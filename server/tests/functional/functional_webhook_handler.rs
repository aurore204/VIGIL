use axum_test::TestServer;
use hmac::{Hmac, Mac};
use serde_json::json;
use sha2::Sha256;
use sqlx::PgPool;
use vigil_server::routes::create_router;

type HmacSha256 = Hmac<Sha256>;

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
            "email": format!("webhook_func_{}@test.com", suffix),
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

async fn create_team_with_webhook_secret(server: &TestServer, token: &str, secret: &str) -> String {
    let (name, value) = auth_header(token);
    let create_response = server
        .post("/teams")
        .add_header(name.clone(), value.clone())
        .json(&json!({"name": "Team Webhook Test"}))
        .await;
    let body: serde_json::Value = create_response.json();
    let team_id = body["data"]["id"].as_str().unwrap().to_string();

    server
        .post(&format!("/teams/{}/webhook-secrets", team_id))
        .add_header(name, value)
        .json(&json!({"service_name": "github", "secret": secret}))
        .await;

    team_id
}

fn sign(payload: &[u8], secret: &str) -> String {
    let mut mac = HmacSha256::new_from_slice(secret.as_bytes()).unwrap();
    mac.update(payload);
    let result = mac.finalize().into_bytes();
    format!("sha256={}", hex::encode(result))
}

#[tokio::test]
async fn test_github_webhook_with_valid_signature_returns_200() {
    ensure_encryption_key();
    let server = setup_server().await;
    let token = register_and_get_token(&server, &uuid::Uuid::new_v4().to_string()).await;
    let secret = "mon-secret-de-test";
    let team_id = create_team_with_webhook_secret(&server, &token, secret).await;

    let payload = json!({
        "action": "completed",
        "workflow_run": { "conclusion": "failure", "name": "CI" }
    });
    let body_bytes = serde_json::to_vec(&payload).unwrap();
    let signature = sign(&body_bytes, secret);

    let response = server
        .post(&format!("/webhooks/github/{}", team_id))
        .add_header(
            axum::http::HeaderName::from_static("x-hub-signature-256"),
            axum::http::HeaderValue::from_str(&signature).unwrap(),
        )
        .add_header(
            axum::http::HeaderName::from_static("x-github-event"),
            axum::http::HeaderValue::from_static("workflow_run"),
        )
        .bytes(body_bytes.into())
        .await;

    response.assert_status(axum::http::StatusCode::OK);
    let body: serde_json::Value = response.json();
    assert!(body["success"].as_bool().unwrap());
}

#[tokio::test]
async fn test_github_webhook_without_signature_returns_401() {
    ensure_encryption_key();
    let server = setup_server().await;
    let token = register_and_get_token(&server, &uuid::Uuid::new_v4().to_string()).await;
    let team_id = create_team_with_webhook_secret(&server, &token, "un-secret").await;

    let payload = json!({"action": "completed"});
    let body_bytes = serde_json::to_vec(&payload).unwrap();

    let response = server
        .post(&format!("/webhooks/github/{}", team_id))
        .add_header(
            axum::http::HeaderName::from_static("x-github-event"),
            axum::http::HeaderValue::from_static("workflow_run"),
        )
        .bytes(body_bytes.into())
        .await;

    response.assert_status(axum::http::StatusCode::UNAUTHORIZED);
    let body: serde_json::Value = response.json();
    assert_eq!(body["code"], "MISSING_SIGNATURE");
}

#[tokio::test]
async fn test_github_webhook_with_invalid_signature_returns_401() {
    ensure_encryption_key();
    let server = setup_server().await;
    let token = register_and_get_token(&server, &uuid::Uuid::new_v4().to_string()).await;
    let team_id = create_team_with_webhook_secret(&server, &token, "le-bon-secret").await;

    let payload = json!({"action": "completed"});
    let body_bytes = serde_json::to_vec(&payload).unwrap();
    let wrong_signature = sign(&body_bytes, "un-mauvais-secret");

    let response = server
        .post(&format!("/webhooks/github/{}", team_id))
        .add_header(
            axum::http::HeaderName::from_static("x-hub-signature-256"),
            axum::http::HeaderValue::from_str(&wrong_signature).unwrap(),
        )
        .add_header(
            axum::http::HeaderName::from_static("x-github-event"),
            axum::http::HeaderValue::from_static("workflow_run"),
        )
        .bytes(body_bytes.into())
        .await;

    response.assert_status(axum::http::StatusCode::UNAUTHORIZED);
    let body: serde_json::Value = response.json();
    assert_eq!(body["code"], "INVALID_SIGNATURE");
}

#[tokio::test]
async fn test_github_webhook_without_configured_secret_returns_404() {
    ensure_encryption_key();
    let server = setup_server().await;
    let token = register_and_get_token(&server, &uuid::Uuid::new_v4().to_string()).await;
    let (name, value) = auth_header(&token);

    let create_response = server
        .post("/teams")
        .add_header(name, value)
        .json(&json!({"name": "Team sans webhook"}))
        .await;
    let body: serde_json::Value = create_response.json();
    let team_id = body["data"]["id"].as_str().unwrap();

    let payload = json!({"action": "completed"});
    let body_bytes = serde_json::to_vec(&payload).unwrap();
    let signature = sign(&body_bytes, "peu-importe");

    let response = server
        .post(&format!("/webhooks/github/{}", team_id))
        .add_header(
            axum::http::HeaderName::from_static("x-hub-signature-256"),
            axum::http::HeaderValue::from_str(&signature).unwrap(),
        )
        .add_header(
            axum::http::HeaderName::from_static("x-github-event"),
            axum::http::HeaderValue::from_static("workflow_run"),
        )
        .bytes(body_bytes.into())
        .await;

    response.assert_status(axum::http::StatusCode::NOT_FOUND);
    let body: serde_json::Value = response.json();
    assert_eq!(body["code"], "WEBHOOK_NOT_CONFIGURED");
}

#[tokio::test]
async fn test_github_webhook_with_invalid_json_returns_400() {
    ensure_encryption_key();
    let server = setup_server().await;
    let token = register_and_get_token(&server, &uuid::Uuid::new_v4().to_string()).await;
    let secret = "secret-json-invalide";
    let team_id = create_team_with_webhook_secret(&server, &token, secret).await;

    let body_bytes = b"ceci n'est pas du json valide".to_vec();
    let signature = sign(&body_bytes, secret);

    let response = server
        .post(&format!("/webhooks/github/{}", team_id))
        .add_header(
            axum::http::HeaderName::from_static("x-hub-signature-256"),
            axum::http::HeaderValue::from_str(&signature).unwrap(),
        )
        .add_header(
            axum::http::HeaderName::from_static("x-github-event"),
            axum::http::HeaderValue::from_static("workflow_run"),
        )
        .bytes(body_bytes.into())
        .await;

    response.assert_status(axum::http::StatusCode::BAD_REQUEST);
    let body: serde_json::Value = response.json();
    assert_eq!(body["code"], "INVALID_PAYLOAD");
}
