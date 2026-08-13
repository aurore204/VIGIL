use vigil_server::services::crypto_service::{encrypt, decrypt};

#[test]
fn encrypt_then_decrypt_returns_original_plaintext() {
    let key = [7u8; 32];
    let plaintext = "mon-secret-webhook-token";

    let (ciphertext_b64, nonce_b64) = encrypt(plaintext, &key).expect("l'encryption doit réussir");
    let decrypted = decrypt(&ciphertext_b64, &nonce_b64, &key).expect("le déchiffrement doit réussir");

    assert_eq!(decrypted, plaintext);
}

#[test]
fn encrypt_produces_different_ciphertext_each_time() {
    let key = [1u8; 32];
    let plaintext = "meme-texte";

    let (ciphertext_1, nonce_1) = encrypt(plaintext, &key).unwrap();
    let (ciphertext_2, nonce_2) = encrypt(plaintext, &key).unwrap();

    // Le nonce est aléatoire à chaque appel, donc le texte chiffré doit différer
    assert_ne!(ciphertext_1, ciphertext_2);
    assert_ne!(nonce_1, nonce_2);
}

#[test]
fn decrypt_fails_with_wrong_key() {
    let key_a = [1u8; 32];
    let key_b = [2u8; 32];
    let plaintext = "donnee-sensible";

    let (ciphertext_b64, nonce_b64) = encrypt(plaintext, &key_a).unwrap();
    let result = decrypt(&ciphertext_b64, &nonce_b64, &key_b);

    assert!(result.is_err());
}

#[test]
fn decrypt_fails_with_tampered_ciphertext() {
    let key = [3u8; 32];
    let plaintext = "donnee-integre";

    let (ciphertext_b64, nonce_b64) = encrypt(plaintext, &key).unwrap();

    // On modifie un caractère du texte chiffré pour simuler une altération
    let mut tampered = ciphertext_b64.clone();
    let last_char = tampered.pop().unwrap();
    let replacement = if last_char == 'A' { 'B' } else { 'A' };
    tampered.push(replacement);

    let result = decrypt(&tampered, &nonce_b64, &key);
    assert!(result.is_err());
}

#[test]
fn decrypt_fails_with_invalid_base64() {
    let key = [4u8; 32];
    let result = decrypt("not-valid-base64!!!", "not-valid-either!!!", &key);

    assert!(result.is_err());
}

#[test]
fn load_encryption_key_fails_when_env_var_missing() {
    std::env::remove_var("TOKEN_ENCRYPTION_KEY");

    let result = vigil_server::services::crypto_service::load_encryption_key();

    assert!(result.is_err());
}

#[test]
fn load_encryption_key_fails_when_wrong_length() {
    std::env::set_var("TOKEN_ENCRYPTION_KEY", "trop-court");

    let result = vigil_server::services::crypto_service::load_encryption_key();

    assert!(result.is_err());

    std::env::remove_var("TOKEN_ENCRYPTION_KEY");
}

#[test]
fn load_encryption_key_succeeds_with_32_byte_key() {
    std::env::set_var("TOKEN_ENCRYPTION_KEY", "12345678901234567890123456789012");

    let result = vigil_server::services::crypto_service::load_encryption_key();

    assert!(result.is_ok());

    std::env::remove_var("TOKEN_ENCRYPTION_KEY");
}