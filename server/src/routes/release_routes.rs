use axum::{
    routing::{get, patch, post},
    Router,
};

use crate::handlers::release_handler;
use crate::state::AppState;

pub fn release_routes() -> Router<AppState> {
    Router::new()
        .route(
            "/teams/:team_id/releases",
            post(release_handler::create_release),
        )
        .route(
            "/teams/:team_id/releases",
            get(release_handler::get_team_releases),
        )
        .route("/releases/:release_id", get(release_handler::get_release))
        .route(
            "/releases/:release_id/start",
            patch(release_handler::start_release),
        )
        .route(
            "/releases/:release_id/cancel",
            patch(release_handler::cancel_release),
        )
        .route(
            "/releases/:release_id/steps/:step_id/validate",
            patch(release_handler::validate_step),
        )
        .route(
            "/releases/:release_id/incidents/:incident_id",
            post(release_handler::link_incident),
        )
}
