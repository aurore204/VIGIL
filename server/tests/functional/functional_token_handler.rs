use axum_test::TestServer;
use serde_json::json;
use sqlx::PgPool;
use vigil_server::routes::create_router;

async fn setup_server() -> TestServer {
    dotenv::dotenv().ok();
    let database_url = std::env::var("DATABASE_URL").unwrap();
    let pool = PgPool::connect(&database_url).await.unwrap();
    let state = vigil_server::state::AppState::new(
        pool,
        vigil_server::websocket::broadcaster::Broadcaster::new(),
    );
    TestServer::new(create_router(state)).unwrap()
}

async fn register_and_get_token(server: &TestServer, suffix: &str) -> String {
    let response = server
        .post("/auth/register")
        .json(&json!({
            "email": format!("token_func_{}@test.com", suffix),
            "password": "password123",
            "username": format!("user_{}", suffix)
        }))
        .await;
    let body: serde_json::Value = response.json();
    body["data"]["token"].as_str().unwrap().to_string()
}

fn auth_header(token: &str) -> (axum::http::HeaderName, axum::http::HeaderValue) {
    (
        axum::http::HeaderName::from_static("authorization"),
        axum::http::HeaderValue::from_str(&format!("Bearer {}", token)).unwrap(),
    )
}

fn ensure_encryption_key() {
    if std::env::var("TOKEN_ENCRYPTION_KEY").is_err() {
        std::env::set_var("TOKEN_ENCRYPTION_KEY", "12345678901234567890123456789012");
    }
}

#[tokio::test]
async fn test_save_token_returns_201() {
    ensure_encryption_key();
    let server = setup_server().await;
    let token = register_and_get_token(&server, &uuid::Uuid::new_v4().to_string()).await;
    let (name, value) = auth_header(&token);

    let response = server
        .post("/me/tokens")
        .add_header(name, value)
        .json(&json!({
            "service_name": "github",
            "token_type": "oauth2",
            "access_token": "gho_exampletoken123"
        }))
        .await;

    response.assert_status(axum::http::StatusCode::CREATED);
    let body: serde_json::Value = response.json();
    assert!(body["success"].as_bool().unwrap());
}

#[tokio::test]
async fn test_save_token_without_auth_returns_401() {
    ensure_encryption_key();
    let server = setup_server().await;

    let response = server
        .post("/me/tokens")
        .json(&json!({
            "service_name": "github",
            "token_type": "oauth2",
            "access_token": "gho_exampletoken123"
        }))
        .await;

    response.assert_status(axum::http::StatusCode::UNAUTHORIZED);
}

#[tokio::test]
async fn test_list_connected_services_returns_200_and_empty_list() {
    ensure_encryption_key();
    let server = setup_server().await;
    let token = register_and_get_token(&server, &uuid::Uuid::new_v4().to_string()).await;
    let (name, value) = auth_header(&token);

    let response = server.get("/me/tokens").add_header(name, value).await;

    response.assert_status(axum::http::StatusCode::OK);
    let body: serde_json::Value = response.json();
    assert!(body["success"].as_bool().unwrap());
    assert!(body["data"]["services"].as_array().unwrap().is_empty());
}

#[tokio::test]
async fn test_list_connected_services_reflects_saved_token() {
    ensure_encryption_key();
    let server = setup_server().await;
    let token = register_and_get_token(&server, &uuid::Uuid::new_v4().to_string()).await;
    let (name, value) = auth_header(&token);

    server
        .post("/me/tokens")
        .add_header(name.clone(), value.clone())
        .json(&json!({
            "service_name": "discord",
            "token_type": "personal",
            "access_token": "discord-token-abc"
        }))
        .await;

    let response = server.get("/me/tokens").add_header(name, value).await;

    response.assert_status(axum::http::StatusCode::OK);
    let body: serde_json::Value = response.json();
    let services = body["data"]["services"].as_array().unwrap();
    assert_eq!(services.len(), 1);
    assert_eq!(services[0], "discord");
}

#[tokio::test]
async fn test_list_connected_services_without_auth_returns_401() {
    ensure_encryption_key();
    let server = setup_server().await;

    let response = server.get("/me/tokens").await;

    response.assert_status(axum::http::StatusCode::UNAUTHORIZED);
}

#[tokio::test]
async fn test_save_token_twice_overwrites_previous_service_entry() {
    ensure_encryption_key();
    let server = setup_server().await;
    let token = register_and_get_token(&server, &uuid::Uuid::new_v4().to_string()).await;
    let (name, value) = auth_header(&token);

    server
        .post("/me/tokens")
        .add_header(name.clone(), value.clone())
        .json(&json!({
            "service_name": "github",
            "token_type": "oauth2",
            "access_token": "ancien-token"
        }))
        .await;

    server
        .post("/me/tokens")
        .add_header(name.clone(), value.clone())
        .json(&json!({
            "service_name": "github",
            "token_type": "oauth2",
            "access_token": "nouveau-token"
        }))
        .await;

    let response = server.get("/me/tokens").add_header(name, value).await;
    let body: serde_json::Value = response.json();
    let services = body["data"]["services"].as_array().unwrap();

    // Un seul service listé malgré les deux sauvegardes (upsert, pas duplication)
    assert_eq!(services.len(), 1);
}