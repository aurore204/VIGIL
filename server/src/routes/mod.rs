use axum::{middleware,routing::get, Router};
use sqlx::PgPool;

mod auth_routes;
mod team_routes;
mod incident_routes;

use crate::middleware::auth_middleware::require_auth;
use crate::websocket::broadcaster::Broadcaster;
use crate::websocket::handler::ws_handler;

pub fn create_router(pool: PgPool, broadcaster: Broadcaster) -> Router {
    // Routes publiques — pas de middleware
    let public_routes = Router::new()
        .merge(auth_routes::public_routes());

    // Routes protégées — middleware require_auth
    let protected_routes = Router::new()
        .merge(auth_routes::protected_routes())
        .merge(team_routes::team_routes())
        .merge(incident_routes::incident_routes())
        .route("/ws", get(ws_handler))
        .layer(middleware::from_fn_with_state(
            pool.clone(),
            require_auth,
        ));

    Router::new()
        .merge(public_routes)
        .merge(protected_routes)
        .with_state(pool)
}