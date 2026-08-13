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
            "email": format!("rule_func_{}@test.com", suffix),
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

async fn create_team_as_manager(server: &TestServer, token: &str) -> String {
    let (name, value) = auth_header(token);
    let response = server
        .post("/teams")
        .add_header(name, value)
        .json(&json!({"name": "Team Rules Test"}))
        .await;
    let body: serde_json::Value = response.json();
    body["data"]["id"].as_str().unwrap().to_string()
}

fn sample_rule_payload() -> serde_json::Value {
    json!({
        "name": "CI failure > Incident",
        "enabled": true,
        "trigger": {
            "service": "github",
            "event": "workflow_run",
            "filters": { "conclusion": "failure" }
        },
        "reaction": {
            "type": "vigil_create_incident",
            "payload": { "title": "CI cassée", "severity": "high" }
        }
    })
}

#[tokio::test]
async fn test_create_rule_as_manager_returns_201() {
    let server = setup_server().await;
    let token = register_and_get_token(&server, &uuid::Uuid::new_v4().to_string()).await;
    let team_id = create_team_as_manager(&server, &token).await;
    let (name, value) = auth_header(&token);

    let response = server
        .post(&format!("/teams/{}/rules", team_id))
        .add_header(name, value)
        .json(&sample_rule_payload())
        .await;

    response.assert_status(axum::http::StatusCode::CREATED);
    let body: serde_json::Value = response.json();
    assert!(body["success"].as_bool().unwrap());
    assert_eq!(body["data"]["name"], "CI failure > Incident");
}

#[tokio::test]
async fn test_create_rule_as_observer_returns_403_not_manager() {
    let server = setup_server().await;
    let token1 = register_and_get_token(&server, &uuid::Uuid::new_v4().to_string()).await;
    let token2 = register_and_get_token(&server, &uuid::Uuid::new_v4().to_string()).await;
    let team_id = create_team_as_manager(&server, &token1).await;

    let (name1, value1) = auth_header(&token1);
    let invite_response = server
        .post(&format!("/teams/{}/invitations", team_id))
        .add_header(name1, value1)
        .await;
    let body: serde_json::Value = invite_response.json();
    let code = body["data"]["code"].as_str().unwrap();

    let (name2, value2) = auth_header(&token2);
    server
        .post("/teams/join")
        .add_header(name2.clone(), value2.clone())
        .json(&json!({"code": code}))
        .await;

    let response = server
        .post(&format!("/teams/{}/rules", team_id))
        .add_header(name2, value2)
        .json(&sample_rule_payload())
        .await;

    response.assert_status(axum::http::StatusCode::FORBIDDEN);
    let body: serde_json::Value = response.json();
    assert_eq!(body["code"], "NOT_MANAGER");
}

#[tokio::test]
async fn test_create_rule_non_member_returns_403_not_member() {
    let server = setup_server().await;
    let token1 = register_and_get_token(&server, &uuid::Uuid::new_v4().to_string()).await;
    let token2 = register_and_get_token(&server, &uuid::Uuid::new_v4().to_string()).await;
    let team_id = create_team_as_manager(&server, &token1).await;

    let (name2, value2) = auth_header(&token2);
    let response = server
        .post(&format!("/teams/{}/rules", team_id))
        .add_header(name2, value2)
        .json(&sample_rule_payload())
        .await;

    response.assert_status(axum::http::StatusCode::FORBIDDEN);
    let body: serde_json::Value = response.json();
    assert_eq!(body["code"], "NOT_MEMBER");
}

#[tokio::test]
async fn test_get_team_rules_returns_200() {
    let server = setup_server().await;
    let token = register_and_get_token(&server, &uuid::Uuid::new_v4().to_string()).await;
    let team_id = create_team_as_manager(&server, &token).await;
    let (name, value) = auth_header(&token);

    server
        .post(&format!("/teams/{}/rules", team_id))
        .add_header(name.clone(), value.clone())
        .json(&sample_rule_payload())
        .await;

    let response = server
        .get(&format!("/teams/{}/rules", team_id))
        .add_header(name, value)
        .await;

    response.assert_status(axum::http::StatusCode::OK);
    let body: serde_json::Value = response.json();
    assert!(body["success"].as_bool().unwrap());
    assert_eq!(body["data"].as_array().unwrap().len(), 1);
}

#[tokio::test]
async fn test_get_team_rules_non_member_returns_403() {
    let server = setup_server().await;
    let token1 = register_and_get_token(&server, &uuid::Uuid::new_v4().to_string()).await;
    let token2 = register_and_get_token(&server, &uuid::Uuid::new_v4().to_string()).await;
    let team_id = create_team_as_manager(&server, &token1).await;

    let (name2, value2) = auth_header(&token2);
    let response = server
        .get(&format!("/teams/{}/rules", team_id))
        .add_header(name2, value2)
        .await;

    response.assert_status(axum::http::StatusCode::FORBIDDEN);
    let body: serde_json::Value = response.json();
    assert_eq!(body["code"], "NOT_MEMBER");
}

#[tokio::test]
async fn test_create_webhook_secret_as_manager_returns_201() {
    ensure_encryption_key();
    let server = setup_server().await;
    let token = register_and_get_token(&server, &uuid::Uuid::new_v4().to_string()).await;
    let team_id = create_team_as_manager(&server, &token).await;
    let (name, value) = auth_header(&token);

    let response = server
        .post(&format!("/teams/{}/webhook-secrets", team_id))
        .add_header(name, value)
        .json(&json!({"service_name": "github", "secret": "un-secret-webhook"}))
        .await;

    response.assert_status(axum::http::StatusCode::CREATED);
    let body: serde_json::Value = response.json();
    assert!(body["success"].as_bool().unwrap());
}

#[tokio::test]
async fn test_create_webhook_secret_as_observer_returns_403() {
    ensure_encryption_key();
    let server = setup_server().await;
    let token1 = register_and_get_token(&server, &uuid::Uuid::new_v4().to_string()).await;
    let token2 = register_and_get_token(&server, &uuid::Uuid::new_v4().to_string()).await;
    let team_id = create_team_as_manager(&server, &token1).await;

    let (name1, value1) = auth_header(&token1);
    let invite_response = server
        .post(&format!("/teams/{}/invitations", team_id))
        .add_header(name1, value1)
        .await;
    let body: serde_json::Value = invite_response.json();
    let code = body["data"]["code"].as_str().unwrap();

    let (name2, value2) = auth_header(&token2);
    server
        .post("/teams/join")
        .add_header(name2.clone(), value2.clone())
        .json(&json!({"code": code}))
        .await;

    let response = server
        .post(&format!("/teams/{}/webhook-secrets", team_id))
        .add_header(name2, value2)
        .json(&json!({"service_name": "github", "secret": "un-secret-webhook"}))
        .await;

    response.assert_status(axum::http::StatusCode::FORBIDDEN);
    let body: serde_json::Value = response.json();
    assert_eq!(body["code"], "NOT_MANAGER");
}