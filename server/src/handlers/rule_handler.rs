use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::IntoResponse,
    Extension, Json,
};
use uuid::Uuid;

use crate::middleware::auth_middleware::AuthenticatedUser;
use crate::models::response::{ApiError, ApiResponse};
use crate::models::rule::CreateRuleRequest;
use crate::services::rule_service::{self, RuleError};
use crate::state::AppState;

// POST /teams/:team_id/rules
pub async fn create_rule(
    State(state): State<AppState>,
    Extension(auth_user): Extension<AuthenticatedUser>,
    Path(team_id): Path<Uuid>,
    Json(req): Json<CreateRuleRequest>,
) -> impl IntoResponse {
    match rule_service::create_rule(&state.pool, team_id, auth_user.id, req).await {
        Ok(rule) => (
            StatusCode::CREATED,
            Json(serde_json::json!(ApiResponse::success(
                "Règle crée avec succès",
                rule
            ))),
        ),
        Err(RuleError::NotMember) => (
            StatusCode::FORBIDDEN,
            Json(serde_json::json!(ApiError::new(
                "Vous n'êtes pas membre de cette team",
                "NOT_MEMBER"
            ))),
        ),
        Err(RuleError::NotManager) => (
            StatusCode::FORBIDDEN,
            Json(serde_json::json!(ApiError::new(
                "Seul le Manager peut créer une règle",
                "NOT_MANAGER"
            ))),
        ),
        Err(_) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!(ApiError::new(
                "Erreur interne du serveur",
                "INTERNAL_ERROR"
            ))),
        ),
    }
}

// GET /teams/:team_id/rules
pub async fn get_team_rules(
    State(state): State<AppState>,
    Extension(auth_user): Extension<AuthenticatedUser>,
    Path(team_id): Path<Uuid>,
) -> impl IntoResponse {
    match rule_service::get_team_rules(&state.pool, team_id, auth_user.id).await {
        Ok(rules) => (
            StatusCode::OK,
            Json(serde_json::json!(ApiResponse::success(
                "Règles récupérées avec succès",
                rules
            ))),
        ),
        Err(RuleError::NotMember) => (
            StatusCode::FORBIDDEN,
            Json(serde_json::json!(ApiError::new(
                "Vous n'êtes pas membre de cette team",
                "NOT_MEMBER"
            ))),
        ),
        Err(_) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!(ApiError::new(
                "Erreur interne du serveur",
                "INTERNAL_ERROR"
            ))),
        ),
    }
}

#[derive(Debug, serde::Deserialize)]
pub struct CreateWebhookSecretRequest {
    pub service_name: String,
    pub secret: String,
}

// POST /teams/:team_id/webhook-secrets
pub async fn create_webhook_secret(
    State(state): State<AppState>,
    Extension(auth_user): Extension<AuthenticatedUser>,
    Path(team_id): Path<Uuid>,
    Json(req): Json<CreateWebhookSecretRequest>,
) -> impl IntoResponse {
    let role = match crate::repositories::team_repository::get_member_role(
        &state.pool,
        team_id,
        auth_user.id,
    )
    .await
    {
        Ok(Some(r)) => r,
        _ => {
            return (
                StatusCode::FORBIDDEN,
                Json(serde_json::json!(ApiError::new(
                    "Accès refusé",
                    "FORBIDDEN"
                ))),
            );
        }
    };

    if role != crate::models::team::TeamRole::Manager {
        return (
            StatusCode::FORBIDDEN,
            Json(serde_json::json!(ApiError::new(
                "Seul le Manager peut configurer un webhook",
                "NOT_MANAGER"
            ))),
        );
    }

    match crate::repositories::webhook_repository::upsert_secret(
        &state.pool,
        team_id,
        &req.service_name,
        &req.secret,
    )
    .await
    {
        Ok(_) => (
            StatusCode::CREATED,
            Json(serde_json::json!(ApiResponse::<()>::success_no_data(
                "Secret webhook configuré"
            ))),
        ),
        Err(_) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!(ApiError::new(
                "Erreur interne",
                "INTERNAL_ERROR"
            ))),
        ),
    }
}
