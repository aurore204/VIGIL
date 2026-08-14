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

#[tokio::test]
async fn test_register_returns_201_with_token() {
    let server = setup_server().await;
    let email = format!("func_{}@test.com", uuid::Uuid::new_v4());

    let response = server
        .post("/auth/register")
        .json(&json!({
            "email": email,
            "password": "password123",
            "username": format!("user_{}", uuid::Uuid::new_v4())
        }))
        .await;

    response.assert_status(axum::http::StatusCode::CREATED);
    let body: serde_json::Value = response.json();
    assert!(body["success"].as_bool().unwrap());
    assert!(body["data"]["token"].is_string());
}

#[tokio::test]
async fn test_register_returns_409_for_duplicate_email() {
    let server = setup_server().await;
    let email = format!("dupfunc_{}@test.com", uuid::Uuid::new_v4());

    server
        .post("/auth/register")
        .json(&json!({
            "email": email,
            "password": "password123",
            "username": format!("user1_{}", uuid::Uuid::new_v4())
        }))
        .await;

    let response = server
        .post("/auth/register")
        .json(&json!({
            "email": email,
            "password": "password456",
            "username": format!("user2_{}", uuid::Uuid::new_v4())
        }))
        .await;

    response.assert_status(axum::http::StatusCode::CONFLICT);
    let body: serde_json::Value = response.json();
    assert!(!body["success"].as_bool().unwrap());
    assert_eq!(body["code"], "EMAIL_ALREADY_EXISTS");
}

#[tokio::test]
async fn test_login_returns_200_with_token() {
    let server = setup_server().await;
    let email = format!("loginfunc_{}@test.com", uuid::Uuid::new_v4());
    let password = "password123";

    server
        .post("/auth/register")
        .json(&json!({
            "email": email,
            "password": password,
            "username": format!("user_{}", uuid::Uuid::new_v4())
        }))
        .await;

    let response = server
        .post("/auth/login")
        .json(&json!({
            "email": email,
            "password": password
        }))
        .await;

    response.assert_status(axum::http::StatusCode::OK);
    let body: serde_json::Value = response.json();
    assert!(body["success"].as_bool().unwrap());
    assert!(body["data"]["token"].is_string());
}

#[tokio::test]
async fn test_login_returns_401_with_wrong_password() {
    let server = setup_server().await;
    let email = format!("wrongfunc_{}@test.com", uuid::Uuid::new_v4());

    server
        .post("/auth/register")
        .json(&json!({
            "email": email,
            "password": "correctpassword",
            "username": format!("user_{}", uuid::Uuid::new_v4())
        }))
        .await;

    let response = server
        .post("/auth/login")
        .json(&json!({
            "email": email,
            "password": "wrongpassword"
        }))
        .await;

    response.assert_status(axum::http::StatusCode::UNAUTHORIZED);
    let body: serde_json::Value = response.json();
    assert!(!body["success"].as_bool().unwrap());
    assert_eq!(body["code"], "INVALID_CREDENTIALS");
}

#[tokio::test]
async fn test_me_returns_200_with_valid_token() {
    let server = setup_server().await;
    let email = format!("mefunc_{}@test.com", uuid::Uuid::new_v4());

    let register_response = server
        .post("/auth/register")
        .json(&json!({
            "email": email,
            "password": "password123",
            "username": format!("user_{}", uuid::Uuid::new_v4())
        }))
        .await;

    let body: serde_json::Value = register_response.json();
    let token = body["data"]["token"].as_str().unwrap();

    let response = server
        .get("/me")
        .add_header(
            axum::http::HeaderName::from_static("authorization"),
            axum::http::HeaderValue::from_str(&format!("Bearer {}", token)).unwrap(),
        )
        .await;

    response.assert_status(axum::http::StatusCode::OK);
    let body: serde_json::Value = response.json();
    assert!(body["success"].as_bool().unwrap());
}

#[tokio::test]
async fn test_me_returns_401_without_token() {
    let server = setup_server().await;

    let response = server.get("/me").await;

    response.assert_status(axum::http::StatusCode::UNAUTHORIZED);
    let body: serde_json::Value = response.json();
    assert!(!body["success"].as_bool().unwrap());
}

#[tokio::test]
async fn test_me_returns_401_with_revoked_token() {
    let server = setup_server().await;
    let email = format!("revokedfunc_{}@test.com", uuid::Uuid::new_v4());

    let register_response = server
        .post("/auth/register")
        .json(&json!({
            "email": email,
            "password": "password123",
            "username": format!("user_{}", uuid::Uuid::new_v4())
        }))
        .await;

    let body: serde_json::Value = register_response.json();
    let token = body["data"]["token"].as_str().unwrap().to_string();

    server
        .post("/auth/logout")
        .add_header(
            axum::http::HeaderName::from_static("authorization"),
            axum::http::HeaderValue::from_str(&format!("Bearer {}", token)).unwrap(),
        )
        .await;

    let response = server
        .get("/me")
        .add_header(
            axum::http::HeaderName::from_static("authorization"),
            axum::http::HeaderValue::from_str(&format!("Bearer {}", token)).unwrap(),
        )
        .await;

    response.assert_status(axum::http::StatusCode::UNAUTHORIZED);
}

#[tokio::test]
async fn test_logout_returns_200() {
    let server = setup_server().await;
    let email = format!("logoutfunc_{}@test.com", uuid::Uuid::new_v4());

    let register_response = server
        .post("/auth/register")
        .json(&json!({
            "email": email,
            "password": "password123",
            "username": format!("user_{}", uuid::Uuid::new_v4())
        }))
        .await;

    let body: serde_json::Value = register_response.json();
    let token = body["data"]["token"].as_str().unwrap();

    let response = server
        .post("/auth/logout")
        .add_header(
            axum::http::HeaderName::from_static("authorization"),
            axum::http::HeaderValue::from_str(&format!("Bearer {}", token)).unwrap(),
        )
        .await;

    response.assert_status(axum::http::StatusCode::OK);
    let body: serde_json::Value = response.json();
    assert!(body["success"].as_bool().unwrap());
}
#[tokio::test]
async fn test_update_profile_changes_username() {
    let server = setup_server().await;
    let email = format!("updateprofile_{}@test.com", uuid::Uuid::new_v4());

    let register_response = server
        .post("/auth/register")
        .json(&json!({
            "email": email,
            "password": "password123",
            "username": format!("user_{}", uuid::Uuid::new_v4())
        }))
        .await;
    let body: serde_json::Value = register_response.json();
    let token = body["data"]["token"].as_str().unwrap();

    let response = server
        .patch("/me")
        .add_header(
            axum::http::HeaderName::from_static("authorization"),
            axum::http::HeaderValue::from_str(&format!("Bearer {}", token)).unwrap(),
        )
        .json(&json!({"username": format!("nouveau_nom_{}", uuid::Uuid::new_v4())}))
        .await;

    response.assert_status(axum::http::StatusCode::OK);
}

#[tokio::test]
async fn test_update_profile_password_change_requires_current_password() {
    let server = setup_server().await;
    let email = format!("updatepw_{}@test.com", uuid::Uuid::new_v4());

    let register_response = server
        .post("/auth/register")
        .json(&json!({
            "email": email,
            "password": "password123",
            "username": format!("user_{}", uuid::Uuid::new_v4())
        }))
        .await;
    let body: serde_json::Value = register_response.json();
    let token = body["data"]["token"].as_str().unwrap();

    let response = server
        .patch("/me")
        .add_header(
            axum::http::HeaderName::from_static("authorization"),
            axum::http::HeaderValue::from_str(&format!("Bearer {}", token)).unwrap(),
        )
        .json(&json!({"new_password": "nouveaupass123"}))
        .await;

    response.assert_status(axum::http::StatusCode::BAD_REQUEST);
    let body: serde_json::Value = response.json();
    assert_eq!(body["code"], "CURRENT_PASSWORD_REQUIRED");
}

#[tokio::test]
async fn test_update_profile_with_wrong_current_password_returns_401() {
    let server = setup_server().await;
    let email = format!("updatewrongpw_{}@test.com", uuid::Uuid::new_v4());

    let register_response = server
        .post("/auth/register")
        .json(&json!({
            "email": email,
            "password": "password123",
            "username": format!("user_{}", uuid::Uuid::new_v4())
        }))
        .await;
    let body: serde_json::Value = register_response.json();
    let token = body["data"]["token"].as_str().unwrap();

    let response = server
        .patch("/me")
        .add_header(
            axum::http::HeaderName::from_static("authorization"),
            axum::http::HeaderValue::from_str(&format!("Bearer {}", token)).unwrap(),
        )
        .json(&json!({
            "current_password": "mauvais-mot-de-passe",
            "new_password": "nouveaupass123"
        }))
        .await;

    response.assert_status(axum::http::StatusCode::UNAUTHORIZED);
    let body: serde_json::Value = response.json();
    assert_eq!(body["code"], "INVALID_CURRENT_PASSWORD");
}

#[tokio::test]
async fn test_update_profile_password_change_succeeds_and_new_password_works() {
    let server = setup_server().await;
    let email = format!("updatepwok_{}@test.com", uuid::Uuid::new_v4());

    let register_response = server
        .post("/auth/register")
        .json(&json!({
            "email": email,
            "password": "ancienpass123",
            "username": format!("user_{}", uuid::Uuid::new_v4())
        }))
        .await;
    let body: serde_json::Value = register_response.json();
    let token = body["data"]["token"].as_str().unwrap();

    server
        .patch("/me")
        .add_header(
            axum::http::HeaderName::from_static("authorization"),
            axum::http::HeaderValue::from_str(&format!("Bearer {}", token)).unwrap(),
        )
        .json(&json!({
            "current_password": "ancienpass123",
            "new_password": "nouveaupass456"
        }))
        .await;

    let login_response = server
        .post("/auth/login")
        .json(&json!({"email": email, "password": "nouveaupass456"}))
        .await;

    login_response.assert_status(axum::http::StatusCode::OK);
}