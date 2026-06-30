use vigil_server::services::auth_service::{verify_token, Claims};
use argon2::{
    password_hash::{rand_core::OsRng, PasswordHash, PasswordHasher, PasswordVerifier, SaltString},
    Argon2,
};
use jsonwebtoken::{encode, EncodingKey, Header};

#[test]
fn test_password_hashing_produces_valid_hash() {
    let password = "password123";
    let salt = SaltString::generate(&mut OsRng);
    let argon2 = Argon2::default();

    let hash = argon2.hash_password(password.as_bytes(), &salt);

    assert!(hash.is_ok());
}

#[test]
fn test_verify_correct_password_succeeds() {
    let password = "password123";
    let salt = SaltString::generate(&mut OsRng);
    let argon2 = Argon2::default();

    let hash = argon2
        .hash_password(password.as_bytes(), &salt)
        .unwrap()
        .to_string();

    let parsed_hash = PasswordHash::new(&hash).unwrap();
    let result = Argon2::default().verify_password(password.as_bytes(), &parsed_hash);

    assert!(result.is_ok());
}

#[test]
fn test_verify_wrong_password_fails() {
    let password = "password123";
    let wrong_password = "wrongpassword";
    let salt = SaltString::generate(&mut OsRng);
    let argon2 = Argon2::default();

    let hash = argon2
        .hash_password(password.as_bytes(), &salt)
        .unwrap()
        .to_string();

    let parsed_hash = PasswordHash::new(&hash).unwrap();
    let result = Argon2::default().verify_password(wrong_password.as_bytes(), &parsed_hash);

    assert!(result.is_err());
}

#[test]
fn test_verify_valid_token_succeeds() {
    std::env::set_var("JWT_SECRET", "test_secret_key");

    let now = chrono::Utc::now();
    let claims = Claims {
        sub: "test-user-id".to_string(),
        iat: now.timestamp(),
        exp: (now + chrono::Duration::days(7)).timestamp() as usize,
    };

    let token = encode(
        &Header::default(),
        &claims,
        &EncodingKey::from_secret("test_secret_key".as_bytes()),
    )
    .unwrap();

    let result = verify_token(&token);

    assert!(result.is_ok());
    assert_eq!(result.unwrap().sub, "test-user-id");
}

#[test]
fn test_verify_expired_token_fails() {
    std::env::set_var("JWT_SECRET", "test_secret_key");

    let now = chrono::Utc::now();
    let claims = Claims {
        sub: "test-user-id".to_string(),
        iat: (now - chrono::Duration::days(10)).timestamp(),
        exp: (now - chrono::Duration::days(3)).timestamp() as usize,
    };

    let token = encode(
        &Header::default(),
        &claims,
        &EncodingKey::from_secret("test_secret_key".as_bytes()),
    )
    .unwrap();

    let result = verify_token(&token);

    assert!(result.is_err());
}

#[test]
fn test_verify_token_wrong_signature_fails() {
    std::env::set_var("JWT_SECRET", "correct_secret");

    let now = chrono::Utc::now();
    let claims = Claims {
        sub: "test-user-id".to_string(),
        iat: now.timestamp(),
        exp: (now + chrono::Duration::days(7)).timestamp() as usize,
    };

    // Token signé avec un mauvais secret
    let token = encode(
        &Header::default(),
        &claims,
        &EncodingKey::from_secret("wrong_secret".as_bytes()),
    )
    .unwrap();

    let result = verify_token(&token);

    assert!(result.is_err());
}