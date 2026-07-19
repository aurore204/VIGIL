use sqlx::PgPool;
use vigil_server::models::incident::{
    AddTimelineEntryRequest, AssignIncidentRequest, CreateIncidentRequest,
    EscalateIncidentRequest, IncidentSeverity, IncidentState,
};
use vigil_server::models::team::CreateTeamRequest;
use vigil_server::models::user::RegisterRequest;
use vigil_server::services::{auth_service, incident_service, team_service};
use vigil_server::repositories::team_repository;

async fn setup_pool() -> PgPool {
    dotenv::dotenv().ok();
    let database_url = std::env::var("DATABASE_URL").unwrap();
    PgPool::connect(&database_url).await.unwrap()
}

async fn create_user(pool: &PgPool, suffix: &str) -> (uuid::Uuid, String) {
    let req = RegisterRequest {
        email: format!("inc_{}@test.com", suffix),
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
    team_service::join_team(
        pool,
        vigil_server::models::team::JoinTeamRequest { code },
        responder_id,
    ).await.unwrap();

    // Promouvoir en Responder
    sqlx::query!(
        "UPDATE team_members SET role = 'responder' WHERE team_id = $1 AND user_id = $2",
        team.id,
        responder_id
    )
    .execute(pool)
    .await
    .unwrap();

    (team.id, manager_id, responder_id)
}

#[tokio::test]
async fn test_create_incident_as_manager_succeeds() {
    let pool = setup_pool().await;
    let (team_id, manager_id, _) = setup_team_with_responder(&pool).await;

    let req = CreateIncidentRequest {
        title: "Test incident".to_string(),
        description: None,
        severity: IncidentSeverity::High,
    };

    let result = incident_service::create_incident(&pool, team_id, manager_id, req).await;
    assert!(result.is_ok());
    let incident = result.unwrap();
    assert_eq!(incident.state, IncidentState::Open);
}

#[tokio::test]
async fn test_create_incident_as_observer_fails() {
    let pool = setup_pool().await;
    let (team_id, manager_id, _) = setup_team_with_responder(&pool).await;

    let id = uuid::Uuid::new_v4().to_string();
    let (observer_id, _) = create_user(&pool, &format!("obs_{}", id)).await;
    let code = team_service::generate_invitation(&pool, team_id, manager_id).await.unwrap();
    team_service::join_team(
        &pool,
        vigil_server::models::team::JoinTeamRequest { code },
        observer_id,
    ).await.unwrap();

    let req = CreateIncidentRequest {
        title: "Test".to_string(),
        description: None,
        severity: IncidentSeverity::Low,
    };

    let result = incident_service::create_incident(&pool, team_id, observer_id, req).await;
    assert!(result.is_err());
}

#[tokio::test]
async fn test_acknowledge_incident_as_responder_succeeds() {
    let pool = setup_pool().await;
    let (team_id, manager_id, responder_id) = setup_team_with_responder(&pool).await;

    let incident = incident_service::create_incident(
        &pool, team_id, manager_id,
        CreateIncidentRequest {
            title: "Test".to_string(),
            description: None,
            severity: IncidentSeverity::Low,
        },
    ).await.unwrap();

    let result = incident_service::acknowledge_incident(&pool, incident.id, responder_id).await;
    assert!(result.is_ok());
    assert_eq!(result.unwrap().state, IncidentState::Acknowledged);
}

#[tokio::test]
async fn test_acknowledge_incident_as_observer_fails() {
    let pool = setup_pool().await;
    let (team_id, manager_id, _) = setup_team_with_responder(&pool).await;

    let id = uuid::Uuid::new_v4().to_string();
    let (observer_id, _) = create_user(&pool, &format!("obs_{}", id)).await;
    let code = team_service::generate_invitation(&pool, team_id, manager_id).await.unwrap();
    team_service::join_team(
        &pool,
        vigil_server::models::team::JoinTeamRequest { code },
        observer_id,
    ).await.unwrap();

    let incident = incident_service::create_incident(
        &pool, team_id, manager_id,
        CreateIncidentRequest {
            title: "Test".to_string(),
            description: None,
            severity: IncidentSeverity::Low,
        },
    ).await.unwrap();

    let result = incident_service::acknowledge_incident(&pool, incident.id, observer_id).await;
    assert!(result.is_err());
}

#[tokio::test]
async fn test_full_lifecycle_open_to_resolved() {
    let pool = setup_pool().await;
    let (team_id, manager_id, responder_id) = setup_team_with_responder(&pool).await;

    let incident = incident_service::create_incident(
        &pool, team_id, manager_id,
        CreateIncidentRequest {
            title: "Test".to_string(),
            description: None,
            severity: IncidentSeverity::Medium,
        },
    ).await.unwrap();

    // open → acknowledged
    let incident = incident_service::acknowledge_incident(&pool, incident.id, responder_id)
        .await.unwrap();
    assert_eq!(incident.state, IncidentState::Acknowledged);

    // acknowledged → escalated
    let incident = incident_service::escalate_incident(
        &pool, incident.id, responder_id,
        EscalateIncidentRequest { severity: IncidentSeverity::Critical },
    ).await.unwrap();
    assert_eq!(incident.state, IncidentState::Escalated);
    assert_eq!(incident.severity, IncidentSeverity::Critical);

    // escalated → resolved
    let incident = incident_service::resolve_incident(&pool, incident.id, manager_id)
        .await.unwrap();
    assert_eq!(incident.state, IncidentState::Resolved);
    assert!(incident.resolved_at.is_some());
}

#[tokio::test]
async fn test_invalid_transition_resolved_to_acknowledged_fails() {
    let pool = setup_pool().await;
    let (team_id, manager_id, responder_id) = setup_team_with_responder(&pool).await;

    let incident = incident_service::create_incident(
        &pool, team_id, manager_id,
        CreateIncidentRequest {
            title: "Test".to_string(),
            description: None,
            severity: IncidentSeverity::Low,
        },
    ).await.unwrap();

    incident_service::acknowledge_incident(&pool, incident.id, responder_id).await.unwrap();
    incident_service::resolve_incident(&pool, incident.id, manager_id).await.unwrap();

    // Essayer d'acquitter un incident déjà résolu
    let result = incident_service::acknowledge_incident(&pool, incident.id, responder_id).await;
    assert!(result.is_err());
}

#[tokio::test]
async fn test_add_timeline_entry_as_responder_succeeds() {
    let pool = setup_pool().await;
    let (team_id, manager_id, responder_id) = setup_team_with_responder(&pool).await;

    let incident = incident_service::create_incident(
        &pool, team_id, manager_id,
        CreateIncidentRequest {
            title: "Test".to_string(),
            description: None,
            severity: IncidentSeverity::Low,
        },
    ).await.unwrap();

    let result = incident_service::add_timeline_entry(
        &pool, incident.id, responder_id,
        AddTimelineEntryRequest { content: "Investigation en cours".to_string() },
    ).await;

    assert!(result.is_ok());
    let entry = result.unwrap();
    assert_eq!(entry.content, "Investigation en cours");
    assert_eq!(entry.author_id, responder_id);
}

#[tokio::test]
async fn test_edit_timeline_entry_by_author_succeeds() {
    let pool = setup_pool().await;
    let (team_id, manager_id, responder_id) = setup_team_with_responder(&pool).await;

    let incident = incident_service::create_incident(
        &pool, team_id, manager_id,
        CreateIncidentRequest {
            title: "Test".to_string(),
            description: None,
            severity: IncidentSeverity::Low,
        },
    ).await.unwrap();

    let entry = incident_service::add_timeline_entry(
        &pool, incident.id, responder_id,
        AddTimelineEntryRequest { content: "Contenu original".to_string() },
    ).await.unwrap();

    let result = incident_service::edit_timeline_entry(
        &pool, entry.id, responder_id,
        vigil_server::models::incident::EditTimelineEntryRequest {
            content: "Contenu modifié".to_string(),
        },
    ).await;

    assert!(result.is_ok());
    let updated = result.unwrap();
    assert_eq!(updated.content, "Contenu modifié");
    assert!(updated.edited_at.is_some());
}

#[tokio::test]
async fn test_edit_timeline_entry_by_non_author_fails() {
    let pool = setup_pool().await;
    let (team_id, manager_id, responder_id) = setup_team_with_responder(&pool).await;

    let incident = incident_service::create_incident(
        &pool, team_id, manager_id,
        CreateIncidentRequest {
            title: "Test".to_string(),
            description: None,
            severity: IncidentSeverity::Low,
        },
    ).await.unwrap();

    let entry = incident_service::add_timeline_entry(
        &pool, incident.id, responder_id,
        AddTimelineEntryRequest { content: "Contenu".to_string() },
    ).await.unwrap();

    // Manager essaie d'éditer l'entrée du Responder
    let result = incident_service::edit_timeline_entry(
        &pool, entry.id, manager_id,
        vigil_server::models::incident::EditTimelineEntryRequest {
            content: "Tentative de modification".to_string(),
        },
    ).await;

    assert!(result.is_err());
}

#[tokio::test]
async fn test_update_incident_as_manager_succeeds() {
    let pool = setup_pool().await;
    let (team_id, manager_id, _) = setup_team_with_responder(&pool).await;

    let incident = incident_service::create_incident(
        &pool, team_id, manager_id,
        CreateIncidentRequest {
            title: "Titre original".to_string(),
            description: None,
            severity: IncidentSeverity::Low,
        },
    ).await.unwrap();

    let result = incident_service::update_incident(
        &pool,
        incident.id,
        manager_id,
        vigil_server::models::incident::UpdateIncidentRequest {
            title: Some("Titre modifié".to_string()),
            description: Some("Description ajoutée".to_string()),
            severity: Some(IncidentSeverity::High),
        },
    ).await;

    assert!(result.is_ok());
    let updated = result.unwrap();
    assert_eq!(updated.title, "Titre modifié");
    assert_eq!(updated.severity, IncidentSeverity::High);
}

#[tokio::test]
async fn test_update_incident_as_responder_fails() {
    let pool = setup_pool().await;
    let (team_id, manager_id, responder_id) = setup_team_with_responder(&pool).await;

    let incident = incident_service::create_incident(
        &pool, team_id, manager_id,
        CreateIncidentRequest {
            title: "Test".to_string(),
            description: None,
            severity: IncidentSeverity::Low,
        },
    ).await.unwrap();

    let result = incident_service::update_incident(
        &pool,
        incident.id,
        responder_id,
        vigil_server::models::incident::UpdateIncidentRequest {
            title: Some("Tentative".to_string()),
            description: None,
            severity: None,
        },
    ).await;

    assert!(result.is_err());
}

#[tokio::test]
async fn test_cancel_incident_as_manager_succeeds() {
    let pool = setup_pool().await;
    let (team_id, manager_id, _) = setup_team_with_responder(&pool).await;

    let incident = incident_service::create_incident(
        &pool, team_id, manager_id,
        CreateIncidentRequest {
            title: "Test".to_string(),
            description: None,
            severity: IncidentSeverity::Low,
        },
    ).await.unwrap();

    let result = incident_service::cancel_incident(&pool, incident.id, manager_id).await;
    assert!(result.is_ok());
}

#[tokio::test]
async fn test_cancel_incident_as_responder_fails() {
    let pool = setup_pool().await;
    let (team_id, manager_id, responder_id) = setup_team_with_responder(&pool).await;

    let incident = incident_service::create_incident(
        &pool, team_id, manager_id,
        CreateIncidentRequest {
            title: "Test".to_string(),
            description: None,
            severity: IncidentSeverity::Low,
        },
    ).await.unwrap();

    let result = incident_service::cancel_incident(&pool, incident.id, responder_id).await;
    assert!(result.is_err());
}