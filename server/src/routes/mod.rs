use axum::Router;
use sqlx::PgPool;
pub mod auth_routes;

pub fn create_router(pool: PgPool) -> Router {
    Router::new()
        .merge(auth_routes::auth_routes())
        .with_state(pool)
}
