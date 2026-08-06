use sqlx::PgPool;
use uuid::Uuid;

use crate::models::reaction::Reaction;

// Ajoute une réaction
pub async fn add_reaction(
    pool: &PgPool,
    entry_id: Uuid,
    user_id: Uuid,
    emoji: &str,
) -> Result<Reaction, sqlx::Error> {
    sqlx::query_as!(
        Reaction,
        r#"
        INSERT INTO timeline_reactions (entry_id, user_id, emoji)
        VALUES ($1, $2, $3)
        RETURNING id, entry_id, user_id, emoji, created_at
        "#,
        entry_id,
        user_id,
        emoji
    )
    .fetch_one(pool)
    .await
}

// Retire une réaction
pub async fn remove_reaction(
    pool: &PgPool,
    entry_id: Uuid,
    user_id: Uuid,
    emoji: &str,
) -> Result<(), sqlx::Error> {
    sqlx::query!(
        r#"
        DELETE FROM timeline_reactions
        WHERE entry_id = $1 AND user_id = $2 AND emoji = $3
        "#,
        entry_id,
        user_id,
        emoji
    )
    .execute(pool)
    .await?;
    Ok(())
}

// Vérifie si une réaction existe déjà
pub async fn reaction_exists(
    pool: &PgPool,
    entry_id: Uuid,
    user_id: Uuid,
    emoji: &str,
) -> Result<bool, sqlx::Error> {
    let result = sqlx::query!(
        r#"
        SELECT COUNT(*) as count
        FROM timeline_reactions
        WHERE entry_id = $1 AND user_id = $2 AND emoji = $3
        "#,
        entry_id,
        user_id,
        emoji
    )
    .fetch_one(pool)
    .await?;
    Ok(result.count.unwrap_or(0) > 0)
}

// Récupère toutes les réactions d'une entrée avec les usernames
pub async fn get_reactions_for_entry(
    pool: &PgPool,
    entry_id: Uuid,
) -> Result<Vec<(String, String)>, sqlx::Error> {
    let rows = sqlx::query!(
        r#"
        SELECT tr.emoji, u.username
        FROM timeline_reactions tr
        JOIN users u ON u.id = tr.user_id
        WHERE tr.entry_id = $1
        ORDER BY tr.created_at ASC
        "#,
        entry_id
    )
    .fetch_all(pool)
    .await?;

    Ok(rows.into_iter().map(|r| (r.emoji, r.username)).collect())
}
