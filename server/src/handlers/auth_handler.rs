use axum::{
    extract::State,
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use sqlx::PgPool;

use crate::models::user::{LoginRequest, RegisterRequest};
use crate::services::auth_service::{self, AuthError};

// POST /auth/register
pub async fn register(
    State(pool): State<PgPool>,
    Json(req): Json<RegisterRequest>,
) -> impl IntoResponse {
    match auth_service::register(&pool, req).await {
        Ok(response) => (StatusCode::CREATED, Json(serde_json::json!(response))),
        Err(AuthError::EmailAlreadyExists) => (
            StatusCode::CONFLICT,
            Json(serde_json::json!({
                "error": "Un compte avec cet email existe déjà"
            })),
        ),
        Err(AuthError::HashError) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({
                "error": "Erreur lors du hashage du mot de passe"
            })),
        ),
        Err(_) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({
                "error": "Erreur interne du serveur"
            })),
        ),
    }
}

// POST /auth/login
pub async fn login(
    State(pool): State<PgPool>,
    Json(req): Json<LoginRequest>,
) -> impl IntoResponse {
    match auth_service::login(&pool, req).await {
        Ok(response) => (StatusCode::OK, Json(serde_json::json!(response))),
        Err(AuthError::InvalidCredentials) => (
            StatusCode::UNAUTHORIZED,
            Json(serde_json::json!({
                "error": "Email ou mot de passe incorrect"
            })),
        ),
        Err(_) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({
                "error": "Erreur interne du serveur"
            })),
        ),
    }
}