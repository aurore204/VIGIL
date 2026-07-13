use sqlx::PgPool;
use vigil_server::models::team::{CreateTeamRequest, JoinTeamRequest, TransferManagerRequest};
use vigil_server::models::user::RegisterRequest;
use vigil_server::repositories::team_repository;
use vigil_server::services::{auth_service, team_service};

async fn setup_pool() -> PgPool {
    dotenv::dotenv().ok();
    let database_url = std::env::var("DATABASE_URL")
        .expect("DATABASE_URL doit être défini");
    PgPool::connect(&database_url).await.unwrap()
}

async fn create_test_user(pool: &PgPool, suffix: &str) -> (uuid::Uuid, String) {
    let email = format!("team_test_{}@test.com", suffix);
    let req = RegisterRequest {
        email: email.clone(),
        password: "password123".to_string(),
        username: format!("user_{}", suffix),
    };
    let response = auth_service::register(pool, req).await.unwrap();
    (response.user.id, response.token)
}

#[tokio::test]
async fn test_create_team_adds_creator_as_manager() {
    let pool = setup_pool().await;
    let (user_id, _) = create_test_user(&pool, &uuid::Uuid::new_v4().to_string()).await;

    let req = CreateTeamRequest {
        name: format!("Team {}", uuid::Uuid::new_v4()),
        description: None,
    };

    let result = team_service::create_team(&pool, req, user_id).await;

    assert!(result.is_ok());
    let team = result.unwrap();
    assert_eq!(team.manager_id, user_id);
    assert_eq!(team.members.len(), 1);
    assert_eq!(team.members[0].role, vigil_server::models::team::TeamRole::Manager);
}

#[tokio::test]
async fn test_generate_invitation_only_for_manager() {
    let pool = setup_pool().await;
    let (manager_id, _) = create_test_user(&pool, &uuid::Uuid::new_v4().to_string()).await;
    let (observer_id, _) = create_test_user(&pool, &uuid::Uuid::new_v4().to_string()).await;

    let req = CreateTeamRequest {
        name: format!("Team {}", uuid::Uuid::new_v4()),
        description: None,
    };
    let team = team_service::create_team(&pool, req, manager_id).await.unwrap();

    // Générer un code pour faire rejoindre l'observer
    let code = team_service::generate_invitation(&pool, team.id, manager_id).await.unwrap();

    // Observer rejoint la team
    team_service::join_team(&pool, JoinTeamRequest { code }, observer_id).await.unwrap();

    // Observer ne peut pas générer un code d'invitation
    let result = team_service::generate_invitation(&pool, team.id, observer_id).await;
    assert!(result.is_err());
}

#[tokio::test]
async fn test_join_team_with_valid_code() {
    let pool = setup_pool().await;
    let (manager_id, _) = create_test_user(&pool, &uuid::Uuid::new_v4().to_string()).await;
    let (user_id, _) = create_test_user(&pool, &uuid::Uuid::new_v4().to_string()).await;

    let req = CreateTeamRequest {
        name: format!("Team {}", uuid::Uuid::new_v4()),
        description: None,
    };
    let team = team_service::create_team(&pool, req, manager_id).await.unwrap();
    let code = team_service::generate_invitation(&pool, team.id, manager_id).await.unwrap();

    let result = team_service::join_team(&pool, JoinTeamRequest { code }, user_id).await;

    assert!(result.is_ok());
    let team = result.unwrap();
    assert_eq!(team.members.len(), 2);
}

#[tokio::test]
async fn test_join_team_with_invalid_code_fails() {
    let pool = setup_pool().await;
    let (user_id, _) = create_test_user(&pool, &uuid::Uuid::new_v4().to_string()).await;

    let result = team_service::join_team(
        &pool,
        JoinTeamRequest { code: "INVALID00".to_string() },
        user_id,
    ).await;

    assert!(result.is_err());
}

#[tokio::test]
async fn test_join_team_already_member_fails() {
    let pool = setup_pool().await;
    let (manager_id, _) = create_test_user(&pool, &uuid::Uuid::new_v4().to_string()).await;
    let (user_id, _) = create_test_user(&pool, &uuid::Uuid::new_v4().to_string()).await;

    let req = CreateTeamRequest {
        name: format!("Team {}", uuid::Uuid::new_v4()),
        description: None,
    };
    let team = team_service::create_team(&pool, req, manager_id).await.unwrap();
    let code = team_service::generate_invitation(&pool, team.id, manager_id).await.unwrap();

    team_service::join_team(&pool, JoinTeamRequest { code: code.clone() }, user_id).await.unwrap();

    // Essayer de rejoindre une 2ème fois
    let result = team_service::join_team(&pool, JoinTeamRequest { code }, user_id).await;
    assert!(result.is_err());
}

#[tokio::test]
async fn test_transfer_manager_role() {
    let pool = setup_pool().await;
    let (manager_id, _) = create_test_user(&pool, &uuid::Uuid::new_v4().to_string()).await;
    let (user_id, _) = create_test_user(&pool, &uuid::Uuid::new_v4().to_string()).await;

    let req = CreateTeamRequest {
        name: format!("Team {}", uuid::Uuid::new_v4()),
        description: None,
    };
    let team = team_service::create_team(&pool, req, manager_id).await.unwrap();
    let code = team_service::generate_invitation(&pool, team.id, manager_id).await.unwrap();
    team_service::join_team(&pool, JoinTeamRequest { code }, user_id).await.unwrap();

    let result = team_service::transfer_manager(
        &pool,
        team.id,
        manager_id,
        TransferManagerRequest { user_id },
    ).await;

    assert!(result.is_ok());
    let updated_team = result.unwrap();
    assert_eq!(updated_team.manager_id, user_id);
}

#[tokio::test]
async fn test_transfer_manager_to_self_fails() {
    let pool = setup_pool().await;
    let (manager_id, _) = create_test_user(&pool, &uuid::Uuid::new_v4().to_string()).await;

    let req = CreateTeamRequest {
        name: format!("Team {}", uuid::Uuid::new_v4()),
        description: None,
    };
    let team = team_service::create_team(&pool, req, manager_id).await.unwrap();

    let result = team_service::transfer_manager(
        &pool,
        team.id,
        manager_id,
        TransferManagerRequest { user_id: manager_id },
    ).await;

    assert!(result.is_err());
}

#[tokio::test]
async fn test_ban_prevents_joining() {
    let pool = setup_pool().await;
    let (manager_id, _) = create_test_user(&pool, &uuid::Uuid::new_v4().to_string()).await;
    let (user_id, _) = create_test_user(&pool, &uuid::Uuid::new_v4().to_string()).await;

    let req = CreateTeamRequest {
        name: format!("Team {}", uuid::Uuid::new_v4()),
        description: None,
    };
    let team = team_service::create_team(&pool, req, manager_id).await.unwrap();

    // Bannir le user
    team_service::ban_member(&pool, team.id, manager_id, user_id, None, None).await.unwrap();

    // Générer un code
    let code = team_service::generate_invitation(&pool, team.id, manager_id).await.unwrap();

    // Le user banni ne peut pas rejoindre même avec un code valide
    let result = team_service::join_team(&pool, JoinTeamRequest { code }, user_id).await;
    assert!(result.is_err());
}

#[tokio::test]
async fn test_kick_member_removes_from_team() {
    let pool = setup_pool().await;
    let (manager_id, _) = create_test_user(&pool, &uuid::Uuid::new_v4().to_string()).await;
    let (user_id, _) = create_test_user(&pool, &uuid::Uuid::new_v4().to_string()).await;

    let req = CreateTeamRequest {
        name: format!("Team {}", uuid::Uuid::new_v4()),
        description: None,
    };
    let team = team_service::create_team(&pool, req, manager_id).await.unwrap();
    let code = team_service::generate_invitation(&pool, team.id, manager_id).await.unwrap();
    team_service::join_team(&pool, JoinTeamRequest { code }, user_id).await.unwrap();

    let result = team_service::kick_member(&pool, team.id, manager_id, user_id).await;

    assert!(result.is_ok());

    let is_member = team_repository::is_member(&pool, team.id, user_id).await.unwrap();
    assert!(!is_member);
}