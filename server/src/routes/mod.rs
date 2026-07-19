use axum::{middleware, routing::get, Router};

mod auth_routes;
mod incident_routes;
mod team_routes;
mod reaction_routes;

use crate::middleware::auth_middleware::require_auth;
use crate::state::AppState;
use crate::websocket::handler::ws_handler;

pub fn create_router(state: AppState) -> Router {
    let public_routes = Router::new()
        .merge(auth_routes::public_routes())
        .merge(reaction_routes::public_reaction_routes());


    let protected_routes = Router::new()
        .merge(auth_routes::protected_routes())
        .merge(team_routes::team_routes())
        .merge(incident_routes::incident_routes())
        .merge(reaction_routes::protected_reaction_routes())
        .route("/ws", get(ws_handler))
        .layer(middleware::from_fn_with_state(
            state.pool.clone(),
            require_auth,
        ));

    Router::new()
        .merge(public_routes)
        .merge(protected_routes)
        .with_state(state)
}