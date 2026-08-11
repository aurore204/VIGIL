use axum::{
    body::Bytes,
    extract::{Path, State},
    http::{HeaderMap, StatusCode},
    response::IntoResponse,
    Json,
};
use uuid::Uuid;

use crate::models::response::{ApiError, ApiResponse};
use crate::services::rule_engine_service;
use crate::services::webhook_verify::verify_github_signature;
use crate::state::AppState;

// POST /webhooks/github/:team_id
pub async fn github_webhook(
    State(state): State<AppState>,
    Path(team_id): Path<Uuid>,
    headers: HeaderMap,
    body: Bytes,
) -> impl IntoResponse {
    //  Récupère le secret configuré pour cette team
    let stored_secret =
    match crate::repositories::webhook_repository::get_secret(&state.pool, team_id, "github")
        .await
    {
        Ok(Some(s)) => s,
        Ok(None) => {
            return (
                StatusCode::NOT_FOUND,
                Json(serde_json::json!(ApiError::new(
                    "Aucun webhook GitHub configuré pour cette team",
                    "WEBHOOK_NOT_CONFIGURED"
                ))),
            );
        }
        Err(_) => {
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!(ApiError::new(
                    "Erreur interne",
                    "INTERNAL_ERROR"
                ))),
            );
        }
    };

let (nonce_b64, ciphertext_b64) = match stored_secret.split_once(':') {
    Some(pair) => pair,
    None => {
        tracing::error!("Format de secret invalide en base pour team_id={}", team_id);
        return (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!(ApiError::new(
                "Erreur interne",
                "INTERNAL_ERROR"
            ))),
        );
    }
};

let key = match crate::services::crypto_service::load_encryption_key() {
    Ok(k) => k,
    Err(_) => {
        return (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!(ApiError::new(
                "Erreur de configuration du chiffrement",
                "ENCRYPTION_CONFIG_ERROR"
            ))),
        );
    }
};

let secret = match crate::services::crypto_service::decrypt(ciphertext_b64, nonce_b64, &key) {
    Ok(s) => s,
    Err(_) => {
        tracing::error!("Échec du déchiffrement du secret webhook pour team_id={}", team_id);
        return (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!(ApiError::new(
                "Erreur interne",
                "INTERNAL_ERROR"
            ))),
        );
    }
};

    //  Vérifie la signature HMAC AVANT tout traitement
    let signature = match headers
        .get("X-Hub-Signature-256")
        .and_then(|v| v.to_str().ok())
    {
        Some(sig) => sig,
        None => {
            tracing::warn!(
                "Webhook GitHub reçu sans signature pour team_id={}",
                team_id
            );
            return (
                StatusCode::UNAUTHORIZED,
                Json(serde_json::json!(ApiError::new(
                    "Signature manquante",
                    "MISSING_SIGNATURE"
                ))),
            );
        }
    };

    if verify_github_signature(&body, signature, &secret).is_err() {
        tracing::warn!(
            "Signature invalide sur webhook GitHub pour team_id={}",
            team_id
        );
        return (
            StatusCode::UNAUTHORIZED,
            Json(serde_json::json!(ApiError::new(
                "Signature invalide",
                "INVALID_SIGNATURE"
            ))),
        );
    }

    // Récupère le type d'event GitHub (workflow_run, push, etc.)
    let event_type = headers
        .get("X-GitHub-Event")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("unknown")
        .to_string();

    //  Parse le JSON
    let payload: serde_json::Value = match serde_json::from_slice(&body) {
        Ok(v) => v,
        Err(_) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(serde_json::json!(ApiError::new(
                    "Payload JSON invalide",
                    "INVALID_PAYLOAD"
                ))),
            );
        }
    };

    // Transmet au moteur de règles pour évaluation et déclenchement
    rule_engine_service::process_incoming_event(&state, team_id, "github", &event_type, payload)
        .await;

    (
        StatusCode::OK,
        Json(serde_json::json!(ApiResponse::<()>::success_no_data(
            "Webhook traité avec succès"
        ))),
    )
}
