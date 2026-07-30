use sqlx::PgPool;
use vigil_server::models::incident::{CreateIncidentRequest, IncidentSeverity};
use vigil_server::models::release::{CreateReleaseRequest, CreateStepRequest, ReleaseState};
use vigil_server::models::team::{CreateTeamRequest, JoinTeamRequest};
use vigil_server::models::user::RegisterRequest;
use vigil_server::services::{auth_service, incident_service, release_service, team_service};

async fn setup_pool() -> PgPool {
    dotenv::dotenv().ok();
    let database_url = std::env::var("DATABASE_URL").unwrap();
    PgPool::connect(&database_url).await.unwrap()
}

async fn create_user(pool: &PgPool, suffix: &str) -> (uuid::Uuid, String) {
    let req = RegisterRequest {
        email: format!("rel_{}@test.com", suffix),
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

fn make_release_req(title: &str) -> CreateReleaseRequest {
    CreateReleaseRequest {
        title: title.to_string(),
        description: None,
        steps: vec![
            CreateStepRequest { name: "build".to_string(), description: None },
            CreateStepRequest { name: "staging".to_string(), description: None },
            CreateStepRequest { name: "production".to_string(), description: None },
        ],
    }
}

#[tokio::test]
async fn test_create_release_as_manager_succeeds() {
    let pool = setup_pool().await;
    let (team_id, manager_id, _) = setup_team_with_responder(&pool).await;

    let result = release_service::create_release(&pool, team_id, manager_id, make_release_req("v1.0")).await;

    assert!(result.is_ok());
    let release = result.unwrap();
    assert_eq!(release.state, ReleaseState::Created);
    assert_eq!(release.steps.len(), 3);
}

#[tokio::test]
async fn test_create_release_as_observer_fails() {
    let pool = setup_pool().await;
    let (team_id, manager_id, _) = setup_team_with_responder(&pool).await;

    let id = uuid::Uuid::new_v4().to_string();
    let (observer_id, _) = create_user(&pool, &id).await;
    let code = team_service::generate_invitation(&pool, team_id, manager_id).await.unwrap();
    team_service::join_team(&pool, JoinTeamRequest { code }, observer_id).await.unwrap();

    let result = release_service::create_release(&pool, team_id, observer_id, make_release_req("v1.0")).await;
    assert!(result.is_err());
}

#[tokio::test]
async fn test_create_release_without_steps_fails() {
    let pool = setup_pool().await;
    let (team_id, manager_id, _) = setup_team_with_responder(&pool).await;

    let result = release_service::create_release(
        &pool, team_id, manager_id,
        CreateReleaseRequest {
            title: "v1.0".to_string(),
            description: None,
            steps: vec![],
        },
    ).await;

    assert!(result.is_err());
}

#[tokio::test]
async fn test_start_release_succeeds() {
    let pool = setup_pool().await;
    let (team_id, manager_id, _) = setup_team_with_responder(&pool).await;

    let release = release_service::create_release(&pool, team_id, manager_id, make_release_req("v1.0")).await.unwrap();
    let result = release_service::start_release(&pool, release.id, manager_id).await;

    match &result {
        Ok(_) => println!("OK"),
        Err(e) => println!("ERROR: {:?}", e),
    }
    assert!(result.is_ok());
}
#[tokio::test]
async fn test_validate_steps_in_order() {
    let pool = setup_pool().await;
    let (team_id, manager_id, responder_id) = setup_team_with_responder(&pool).await;

    let release = release_service::create_release(&pool, team_id, manager_id, make_release_req("v1.0")).await.unwrap();
    release_service::start_release(&pool, release.id, manager_id).await.unwrap();

    let step1_id = release.steps[0].id;
    let result = release_service::validate_step(&pool, release.id, step1_id, responder_id).await;
    assert!(result.is_ok());
}

#[tokio::test]
async fn test_cannot_validate_step_out_of_order() {
    let pool = setup_pool().await;
    let (team_id, manager_id, responder_id) = setup_team_with_responder(&pool).await;

    let release = release_service::create_release(&pool, team_id, manager_id, make_release_req("v1.0")).await.unwrap();
    release_service::start_release(&pool, release.id, manager_id).await.unwrap();

    // Essayer de valider la 2ème étape sans valider la 1ère
    let step2_id = release.steps[1].id;
    let result = release_service::validate_step(&pool, release.id, step2_id, responder_id).await;
    assert!(result.is_err());
}

#[tokio::test]
async fn test_all_steps_validated_completes_release() {
    let pool = setup_pool().await;
    let (team_id, manager_id, responder_id) = setup_team_with_responder(&pool).await;

    let release = release_service::create_release(
        &pool, team_id, manager_id,
        CreateReleaseRequest {
            title: "v1.0".to_string(),
            description: None,
            steps: vec![
                CreateStepRequest { name: "build".to_string(), description: None },
            ],
        },
    ).await.unwrap();

    release_service::start_release(&pool, release.id, manager_id).await.unwrap();

    let step_id = release.steps[0].id;
    let result = release_service::validate_step(&pool, release.id, step_id, responder_id).await;

    assert!(result.is_ok());
    assert_eq!(result.unwrap().state, ReleaseState::Completed);
}

#[tokio::test]
async fn test_incident_blocks_release() {
    let pool = setup_pool().await;
    let (team_id, manager_id, _) = setup_team_with_responder(&pool).await;

    let release = release_service::create_release(&pool, team_id, manager_id, make_release_req("v1.0")).await.unwrap();
    release_service::start_release(&pool, release.id, manager_id).await.unwrap();

    let incident = incident_service::create_incident(
        &pool, team_id, manager_id,
        CreateIncidentRequest {
            title: "Incident critique".to_string(),
            description: None,
            severity: IncidentSeverity::Critical,
        },
    ).await.unwrap();

    let blocked = release_service::block_release_if_needed(&pool, release.id, incident.id).await.unwrap();
    assert!(blocked);

    let updated = release_service::get_release(&pool, release.id, manager_id).await.unwrap();
    assert_eq!(updated.state, ReleaseState::Blocked);
}

#[tokio::test]
async fn test_resolving_incident_unblocks_release() {
    let pool = setup_pool().await;
    let (team_id, manager_id, responder_id) = setup_team_with_responder(&pool).await;

    let release = release_service::create_release(&pool, team_id, manager_id, make_release_req("v1.0")).await.unwrap();
    release_service::start_release(&pool, release.id, manager_id).await.unwrap();

    let incident = incident_service::create_incident(
        &pool, team_id, manager_id,
        CreateIncidentRequest {
            title: "Incident".to_string(),
            description: None,
            severity: IncidentSeverity::High,
        },
    ).await.unwrap();

    release_service::block_release_if_needed(&pool, release.id, incident.id).await.unwrap();

    // Résoudre l'incident
    incident_service::acknowledge_incident(&pool, incident.id, responder_id).await.unwrap();
    incident_service::resolve_incident(&pool, incident.id, manager_id).await.unwrap();

    // Débloquer manuellement (normalement appelé automatiquement dans le handler)
    let unblocked = release_service::unblock_release_if_resolved(&pool, release.id).await.unwrap();
    assert!(unblocked);

    let updated = release_service::get_release(&pool, release.id, manager_id).await.unwrap();
    assert_eq!(updated.state, ReleaseState::InProgress);
}

#[tokio::test]
async fn test_cancel_release_succeeds() {
    let pool = setup_pool().await;
    let (team_id, manager_id, _) = setup_team_with_responder(&pool).await;

    let release = release_service::create_release(&pool, team_id, manager_id, make_release_req("v1.0")).await.unwrap();
    let result = release_service::cancel_release(&pool, release.id, manager_id).await;
    assert!(result.is_ok());
}

