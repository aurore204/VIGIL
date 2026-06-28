use axum::{
    extract::{Request, State},
    http::StatusCode,
    middleware::Next,
    response::IntoResponse,
    Json,
};
use sqlx::PgPool;
use uuid::Uuid;

use crate::services::auth_service::verify_token;

// Structure qui représente l'utilisateur connecté,
// injectée dans les handlers protégés
#[derive(Debug, Clone)]
pub struct AuthenticatedUser {
    pub id: Uuid,
}

// Middleware qui vérifie le token JWT sur les routes protégées
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
    match verify_token(token) {
        Ok(claims) => {
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

            // Injecter l'utilisateur dans les extensions de la requête
            request.extensions_mut().insert(AuthenticatedUser { id: user_id });
            next.run(request).await
        }
        Err(_) => (
            StatusCode::UNAUTHORIZED,
            Json(serde_json::json!({
                "error": "Token invalide ou expiré"
            })),
        )
            .into_response(),
    }
}