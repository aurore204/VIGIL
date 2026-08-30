use argon2::{
    password_hash::{rand_core::OsRng, PasswordHash, PasswordHasher, PasswordVerifier, SaltString},
    Argon2,
};
use jsonwebtoken::{encode, DecodingKey, EncodingKey, Header, Validation};
use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use std::env;
use uuid::Uuid;

use crate::models::user::{
    AuthResponse, LoginRequest, RegisterRequest, UpdateProfileRequest, UserPublic,
};
use crate::repositories::user_repository;

// Structure des claims du token JWT
#[derive(Debug, Serialize, Deserialize)]
pub struct Claims {
    pub sub: String,
    pub iat: i64, // date d'émission du token
    pub exp: usize,
}

// Erreurs possibles du service auth
#[derive(Debug)]
pub enum AuthError {
    EmailAlreadyExists,
    InvalidCredentials,
    CurrentPasswordRequired,
    DatabaseError(sqlx::Error),
    HashError,
    TokenError,
    TokenInvalid,
}

// Inscription d'un nouvel utilisateur
pub async fn register(pool: &PgPool, req: RegisterRequest) -> Result<AuthResponse, AuthError> {
    let existing = user_repository::find_by_email(pool, &req.email)
        .await
        .map_err(AuthError::DatabaseError)?;

    if existing.is_some() {
        return Err(AuthError::EmailAlreadyExists);
    }

    let salt = SaltString::generate(&mut OsRng);
    let argon2 = Argon2::default();
    let password_hash = argon2
        .hash_password(req.password.as_bytes(), &salt)
        .map_err(|_| AuthError::HashError)?
        .to_string();

    let user = user_repository::create_user(pool, &req.email, &req.username, &password_hash)
        .await
        .map_err(AuthError::DatabaseError)?;

    let token = generate_token(&user.id)?;

    Ok(AuthResponse { token, user })
}

// Connexion d'un utilisateur existant
pub async fn login(pool: &PgPool, req: LoginRequest) -> Result<AuthResponse, AuthError> {
    let user = user_repository::find_by_email(pool, &req.email)
        .await
        .map_err(AuthError::DatabaseError)?
        .ok_or(AuthError::InvalidCredentials)?;

    let password_hash = user
        .password_hash
        .as_ref()
        .ok_or(AuthError::InvalidCredentials)?;

    let parsed_hash = PasswordHash::new(password_hash).map_err(|_| AuthError::HashError)?;

    Argon2::default()
        .verify_password(req.password.as_bytes(), &parsed_hash)
        .map_err(|_| AuthError::InvalidCredentials)?;

    let user_public = UserPublic {
        id: user.id,
        email: user.email,
        username: user.username,
        language: user.language,
        created_at: user.created_at,
    };

    let token = generate_token(&user_public.id)?;

    Ok(AuthResponse {
        token,
        user: user_public,
    })
}

//  invalide tous les tokens de l'utilisateur
pub async fn logout(pool: &PgPool, user_id: Uuid) -> Result<(), AuthError> {
    user_repository::invalidate_tokens(pool, user_id)
        .await
        .map_err(AuthError::DatabaseError)
}

pub async fn update_profile(
    pool: &PgPool,
    user_id: Uuid,
    req: UpdateProfileRequest,
) -> Result<UserPublic, AuthError> {
    // Vérification d'unicité de l'email si celui-ci change
    if let Some(ref new_email) = req.email {
        if let Some(existing) = user_repository::find_by_email(pool, new_email)
            .await
            .map_err(AuthError::DatabaseError)?
        {
            if existing.id != user_id {
                return Err(AuthError::EmailAlreadyExists);
            }
        }
    }

    // Si un nouveau mot de passe est demandé, on vérifie l'ancien avant de re-hasher
    let new_password_hash: Option<String> = if let Some(new_password) = req.new_password {
        let current_password = req
            .current_password
            .ok_or(AuthError::CurrentPasswordRequired)?;

        let full_user = user_repository::find_full_by_id(pool, user_id)
            .await
            .map_err(AuthError::DatabaseError)?
            .ok_or(AuthError::InvalidCredentials)?;

        let stored_hash = full_user
            .password_hash
            .as_ref()
            .ok_or(AuthError::InvalidCredentials)?;

        let parsed_hash = PasswordHash::new(stored_hash).map_err(|_| AuthError::HashError)?;

        Argon2::default()
            .verify_password(current_password.as_bytes(), &parsed_hash)
            .map_err(|_| AuthError::InvalidCredentials)?;

        let salt = SaltString::generate(&mut OsRng);
        let hashed = Argon2::default()
            .hash_password(new_password.as_bytes(), &salt)
            .map_err(|_| AuthError::HashError)?
            .to_string();

        Some(hashed)
    } else {
        None
    };

    let updated = user_repository::update_user(
        pool,
        user_id,
        req.username.as_deref(),
        req.email.as_deref(),
        new_password_hash.as_deref(),
        req.language.as_deref(),
    )
    .await
    .map_err(AuthError::DatabaseError)?;

    Ok(updated)
}

// Génère un token JWT pour un utilisateur
fn generate_token(user_id: &Uuid) -> Result<String, AuthError> {
    let secret = env::var("JWT_SECRET").expect("JWT_SECRET doit être défini dans .env");

    let now = chrono::Utc::now();
    let iat = now.timestamp();
    let exp = now
        .checked_add_signed(chrono::Duration::days(7))
        .unwrap()
        .timestamp() as usize;

    let claims = Claims {
        sub: user_id.to_string(),
        iat,
        exp,
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
    let secret = env::var("JWT_SECRET").expect("JWT_SECRET doit être défini dans .env");

    jsonwebtoken::decode::<Claims>(
        token,
        &DecodingKey::from_secret(secret.as_bytes()),
        &Validation::default(),
    )
    .map(|data| data.claims)
    .map_err(|_| AuthError::TokenError)
}
