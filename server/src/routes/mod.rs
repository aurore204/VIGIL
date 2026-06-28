use axum::Router;
use sqlx::PgPool;

pub fn create_router(_pool: PgPool) -> Router {
    Router::new()
}
