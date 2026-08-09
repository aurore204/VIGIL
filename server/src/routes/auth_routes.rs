use axum::{
    routing::{get, post},
    Router,
};

use crate::handlers::auth_handler;
use crate::state::AppState;

pub fn public_routes() -> Router<AppState> {
    Router::new()
        .route("/auth/register", post(auth_handler::register))
        .route("/auth/login", post(auth_handler::login))
}

pub fn protected_routes() -> Router<AppState> {
    Router::new()
        .route(
            "/me",
            get(auth_handler::me).patch(auth_handler::update_profile),
        )
        .route("/auth/logout", post(auth_handler::logout))
}