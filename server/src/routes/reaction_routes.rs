use axum::{
    routing::{delete, get, post},
    Router,
};

use crate::handlers::reaction_handler;
use crate::state::AppState;

pub fn public_reaction_routes() -> Router<AppState> {
    Router::new().route(
        "/reactions/available",
        get(reaction_handler::get_available_reactions),
    )
}

pub fn protected_reaction_routes() -> Router<AppState> {
    Router::new()
        .route(
            "/incidents/:incident_id/timeline/:entry_id/reactions",
            post(reaction_handler::add_reaction),
        )
        .route(
            "/incidents/:incident_id/timeline/:entry_id/reactions/:emoji",
            delete(reaction_handler::remove_reaction),
        )
}
