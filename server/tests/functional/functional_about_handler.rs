use axum_test::TestServer;
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

#[tokio::test]
async fn test_get_about_returns_200_without_auth() {
    let server = setup_server().await;

    let response = server.get("/about.json").await;

    response.assert_status(axum::http::StatusCode::OK);
}

#[tokio::test]
async fn test_get_about_contains_client_and_server_sections() {
    let server = setup_server().await;

    let response = server.get("/about.json").await;
    let body: serde_json::Value = response.json();

    assert!(body["client"]["host"].is_string());
    assert!(body["server"]["current_time"].is_i64());
    assert!(body["server"]["services"].is_array());
    assert!(body["server"]["token"].is_string());
}

#[tokio::test]
async fn test_get_about_exposes_github_service() {
    let server = setup_server().await;

    let response = server.get("/about.json").await;
    let body: serde_json::Value = response.json();

    let services = body["server"]["services"].as_array().unwrap();
    let github = services.iter().find(|s| s["name"] == "github");

    assert!(github.is_some());
    let actions = github.unwrap()["actions"].as_array().unwrap();
    assert!(!actions.is_empty());
}

#[tokio::test]
async fn test_get_about_exposes_vigil_reaction() {
    let server = setup_server().await;

    let response = server.get("/about.json").await;
    let body: serde_json::Value = response.json();

    let services = body["server"]["services"].as_array().unwrap();
    let vigil = services.iter().find(|s| s["name"] == "vigil");

    assert!(vigil.is_some());
    let reactions = vigil.unwrap()["reactions"].as_array().unwrap();
    assert_eq!(reactions[0]["name"], "create_incident");
}

#[tokio::test]
async fn test_get_about_token_is_a_sha256_hash() {
    let server = setup_server().await;

    let response = server.get("/about.json").await;
    let body: serde_json::Value = response.json();

    let token = body["server"]["token"].as_str().unwrap();
    // Un hash SHA-256 fait toujours 64 caractères hexadécimaux
    assert_eq!(token.len(), 64);
    assert!(token.chars().all(|c| c.is_ascii_hexdigit()));
}
