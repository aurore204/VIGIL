use axum_test::TestServer;
use serde_json::json;
use sqlx::PgPool;
use vigil_server::routes::create_router;
use vigil_server::state::AppState;
use vigil_server::websocket::broadcaster::Broadcaster;

async fn setup_server() -> TestServer {
    dotenv::dotenv().ok();
    let database_url = std::env::var("DATABASE_URL").unwrap();
    let pool = PgPool::connect(&database_url).await.unwrap();
    let state = AppState::new(pool, Broadcaster::new());
    TestServer::new(create_router(state)).unwrap()
}

fn auth_header(token: &str) -> (axum::http::HeaderName, axum::http::HeaderValue) {
    (
        axum::http::HeaderName::from_static("authorization"),
        axum::http::HeaderValue::from_str(&format!("Bearer {}", token)).unwrap(),
    )
}

async fn register_and_get_token(server: &TestServer, suffix: &str) -> (String, String) {
    let response = server
        .post("/auth/register")
        .json(&json!({
            "email": format!("msg_func_{}@test.com", suffix),
            "password": "password123",
            "username": format!("user_{}", suffix)
        }))
        .await;
    let body: serde_json::Value = response.json();
    let token = body["data"]["token"].as_str().unwrap().to_string();
    let user_id = body["data"]["user"]["id"].as_str().unwrap().to_string();
    (token, user_id)
}

async fn setup_two_users_in_team(server: &TestServer) -> (String, String, String) {
    let id = uuid::Uuid::new_v4().to_string();
    let (token1, _) = register_and_get_token(server, &format!("u1_{}", id)).await;
    let (token2, user2_id) = register_and_get_token(server, &format!("u2_{}", id)).await;

    let (n1, v1) = auth_header(&token1);
    let team_response = server
        .post("/teams")
        .add_header(n1.clone(), v1.clone())
        .json(&json!({"name": format!("Team {}", id)}))
        .await;
    let body: serde_json::Value = team_response.json();
    let team_id = body["data"]["id"].as_str().unwrap();

    let invite = server
        .post(&format!("/teams/{}/invitations", team_id))
        .add_header(n1, v1)
        .await;
    let body: serde_json::Value = invite.json();
    let code = body["data"]["code"].as_str().unwrap();

    let (n2, v2) = auth_header(&token2);
    server
        .post("/teams/join")
        .add_header(n2, v2)
        .json(&json!({"code": code}))
        .await;

    (token1, token2, user2_id)
}

#[tokio::test]
async fn test_send_message_returns_201() {
    let server = setup_server().await;
    let (token1, _, user2_id) = setup_two_users_in_team(&server).await;
    let (n1, v1) = auth_header(&token1);

    let response = server
        .post(&format!("/users/{}/messages", user2_id))
        .add_header(n1, v1)
        .json(&json!({"content": "Bonjour !"}))
        .await;

    response.assert_status(axum::http::StatusCode::CREATED);
    let body: serde_json::Value = response.json();
    assert!(body["success"].as_bool().unwrap());
    assert_eq!(body["data"]["content"], "Bonjour !");
}

#[tokio::test]
async fn test_send_message_without_shared_team_returns_403() {
    let server = setup_server().await;
    let id = uuid::Uuid::new_v4().to_string();
    let (token1, _) = register_and_get_token(&server, &format!("u1_{}", id)).await;
    let (_, user2_id) = register_and_get_token(&server, &format!("u2_{}", id)).await;
    let (n1, v1) = auth_header(&token1);

    let response = server
        .post(&format!("/users/{}/messages", user2_id))
        .add_header(n1, v1)
        .json(&json!({"content": "Bonjour !"}))
        .await;

    response.assert_status(axum::http::StatusCode::FORBIDDEN);
    let body: serde_json::Value = response.json();
    assert_eq!(body["code"], "NO_SHARED_TEAM");
}

#[tokio::test]
async fn test_send_message_too_long_returns_400() {
    let server = setup_server().await;
    let (token1, _, user2_id) = setup_two_users_in_team(&server).await;
    let (n1, v1) = auth_header(&token1);

    let response = server
        .post(&format!("/users/{}/messages", user2_id))
        .add_header(n1, v1)
        .json(&json!({"content": "a".repeat(2001)}))
        .await;

    response.assert_status(axum::http::StatusCode::BAD_REQUEST);
    let body: serde_json::Value = response.json();
    assert_eq!(body["code"], "CONTENT_TOO_LONG");
}

#[tokio::test]
async fn test_get_conversation_returns_200() {
    let server = setup_server().await;
    let (token1, token2, user2_id) = setup_two_users_in_team(&server).await;
    let (n1, v1) = auth_header(&token1);
    let (n2, v2) = auth_header(&token2);

    server
        .post(&format!("/users/{}/messages", user2_id))
        .add_header(n1.clone(), v1.clone())
        .json(&json!({"content": "Message 1"}))
        .await;

    let response = server
        .get(&format!("/users/{}/messages", user2_id))
        .add_header(n1, v1)
        .await;

    response.assert_status(axum::http::StatusCode::OK);
    let body: serde_json::Value = response.json();
    assert_eq!(body["data"].as_array().unwrap().len(), 1);
}