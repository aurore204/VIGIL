use axum::{extract::State, http::StatusCode, response::IntoResponse, Extension, Json};

use crate::middleware::auth_middleware::AuthenticatedUser;
use crate::models::response::{ApiError, ApiResponse};
use crate::models::token::{ConnectedServicesResponse, SaveTokenRequest};
use crate::services::token_service;
use crate::state::AppState;

// POST /me/tokens
pub async fn save_token(
    State(state): State<AppState>,
    Extension(auth_user): Extension<AuthenticatedUser>,
    Json(req): Json<SaveTokenRequest>,
) -> impl IntoResponse {
    match token_service::save_token(
        &state.pool, auth_user.id, &req.service_name, &req.token_type, &req.access_token,
    ).await {
        Ok(_) => (
            StatusCode::CREATED,
            Json(serde_json::json!(ApiResponse::<()>::success_no_data("Token enregistré avec succès"))),
        ),
        Err(_) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!(ApiError::new("Erreur lors de l'enregistrement du token", "TOKEN_SAVE_ERROR"))),
        ),
    }
}

// GET /me/tokens
pub async fn list_connected_services(
    State(state): State<AppState>,
    Extension(auth_user): Extension<AuthenticatedUser>,
) -> impl IntoResponse {
    match token_service::list_connected_services(&state.pool, auth_user.id).await {
        Ok(services) => (
            StatusCode::OK,
            Json(serde_json::json!(ApiResponse::success(
                "Services connectés récupérés",
                ConnectedServicesResponse { services }
            ))),
        ),
        Err(_) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!(ApiError::new("Erreur interne", "INTERNAL_ERROR"))),
        ),
    }
}