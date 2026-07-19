use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::IntoResponse,
    Extension, Json,
};
use uuid::Uuid;

use crate::middleware::auth_middleware::AuthenticatedUser;
use crate::models::message::SendMessageRequest;
use crate::models::response::{ApiError, ApiResponse};
use crate::repositories::user_repository;
use crate::services::message_service::{self, MessageError};
use crate::state::AppState;
use crate::websocket::events::WsEvent;

// POST /users/:user_id/messages
pub async fn send_message(
    State(state): State<AppState>,
    Extension(auth_user): Extension<AuthenticatedUser>,
    Path(receiver_id): Path<Uuid>,
    Json(req): Json<SendMessageRequest>,
) -> impl IntoResponse {
    match message_service::send_message(&state.pool, auth_user.id, receiver_id, req).await {
        Ok(message) => {
            let receiver_username = user_repository::find_by_id(&state.pool, receiver_id)
                .await
                .ok()
                .flatten()
                .map(|u| u.username)
                .unwrap_or_default();

            let sender_username = message.sender_username.clone();

            state.broadcaster.broadcast(WsEvent::PrivateMessageReceived {
                from: sender_username,
                to: receiver_username,
                content: message.content.clone(),
                at: message.created_at,
            });

            (
                StatusCode::CREATED,
                Json(serde_json::json!(ApiResponse::success(
                    "Message envoyé avec succès",
                    message
                ))),
            )
        }
        Err(MessageError::ContentTooLong) => (
            StatusCode::BAD_REQUEST,
            Json(serde_json::json!(ApiError::new(
                "Le message ne peut pas dépasser 2000 caractères",
                "CONTENT_TOO_LONG"
            ))),
        ),
        Err(MessageError::NoSharedTeam) => (
            StatusCode::FORBIDDEN,
            Json(serde_json::json!(ApiError::new(
                "Vous ne partagez aucune team avec cet utilisateur",
                "NO_SHARED_TEAM"
            ))),
        ),
        Err(MessageError::CannotMessageSelf) => (
            StatusCode::BAD_REQUEST,
            Json(serde_json::json!(ApiError::new(
                "Vous ne pouvez pas vous envoyer un message à vous-même",
                "CANNOT_MESSAGE_SELF"
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

// GET /users/:user_id/messages
pub async fn get_conversation(
    State(state): State<AppState>,
    Extension(auth_user): Extension<AuthenticatedUser>,
    Path(other_user_id): Path<Uuid>,
) -> impl IntoResponse {
    match message_service::get_conversation(&state.pool, auth_user.id, other_user_id).await {
        Ok(messages) => (
            StatusCode::OK,
            Json(serde_json::json!(ApiResponse::success(
                "Conversation récupérée avec succès",
                messages
            ))),
        ),
        Err(MessageError::NoSharedTeam) => (
            StatusCode::FORBIDDEN,
            Json(serde_json::json!(ApiError::new(
                "Vous ne partagez aucune team avec cet utilisateur",
                "NO_SHARED_TEAM"
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

// PATCH /messages/:message_id/read
pub async fn mark_as_read(
    State(state): State<AppState>,
    Extension(auth_user): Extension<AuthenticatedUser>,
    Path(message_id): Path<Uuid>,
) -> impl IntoResponse {
    match message_service::mark_as_read(&state.pool, message_id, auth_user.id).await {
        Ok(_) => (
            StatusCode::OK,
            Json(serde_json::json!(ApiResponse::<()>::success_no_data(
                "Message marqué comme lu"
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