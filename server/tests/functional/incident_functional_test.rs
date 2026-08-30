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
            "email": format!("inc_func_{}@test.com", suffix),
            "password": "password123",
            "username": format!("user_{}", suffix)
        }))
        .await;
    let body: serde_json::Value = response.json();
    let token = body["data"]["token"].as_str().unwrap().to_string();
    let user_id = body["data"]["user"]["id"].as_str().unwrap().to_string();
    (token, user_id)
}

async fn setup_team_and_get_ids(server: &TestServer) -> (String, String, String, String) {
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

    let invite_response = server
        .post(&format!("/teams/{}/invitations", team_id))
        .add_header(mn.clone(), mv.clone())
        .await;
    let body: serde_json::Value = invite_response.json();
    let code = body["data"]["code"].as_str().unwrap().to_string();

    let (rn, rv) = auth_header(&responder_token);
    server
        .post("/teams/join")
        .add_header(rn, rv)
        .json(&json!({"code": code}))
        .await;

    // Promouvoir en Responder via l'API
    server
        .patch(&format!("/teams/{}/members/{}/role", team_id, responder_id))
        .add_header(mn, mv)
        .json(&json!({"role": "responder"}))
        .await;

    (team_id, manager_token, responder_token, responder_id)
}

#[tokio::test]
async fn test_create_incident_returns_201() {
    let server = setup_server().await;
    let (team_id, manager_token, _, _) = setup_team_and_get_ids(&server).await;
    let (mn, mv) = auth_header(&manager_token);

    let response = server
        .post(&format!("/teams/{}/incidents", team_id))
        .add_header(mn, mv)
        .json(&json!({
            "title": "Production down",
            "severity": "high"
        }))
        .await;

    response.assert_status(axum::http::StatusCode::CREATED);
    let body: serde_json::Value = response.json();
    assert!(body["success"].as_bool().unwrap());
    assert_eq!(body["data"]["state"], "open");
}

#[tokio::test]
async fn test_create_incident_as_observer_returns_403() {
    let server = setup_server().await;
    let (team_id, manager_token, _, _) = setup_team_and_get_ids(&server).await;

    let id = uuid::Uuid::new_v4().to_string();
    let (observer_token, _) = register_and_get_token(&server, &id).await;

    let (mn, mv) = auth_header(&manager_token);
    let invite_response = server
        .post(&format!("/teams/{}/invitations", team_id))
        .add_header(mn, mv)
        .await;
    let body: serde_json::Value = invite_response.json();
    let code = body["data"]["code"].as_str().unwrap();

    let (on, ov) = auth_header(&observer_token);
    server
        .post("/teams/join")
        .add_header(on.clone(), ov.clone())
        .json(&json!({"code": code}))
        .await;

    let response = server
        .post(&format!("/teams/{}/incidents", team_id))
        .add_header(on, ov)
        .json(&json!({"title": "Test", "severity": "low"}))
        .await;

    response.assert_status(axum::http::StatusCode::FORBIDDEN);
    let body: serde_json::Value = response.json();
    assert_eq!(body["code"], "NOT_MANAGER");
}

#[tokio::test]
async fn test_acknowledge_incident_returns_200() {
    let server = setup_server().await;
    let (team_id, manager_token, responder_token, _) = setup_team_and_get_ids(&server).await;

    let (mn, mv) = auth_header(&manager_token);
    let create_response = server
        .post(&format!("/teams/{}/incidents", team_id))
        .add_header(mn, mv)
        .json(&json!({"title": "Test", "severity": "low"}))
        .await;
    let body: serde_json::Value = create_response.json();
    let incident_id = body["data"]["id"].as_str().unwrap();

    let (rn, rv) = auth_header(&responder_token);
    let response = server
        .patch(&format!("/incidents/{}/acknowledge", incident_id))
        .add_header(rn, rv)
        .await;

    response.assert_status(axum::http::StatusCode::OK);
    let body: serde_json::Value = response.json();
    assert_eq!(body["data"]["state"], "acknowledged");
}

#[tokio::test]
async fn test_invalid_transition_returns_400() {
    let server = setup_server().await;
    let (team_id, manager_token, responder_token, _) = setup_team_and_get_ids(&server).await;

    let (mn, mv) = auth_header(&manager_token);
    let create_response = server
        .post(&format!("/teams/{}/incidents", team_id))
        .add_header(mn.clone(), mv.clone())
        .json(&json!({"title": "Test", "severity": "low"}))
        .await;
    let body: serde_json::Value = create_response.json();
    let incident_id = body["data"]["id"].as_str().unwrap();

    // Résoudre directement sans acquitter d'abord (open → resolved est autorisé)
    // Tester resolved → acknowledged qui est interdit
    server
        .patch(&format!("/incidents/{}/resolve", incident_id))
        .add_header(mn, mv)
        .await;

    let (rn, rv) = auth_header(&responder_token);
    let response = server
        .patch(&format!("/incidents/{}/acknowledge", incident_id))
        .add_header(rn, rv)
        .await;

    response.assert_status(axum::http::StatusCode::BAD_REQUEST);
    let body: serde_json::Value = response.json();
    assert_eq!(body["code"], "INVALID_STATE_TRANSITION");
}

#[tokio::test]
async fn test_add_timeline_entry_returns_201() {
    let server = setup_server().await;
    let (team_id, manager_token, responder_token, _) = setup_team_and_get_ids(&server).await;

    let (mn, mv) = auth_header(&manager_token);
    let create_response = server
        .post(&format!("/teams/{}/incidents", team_id))
        .add_header(mn, mv)
        .json(&json!({"title": "Test", "severity": "low"}))
        .await;
    let body: serde_json::Value = create_response.json();
    let incident_id = body["data"]["id"].as_str().unwrap();

    let (rn, rv) = auth_header(&responder_token);
    let response = server
        .post(&format!("/incidents/{}/timeline", incident_id))
        .add_header(rn, rv)
        .json(&json!({"content": "Investigation en cours"}))
        .await;

    response.assert_status(axum::http::StatusCode::CREATED);
    let body: serde_json::Value = response.json();
    assert_eq!(body["data"]["content"], "Investigation en cours");
    assert_eq!(
        body["data"]["author_username"],
        "user_rsp_".to_string()
            + &body["data"]["author_username"]
                .as_str()
                .unwrap()
                .replace("user_rsp_", "")
    );
}

#[tokio::test]
async fn test_get_incident_with_timeline_returns_200() {
    let server = setup_server().await;
    let (team_id, manager_token, responder_token, _) = setup_team_and_get_ids(&server).await;

    let (mn, mv) = auth_header(&manager_token);
    let create_response = server
        .post(&format!("/teams/{}/incidents", team_id))
        .add_header(mn, mv)
        .json(&json!({"title": "Test", "severity": "low"}))
        .await;
    let body: serde_json::Value = create_response.json();
    let incident_id = body["data"]["id"].as_str().unwrap();

    let (rn, rv) = auth_header(&responder_token);
    server
        .post(&format!("/incidents/{}/timeline", incident_id))
        .add_header(rn.clone(), rv.clone())
        .json(&json!({"content": "Entrée 1"}))
        .await;

    let response = server
        .get(&format!("/incidents/{}", incident_id))
        .add_header(rn, rv)
        .await;

    response.assert_status(axum::http::StatusCode::OK);
    let body: serde_json::Value = response.json();
    assert_eq!(body["data"]["timeline"].as_array().unwrap().len(), 1);
}

#[tokio::test]
async fn test_get_incident_as_non_member_returns_403() {
    let server = setup_server().await;
    let (team_id, manager_token, _, _) = setup_team_and_get_ids(&server).await;

    let (mn, mv) = auth_header(&manager_token);
    let create_response = server
        .post(&format!("/teams/{}/incidents", team_id))
        .add_header(mn, mv)
        .json(&json!({"title": "Test", "severity": "low"}))
        .await;
    let body: serde_json::Value = create_response.json();
    let incident_id = body["data"]["id"].as_str().unwrap();

    let id = uuid::Uuid::new_v4().to_string();
    let (stranger_token, _) = register_and_get_token(&server, &id).await;
    let (sn, sv) = auth_header(&stranger_token);

    let response = server
        .get(&format!("/incidents/{}", incident_id))
        .add_header(sn, sv)
        .await;

    response.assert_status(axum::http::StatusCode::FORBIDDEN);
}

#[tokio::test]
async fn test_update_incident_returns_200() {
    let server = setup_server().await;
    let (team_id, manager_token, _, _) = setup_team_and_get_ids(&server).await;
    let (mn, mv) = auth_header(&manager_token);

    let create_response = server
        .post(&format!("/teams/{}/incidents", team_id))
        .add_header(mn.clone(), mv.clone())
        .json(&json!({"title": "Titre original", "severity": "low"}))
        .await;
    let body: serde_json::Value = create_response.json();
    let incident_id = body["data"]["id"].as_str().unwrap();

    let response = server
        .patch(&format!("/incidents/{}", incident_id))
        .add_header(mn, mv)
        .json(&json!({"title": "Titre modifié", "severity": "high"}))
        .await;

    response.assert_status(axum::http::StatusCode::OK);
    let body: serde_json::Value = response.json();
    assert_eq!(body["data"]["title"], "Titre modifié");
    assert_eq!(body["data"]["severity"], "high");
}

#[tokio::test]
async fn test_cancel_incident_returns_200() {
    let server = setup_server().await;
    let (team_id, manager_token, _, _) = setup_team_and_get_ids(&server).await;
    let (mn, mv) = auth_header(&manager_token);

    let create_response = server
        .post(&format!("/teams/{}/incidents", team_id))
        .add_header(mn.clone(), mv.clone())
        .json(&json!({"title": "Test", "severity": "low"}))
        .await;
    let body: serde_json::Value = create_response.json();
    let incident_id = body["data"]["id"].as_str().unwrap();

    let response = server
        .delete(&format!("/incidents/{}", incident_id))
        .add_header(mn, mv)
        .await;

    response.assert_status(axum::http::StatusCode::OK);
}
