use axum::{middleware, Router};
use sqlx::PgPool;

mod auth_routes;

use crate::middleware::auth_middleware::require_auth;

pub fn create_router(pool: PgPool) -> Router {
    Router::new()
        .merge(auth_routes::auth_routes())
        .route_layer(middleware::from_fn_with_state(
            pool.clone(),
            require_auth,
        ))
        .with_state(pool)
}