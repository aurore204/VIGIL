use axum_test::TestServer;
use serde_json::json;
use sqlx::PgPool;
use vigil_server::models::rule::RuleLogStatus;
use vigil_server::repositories::rule_repository;
use vigil_server::routes::create_router;

async fn setup_test_pool() -> PgPool {
    dotenv::dotenv().ok();
    let database_url = std::env::var("DATABASE_URL").unwrap();
    PgPool::connect(&database_url).await.unwrap()
}

async fn setup_server(pool: PgPool) -> TestServer {
    let state = vigil_server::state::AppState::new(
        pool,
        vigil_server::websocket::broadcaster::Broadcaster::new(),
    );
    TestServer::new(create_router(state)).unwrap()
}

// Crée un utilisateur + une team via l'API, pour obtenir un team_id et un user_id
async fn create_valid_team(server: &TestServer, suffix: &str) -> (uuid::Uuid, uuid::Uuid) {
    let register_response = server
        .post("/auth/register")
        .json(&json!({
            "email": format!("rule_repo_{}@test.com", suffix),
            "password": "password123",
            "username": format!("user_{}", suffix)
        }))
        .await;
    let register_body: serde_json::Value = register_response.json();
    let token = register_body["data"]["token"].as_str().unwrap().to_string();

    let create_response = server
        .post("/teams")
        .add_header(
            axum::http::HeaderName::from_static("authorization"),
            axum::http::HeaderValue::from_str(&format!("Bearer {}", token)).unwrap(),
        )
        .json(&json!({"name": "Team Integration Test"}))
        .await;
    let body: serde_json::Value = create_response.json();
    let team_id = uuid::Uuid::parse_str(body["data"]["id"].as_str().unwrap()).unwrap();
    let user_id = uuid::Uuid::parse_str(body["data"]["manager_id"].as_str().unwrap()).unwrap();

    (team_id, user_id)
}

fn sample_trigger() -> serde_json::Value {
    json!({
        "service": "github",
        "event": "workflow_run",
        "filters": { "conclusion": "failure" }
    })
}

fn sample_reaction() -> serde_json::Value {
    json!({
        "type": "vigil_create_incident",
        "payload": { "title": "Incident automatique", "severity": "high" }
    })
}

#[tokio::test]
async fn test_create_rule_persists_correctly() {
    let pool = setup_test_pool().await;
    let server = setup_server(pool.clone()).await;
    let (team_id, user_id) = create_valid_team(&server, &uuid::Uuid::new_v4().to_string()).await;

    let rule = rule_repository::create_rule(
        &pool,
        team_id,
        user_id,
        "Ma règle de test",
        true,
        sample_trigger(),
        sample_reaction(),
    )
    .await
    .expect("la création de la règle doit réussir");

    assert_eq!(rule.name, "Ma règle de test");
    assert_eq!(rule.team_id, team_id);
    assert_eq!(rule.created_by, user_id);
    assert!(rule.enabled);
}

#[tokio::test]
async fn test_find_by_id_returns_created_rule() {
    let pool = setup_test_pool().await;
    let server = setup_server(pool.clone()).await;
    let (team_id, user_id) = create_valid_team(&server, &uuid::Uuid::new_v4().to_string()).await;

    let created = rule_repository::create_rule(
        &pool,
        team_id,
        user_id,
        "Règle à retrouver",
        true,
        sample_trigger(),
        sample_reaction(),
    )
    .await
    .unwrap();

    let found = rule_repository::find_by_id(&pool, created.id)
        .await
        .unwrap();

    assert!(found.is_some());
    assert_eq!(found.unwrap().id, created.id);
}

#[tokio::test]
async fn test_find_by_id_returns_none_for_unknown_id() {
    let pool = setup_test_pool().await;

    let result = rule_repository::find_by_id(&pool, uuid::Uuid::new_v4())
        .await
        .unwrap();

    assert!(result.is_none());
}

#[tokio::test]
async fn test_find_by_team_returns_all_team_rules() {
    let pool = setup_test_pool().await;
    let server = setup_server(pool.clone()).await;
    let (team_id, user_id) = create_valid_team(&server, &uuid::Uuid::new_v4().to_string()).await;

    rule_repository::create_rule(
        &pool, team_id, user_id, "Règle 1", true, sample_trigger(), sample_reaction(),
    )
    .await
    .unwrap();
    rule_repository::create_rule(
        &pool, team_id, user_id, "Règle 2", true, sample_trigger(), sample_reaction(),
    )
    .await
    .unwrap();

    let rules = rule_repository::find_by_team(&pool, team_id).await.unwrap();

    assert_eq!(rules.len(), 2);
}

#[tokio::test]
async fn test_find_by_team_returns_empty_for_team_without_rules() {
    let pool = setup_test_pool().await;
    let server = setup_server(pool.clone()).await;
    let (team_id, _user_id) = create_valid_team(&server, &uuid::Uuid::new_v4().to_string()).await;

    let rules = rule_repository::find_by_team(&pool, team_id).await.unwrap();

    assert!(rules.is_empty());
}

#[tokio::test]
async fn test_find_matching_rules_matches_service_and_event() {
    let pool = setup_test_pool().await;
    let server = setup_server(pool.clone()).await;
    let (team_id, user_id) = create_valid_team(&server, &uuid::Uuid::new_v4().to_string()).await;

    rule_repository::create_rule(
        &pool, team_id, user_id, "Règle GitHub", true, sample_trigger(), sample_reaction(),
    )
    .await
    .unwrap();

    let matches = rule_repository::find_matching_rules(&pool, team_id, "github", "workflow_run")
        .await
        .unwrap();

    assert_eq!(matches.len(), 1);
}

#[tokio::test]
async fn test_find_matching_rules_ignores_disabled_rules() {
    let pool = setup_test_pool().await;
    let server = setup_server(pool.clone()).await;
    let (team_id, user_id) = create_valid_team(&server, &uuid::Uuid::new_v4().to_string()).await;

    rule_repository::create_rule(
        &pool, team_id, user_id, "Règle désactivée", false, sample_trigger(), sample_reaction(),
    )
    .await
    .unwrap();

    let matches = rule_repository::find_matching_rules(&pool, team_id, "github", "workflow_run")
        .await
        .unwrap();

    assert!(matches.is_empty());
}

#[tokio::test]
async fn test_find_matching_rules_ignores_different_service() {
    let pool = setup_test_pool().await;
    let server = setup_server(pool.clone()).await;
    let (team_id, user_id) = create_valid_team(&server, &uuid::Uuid::new_v4().to_string()).await;

    rule_repository::create_rule(
        &pool, team_id, user_id, "Règle GitLab", true,
        json!({"service": "gitlab", "event": "pipeline"}),
        sample_reaction(),
    )
    .await
    .unwrap();

    let matches = rule_repository::find_matching_rules(&pool, team_id, "github", "workflow_run")
        .await
        .unwrap();

    assert!(matches.is_empty());
}

#[tokio::test]
async fn test_log_execution_success_does_not_error() {
    let pool = setup_test_pool().await;
    let server = setup_server(pool.clone()).await;
    let (team_id, user_id) = create_valid_team(&server, &uuid::Uuid::new_v4().to_string()).await;

    let rule = rule_repository::create_rule(
        &pool, team_id, user_id, "Règle avec log", true, sample_trigger(), sample_reaction(),
    )
    .await
    .unwrap();

    let result = rule_repository::log_execution(
        &pool,
        rule.id,
        RuleLogStatus::Success,
        "incident_created",
        Some(uuid::Uuid::new_v4()),
    )
    .await;

    assert!(result.is_ok());
}

#[tokio::test]
async fn test_log_execution_failure_does_not_error() {
    let pool = setup_test_pool().await;
    let server = setup_server(pool.clone()).await;
    let (team_id, user_id) = create_valid_team(&server, &uuid::Uuid::new_v4().to_string()).await;

    let rule = rule_repository::create_rule(
        &pool, team_id, user_id, "Règle avec échec", true, sample_trigger(), sample_reaction(),
    )
    .await
    .unwrap();

    let result = rule_repository::log_execution(
        &pool,
        rule.id,
        RuleLogStatus::Failed,
        "service_unavailable",
        None,
    )
    .await;

    assert!(result.is_ok());
}