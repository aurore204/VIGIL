use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::IntoResponse,
    Extension, Json,
};
use uuid::Uuid;

use crate::middleware::auth_middleware::AuthenticatedUser;
use crate::models::reaction::AddReactionRequest;
use crate::models::response::{ApiError, ApiResponse};
use crate::repositories::user_repository;
use crate::services::reaction_service::{self, ReactionError};
use crate::state::AppState;
use crate::websocket::events::WsEvent;

// GET /reactions/available
pub async fn get_available_reactions() -> impl IntoResponse {
    let emojis = reaction_service::get_available_emojis();
    (
        StatusCode::OK,
        Json(serde_json::json!(ApiResponse::success(
            "Emojis disponibles",
            emojis
        ))),
    )
}

// POST /incidents/:incident_id/timeline/:entry_id/reactions
pub async fn add_reaction(
    State(state): State<AppState>,
    Extension(auth_user): Extension<AuthenticatedUser>,
    Path((incident_id, entry_id)): Path<(Uuid, Uuid)>,
    Json(req): Json<AddReactionRequest>,
) -> impl IntoResponse {
    let emoji = req.emoji.clone();

    let username = user_repository::find_by_id(&state.pool, auth_user.id)
        .await
        .ok()
        .flatten()
        .map(|u| u.username)
        .unwrap_or_default();

    match reaction_service::add_reaction(&state.pool, entry_id, auth_user.id, req).await {
        Ok(reactions) => {
            state.broadcaster.broadcast(WsEvent::ReactionAdded {
                incident_id,
                entry_id,
                emoji,
                by: username,
            });
            (
                StatusCode::CREATED,
                Json(serde_json::json!(ApiResponse::success(
                    "Réaction ajoutée avec succès",
                    reactions
                ))),
            )
        }
        Err(ReactionError::InvalidEmoji) => (
            StatusCode::BAD_REQUEST,
            Json(serde_json::json!(ApiError::new(
                "Emoji non disponible",
                "INVALID_EMOJI"
            ))),
        ),
        Err(ReactionError::AlreadyReacted) => (
            StatusCode::CONFLICT,
            Json(serde_json::json!(ApiError::new(
                "Vous avez déjà réagi avec cet emoji",
                "ALREADY_REACTED"
            ))),
        ),
        Err(ReactionError::NotMember) => (
            StatusCode::FORBIDDEN,
            Json(serde_json::json!(ApiError::new(
                "Vous n'êtes pas membre de cette team",
                "NOT_MEMBER"
            ))),
        ),
        Err(ReactionError::EntryNotFound) => (
            StatusCode::NOT_FOUND,
            Json(serde_json::json!(ApiError::new(
                "Entrée de timeline introuvable",
                "ENTRY_NOT_FOUND"
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

// DELETE /incidents/:incident_id/timeline/:entry_id/reactions/:emoji
pub async fn remove_reaction(
    State(state): State<AppState>,
    Extension(auth_user): Extension<AuthenticatedUser>,
    Path((incident_id, entry_id, emoji)): Path<(Uuid, Uuid, String)>,
) -> impl IntoResponse {
    let username = user_repository::find_by_id(&state.pool, auth_user.id)
        .await
        .ok()
        .flatten()
        .map(|u| u.username)
        .unwrap_or_default();

    match reaction_service::remove_reaction(&state.pool, entry_id, auth_user.id, &emoji).await {
        Ok(reactions) => {
            state.broadcaster.broadcast(WsEvent::ReactionRemoved {
                incident_id,
                entry_id,
                emoji,
                by: username,
            });
            (
                StatusCode::OK,
                Json(serde_json::json!(ApiResponse::success(
                    "Réaction retirée avec succès",
                    reactions
                ))),
            )
        }
        Err(ReactionError::InvalidEmoji) => (
            StatusCode::BAD_REQUEST,
            Json(serde_json::json!(ApiError::new(
                "Emoji non disponible",
                "INVALID_EMOJI"
            ))),
        ),
        Err(ReactionError::NotReacted) => (
            StatusCode::NOT_FOUND,
            Json(serde_json::json!(ApiError::new(
                "Vous n'avez pas réagi avec cet emoji",
                "NOT_REACTED"
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