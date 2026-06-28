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
        SELECT id, email, password_hash, username, language, created_at, updated_at
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