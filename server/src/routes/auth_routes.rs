use axum::{routing::post, Router};
use sqlx::PgPool;

use crate::handlers::auth_handler;

pub fn auth_routes() -> Router<PgPool> {
    Router::new()
        .route("/auth/register", post(auth_handler::register))
        .route("/auth/login", post(auth_handler::login))
}