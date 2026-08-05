use sqlx::PgPool;
use uuid::Uuid;

pub struct EncryptedTokenRow {
    pub access_token: String,
    pub encryption_nonce: String,
}

// Insère ou met à jour un token déjà chiffré
pub async fn upsert_token(
    pool: &PgPool,
    user_id: Uuid,
    service_name: &str,
    token_type: &str,
    encrypted_access_token: &str,
    encryption_nonce: &str,
) -> Result<(), sqlx::Error> {
    sqlx::query!(
    r#"
    INSERT INTO user_tokens (user_id, service_name, token_type, access_token, encryption_nonce)
    VALUES ($1, $2, $3::token_type, $4, $5)
    ON CONFLICT (user_id, service_name)
    DO UPDATE SET access_token = $4, encryption_nonce = $5, token_type = $3::token_type, updated_at = NOW()
    "#,
    user_id,
    service_name,
    token_type as _,
    encrypted_access_token,
    encryption_nonce
)
    .execute(pool)
    .await?;

    Ok(())
}

// Récupère le token chiffré brut (pas encore déchiffré)
pub async fn find_token(
    pool: &PgPool,
    user_id: Uuid,
    service_name: &str,
) -> Result<Option<EncryptedTokenRow>, sqlx::Error> {
    let row = sqlx::query!(
        r#"
        SELECT access_token, encryption_nonce
        FROM user_tokens
        WHERE user_id = $1 AND service_name = $2
        "#,
        user_id,
        service_name
    )
    .fetch_optional(pool)
    .await?;

    Ok(row.map(|r| EncryptedTokenRow {
        access_token: r.access_token,
        encryption_nonce: r.encryption_nonce,
    }))
}

// Liste les noms de services connectés (jamais le token lui-même)
pub async fn list_connected_services(pool: &PgPool, user_id: Uuid) -> Result<Vec<String>, sqlx::Error> {
    let rows = sqlx::query!(
        r#"SELECT service_name FROM user_tokens WHERE user_id = $1"#,
        user_id
    )
    .fetch_all(pool)
    .await?;

    Ok(rows.into_iter().map(|r| r.service_name).collect())
}