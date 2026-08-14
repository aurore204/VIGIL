use axum_test::TestServer;
use serde_json::json;
use sqlx::PgPool;
use vigil_server::repositories::webhook_repository;
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

async fn create_valid_team(server: &TestServer, suffix: &str) -> uuid::Uuid {
    let register_response = server
        .post("/auth/register")
        .json(&json!({
            "email": format!("webhook_repo_{}@test.com", suffix),
            "password": "password123",
            "username": format!("user_{}", suffix)
        }))
        .await;
    let register_body: serde_json::Value = register_response.json();
    let token = register_body["data"]["token"].as_str().unwrap().to_string();

    let create_response = server
        .post("/teams")
        .add_header(
            axum::http::HeaderName::from_static("authorization"),
            axum::http::HeaderValue::from_str(&format!("Bearer {}", token)).unwrap(),
        )
        .json(&json!({"name": "Team Webhook Repo Test"}))
        .await;
    let body: serde_json::Value = create_response.json();
    uuid::Uuid::parse_str(body["data"]["id"].as_str().unwrap()).unwrap()
}

#[tokio::test]
async fn test_get_secret_returns_none_when_not_configured() {
    let pool = setup_test_pool().await;
    let server = setup_server(pool.clone()).await;
    let team_id = create_valid_team(&server, &uuid::Uuid::new_v4().to_string()).await;

    let result = webhook_repository::get_secret(&pool, team_id, "github")
        .await
        .unwrap();

    assert!(result.is_none());
}

#[tokio::test]
async fn test_upsert_secret_then_get_secret_returns_it() {
    let pool = setup_test_pool().await;
    let server = setup_server(pool.clone()).await;
    let team_id = create_valid_team(&server, &uuid::Uuid::new_v4().to_string()).await;

    webhook_repository::upsert_secret(&pool, team_id, "github", "nonce:ciphertext")
        .await
        .expect("l'insertion doit réussir");

    let result = webhook_repository::get_secret(&pool, team_id, "github")
        .await
        .unwrap();

    assert_eq!(result, Some("nonce:ciphertext".to_string()));
}

#[tokio::test]
async fn test_upsert_secret_overwrites_existing_secret() {
    let pool = setup_test_pool().await;
    let server = setup_server(pool.clone()).await;
    let team_id = create_valid_team(&server, &uuid::Uuid::new_v4().to_string()).await;

    webhook_repository::upsert_secret(&pool, team_id, "github", "ancien:secret")
        .await
        .unwrap();
    webhook_repository::upsert_secret(&pool, team_id, "github", "nouveau:secret")
        .await
        .unwrap();

    let result = webhook_repository::get_secret(&pool, team_id, "github")
        .await
        .unwrap();

    assert_eq!(result, Some("nouveau:secret".to_string()));
}

#[tokio::test]
async fn test_get_secret_is_scoped_per_service() {
    let pool = setup_test_pool().await;
    let server = setup_server(pool.clone()).await;
    let team_id = create_valid_team(&server, &uuid::Uuid::new_v4().to_string()).await;

    webhook_repository::upsert_secret(&pool, team_id, "github", "secret-github")
        .await
        .unwrap();

    let gitlab_result = webhook_repository::get_secret(&pool, team_id, "gitlab")
        .await
        .unwrap();

    assert!(gitlab_result.is_none());
}
