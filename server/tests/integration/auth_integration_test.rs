use sqlx::PgPool;
use vigil_server::models::user::{LoginRequest, RegisterRequest};
use vigil_server::repositories::user_repository;
use vigil_server::services::auth_service;

async fn setup_pool() -> PgPool {
    dotenv::dotenv().ok();
    let database_url = std::env::var("DATABASE_URL")
        .expect("DATABASE_URL doit être défini");

    PgPool::connect(&database_url)
        .await
        .expect("Impossible de se connecter à la base de test")
}

#[tokio::test]
async fn test_register_creates_user_in_database() {
    let pool = setup_pool().await;
    let email = format!("test_{}@test.com", uuid::Uuid::new_v4());

    let req = RegisterRequest {
        email: email.clone(),
        password: "password123".to_string(),
        username: format!("user_{}", uuid::Uuid::new_v4()),
    };

    let result = auth_service::register(&pool, req).await;

    assert!(result.is_ok());
    let response = result.unwrap();
    assert_eq!(response.user.email, email);
}

#[tokio::test]
async fn test_register_rejects_duplicate_email() {
    let pool = setup_pool().await;
    let email = format!("dup_{}@test.com", uuid::Uuid::new_v4());

    let req1 = RegisterRequest {
        email: email.clone(),
        password: "password123".to_string(),
        username: format!("user1_{}", uuid::Uuid::new_v4()),
    };
    auth_service::register(&pool, req1).await.unwrap();

    let req2 = RegisterRequest {
        email: email.clone(),
        password: "password456".to_string(),
        username: format!("user2_{}", uuid::Uuid::new_v4()),
    };
    let result = auth_service::register(&pool, req2).await;

    assert!(result.is_err());
}

#[tokio::test]
async fn test_login_succeeds_with_correct_credentials() {
    let pool = setup_pool().await;
    let email = format!("login_{}@test.com", uuid::Uuid::new_v4());
    let password = "password123";

    let register_req = RegisterRequest {
        email: email.clone(),
        password: password.to_string(),
        username: format!("user_{}", uuid::Uuid::new_v4()),
    };
    auth_service::register(&pool, register_req).await.unwrap();

    let login_req = LoginRequest {
        email: email.clone(),
        password: password.to_string(),
    };
    let result = auth_service::login(&pool, login_req).await;

    assert!(result.is_ok());
}

#[tokio::test]
async fn test_login_fails_with_wrong_password() {
    let pool = setup_pool().await;
    let email = format!("wrongpass_{}@test.com", uuid::Uuid::new_v4());

    let register_req = RegisterRequest {
        email: email.clone(),
        password: "correctpassword".to_string(),
        username: format!("user_{}", uuid::Uuid::new_v4()),
    };
    auth_service::register(&pool, register_req).await.unwrap();

    let login_req = LoginRequest {
        email: email.clone(),
        password: "wrongpassword".to_string(),
    };
    let result = auth_service::login(&pool, login_req).await;

    assert!(result.is_err());
}

#[tokio::test]
async fn test_logout_invalidates_token() {
    let pool = setup_pool().await;
    let email = format!("logout_{}@test.com", uuid::Uuid::new_v4());

    let register_req = RegisterRequest {
        email: email.clone(),
        password: "password123".to_string(),
        username: format!("user_{}", uuid::Uuid::new_v4()),
    };
    let response = auth_service::register(&pool, register_req).await.unwrap();
    let user_id = response.user.id;

    // Token émis avant le logout
    let issued_at = chrono::Utc::now().timestamp();

    // On invalide
    auth_service::logout(&pool, user_id).await.unwrap();

    // Le token émis avant le logout doit être invalide
    let is_valid = user_repository::is_token_valid(&pool, user_id, issued_at)
        .await
        .unwrap();

    assert!(!is_valid);
}

#[tokio::test]
async fn test_token_valid_for_fresh_user() {
    let pool = setup_pool().await;
    let email = format!("fresh_{}@test.com", uuid::Uuid::new_v4());

    let register_req = RegisterRequest {
        email: email.clone(),
        password: "password123".to_string(),
        username: format!("user_{}", uuid::Uuid::new_v4()),
    };
    let response = auth_service::register(&pool, register_req).await.unwrap();
    let user_id = response.user.id;

    let issued_at = chrono::Utc::now().timestamp();
    let is_valid = user_repository::is_token_valid(&pool, user_id, issued_at)
        .await
        .unwrap();

    assert!(is_valid);
}