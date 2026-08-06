use axum::{
    routing::{get, post},
    Router,
};

use crate::handlers::rule_handler;
use crate::state::AppState;

pub fn rule_routes() -> Router<AppState> {
    Router::new()
        .route(
            "/teams/:team_id/rules",
            get(rule_handler::get_team_rules).post(rule_handler::create_rule),
        )
        .route(
            "/teams/:team_id/webhook-secrets",
            post(rule_handler::create_webhook_secret),
        )
}
