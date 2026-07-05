use axum::{
    extract::State,
    http::StatusCode,
    response::IntoResponse,
    Extension, Json,
};
use sqlx::PgPool;

use crate::middleware::auth_middleware::AuthenticatedUser;
use crate::models::response::{ApiError, ApiResponse};
use crate::models::user::{LoginRequest, RegisterRequest};
use crate::repositories::user_repository;
use crate::services::auth_service::{self, AuthError};

// POST /auth/register
pub async fn register(
    State(pool): State<PgPool>,
    Json(req): Json<RegisterRequest>,
) -> impl IntoResponse {
    match auth_service::register(&pool, req).await {
        Ok(response) => (
            StatusCode::CREATED,
            Json(serde_json::json!(ApiResponse::success(
                "Inscription réussie",
                response
            ))),
        ),
        Err(AuthError::EmailAlreadyExists) => (
            StatusCode::CONFLICT,
            Json(serde_json::json!(ApiError::new(
                "Un compte avec cet email existe déjà",
                "EMAIL_ALREADY_EXISTS"
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

// POST /auth/login
pub async fn login(
    State(pool): State<PgPool>,
    Json(req): Json<LoginRequest>,
) -> impl IntoResponse {
    match auth_service::login(&pool, req).await {
        Ok(response) => (
            StatusCode::OK,
            Json(serde_json::json!(ApiResponse::success(
                "Connexion réussie",
                response
            ))),
        ),
        Err(AuthError::InvalidCredentials) => (
            StatusCode::UNAUTHORIZED,
            Json(serde_json::json!(ApiError::new(
                "Email ou mot de passe incorrect",
                "INVALID_CREDENTIALS"
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

// GET /me
pub async fn me(
    State(pool): State<PgPool>,
    Extension(auth_user): Extension<AuthenticatedUser>,
) -> impl IntoResponse {
    match user_repository::find_by_id(&pool, auth_user.id).await {
        Ok(Some(user)) => (
            StatusCode::OK,
            Json(serde_json::json!(ApiResponse::success(
                "Utilisateur récupéré avec succès",
                user
            ))),
        ),
        Ok(None) => (
            StatusCode::NOT_FOUND,
            Json(serde_json::json!(ApiError::new(
                "Utilisateur non trouvé",
                "USER_NOT_FOUND"
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

// POST /auth/logout
pub async fn logout(
    State(pool): State<PgPool>,
    Extension(auth_user): Extension<AuthenticatedUser>,
) -> impl IntoResponse {
    match auth_service::logout(&pool, auth_user.id).await {
        Ok(_) => (
            StatusCode::OK,
            Json(serde_json::json!(ApiResponse::<()>::success_no_data(
                "Déconnexion réussie"
            ))),
        ),
        Err(_) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!(ApiError::new(
                "Erreur lors de la déconnexion",
                "LOGOUT_ERROR"
            ))),
        ),
    }
}