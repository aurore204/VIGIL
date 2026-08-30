use jsonwebtoken::{encode, EncodingKey, Header};
use serde::Serialize;
use vigil_server::services::auth_service::verify_token;

fn ensure_jwt_secret() {
    if std::env::var("JWT_SECRET").is_err() {
        std::env::set_var("JWT_SECRET", "test-secret-for-unit-tests");
    }
}

#[derive(Serialize)]
struct TestClaims {
    sub: String,
    iat: i64,
    exp: usize,
}

fn make_token(secret: &str, sub: &str, exp_offset_seconds: i64) -> String {
    let now = chrono::Utc::now();
    let claims = TestClaims {
        sub: sub.to_string(),
        iat: now.timestamp(),
        exp: (now.timestamp() + exp_offset_seconds) as usize,
    };

    encode(
        &Header::default(),
        &claims,
        &EncodingKey::from_secret(secret.as_bytes()),
    )
    .unwrap()
}

#[test]
fn verify_token_accepts_valid_token() {
    ensure_jwt_secret();
    let secret = std::env::var("JWT_SECRET").unwrap();
    let user_id = uuid::Uuid::new_v4().to_string();
    let token = make_token(&secret, &user_id, 3600);

    let result = verify_token(&token);

    assert!(result.is_ok());
    assert_eq!(result.unwrap().sub, user_id);
}

#[test]
fn verify_token_rejects_expired_token() {
    ensure_jwt_secret();
    let secret = std::env::var("JWT_SECRET").unwrap();
    let user_id = uuid::Uuid::new_v4().to_string();
    // Token expiré il y a 1 heure
    let token = make_token(&secret, &user_id, -3600);

    let result = verify_token(&token);

    assert!(result.is_err());
}

#[test]
fn verify_token_rejects_token_signed_with_wrong_secret() {
    ensure_jwt_secret();
    let user_id = uuid::Uuid::new_v4().to_string();
    let token = make_token("un-mauvais-secret", &user_id, 3600);

    let result = verify_token(&token);

    assert!(result.is_err());
}

#[test]
fn verify_token_rejects_malformed_token() {
    ensure_jwt_secret();

    let result = verify_token("ceci-nest-pas-un-jwt-valide");

    assert!(result.is_err());
}

#[test]
fn verify_token_rejects_empty_token() {
    ensure_jwt_secret();

    let result = verify_token("");

    assert!(result.is_err());
}
