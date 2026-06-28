use argon2::{
    password_hash::{rand_core::OsRng, PasswordHash, PasswordHasher, PasswordVerifier, SaltString},
    Argon2,
};
use jsonwebtoken::{encode, DecodingKey, EncodingKey, Header, Validation};
use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use std::env;
use uuid::Uuid;

use crate::models::user::{AuthResponse, LoginRequest, RegisterRequest, UserPublic};
use crate::repositories::user_repository;

// Structure des claims du token JWT
#[derive(Debug, Serialize, Deserialize)]
pub struct Claims {
    pub sub: String,  // id de l'utilisateur
    pub exp: usize,   // date d'expiration
}

// Erreurs possibles du service auth
#[derive(Debug)]
pub enum AuthError {
    EmailAlreadyExists,
    InvalidCredentials,
    DatabaseError(sqlx::Error),
    HashError,
    TokenError,
}

// Inscription d'un nouvel utilisateur
pub async fn register(
    pool: &PgPool,
    req: RegisterRequest,
) -> Result<AuthResponse, AuthError> {
    // Vérifier si l'email existe déjà
    let existing = user_repository::find_by_email(pool, &req.email)
        .await
        .map_err(AuthError::DatabaseError)?;

    if existing.is_some() {
        return Err(AuthError::EmailAlreadyExists);
    }

    // Hasher le mot de passe
    let salt = SaltString::generate(&mut OsRng);
    let argon2 = Argon2::default();
    let password_hash = argon2
        .hash_password(req.password.as_bytes(), &salt)
        .map_err(|_| AuthError::HashError)?
        .to_string();

    // Créer l'utilisateur en base
    let user = user_repository::create_user(pool, &req.email, &req.username, &password_hash)
        .await
        .map_err(AuthError::DatabaseError)?;

    // Générer le token JWT
    let token = generate_token(&user.id)?;

    Ok(AuthResponse { token, user })
}

// Connexion d'un utilisateur existant
pub async fn login(
    pool: &PgPool,
    req: LoginRequest,
) -> Result<AuthResponse, AuthError> {
    // Chercher l'utilisateur par email
    let user = user_repository::find_by_email(pool, &req.email)
        .await
        .map_err(AuthError::DatabaseError)?
        .ok_or(AuthError::InvalidCredentials)?;

    // Vérifier le mot de passe
    let password_hash = user.password_hash
        .as_ref()
        .ok_or(AuthError::InvalidCredentials)?;

    let parsed_hash = PasswordHash::new(password_hash)
        .map_err(|_| AuthError::HashError)?;

    Argon2::default()
        .verify_password(req.password.as_bytes(), &parsed_hash)
        .map_err(|_| AuthError::InvalidCredentials)?;

    // Construire le UserPublic
    let user_public = UserPublic {
        id: user.id,
        email: user.email,
        username: user.username,
        language: user.language,
        created_at: user.created_at,
    };

    // Générer le token JWT
    let token = generate_token(&user_public.id)?;

    Ok(AuthResponse { token, user: user_public })
}

// Génère un token JWT pour un utilisateur
fn generate_token(user_id: &Uuid) -> Result<String, AuthError> {
    let secret = env::var("JWT_SECRET")
        .expect("JWT_SECRET doit être défini dans .env");

    let expiration = chrono::Utc::now()
        .checked_add_signed(chrono::Duration::days(7))
        .unwrap()
        .timestamp() as usize;

    let claims = Claims {
        sub: user_id.to_string(),
        exp: expiration,
    };

    encode(
        &Header::default(),
        &claims,
        &EncodingKey::from_secret(secret.as_bytes()),
    )
    .map_err(|_| AuthError::TokenError)
}

// Vérifie et décode un token JWT
pub fn verify_token(token: &str) -> Result<Claims, AuthError> {
    let secret = env::var("JWT_SECRET")
        .expect("JWT_SECRET doit être défini dans .env");

    jsonwebtoken::decode::<Claims>(
        token,
        &DecodingKey::from_secret(secret.as_bytes()),
        &Validation::default(),
    )
    .map(|data| data.claims)
    .map_err(|_| AuthError::TokenError)
}