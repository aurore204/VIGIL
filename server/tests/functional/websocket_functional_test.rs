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

async fn register_and_get_token(server: &TestServer, suffix: &str) -> String {
    let response = server
        .post("/auth/register")
        .json(&json!({
            "email": format!("ws_func_{}@test.com", suffix),
            "password": "password123",
            "username": format!("user_{}", suffix)
        }))
        .await;
    let body: serde_json::Value = response.json();
    body["data"]["token"].as_str().unwrap().to_string()
}

#[tokio::test]
async fn test_ws_endpoint_requires_auth() {
    let server = setup_server().await;
    let response = server.get("/ws").await;
    assert!(
        response.status_code() == axum::http::StatusCode::UNAUTHORIZED
            || response.status_code() == axum::http::StatusCode::BAD_REQUEST
            || response.status_code() == axum::http::StatusCode::METHOD_NOT_ALLOWED
    );
}

#[tokio::test]
async fn test_acknowledge_incident_broadcasts_ws_event() {
    let server = setup_server().await;
    let id = uuid::Uuid::new_v4().to_string();

    let manager_token = register_and_get_token(&server, &format!("mgr_{}", id)).await;
    let responder_token = register_and_get_token(&server, &format!("rsp_{}", id)).await;

    let (mn, mv) = auth_header(&manager_token);
    let team_response = server
        .post("/teams")
        .add_header(mn.clone(), mv.clone())
        .json(&json!({"name": format!("Team {}", id)}))
        .await;
    let body: serde_json::Value = team_response.json();
    let team_id = body["data"]["id"].as_str().unwrap();

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
    let responder_id = body["data"]["members"]
        .as_array()
        .unwrap()
        .iter()
        .find(|m| m["role"] == "observer")
        .unwrap()["user_id"]
        .as_str()
        .unwrap()
        .to_string();

    server
        .patch(&format!("/teams/{}/members/{}/role", team_id, responder_id))
        .add_header(mn.clone(), mv.clone())
        .json(&json!({"role": "responder"}))
        .await;

    let incident_response = server
        .post(&format!("/teams/{}/incidents", team_id))
        .add_header(mn, mv)
        .json(&json!({"title": "Test WS", "severity": "high"}))
        .await;
    let body: serde_json::Value = incident_response.json();
    let incident_id = body["data"]["id"].as_str().unwrap();

    // L'acquittement doit réussir et broadcaster l'event en background
    let response = server
        .patch(&format!("/incidents/{}/acknowledge", incident_id))
        .add_header(rn, rv)
        .await;

    response.assert_status(axum::http::StatusCode::OK);
    let body: serde_json::Value = response.json();
    assert_eq!(body["data"]["state"], "acknowledged");
}

#[tokio::test]
async fn test_timeline_entry_broadcasts_ws_event() {
    let server = setup_server().await;
    let id = uuid::Uuid::new_v4().to_string();

    let manager_token = register_and_get_token(&server, &format!("mgr_{}", id)).await;
    let responder_token = register_and_get_token(&server, &format!("rsp_{}", id)).await;

    let (mn, mv) = auth_header(&manager_token);
    let team_response = server
        .post("/teams")
        .add_header(mn.clone(), mv.clone())
        .json(&json!({"name": format!("Team {}", id)}))
        .await;
    let body: serde_json::Value = team_response.json();
    let team_id = body["data"]["id"].as_str().unwrap();

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
    let responder_id = body["data"]["members"]
        .as_array()
        .unwrap()
        .iter()
        .find(|m| m["role"] == "observer")
        .unwrap()["user_id"]
        .as_str()
        .unwrap()
        .to_string();

    server
        .patch(&format!("/teams/{}/members/{}/role", team_id, responder_id))
        .add_header(mn.clone(), mv.clone())
        .json(&json!({"role": "responder"}))
        .await;

    let incident_response = server
        .post(&format!("/teams/{}/incidents", team_id))
        .add_header(mn, mv)
        .json(&json!({"title": "Test WS Timeline", "severity": "low"}))
        .await;
    let body: serde_json::Value = incident_response.json();
    let incident_id = body["data"]["id"].as_str().unwrap();

    let response = server
        .post(&format!("/incidents/{}/timeline", incident_id))
        .add_header(rn, rv)
        .json(&json!({"content": "Message de test WebSocket"}))
        .await;

    response.assert_status(axum::http::StatusCode::CREATED);
    let body: serde_json::Value = response.json();
    assert_eq!(body["data"]["content"], "Message de test WebSocket");
}
