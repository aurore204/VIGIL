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
            "email": format!("react_func_{}@test.com", suffix),
            "password": "password123",
            "username": format!("user_{}", suffix)
        }))
        .await;
    let body: serde_json::Value = response.json();
    let token = body["data"]["token"].as_str().unwrap().to_string();
    let user_id = body["data"]["user"]["id"].as_str().unwrap().to_string();
    (token, user_id)
}

async fn setup_team_incident_entry(
    server: &TestServer,
) -> (String, String, String, String, String) {
    let id = uuid::Uuid::new_v4().to_string();
    let (manager_token, _) = register_and_get_token(server, &format!("mgr_{}", id)).await;
    let (responder_token, responder_id) =
        register_and_get_token(server, &format!("rsp_{}", id)).await;

    let (mn, mv) = auth_header(&manager_token);
    let team_response = server
        .post("/teams")
        .add_header(mn.clone(), mv.clone())
        .json(&json!({"name": format!("Team {}", id)}))
        .await;
    let body: serde_json::Value = team_response.json();
    let team_id = body["data"]["id"].as_str().unwrap().to_string();

    let invite = server
        .post(&format!("/teams/{}/invitations", team_id))
        .add_header(mn.clone(), mv.clone())
        .await;
    let body: serde_json::Value = invite.json();
    let code = body["data"]["code"].as_str().unwrap();

    let (rn, rv) = auth_header(&responder_token);
    let join = server
        .post("/teams/join")
        .add_header(rn.clone(), rv.clone())
        .json(&json!({"code": code}))
        .await;
    let body: serde_json::Value = join.json();
    let rid = body["data"]["members"]
        .as_array()
        .unwrap()
        .iter()
        .find(|m| m["role"] == "observer")
        .unwrap()["user_id"]
        .as_str()
        .unwrap()
        .to_string();

    server
        .patch(&format!("/teams/{}/members/{}/role", team_id, rid))
        .add_header(mn.clone(), mv.clone())
        .json(&json!({"role": "responder"}))
        .await;

    let incident = server
        .post(&format!("/teams/{}/incidents", team_id))
        .add_header(mn, mv)
        .json(&json!({"title": "Test", "severity": "low"}))
        .await;
    let body: serde_json::Value = incident.json();
    let incident_id = body["data"]["id"].as_str().unwrap().to_string();

    let entry = server
        .post(&format!("/incidents/{}/timeline", incident_id))
        .add_header(rn, rv)
        .json(&json!({"content": "Entrée test"}))
        .await;
    let body: serde_json::Value = entry.json();
    let entry_id = body["data"]["id"].as_str().unwrap().to_string();

    (
        manager_token,
        responder_token,
        team_id,
        incident_id,
        entry_id,
    )
}

#[tokio::test]
async fn test_get_available_reactions_returns_200() {
    let server = setup_server().await;
    let response = server.get("/reactions/available").await;
    response.assert_status(axum::http::StatusCode::OK);
    let body: serde_json::Value = response.json();
    assert!(body["success"].as_bool().unwrap());
    assert!(body["data"].as_array().unwrap().len() >= 5);
}

#[tokio::test]
async fn test_add_reaction_returns_201() {
    let server = setup_server().await;
    let (_, responder_token, _, incident_id, entry_id) = setup_team_incident_entry(&server).await;
    let (rn, rv) = auth_header(&responder_token);

    let response = server
        .post(&format!(
            "/incidents/{}/timeline/{}/reactions",
            incident_id, entry_id
        ))
        .add_header(rn, rv)
        .json(&json!({"emoji": "+1"}))
        .await;

    response.assert_status(axum::http::StatusCode::CREATED);
    let body: serde_json::Value = response.json();
    assert!(body["success"].as_bool().unwrap());
}

#[tokio::test]
async fn test_add_duplicate_reaction_returns_409() {
    let server = setup_server().await;
    let (_, responder_token, _, incident_id, entry_id) = setup_team_incident_entry(&server).await;
    let (rn, rv) = auth_header(&responder_token);

    server
        .post(&format!(
            "/incidents/{}/timeline/{}/reactions",
            incident_id, entry_id
        ))
        .add_header(rn.clone(), rv.clone())
        .json(&json!({"emoji": "+1"}))
        .await;

    let response = server
        .post(&format!(
            "/incidents/{}/timeline/{}/reactions",
            incident_id, entry_id
        ))
        .add_header(rn, rv)
        .json(&json!({"emoji": "+1"}))
        .await;

    response.assert_status(axum::http::StatusCode::CONFLICT);
    let body: serde_json::Value = response.json();
    assert_eq!(body["code"], "ALREADY_REACTED");
}

#[tokio::test]
async fn test_add_invalid_emoji_returns_400() {
    let server = setup_server().await;
    let (_, responder_token, _, incident_id, entry_id) = setup_team_incident_entry(&server).await;
    let (rn, rv) = auth_header(&responder_token);

    let response = server
        .post(&format!(
            "/incidents/{}/timeline/{}/reactions",
            incident_id, entry_id
        ))
        .add_header(rn, rv)
        .json(&json!({"emoji": "invalid"}))
        .await;

    response.assert_status(axum::http::StatusCode::BAD_REQUEST);
    let body: serde_json::Value = response.json();
    assert_eq!(body["code"], "INVALID_EMOJI");
}

#[tokio::test]
async fn test_remove_reaction_returns_200() {
    let server = setup_server().await;
    let (_, responder_token, _, incident_id, entry_id) = setup_team_incident_entry(&server).await;
    let (rn, rv) = auth_header(&responder_token);

    server
        .post(&format!(
            "/incidents/{}/timeline/{}/reactions",
            incident_id, entry_id
        ))
        .add_header(rn.clone(), rv.clone())
        .json(&json!({"emoji": "+1"}))
        .await;

    let response = server
        .delete(&format!(
            "/incidents/{}/timeline/{}/reactions/+1",
            incident_id, entry_id
        ))
        .add_header(rn, rv)
        .await;

    response.assert_status(axum::http::StatusCode::OK);
}

#[tokio::test]
async fn test_remove_nonexistent_reaction_returns_404() {
    let server = setup_server().await;
    let (_, responder_token, _, incident_id, entry_id) = setup_team_incident_entry(&server).await;
    let (rn, rv) = auth_header(&responder_token);

    let response = server
        .delete(&format!(
            "/incidents/{}/timeline/{}/reactions/+1",
            incident_id, entry_id
        ))
        .add_header(rn, rv)
        .await;

    response.assert_status(axum::http::StatusCode::NOT_FOUND);
    let body: serde_json::Value = response.json();
    assert_eq!(body["code"], "NOT_REACTED");
}
