use sqlx::PgPool;
use crate::websocket::broadcaster::Broadcaster;

#[derive(Clone)]
pub struct AppState {
    pub pool: PgPool,
    pub broadcaster: Broadcaster,
}

impl AppState {
    pub fn new(pool: PgPool, broadcaster: Broadcaster) -> Self {
        Self { pool, broadcaster }
    }
}