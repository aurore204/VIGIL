use chrono::Utc;
use sqlx::PgPool;
use uuid::Uuid;

use crate::models::user::{User, UserPublic};

// Crée un nouvel utilisateur en base
pub async fn create_user(
    pool: &PgPool,
    email: &str,
    username: &str,
    password_hash: &str,
) -> Result<UserPublic, sqlx::Error> {
    let user = sqlx::query_as!(
        UserPublic,
        r#"
        INSERT INTO users (email, username, password_hash)
        VALUES ($1, $2, $3)
        RETURNING id, email, username, language, created_at
        "#,
        email,
        username,
        password_hash
    )
    .fetch_one(pool)
    .await?;

    Ok(user)
}

// Trouve un utilisateur par son email
pub async fn find_by_email(
    pool: &PgPool,
    email: &str,
) -> Result<Option<User>, sqlx::Error> {
    let user = sqlx::query_as!(
        User,
        r#"
        SELECT id, email, password_hash, username, language,
               token_invalidated_at, created_at, updated_at
        FROM users
        WHERE email = $1
        "#,
        email
    )
    .fetch_optional(pool)
    .await?;

    Ok(user)
}

// Trouve un utilisateur par son id
pub async fn find_by_id(
    pool: &PgPool,
    id: Uuid,
) -> Result<Option<UserPublic>, sqlx::Error> {
    let user = sqlx::query_as!(
        UserPublic,
        r#"
        SELECT id, email, username, language, created_at
        FROM users
        WHERE id = $1
        "#,
        id
    )
    .fetch_optional(pool)
    .await?;

    Ok(user)
}

// Invalide tous les tokens d'un utilisateur en mettant à jour token_invalidated_at
pub async fn invalidate_tokens(
    pool: &PgPool,
    user_id: Uuid,
) -> Result<(), sqlx::Error> {
    sqlx::query!(
        r#"
        UPDATE users
        SET token_invalidated_at = $1, updated_at = $1
        WHERE id = $2
        "#,
        Utc::now(),
        user_id
    )
    .execute(pool)
    .await?;

    Ok(())
}

// Vérifie si un token émis à une certaine date est encore valide
pub async fn is_token_valid(
    pool: &PgPool,
    user_id: Uuid,
    token_issued_at: i64,
) -> Result<bool, sqlx::Error> {
    let user = sqlx::query!(
        r#"
        SELECT token_invalidated_at
        FROM users
        WHERE id = $1
        "#,
        user_id
    )
    .fetch_optional(pool)
    .await?;

    match user {
        None => Ok(false),
        Some(row) => match row.token_invalidated_at {
            // Pas d'invalidation → token valide
            None => Ok(true),
            // Token émis avant l'invalidation → invalide
            Some(invalidated_at) => {
                Ok(token_issued_at > invalidated_at.timestamp())
            }
        },
    }
}