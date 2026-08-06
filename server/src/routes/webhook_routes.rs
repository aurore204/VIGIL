use axum::{routing::post, Router};

use crate::handlers::webhook_handler;
use crate::state::AppState;

pub fn webhook_routes() -> Router<AppState> {
    Router::new().route(
        "/webhooks/github/:team_id",
        post(webhook_handler::github_webhook),
    )
}
