use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

pub const MAX_MESSAGE_LENGTH: usize = 2000;

#[derive(Debug, Serialize, Deserialize, Clone, sqlx::FromRow)]
pub struct PrivateMessage {
    pub id: Uuid,
    pub sender_id: Uuid,
    pub receiver_id: Uuid,
    pub content: String,
    pub read_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, Deserialize, Clone, sqlx::FromRow)]
pub struct PrivateMessageWithUsers {
    pub id: Uuid,
    pub sender_id: Uuid,
    pub sender_username: String,
    pub receiver_id: Uuid,
    pub receiver_username: String,
    pub content: String,
    pub read_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
pub struct SendMessageRequest {
    pub content: String,
}