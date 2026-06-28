use axum::{
    routing::{get, post},
    Router,
};
use sqlx::PgPool;

use crate::handlers::auth_handler;

// Routes publiques : pas besoin d'être connecté
pub fn public_routes() -> Router<PgPool> {
    Router::new()
        .route("/auth/register", post(auth_handler::register))
        .route("/auth/login", post(auth_handler::login))
}

// Routes protégées : token JWT obligatoire
pub fn protected_routes() -> Router<PgPool> {
    Router::new()
        .route("/me", get(auth_handler::me))
        .route("/auth/logout", post(auth_handler::logout))
}