use axum::{
    extract::{Request, State},
    http::StatusCode,
    middleware::Next,
    response::IntoResponse,
    Json,
};
use sqlx::PgPool;
use uuid::Uuid;

use crate::models::response::ApiError;
use crate::repositories::user_repository;
use crate::services::auth_service::verify_token;

#[derive(Debug, Clone)]
pub struct AuthenticatedUser {
    pub id: Uuid,
}

pub async fn require_auth(
    State(pool): State<PgPool>,
    mut request: Request,
    next: Next,
) -> impl IntoResponse {
    let auth_header = request
        .headers()
        .get("Authorization")
        .and_then(|h| h.to_str().ok());

    let token = match auth_header {
        Some(header) if header.starts_with("Bearer ") => &header[7..],
        _ => {
            return (
                StatusCode::UNAUTHORIZED,
                Json(serde_json::json!(ApiError::new(
                    "Token manquant ou invalide",
                    "MISSING_TOKEN"
                ))),
            )
                .into_response();
        }
    };

    let claims = match verify_token(token) {
        Ok(c) => c,
        Err(_) => {
            return (
                StatusCode::UNAUTHORIZED,
                Json(serde_json::json!(ApiError::new(
                    "Token invalide ou expiré",
                    "INVALID_TOKEN"
                ))),
            )
                .into_response();
        }
    };

    let user_id = match Uuid::parse_str(&claims.sub) {
        Ok(id) => id,
        Err(_) => {
            return (
                StatusCode::UNAUTHORIZED,
                Json(serde_json::json!(ApiError::new(
                    "Token invalide",
                    "INVALID_TOKEN"
                ))),
            )
                .into_response();
        }
    };

    match user_repository::is_token_valid(&pool, user_id, claims.iat).await {
        Ok(true) => {}
        Ok(false) => {
            return (
                StatusCode::UNAUTHORIZED,
                Json(serde_json::json!(ApiError::new(
                    "Token révoqué, veuillez vous reconnecter",
                    "TOKEN_REVOKED"
                ))),
            )
                .into_response();
        }
        Err(_) => {
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!(ApiError::new(
                    "Erreur interne du serveur",
                    "INTERNAL_ERROR"
                ))),
            )
                .into_response();
        }
    }

    request
        .extensions_mut()
        .insert(AuthenticatedUser { id: user_id });
    next.run(request).await
}
