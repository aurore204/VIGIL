use axum::{middleware, Router};
use sqlx::PgPool;

mod auth_routes;

use crate::middleware::auth_middleware::require_auth;

pub fn create_router(pool: PgPool) -> Router {
    // Routes publiques — pas de middleware
    let public_routes = Router::new()
        .merge(auth_routes::public_routes());

    // Routes protégées — middleware require_auth
    let protected_routes = Router::new()
        .merge(auth_routes::protected_routes())
        .layer(middleware::from_fn_with_state(
            pool.clone(),
            require_auth,
        ));

    Router::new()
        .merge(public_routes)
        .merge(protected_routes)
        .with_state(pool)
}