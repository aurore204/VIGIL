use axum::{
    extract::{Request, State},
    http::StatusCode,
    middleware::Next,
    response::IntoResponse,
    Json,
};
use sqlx::PgPool;
use uuid::Uuid;

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
    // Récupérer le header Authorization
    let auth_header = request
        .headers()
        .get("Authorization")
        .and_then(|h| h.to_str().ok());

    let token = match auth_header {
        Some(header) if header.starts_with("Bearer ") => &header[7..],
        _ => {
            return (
                StatusCode::UNAUTHORIZED,
                Json(serde_json::json!({
                    "error": "Token manquant ou invalide"
                })),
            )
                .into_response();
        }
    };

    // Vérifier et décoder le token
    let claims = match verify_token(token) {
        Ok(c) => c,
        Err(_) => {
            return (
                StatusCode::UNAUTHORIZED,
                Json(serde_json::json!({
                    "error": "Token invalide ou expiré"
                })),
            )
                .into_response();
        }
    };

    // Parser l'id utilisateur
    let user_id = match Uuid::parse_str(&claims.sub) {
        Ok(id) => id,
        Err(_) => {
            return (
                StatusCode::UNAUTHORIZED,
                Json(serde_json::json!({
                    "error": "Token invalide"
                })),
            )
                .into_response();
        }
    };

    // Vérifier que le token n'a pas été invalidé par un logout
    match user_repository::is_token_valid(&pool, user_id, claims.iat).await {
        Ok(true) => {}
        Ok(false) => {
            return (
                StatusCode::UNAUTHORIZED,
                Json(serde_json::json!({
                    "error": "Token révoqué, veuillez vous reconnecter"
                })),
            )
                .into_response();
        }
        Err(_) => {
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({
                    "error": "Erreur interne du serveur"
                })),
            )
                .into_response();
        }
    }

    // Injecter l'utilisateur dans les extensions de la requête
    request.extensions_mut().insert(AuthenticatedUser { id: user_id });
    next.run(request).await
}