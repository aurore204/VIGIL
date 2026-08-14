use axum_test::TestServer;
use serde_json::json;
use sqlx::PgPool;
use vigil_server::repositories::token_repository;
use vigil_server::routes::create_router;

async fn setup_test_pool() -> PgPool {
    dotenv::dotenv().ok();
    let database_url = std::env::var("DATABASE_URL").unwrap();
    PgPool::connect(&database_url).await.unwrap()
}

async fn setup_server(pool: PgPool) -> TestServer {
    let state = vigil_server::state::AppState::new(
        pool,
        vigil_server::websocket::broadcaster::Broadcaster::new(),
    );
    TestServer::new(create_router(state)).unwrap()
}

// Crée un utilisateur valide via l'API pour respecter la contrainte de clé étrangère.
async fn create_valid_user(server: &TestServer, suffix: &str) -> uuid::Uuid {
    let response = server
        .post("/auth/register")
        .json(&json!({
            "email": format!("token_repo_{}@test.com", suffix),
            "password": "password123",
            "username": format!("user_{}", suffix)
        }))
        .await;
    let body: serde_json::Value = response.json();
    let me_response = server
        .get("/me")
        .add_header(
            axum::http::HeaderName::from_static("authorization"),
            axum::http::HeaderValue::from_str(&format!(
                "Bearer {}",
                body["data"]["token"].as_str().unwrap()
            ))
            .unwrap(),
        )
        .await;
    let me_body: serde_json::Value = me_response.json();
    uuid::Uuid::parse_str(me_body["data"]["id"].as_str().unwrap()).unwrap()
}

#[tokio::test]
async fn test_find_token_returns_none_when_not_configured() {
    let pool = setup_test_pool().await;
    let server = setup_server(pool.clone()).await;
    let user_id = create_valid_user(&server, &uuid::Uuid::new_v4().to_string()).await;

    let result = token_repository::find_token(&pool, user_id, "github")
        .await
        .unwrap();

    assert!(result.is_none());
}

#[tokio::test]
async fn test_upsert_token_then_find_token_returns_it() {
    let pool = setup_test_pool().await;
    let server = setup_server(pool.clone()).await;
    let user_id = create_valid_user(&server, &uuid::Uuid::new_v4().to_string()).await;

    token_repository::upsert_token(
        &pool,
        user_id,
        "github",
        "oauth2",
        "encrypted-access-token",
        "encrypted-nonce",
    )
    .await
    .expect("l'insertion doit réussir");

    let result = token_repository::find_token(&pool, user_id, "github")
        .await
        .unwrap();

    assert!(result.is_some());
    let row = result.unwrap();
    assert_eq!(row.access_token, "encrypted-access-token");
    assert_eq!(row.encryption_nonce, "encrypted-nonce");
}

#[tokio::test]
async fn test_upsert_token_overwrites_existing_token() {
    let pool = setup_test_pool().await;
    let server = setup_server(pool.clone()).await;
    let user_id = create_valid_user(&server, &uuid::Uuid::new_v4().to_string()).await;

    token_repository::upsert_token(
        &pool,
        user_id,
        "github",
        "oauth2",
        "ancien-token",
        "ancien-nonce",
    )
    .await
    .unwrap();
    token_repository::upsert_token(
        &pool,
        user_id,
        "github",
        "oauth2",
        "nouveau-token",
        "nouveau-nonce",
    )
    .await
    .unwrap();

    let result = token_repository::find_token(&pool, user_id, "github")
        .await
        .unwrap()
        .unwrap();

    assert_eq!(result.access_token, "nouveau-token");
    assert_eq!(result.encryption_nonce, "nouveau-nonce");
}

#[tokio::test]
async fn test_find_token_is_scoped_per_service() {
    let pool = setup_test_pool().await;
    let server = setup_server(pool.clone()).await;
    let user_id = create_valid_user(&server, &uuid::Uuid::new_v4().to_string()).await;

    token_repository::upsert_token(
        &pool,
        user_id,
        "github",
        "oauth2",
        "token-github",
        "nonce-github",
    )
    .await
    .unwrap();

    let gitlab_result = token_repository::find_token(&pool, user_id, "gitlab")
        .await
        .unwrap();

    assert!(gitlab_result.is_none());
}

#[tokio::test]
async fn test_list_connected_services_returns_empty_when_none() {
    let pool = setup_test_pool().await;
    let server = setup_server(pool.clone()).await;
    let user_id = create_valid_user(&server, &uuid::Uuid::new_v4().to_string()).await;

    let services = token_repository::list_connected_services(&pool, user_id)
        .await
        .unwrap();

    assert!(services.is_empty());
}

#[tokio::test]
async fn test_list_connected_services_returns_all_connected() {
    let pool = setup_test_pool().await;
    let server = setup_server(pool.clone()).await;
    let user_id = create_valid_user(&server, &uuid::Uuid::new_v4().to_string()).await;

    token_repository::upsert_token(&pool, user_id, "github", "oauth2", "token-1", "nonce-1")
        .await
        .unwrap();
    token_repository::upsert_token(&pool, user_id, "discord", "personal", "token-2", "nonce-2")
        .await
        .unwrap();

    let services = token_repository::list_connected_services(&pool, user_id)
        .await
        .unwrap();

    assert_eq!(services.len(), 2);
    assert!(services.contains(&"github".to_string()));
    assert!(services.contains(&"discord".to_string()));
}

#[tokio::test]
async fn test_list_connected_services_does_not_leak_other_users_tokens() {
    let pool = setup_test_pool().await;
    let server = setup_server(pool.clone()).await;
    let user_id_1 = create_valid_user(&server, &uuid::Uuid::new_v4().to_string()).await;
    let user_id_2 = create_valid_user(&server, &uuid::Uuid::new_v4().to_string()).await;

    token_repository::upsert_token(&pool, user_id_1, "github", "oauth2", "token", "nonce")
        .await
        .unwrap();

    let services_user_2 = token_repository::list_connected_services(&pool, user_id_2)
        .await
        .unwrap();

    assert!(services_user_2.is_empty());
}
