use axum::{
    routing::{get, patch, post},
    Router,
};

use crate::handlers::message_handler;
use crate::state::AppState;

pub fn message_routes() -> Router<AppState> {
    Router::new()
        .route("/users/:user_id/messages", post(message_handler::send_message))
        .route("/users/:user_id/messages", get(message_handler::get_conversation))
        .route("/messages/:message_id/read", patch(message_handler::mark_as_read))
}