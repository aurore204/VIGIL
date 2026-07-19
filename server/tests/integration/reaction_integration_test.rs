use sqlx::PgPool;
use vigil_server::models::incident::{CreateIncidentRequest, IncidentSeverity, AddTimelineEntryRequest};
use vigil_server::models::reaction::AddReactionRequest;
use vigil_server::models::team::{CreateTeamRequest, JoinTeamRequest};
use vigil_server::models::user::RegisterRequest;
use vigil_server::services::{auth_service, incident_service, reaction_service, team_service};
use vigil_server::repositories::team_repository;

async fn setup_pool() -> PgPool {
    dotenv::dotenv().ok();
    let database_url = std::env::var("DATABASE_URL").unwrap();
    PgPool::connect(&database_url).await.unwrap()
}

async fn create_user(pool: &PgPool, suffix: &str) -> (uuid::Uuid, String) {
    let req = RegisterRequest {
        email: format!("react_{}@test.com", suffix),
        password: "password123".to_string(),
        username: format!("user_{}", suffix),
    };
    let response = auth_service::register(pool, req).await.unwrap();
    (response.user.id, response.token)
}

async fn setup_team_with_responder(pool: &PgPool) -> (uuid::Uuid, uuid::Uuid, uuid::Uuid) {
    let id = uuid::Uuid::new_v4().to_string();
    let (manager_id, _) = create_user(pool, &format!("mgr_{}", id)).await;
    let (responder_id, _) = create_user(pool, &format!("rsp_{}", id)).await;

    let team = team_service::create_team(
        pool,
        CreateTeamRequest { name: format!("Team {}", id), description: None },
        manager_id,
    ).await.unwrap();

    let code = team_service::generate_invitation(pool, team.id, manager_id).await.unwrap();
    team_service::join_team(pool, JoinTeamRequest { code }, responder_id).await.unwrap();

    sqlx::query!(
        "UPDATE team_members SET role = 'responder' WHERE team_id = $1 AND user_id = $2",
        team.id, responder_id
    )
    .execute(pool)
    .await
    .unwrap();

    (team.id, manager_id, responder_id)
}

async fn create_incident_and_entry(
    pool: &PgPool,
    team_id: uuid::Uuid,
    manager_id: uuid::Uuid,
    responder_id: uuid::Uuid,
) -> (uuid::Uuid, uuid::Uuid) {
    let incident = incident_service::create_incident(
        pool, team_id, manager_id,
        CreateIncidentRequest {
            title: "Test".to_string(),
            description: None,
            severity: IncidentSeverity::Low,
        },
    ).await.unwrap();

    let entry = incident_service::add_timeline_entry(
        pool, incident.id, responder_id,
        AddTimelineEntryRequest { content: "Entrée test".to_string() },
    ).await.unwrap();

    (incident.id, entry.id)
}

#[tokio::test]
async fn test_add_reaction_succeeds() {
    let pool = setup_pool().await;
    let (team_id, manager_id, responder_id) = setup_team_with_responder(&pool).await;
    let (_, entry_id) = create_incident_and_entry(&pool, team_id, manager_id, responder_id).await;

    let result = reaction_service::add_reaction(
        &pool, entry_id, responder_id,
        AddReactionRequest { emoji: "+1".to_string() },
    ).await;

    assert!(result.is_ok());
    let reactions = result.unwrap();
    assert!(!reactions.is_empty());
    assert_eq!(reactions[0].emoji, "+1");
    assert_eq!(reactions[0].count, 1);
}

#[tokio::test]
async fn test_add_duplicate_reaction_fails() {
    let pool = setup_pool().await;
    let (team_id, manager_id, responder_id) = setup_team_with_responder(&pool).await;
    let (_, entry_id) = create_incident_and_entry(&pool, team_id, manager_id, responder_id).await;

    reaction_service::add_reaction(
        &pool, entry_id, responder_id,
        AddReactionRequest { emoji: "+1".to_string() },
    ).await.unwrap();

    let result = reaction_service::add_reaction(
        &pool, entry_id, responder_id,
        AddReactionRequest { emoji: "+1".to_string() },
    ).await;

    assert!(result.is_err());
}

#[tokio::test]
async fn test_add_invalid_emoji_fails() {
    let pool = setup_pool().await;
    let (team_id, manager_id, responder_id) = setup_team_with_responder(&pool).await;
    let (_, entry_id) = create_incident_and_entry(&pool, team_id, manager_id, responder_id).await;

    let result = reaction_service::add_reaction(
        &pool, entry_id, responder_id,
        AddReactionRequest { emoji: "invalid_emoji".to_string() },
    ).await;

    assert!(result.is_err());
}

#[tokio::test]
async fn test_remove_reaction_succeeds() {
    let pool = setup_pool().await;
    let (team_id, manager_id, responder_id) = setup_team_with_responder(&pool).await;
    let (_, entry_id) = create_incident_and_entry(&pool, team_id, manager_id, responder_id).await;

    reaction_service::add_reaction(
        &pool, entry_id, responder_id,
        AddReactionRequest { emoji: "+1".to_string() },
    ).await.unwrap();

    let result = reaction_service::remove_reaction(
        &pool, entry_id, responder_id, "+1",
    ).await;

    assert!(result.is_ok());
    let reactions = result.unwrap();
    assert!(reactions.is_empty());
}

#[tokio::test]
async fn test_remove_nonexistent_reaction_fails() {
    let pool = setup_pool().await;
    let (team_id, manager_id, responder_id) = setup_team_with_responder(&pool).await;
    let (_, entry_id) = create_incident_and_entry(&pool, team_id, manager_id, responder_id).await;

    let result = reaction_service::remove_reaction(
        &pool, entry_id, responder_id, "+1",
    ).await;

    assert!(result.is_err());
}

#[tokio::test]
async fn test_multiple_users_can_react_with_same_emoji() {
    let pool = setup_pool().await;
    let (team_id, manager_id, responder_id) = setup_team_with_responder(&pool).await;
    let (_, entry_id) = create_incident_and_entry(&pool, team_id, manager_id, responder_id).await;

    reaction_service::add_reaction(
        &pool, entry_id, responder_id,
        AddReactionRequest { emoji: "+1".to_string() },
    ).await.unwrap();

    let result = reaction_service::add_reaction(
        &pool, entry_id, manager_id,
        AddReactionRequest { emoji: "+1".to_string() },
    ).await;

    assert!(result.is_ok());
    let reactions = result.unwrap();
    assert_eq!(reactions[0].count, 2);
    assert_eq!(reactions[0].users.len(), 2);
}