use axum::{
    routing::{get, post},
    Router,
};
use sqlx::PgPool;

use crate::handlers::auth_handler;

pub fn auth_routes() -> Router<PgPool> {
    let protected = Router::new()
        .route("/me", get(auth_handler::me))
        .route("/auth/logout", post(auth_handler::logout));

    let public = Router::new()
        .route("/auth/register", post(auth_handler::register))
        .route("/auth/login", post(auth_handler::login));

    Router::new()
        .merge(public)
        .merge(protected)
}