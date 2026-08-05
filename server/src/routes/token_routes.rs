use axum::{routing::{get, post}, Router};

use crate::handlers::token_handler;
use crate::state::AppState;

pub fn token_routes() -> Router<AppState> {
    Router::new()
        .route("/me/tokens", post(token_handler::save_token))
        .route("/me/tokens", get(token_handler::list_connected_services))
}