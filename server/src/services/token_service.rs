use sqlx::PgPool;
use uuid::Uuid;

use crate::repositories::token_repository;
use crate::services::crypto_service::{decrypt, encrypt, load_encryption_key, CryptoError};

#[derive(Debug)]
pub enum TokenError {
    EncryptionFailed,
    DatabaseError(sqlx::Error),
}

impl From<CryptoError> for TokenError {
    fn from(_: CryptoError) -> Self {
        TokenError::EncryptionFailed
    }
}

// Chiffre un token en clair.
pub async fn save_token(
    pool: &PgPool,
    user_id: Uuid,
    service_name: &str,
    token_type: &str,
    access_token: &str,
) -> Result<(), TokenError> {
    let key = load_encryption_key()?;
    let (encrypted_access, nonce_access) = encrypt(access_token, &key)?;

    token_repository::upsert_token(
        pool,
        user_id,
        service_name,
        token_type,
        &encrypted_access,
        &nonce_access,
    )
    .await
    .map_err(TokenError::DatabaseError)
}

//Récupère le token chiffré via le repository, puis le déchiffre.
pub async fn get_decrypted_token(
    pool: &PgPool,
    user_id: Uuid,
    service_name: &str,
) -> Result<Option<String>, TokenError> {
    let row = token_repository::find_token(pool, user_id, service_name)
        .await
        .map_err(TokenError::DatabaseError)?;

    let row = match row {
        Some(r) => r,
        None => return Ok(None),
    };

    let key = load_encryption_key()?;
    let decrypted = decrypt(&row.access_token, &row.encryption_nonce, &key)?;

    Ok(Some(decrypted))
}

pub async fn list_connected_services(
    pool: &PgPool,
    user_id: Uuid,
) -> Result<Vec<String>, sqlx::Error> {
    token_repository::list_connected_services(pool, user_id).await
}
