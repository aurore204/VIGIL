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
            "email": format!("team_func_{}@test.com", suffix),
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

#[tokio::test]
async fn test_create_team_returns_201() {
    let server = setup_server().await;
    let token = register_and_get_token(&server, &uuid::Uuid::new_v4().to_string()).await;
    let (name, value) = auth_header(&token);

    let response = server
        .post("/teams")
        .add_header(name, value)
        .json(&json!({"name": "Team Test", "description": "Une team"}))
        .await;

    response.assert_status(axum::http::StatusCode::CREATED);
    let body: serde_json::Value = response.json();
    assert!(body["success"].as_bool().unwrap());
    assert!(body["data"]["id"].is_string());
}

#[tokio::test]
async fn test_get_user_teams_returns_200() {
    let server = setup_server().await;
    let token = register_and_get_token(&server, &uuid::Uuid::new_v4().to_string()).await;
    let (name, value) = auth_header(&token);

    server
        .post("/teams")
        .add_header(name.clone(), value.clone())
        .json(&json!({"name": "Team Test"}))
        .await;

    let response = server
        .get("/teams")
        .add_header(name, value)
        .await;

    response.assert_status(axum::http::StatusCode::OK);
    let body: serde_json::Value = response.json();
    assert!(body["success"].as_bool().unwrap());
    assert!(body["data"].is_array());
}

#[tokio::test]
async fn test_get_team_returns_403_for_non_member() {
    let server = setup_server().await;
    let token1 = register_and_get_token(&server, &uuid::Uuid::new_v4().to_string()).await;
    let token2 = register_and_get_token(&server, &uuid::Uuid::new_v4().to_string()).await;

    let (name1, value1) = auth_header(&token1);
    let create_response = server
        .post("/teams")
        .add_header(name1, value1)
        .json(&json!({"name": "Team Test"}))
        .await;

    let body: serde_json::Value = create_response.json();
    let team_id = body["data"]["id"].as_str().unwrap();

    let (name2, value2) = auth_header(&token2);
    let response = server
        .get(&format!("/teams/{}", team_id))
        .add_header(name2, value2)
        .await;

    response.assert_status(axum::http::StatusCode::FORBIDDEN);
    let body: serde_json::Value = response.json();
    assert_eq!(body["code"], "NOT_MEMBER");
}

#[tokio::test]
async fn test_join_team_with_valid_code_returns_200() {
    let server = setup_server().await;
    let token1 = register_and_get_token(&server, &uuid::Uuid::new_v4().to_string()).await;
    let token2 = register_and_get_token(&server, &uuid::Uuid::new_v4().to_string()).await;

    let (name1, value1) = auth_header(&token1);
    let create_response = server
        .post("/teams")
        .add_header(name1.clone(), value1.clone())
        .json(&json!({"name": "Team Test"}))
        .await;

    let body: serde_json::Value = create_response.json();
    let team_id = body["data"]["id"].as_str().unwrap();

    let invite_response = server
        .post(&format!("/teams/{}/invitations", team_id))
        .add_header(name1, value1)
        .await;

    let body: serde_json::Value = invite_response.json();
    let code = body["data"]["code"].as_str().unwrap();

    let (name2, value2) = auth_header(&token2);
    let response = server
        .post("/teams/join")
        .add_header(name2, value2)
        .json(&json!({"code": code}))
        .await;

    response.assert_status(axum::http::StatusCode::OK);
    let body: serde_json::Value = response.json();
    assert!(body["success"].as_bool().unwrap());
    assert_eq!(body["data"]["members"].as_array().unwrap().len(), 2);
}

#[tokio::test]
async fn test_join_team_with_invalid_code_returns_400() {
    let server = setup_server().await;
    let token = register_and_get_token(&server, &uuid::Uuid::new_v4().to_string()).await;
    let (name, value) = auth_header(&token);

    let response = server
        .post("/teams/join")
        .add_header(name, value)
        .json(&json!({"code": "INVALID00"}))
        .await;

    response.assert_status(axum::http::StatusCode::BAD_REQUEST);
    let body: serde_json::Value = response.json();
    assert_eq!(body["code"], "INVALID_CODE");
}

#[tokio::test]
async fn test_generate_invitation_only_manager_returns_201() {
    let server = setup_server().await;
    let token = register_and_get_token(&server, &uuid::Uuid::new_v4().to_string()).await;
    let (name, value) = auth_header(&token);

    let create_response = server
        .post("/teams")
        .add_header(name.clone(), value.clone())
        .json(&json!({"name": "Team Test"}))
        .await;

    let body: serde_json::Value = create_response.json();
    let team_id = body["data"]["id"].as_str().unwrap();

    let response = server
        .post(&format!("/teams/{}/invitations", team_id))
        .add_header(name, value)
        .await;

    response.assert_status(axum::http::StatusCode::CREATED);
    let body: serde_json::Value = response.json();
    assert!(body["data"]["code"].is_string());
}

#[tokio::test]
async fn test_observer_cannot_generate_invitation() {
    let server = setup_server().await;
    let token1 = register_and_get_token(&server, &uuid::Uuid::new_v4().to_string()).await;
    let token2 = register_and_get_token(&server, &uuid::Uuid::new_v4().to_string()).await;

    let (name1, value1) = auth_header(&token1);
    let create_response = server
        .post("/teams")
        .add_header(name1.clone(), value1.clone())
        .json(&json!({"name": "Team Test"}))
        .await;

    let body: serde_json::Value = create_response.json();
    let team_id = body["data"]["id"].as_str().unwrap();

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
        .post(&format!("/teams/{}/invitations", team_id))
        .add_header(name2, value2)
        .await;

    response.assert_status(axum::http::StatusCode::FORBIDDEN);
    let body: serde_json::Value = response.json();
    assert_eq!(body["code"], "NOT_MANAGER");
}

#[tokio::test]
async fn test_transfer_manager_returns_200() {
    let server = setup_server().await;
    let token1 = register_and_get_token(&server, &uuid::Uuid::new_v4().to_string()).await;
    let token2 = register_and_get_token(&server, &uuid::Uuid::new_v4().to_string()).await;

    let (name1, value1) = auth_header(&token1);
    let create_response = server
        .post("/teams")
        .add_header(name1.clone(), value1.clone())
        .json(&json!({"name": "Team Test"}))
        .await;

    let body: serde_json::Value = create_response.json();
    let team_id = body["data"]["id"].as_str().unwrap();

    let invite_response = server
        .post(&format!("/teams/{}/invitations", team_id))
        .add_header(name1.clone(), value1.clone())
        .await;

    let body: serde_json::Value = invite_response.json();
    let code = body["data"]["code"].as_str().unwrap();

    let (name2, value2) = auth_header(&token2);
    let join_response = server
        .post("/teams/join")
        .add_header(name2, value2)
        .json(&json!({"code": code}))
        .await;

    let body: serde_json::Value = join_response.json();
    
    // Afficher la réponse pour déboguer
    println!("JOIN RESPONSE: {}", serde_json::to_string_pretty(&body).unwrap());

    let new_manager_id = body["data"]["members"]
        .as_array()
        .unwrap()
        .iter()
        .find(|m| m["role"] == "observer")
        .unwrap()["user_id"]
        .as_str()
        .unwrap()
        .to_string();

    let response = server
        .post(&format!("/teams/{}/transfer", team_id))
        .add_header(name1, value1)
        .json(&json!({"user_id": new_manager_id}))
        .await;

    response.assert_status(axum::http::StatusCode::OK);
    let body: serde_json::Value = response.json();
    assert!(body["success"].as_bool().unwrap());
    assert_eq!(body["data"]["manager_id"], new_manager_id);
}

#[tokio::test]
async fn test_transfer_manager_to_self_returns_400() {
    let server = setup_server().await;
    let token = register_and_get_token(&server, &uuid::Uuid::new_v4().to_string()).await;
    let (name, value) = auth_header(&token);

    let create_response = server
        .post("/teams")
        .add_header(name.clone(), value.clone())
        .json(&json!({"name": "Team Test"}))
        .await;

    let body: serde_json::Value = create_response.json();
    let team_id = body["data"]["id"].as_str().unwrap();
    let manager_id = body["data"]["manager_id"].as_str().unwrap();

    let response = server
        .post(&format!("/teams/{}/transfer", team_id))
        .add_header(name, value)
        .json(&json!({"user_id": manager_id}))
        .await;

    response.assert_status(axum::http::StatusCode::BAD_REQUEST);
    let body: serde_json::Value = response.json();
    assert_eq!(body["code"], "CANNOT_TARGET_SELF");
}

#[tokio::test]
async fn test_update_team_returns_200() {
    let server = setup_server().await;
    let token = register_and_get_token(&server, &uuid::Uuid::new_v4().to_string()).await;
    let (name, value) = auth_header(&token);

    let create_response = server
        .post("/teams")
        .add_header(name.clone(), value.clone())
        .json(&json!({"name": "Team originale"}))
        .await;
    let body: serde_json::Value = create_response.json();
    let team_id = body["data"]["id"].as_str().unwrap();

    let response = server
        .patch(&format!("/teams/{}", team_id))
        .add_header(name, value)
        .json(&json!({"name": "Team renommée"}))
        .await;

    response.assert_status(axum::http::StatusCode::OK);
    let body: serde_json::Value = response.json();
    assert_eq!(body["data"]["name"], "Team renommée");
}

#[tokio::test]
async fn test_delete_team_returns_200() {
    let server = setup_server().await;
    let token = register_and_get_token(&server, &uuid::Uuid::new_v4().to_string()).await;
    let (name, value) = auth_header(&token);

    let create_response = server
        .post("/teams")
        .add_header(name.clone(), value.clone())
        .json(&json!({"name": "Team à supprimer"}))
        .await;
    let body: serde_json::Value = create_response.json();
    let team_id = body["data"]["id"].as_str().unwrap();

    let response = server
        .delete(&format!("/teams/{}", team_id))
        .add_header(name, value)
        .await;

    response.assert_status(axum::http::StatusCode::OK);
}

#[tokio::test]
async fn test_get_team_members_returns_200() {
    let server = setup_server().await;
    let token = register_and_get_token(&server, &uuid::Uuid::new_v4().to_string()).await;
    let (name, value) = auth_header(&token);

    let create_response = server
        .post("/teams")
        .add_header(name.clone(), value.clone())
        .json(&json!({"name": "Team Test"}))
        .await;
    let body: serde_json::Value = create_response.json();
    let team_id = body["data"]["id"].as_str().unwrap();

    let response = server
        .get(&format!("/teams/{}/members", team_id))
        .add_header(name, value)
        .await;

    response.assert_status(axum::http::StatusCode::OK);
    let body: serde_json::Value = response.json();
    assert_eq!(body["data"].as_array().unwrap().len(), 1);
}

#[tokio::test]
async fn test_leave_team_as_observer_returns_200() {
    let server = setup_server().await;
    let token1 = register_and_get_token(&server, &uuid::Uuid::new_v4().to_string()).await;
    let token2 = register_and_get_token(&server, &uuid::Uuid::new_v4().to_string()).await;

    let (n1, v1) = auth_header(&token1);
    let create_response = server
        .post("/teams")
        .add_header(n1.clone(), v1.clone())
        .json(&json!({"name": "Team Test"}))
        .await;
    let body: serde_json::Value = create_response.json();
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
        .add_header(n2.clone(), v2.clone())
        .json(&json!({"code": code}))
        .await;

    let response = server
        .delete(&format!("/teams/{}/leave", team_id))
        .add_header(n2, v2)
        .await;

    response.assert_status(axum::http::StatusCode::OK);
}

#[tokio::test]
async fn test_leave_team_as_manager_returns_400() {
    let server = setup_server().await;
    let token = register_and_get_token(&server, &uuid::Uuid::new_v4().to_string()).await;
    let (n, v) = auth_header(&token);

    let create_response = server
        .post("/teams")
        .add_header(n.clone(), v.clone())
        .json(&json!({"name": "Team Test"}))
        .await;
    let body: serde_json::Value = create_response.json();
    let team_id = body["data"]["id"].as_str().unwrap();

    let response = server
        .delete(&format!("/teams/{}/leave", team_id))
        .add_header(n, v)
        .await;

    response.assert_status(axum::http::StatusCode::BAD_REQUEST);
    let body: serde_json::Value = response.json();
    assert_eq!(body["code"], "MANAGER_MUST_TRANSFER_FIRST");
}