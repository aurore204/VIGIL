use axum_test::TestServer;
use serde_json::json;
use sqlx::PgPool;
use vigil_server::routes::create_router;

async fn setup_server() -> TestServer {
    dotenv::dotenv().ok();
    let database_url = std::env::var("DATABASE_URL")
        .expect("DATABASE_URL doit être défini");

    let pool = PgPool::connect(&database_url)
        .await
        .expect("Impossible de se connecter à la base de test");

    let app = create_router(pool);
    TestServer::new(app).unwrap()
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
    assert!(body["token"].is_string());
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
    assert!(body["token"].is_string());
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
    let token = body["token"].as_str().unwrap();

    let response = server
        .get("/me")
        .add_header(
            axum::http::HeaderName::from_static("authorization"),
            axum::http::HeaderValue::from_str(&format!("Bearer {}", token)).unwrap(),
        )
        .await;

    response.assert_status(axum::http::StatusCode::OK);
}

#[tokio::test]
async fn test_me_returns_401_without_token() {
    let server = setup_server().await;

    let response = server.get("/me").await;

    response.assert_status(axum::http::StatusCode::UNAUTHORIZED);
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
    let token = body["token"].as_str().unwrap().to_string();

    // Logout pour révoquer le token
    server
        .post("/auth/logout")
        .add_header(
            axum::http::HeaderName::from_static("authorization"),
            axum::http::HeaderValue::from_str(&format!("Bearer {}", token)).unwrap(),
        )
        .await;

    // Réessayer GET /me avec le token révoqué
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
    let token = body["token"].as_str().unwrap();

    let response = server
        .post("/auth/logout")
        .add_header(
            axum::http::HeaderName::from_static("authorization"),
            axum::http::HeaderValue::from_str(&format!("Bearer {}", token)).unwrap(),
        )
        .await;

    response.assert_status(axum::http::StatusCode::OK);
}