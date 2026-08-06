use axum::{middleware, routing::get, Router};

mod auth_routes;
mod incident_routes;
mod message_routes;
mod reaction_routes;
mod release_routes;
mod rule_routes;
mod team_routes;
mod token_routes;
mod webhook_routes;

use crate::handlers::about_handler;
use crate::middleware::auth_middleware::require_auth;
use crate::state::AppState;
use crate::websocket::handler::{get_online_users, ws_handler};

pub fn create_router(state: AppState) -> Router {
    let public_routes = Router::new()
        .merge(auth_routes::public_routes())
        .merge(reaction_routes::public_reaction_routes())
        .merge(webhook_routes::webhook_routes())
        .merge(rule_routes::rule_routes());

    let protected_routes = Router::new()
        .merge(auth_routes::protected_routes())
        .merge(team_routes::team_routes())
        .merge(incident_routes::incident_routes())
        .merge(reaction_routes::protected_reaction_routes())
        .merge(message_routes::message_routes())
        .merge(release_routes::release_routes())
        .merge(token_routes::token_routes())
        .route("/presence/online", get(get_online_users))
        .layer(middleware::from_fn_with_state(
            state.pool.clone(),
            require_auth,
        ));

    // La route WS sort de protected_routes : elle gère sa propre auth
    let ws_routes = Router::new()
        .route("/ws", get(ws_handler))
        .route("/about.json", get(about_handler::get_about));

    Router::new()
        .merge(public_routes)
        .merge(protected_routes)
        .merge(ws_routes)
        .with_state(state)
}
