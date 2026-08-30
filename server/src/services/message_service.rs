use sqlx::PgPool;
use uuid::Uuid;

use crate::models::message::{PrivateMessageWithUsers, SendMessageRequest, MAX_MESSAGE_LENGTH};
use crate::repositories::message_repository;

#[derive(Debug)]
pub enum MessageError {
    ContentTooLong,
    NoSharedTeam,
    CannotMessageSelf,
    DatabaseError(sqlx::Error),
}

pub async fn send_message(
    pool: &PgPool,
    sender_id: Uuid,
    receiver_id: Uuid,
    req: SendMessageRequest,
) -> Result<PrivateMessageWithUsers, MessageError> {
    if sender_id == receiver_id {
        return Err(MessageError::CannotMessageSelf);
    }

    if req.content.len() > MAX_MESSAGE_LENGTH {
        return Err(MessageError::ContentTooLong);
    }

    let share_team = message_repository::share_team(pool, sender_id, receiver_id)
        .await
        .map_err(MessageError::DatabaseError)?;

    if !share_team {
        return Err(MessageError::NoSharedTeam);
    }

    message_repository::send_message(pool, sender_id, receiver_id, &req.content)
        .await
        .map_err(MessageError::DatabaseError)
}

pub async fn get_conversation(
    pool: &PgPool,
    user_id: Uuid,
    other_user_id: Uuid,
) -> Result<Vec<PrivateMessageWithUsers>, MessageError> {
    let share_team = message_repository::share_team(pool, user_id, other_user_id)
        .await
        .map_err(MessageError::DatabaseError)?;

    if !share_team {
        return Err(MessageError::NoSharedTeam);
    }

    message_repository::get_conversation(pool, user_id, other_user_id)
        .await
        .map_err(MessageError::DatabaseError)
}

pub async fn mark_as_read(
    pool: &PgPool,
    message_id: Uuid,
    user_id: Uuid,
) -> Result<(), MessageError> {
    message_repository::mark_as_read(pool, message_id, user_id)
        .await
        .map_err(MessageError::DatabaseError)
}
