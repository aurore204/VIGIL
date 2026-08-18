use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::IntoResponse,
    Extension, Json,
};
use uuid::Uuid;

use crate::middleware::auth_middleware::AuthenticatedUser;
use crate::models::release::CreateReleaseRequest;
use crate::models::response::{ApiError, ApiResponse};
use crate::repositories::user_repository;
use crate::services::release_service::{self, ReleaseError};
use crate::state::AppState;
use crate::websocket::events::WsEvent;

// POST /teams/:team_id/releases
pub async fn create_release(
    State(state): State<AppState>,
    Extension(auth_user): Extension<AuthenticatedUser>,
    Path(team_id): Path<Uuid>,
    Json(req): Json<CreateReleaseRequest>,
) -> impl IntoResponse {
    let title = req.title.clone();
    match release_service::create_release(&state.pool, team_id, auth_user.id, req).await {
        Ok(release) => (
            StatusCode::CREATED,
            Json(serde_json::json!(ApiResponse::success(
                &format!("Release '{}' crée avec succès", title),
                release
            ))),
        ),
        Err(ReleaseError::NotMember) => (
            StatusCode::FORBIDDEN,
            Json(serde_json::json!(ApiError::new(
                "Vous n'êtes pas membre de cette team",
                "NOT_MEMBER"
            ))),
        ),
        Err(ReleaseError::Forbidden) => (
            StatusCode::FORBIDDEN,
            Json(serde_json::json!(ApiError::new(
                "Seul le Manager peut créer une release",
                "NOT_MANAGER"
            ))),
        ),
        Err(ReleaseError::NoSteps) => (
            StatusCode::BAD_REQUEST,
            Json(serde_json::json!(ApiError::new(
                "Une release doit avoir au moins une étape",
                "NO_STEPS"
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

// GET /teams/:team_id/releases
pub async fn get_team_releases(
    State(state): State<AppState>,
    Extension(auth_user): Extension<AuthenticatedUser>,
    Path(team_id): Path<Uuid>,
) -> impl IntoResponse {
    match release_service::get_team_releases(&state.pool, team_id, auth_user.id).await {
        Ok(releases) => (
            StatusCode::OK,
            Json(serde_json::json!(ApiResponse::success(
                "Releases récupérées avec succès",
                releases
            ))),
        ),
        Err(ReleaseError::NotMember) => (
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

// GET /releases/:release_id
pub async fn get_release(
    State(state): State<AppState>,
    Extension(auth_user): Extension<AuthenticatedUser>,
    Path(release_id): Path<Uuid>,
) -> impl IntoResponse {
    match release_service::get_release(&state.pool, release_id, auth_user.id).await {
        Ok(release) => (
            StatusCode::OK,
            Json(serde_json::json!(ApiResponse::success(
                "Release récupérée avec succès",
                release
            ))),
        ),
        Err(ReleaseError::ReleaseNotFound) => (
            StatusCode::NOT_FOUND,
            Json(serde_json::json!(ApiError::new(
                "Release introuvable",
                "RELEASE_NOT_FOUND"
            ))),
        ),
        Err(ReleaseError::NotMember) => (
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

// PATCH /releases/:release_id/start
pub async fn start_release(
    State(state): State<AppState>,
    Extension(auth_user): Extension<AuthenticatedUser>,
    Path(release_id): Path<Uuid>,
) -> impl IntoResponse {
    match release_service::start_release(&state.pool, release_id, auth_user.id).await {
        Ok(release) => {
            state.broadcaster.broadcast(WsEvent::ReleaseStateChanged {
                release_id,
                new_state: "in_progress".to_string(),
                by: None,
            });
            (
                StatusCode::OK,
                Json(serde_json::json!(ApiResponse::success(
                    "Release démarrée avec succès",
                    release
                ))),
            )
        }
        Err(ReleaseError::ReleaseNotFound) => (
            StatusCode::NOT_FOUND,
            Json(serde_json::json!(ApiError::new(
                "Release introuvable",
                "RELEASE_NOT_FOUND"
            ))),
        ),
        Err(ReleaseError::Forbidden) => (
            StatusCode::FORBIDDEN,
            Json(serde_json::json!(ApiError::new(
                "Seul le Manager peut démarrer une release",
                "NOT_MANAGER"
            ))),
        ),
        Err(ReleaseError::InvalidStateTransition) => (
            StatusCode::BAD_REQUEST,
            Json(serde_json::json!(ApiError::new(
                "La release ne peut pas être démarrée dans son état actuel",
                "INVALID_STATE_TRANSITION"
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

// PATCH /releases/:release_id/steps/:step_id/validate
pub async fn validate_step(
    State(state): State<AppState>,
    Extension(auth_user): Extension<AuthenticatedUser>,
    Path((release_id, step_id)): Path<(Uuid, Uuid)>,
) -> impl IntoResponse {
    let username = user_repository::find_by_id(&state.pool, auth_user.id)
        .await
        .ok()
        .flatten()
        .map(|u| u.username)
        .unwrap_or_default();

    match release_service::validate_step(&state.pool, release_id, step_id, auth_user.id).await {
        Ok(release) => {
            let step_name = release
                .steps
                .iter()
                .find(|s| s.id == step_id)
                .map(|s| s.name.clone())
                .unwrap_or_default();

            state.broadcaster.broadcast(WsEvent::ReleaseStepValidated {
                release_id,
                step: step_name,
                by: username,
            });

            if release.state == crate::models::release::ReleaseState::Completed {
                state.broadcaster.broadcast(WsEvent::ReleaseStateChanged {
                    release_id,
                    new_state: "completed".to_string(),
                    by: None,
                });
            }

            (
                StatusCode::OK,
                Json(serde_json::json!(ApiResponse::success(
                    "Étape validée avec succès",
                    release
                ))),
            )
        }
        Err(ReleaseError::ReleaseNotFound) => (
            StatusCode::NOT_FOUND,
            Json(serde_json::json!(ApiError::new(
                "Release introuvable",
                "RELEASE_NOT_FOUND"
            ))),
        ),
        Err(ReleaseError::StepNotFound) => (
            StatusCode::NOT_FOUND,
            Json(serde_json::json!(ApiError::new(
                "Étape introuvable",
                "STEP_NOT_FOUND"
            ))),
        ),
        Err(ReleaseError::StepNotAvailable) => (
            StatusCode::BAD_REQUEST,
            Json(serde_json::json!(ApiError::new(
                "Les étapes précédentes doivent être validées d'abord",
                "STEP_NOT_AVAILABLE"
            ))),
        ),
        Err(ReleaseError::ReleaseBlocked) => (
            StatusCode::BAD_REQUEST,
            Json(serde_json::json!(ApiError::new(
                "La release est bloquée par un incident actif",
                "RELEASE_BLOCKED"
            ))),
        ),
        Err(ReleaseError::Forbidden) => (
            StatusCode::FORBIDDEN,
            Json(serde_json::json!(ApiError::new(
                "Les Observers ne peuvent pas valider une étape",
                "FORBIDDEN"
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

// PATCH /releases/:release_id/cancel
pub async fn cancel_release(
    State(state): State<AppState>,
    Extension(auth_user): Extension<AuthenticatedUser>,
    Path(release_id): Path<Uuid>,
) -> impl IntoResponse {
    match release_service::cancel_release(&state.pool, release_id, auth_user.id).await {
        Ok(_) => {
            state.broadcaster.broadcast(WsEvent::ReleaseStateChanged {
                release_id,
                new_state: "cancelled".to_string(),
                by: None,
            });
            (
                StatusCode::OK,
                Json(serde_json::json!(ApiResponse::<()>::success_no_data(
                    "Release annulée avec succès"
                ))),
            )
        }
        Err(ReleaseError::ReleaseNotFound) => (
            StatusCode::NOT_FOUND,
            Json(serde_json::json!(ApiError::new(
                "Release introuvable",
                "RELEASE_NOT_FOUND"
            ))),
        ),
        Err(ReleaseError::Forbidden) => (
            StatusCode::FORBIDDEN,
            Json(serde_json::json!(ApiError::new(
                "Seul le Manager peut annuler une release",
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

// POST /releases/:release_id/incidents/:incident_id
pub async fn link_incident(
    State(state): State<AppState>,
    Extension(auth_user): Extension<AuthenticatedUser>,
    Path((release_id, incident_id)): Path<(Uuid, Uuid)>,
) -> impl IntoResponse {
    let username = user_repository::find_by_id(&state.pool, auth_user.id)
        .await
        .ok()
        .flatten()
        .map(|u| u.username)
        .unwrap_or_default();

    match release_service::block_release_if_needed(&state.pool, release_id, incident_id).await {
        Ok(blocked) => {
            if blocked {
                state.broadcaster.broadcast(WsEvent::ReleaseStateChanged {
                    release_id,
                    new_state: "blocked".to_string(),
                    by: Some(username),
                });
            }
            (
                StatusCode::OK,
                Json(serde_json::json!(ApiResponse::<()>::success_no_data(
                    if blocked {
                        "Release bloquée par l'incident"
                    } else {
                        "Incident lié à la release"
                    }
                ))),
            )
        }
        Err(_) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!(ApiError::new(
                "Erreur interne du serveur",
                "INTERNAL_ERROR"
            ))),
        ),
    }
}
