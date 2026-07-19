use sqlx::PgPool;
use uuid::Uuid;

use crate::models::message::PrivateMessageWithUsers;

pub async fn send_message(
    pool: &PgPool,
    sender_id: Uuid,
    receiver_id: Uuid,
    content: &str,
) -> Result<PrivateMessageWithUsers, sqlx::Error> {
    sqlx::query_as!(
        PrivateMessageWithUsers,
        r#"
        INSERT INTO private_messages (sender_id, receiver_id, content)
        VALUES ($1, $2, $3)
        RETURNING
            id,
            sender_id,
            (SELECT username FROM users WHERE id = sender_id) as "sender_username!",
            receiver_id,
            (SELECT username FROM users WHERE id = receiver_id) as "receiver_username!",
            content,
            read_at,
            created_at
        "#,
        sender_id,
        receiver_id,
        content
    )
    .fetch_one(pool)
    .await
}

pub async fn get_conversation(
    pool: &PgPool,
    user1_id: Uuid,
    user2_id: Uuid,
) -> Result<Vec<PrivateMessageWithUsers>, sqlx::Error> {
    sqlx::query_as!(
        PrivateMessageWithUsers,
        r#"
        SELECT
            pm.id,
            pm.sender_id,
            s.username as "sender_username!",
            pm.receiver_id,
            r.username as "receiver_username!",
            pm.content,
            pm.read_at,
            pm.created_at
        FROM private_messages pm
        JOIN users s ON s.id = pm.sender_id
        JOIN users r ON r.id = pm.receiver_id
        WHERE (pm.sender_id = $1 AND pm.receiver_id = $2)
           OR (pm.sender_id = $2 AND pm.receiver_id = $1)
        ORDER BY pm.created_at ASC
        "#,
        user1_id,
        user2_id
    )
    .fetch_all(pool)
    .await
}

pub async fn mark_as_read(
    pool: &PgPool,
    message_id: Uuid,
    user_id: Uuid,
) -> Result<(), sqlx::Error> {
    sqlx::query!(
        r#"
        UPDATE private_messages
        SET read_at = NOW()
        WHERE id = $1 AND receiver_id = $2 AND read_at IS NULL
        "#,
        message_id,
        user_id
    )
    .execute(pool)
    .await?;
    Ok(())
}

pub async fn share_team(
    pool: &PgPool,
    user1_id: Uuid,
    user2_id: Uuid,
) -> Result<bool, sqlx::Error> {
    let result = sqlx::query!(
        r#"
        SELECT COUNT(*) as count
        FROM team_members tm1
        JOIN team_members tm2 ON tm1.team_id = tm2.team_id
        WHERE tm1.user_id = $1 AND tm2.user_id = $2
        "#,
        user1_id,
        user2_id
    )
    .fetch_one(pool)
    .await?;

    Ok(result.count.unwrap_or(0) > 0)
}