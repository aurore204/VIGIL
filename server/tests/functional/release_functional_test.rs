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
            "email": format!("rel_func_{}@test.com", suffix),
            "password": "password123",
            "username": format!("user_{}", suffix)
        }))
        .await;
    let body: serde_json::Value = response.json();
    let token = body["data"]["token"].as_str().unwrap().to_string();
    let user_id = body["data"]["user"]["id"].as_str().unwrap().to_string();
    (token, user_id)
}

async fn setup_team_with_responder(server: &TestServer) -> (String, String, String, String) {
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
        .add_header(mn, mv)
        .json(&json!({"role": "responder"}))
        .await;

    (manager_token, responder_token, team_id, responder_id)
}

#[tokio::test]
async fn test_create_release_returns_201() {
    let server = setup_server().await;
    let (manager_token, _, team_id, _) = setup_team_with_responder(&server).await;
    let (mn, mv) = auth_header(&manager_token);

    let response = server
        .post(&format!("/teams/{}/releases", team_id))
        .add_header(mn, mv)
        .json(&json!({
            "title": "v1.0",
            "steps": [
                {"name": "build"},
                {"name": "staging"},
                {"name": "production"}
            ]
        }))
        .await;

    response.assert_status(axum::http::StatusCode::CREATED);
    let body: serde_json::Value = response.json();
    assert!(body["success"].as_bool().unwrap());
    assert_eq!(body["data"]["state"], "created");
    assert_eq!(body["data"]["steps"].as_array().unwrap().len(), 3);
}

#[tokio::test]
async fn test_create_release_without_steps_returns_400() {
    let server = setup_server().await;
    let (manager_token, _, team_id, _) = setup_team_with_responder(&server).await;
    let (mn, mv) = auth_header(&manager_token);

    let response = server
        .post(&format!("/teams/{}/releases", team_id))
        .add_header(mn, mv)
        .json(&json!({"title": "v1.0", "steps": []}))
        .await;

    response.assert_status(axum::http::StatusCode::BAD_REQUEST);
    let body: serde_json::Value = response.json();
    assert_eq!(body["code"], "NO_STEPS");
}

#[tokio::test]
async fn test_start_release_returns_200() {
    let server = setup_server().await;
    let (manager_token, _, team_id, _) = setup_team_with_responder(&server).await;
    let (mn, mv) = auth_header(&manager_token);

    let create_response = server
        .post(&format!("/teams/{}/releases", team_id))
        .add_header(mn.clone(), mv.clone())
        .json(&json!({"title": "v1.0", "steps": [{"name": "build"}]}))
        .await;
    let body: serde_json::Value = create_response.json();
    let release_id = body["data"]["id"].as_str().unwrap();

    let response = server
        .patch(&format!("/releases/{}/start", release_id))
        .add_header(mn, mv)
        .await;

    response.assert_status(axum::http::StatusCode::OK);
    let body: serde_json::Value = response.json();
    assert_eq!(body["data"]["state"], "in_progress");
}

#[tokio::test]
async fn test_validate_step_returns_200() {
    let server = setup_server().await;
    let (manager_token, responder_token, team_id, _) = setup_team_with_responder(&server).await;
    let (mn, mv) = auth_header(&manager_token);

    let create_response = server
        .post(&format!("/teams/{}/releases", team_id))
        .add_header(mn.clone(), mv.clone())
        .json(&json!({"title": "v1.0", "steps": [{"name": "build"}]}))
        .await;
    let body: serde_json::Value = create_response.json();
    let release_id = body["data"]["id"].as_str().unwrap();
    let step_id = body["data"]["steps"][0]["id"].as_str().unwrap();

    server
        .patch(&format!("/releases/{}/start", release_id))
        .add_header(mn, mv)
        .await;

    let (rn, rv) = auth_header(&responder_token);
    let response = server
        .patch(&format!(
            "/releases/{}/steps/{}/validate",
            release_id, step_id
        ))
        .add_header(rn, rv)
        .await;

    response.assert_status(axum::http::StatusCode::OK);
    let body: serde_json::Value = response.json();
    assert_eq!(body["data"]["state"], "completed");
}

#[tokio::test]
async fn test_cancel_release_returns_200() {
    let server = setup_server().await;
    let (manager_token, _, team_id, _) = setup_team_with_responder(&server).await;
    let (mn, mv) = auth_header(&manager_token);

    let create_response = server
        .post(&format!("/teams/{}/releases", team_id))
        .add_header(mn.clone(), mv.clone())
        .json(&json!({"title": "v1.0", "steps": [{"name": "build"}]}))
        .await;
    let body: serde_json::Value = create_response.json();
    let release_id = body["data"]["id"].as_str().unwrap();

    let response = server
        .patch(&format!("/releases/{}/cancel", release_id))
        .add_header(mn, mv)
        .await;

    response.assert_status(axum::http::StatusCode::OK);
}

#[tokio::test]
async fn test_get_team_releases_returns_200() {
    let server = setup_server().await;
    let (manager_token, _, team_id, _) = setup_team_with_responder(&server).await;
    let (mn, mv) = auth_header(&manager_token);

    server
        .post(&format!("/teams/{}/releases", team_id))
        .add_header(mn.clone(), mv.clone())
        .json(&json!({"title": "v1.0", "steps": [{"name": "build"}]}))
        .await;

    let response = server
        .get(&format!("/teams/{}/releases", team_id))
        .add_header(mn, mv)
        .await;

    response.assert_status(axum::http::StatusCode::OK);
    let body: serde_json::Value = response.json();
    assert_eq!(body["data"].as_array().unwrap().len(), 1);
}

#[tokio::test]
async fn test_observer_cannot_validate_step() {
    let server = setup_server().await;
    let (manager_token, _, team_id, _) = setup_team_with_responder(&server).await;
    let (mn, mv) = auth_header(&manager_token);

    let create_response = server
        .post(&format!("/teams/{}/releases", team_id))
        .add_header(mn.clone(), mv.clone())
        .json(&json!({"title": "v1.0", "steps": [{"name": "build"}]}))
        .await;
    let body: serde_json::Value = create_response.json();
    let release_id = body["data"]["id"].as_str().unwrap();
    let step_id = body["data"]["steps"][0]["id"].as_str().unwrap();

    server
        .patch(&format!("/releases/{}/start", release_id))
        .add_header(mn.clone(), mv.clone())
        .await;

    let id = uuid::Uuid::new_v4().to_string();
    let (observer_token, _) = register_and_get_token(&server, &id).await;
    let invite = server
        .post(&format!("/teams/{}/invitations", team_id))
        .add_header(mn, mv)
        .await;
    let body: serde_json::Value = invite.json();
    let code = body["data"]["code"].as_str().unwrap();

    let (on, ov) = auth_header(&observer_token);
    server
        .post("/teams/join")
        .add_header(on.clone(), ov.clone())
        .json(&json!({"code": code}))
        .await;

    let response = server
        .patch(&format!(
            "/releases/{}/steps/{}/validate",
            release_id, step_id
        ))
        .add_header(on, ov)
        .await;

    response.assert_status(axum::http::StatusCode::FORBIDDEN);
}
