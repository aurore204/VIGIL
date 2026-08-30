use aes_gcm::aead::rand_core::RngCore;
use aes_gcm::aead::{Aead, KeyInit, OsRng};
use aes_gcm::{Aes256Gcm, Nonce};
use base64::{engine::general_purpose::STANDARD, Engine};

#[derive(Debug)]
pub enum CryptoError {
    InvalidKey,
    EncryptionFailed,
    DecryptionFailed,
}

// Chiffre un texte en clair. Retourne texte_chiffré_base64, nonce_base64
pub fn encrypt(plaintext: &str, key: &[u8; 32]) -> Result<(String, String), CryptoError> {
    let cipher = Aes256Gcm::new_from_slice(key).map_err(|_| CryptoError::InvalidKey)?;

    let mut nonce_bytes = [0u8; 12];
    OsRng.fill_bytes(&mut nonce_bytes);
    let nonce = Nonce::from_slice(&nonce_bytes);

    let ciphertext = cipher
        .encrypt(nonce, plaintext.as_bytes())
        .map_err(|_| CryptoError::EncryptionFailed)?;

    Ok((STANDARD.encode(ciphertext), STANDARD.encode(nonce_bytes)))
}

// Déchiffre un token précédemment chiffré avec `encrypt`.
pub fn decrypt(
    ciphertext_b64: &str,
    nonce_b64: &str,
    key: &[u8; 32],
) -> Result<String, CryptoError> {
    let cipher = Aes256Gcm::new_from_slice(key).map_err(|_| CryptoError::InvalidKey)?;

    let ciphertext = STANDARD
        .decode(ciphertext_b64)
        .map_err(|_| CryptoError::DecryptionFailed)?;
    let nonce_bytes = STANDARD
        .decode(nonce_b64)
        .map_err(|_| CryptoError::DecryptionFailed)?;
    let nonce = Nonce::from_slice(&nonce_bytes);

    let plaintext = cipher
        .decrypt(nonce, ciphertext.as_ref())
        .map_err(|_| CryptoError::DecryptionFailed)?;

    String::from_utf8(plaintext).map_err(|_| CryptoError::DecryptionFailed)
}

//Doit être une chaîne de 32 caractères (256 bits).
pub fn load_encryption_key() -> Result<[u8; 32], CryptoError> {
    let key_str = std::env::var("TOKEN_ENCRYPTION_KEY").map_err(|_| CryptoError::InvalidKey)?;
    let key_bytes = key_str.as_bytes();

    if key_bytes.len() != 32 {
        return Err(CryptoError::InvalidKey);
    }

    let mut key = [0u8; 32];
    key.copy_from_slice(key_bytes);
    Ok(key)
}
