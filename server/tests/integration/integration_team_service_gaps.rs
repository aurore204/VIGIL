use sqlx::PgPool;
use vigil_server::models::team::{
    CreateTeamRequest, JoinTeamRequest, TeamRole, TransferManagerRequest,
};
use vigil_server::models::user::RegisterRequest;
use vigil_server::services::{auth_service, team_service};

async fn setup_pool() -> PgPool {
    dotenv::dotenv().ok();
    let database_url = std::env::var("DATABASE_URL").unwrap();
    PgPool::connect(&database_url).await.unwrap()
}

async fn create_test_user(pool: &PgPool, suffix: &str) -> uuid::Uuid {
    let req = RegisterRequest {
        email: format!("team_gap_{}@test.com", suffix),
        password: "password123".to_string(),
        username: format!("user_{}", suffix),
    };
    auth_service::register(pool, req).await.unwrap().user.id
}

async fn create_team_with_member(pool: &PgPool) -> (uuid::Uuid, uuid::Uuid, uuid::Uuid) {
    let manager_id = create_test_user(pool, &uuid::Uuid::new_v4().to_string()).await;
    let member_id = create_test_user(pool, &uuid::Uuid::new_v4().to_string()).await;

    let team = team_service::create_team(
        pool,
        CreateTeamRequest {
            name: format!("Team {}", uuid::Uuid::new_v4()),
            description: None,
        },
        manager_id,
    )
    .await
    .unwrap();

    let code = team_service::generate_invitation(pool, team.id, manager_id)
        .await
        .unwrap();
    team_service::join_team(pool, JoinTeamRequest { code }, member_id)
        .await
        .unwrap();

    (team.id, manager_id, member_id)
}

#[tokio::test]
async fn test_get_team_success_for_member() {
    let pool = setup_pool().await;
    let (team_id, manager_id, member_id) = create_team_with_member(&pool).await;

    let result = team_service::get_team(&pool, team_id, member_id).await;

    assert!(result.is_ok());
    assert_eq!(result.unwrap().manager_id, manager_id);
}

#[tokio::test]
async fn test_update_member_role_as_manager_succeeds() {
    let pool = setup_pool().await;
    let (team_id, manager_id, member_id) = create_team_with_member(&pool).await;

    let result = team_service::update_member_role(
        &pool,
        team_id,
        manager_id,
        member_id,
        TeamRole::Responder,
    )
    .await;

    assert!(result.is_ok());

    let role =
        vigil_server::repositories::team_repository::get_member_role(&pool, team_id, member_id)
            .await
            .unwrap();
    assert_eq!(role, Some(TeamRole::Responder));
}

#[tokio::test]
async fn test_update_member_role_as_non_manager_fails() {
    let pool = setup_pool().await;
    let (team_id, _manager_id, member_id) = create_team_with_member(&pool).await;

    let result =
        team_service::update_member_role(&pool, team_id, member_id, member_id, TeamRole::Responder)
            .await;

    assert!(result.is_err());
}

#[tokio::test]
async fn test_update_member_role_targeting_self_fails() {
    let pool = setup_pool().await;
    let (team_id, manager_id, _member_id) = create_team_with_member(&pool).await;

    let result = team_service::update_member_role(
        &pool,
        team_id,
        manager_id,
        manager_id,
        TeamRole::Responder,
    )
    .await;

    assert!(result.is_err());
}

#[tokio::test]
async fn test_transfer_manager_as_non_manager_fails() {
    let pool = setup_pool().await;
    let (team_id, _manager_id, member_id) = create_team_with_member(&pool).await;
    let other_id = create_test_user(&pool, &uuid::Uuid::new_v4().to_string()).await;

    let result = team_service::transfer_manager(
        &pool,
        team_id,
        member_id,
        TransferManagerRequest { user_id: other_id },
    )
    .await;

    assert!(result.is_err());
}

#[tokio::test]
async fn test_transfer_manager_to_non_member_fails() {
    let pool = setup_pool().await;
    let (team_id, manager_id, _member_id) = create_team_with_member(&pool).await;
    let outsider_id = create_test_user(&pool, &uuid::Uuid::new_v4().to_string()).await;

    let result = team_service::transfer_manager(
        &pool,
        team_id,
        manager_id,
        TransferManagerRequest {
            user_id: outsider_id,
        },
    )
    .await;

    assert!(result.is_err());
}

#[tokio::test]
async fn test_kick_member_as_non_manager_fails() {
    let pool = setup_pool().await;
    let (team_id, manager_id, member_id) = create_team_with_member(&pool).await;

    let result = team_service::kick_member(&pool, team_id, member_id, manager_id).await;

    assert!(result.is_err());
}

#[tokio::test]
async fn test_kick_member_targeting_self_fails() {
    let pool = setup_pool().await;
    let (team_id, manager_id, _member_id) = create_team_with_member(&pool).await;

    let result = team_service::kick_member(&pool, team_id, manager_id, manager_id).await;

    assert!(result.is_err());
}

#[tokio::test]
async fn test_kick_member_targeting_non_member_fails() {
    let pool = setup_pool().await;
    let (team_id, manager_id, _member_id) = create_team_with_member(&pool).await;
    let outsider_id = create_test_user(&pool, &uuid::Uuid::new_v4().to_string()).await;

    let result = team_service::kick_member(&pool, team_id, manager_id, outsider_id).await;

    assert!(result.is_err());
}

#[tokio::test]
async fn test_ban_member_as_non_manager_fails() {
    let pool = setup_pool().await;
    let (team_id, _manager_id, member_id) = create_team_with_member(&pool).await;
    let outsider_id = create_test_user(&pool, &uuid::Uuid::new_v4().to_string()).await;

    let result = team_service::ban_member(&pool, team_id, member_id, outsider_id, None, None).await;

    assert!(result.is_err());
}

#[tokio::test]
async fn test_ban_member_targeting_self_fails() {
    let pool = setup_pool().await;
    let (team_id, manager_id, _member_id) = create_team_with_member(&pool).await;

    let result = team_service::ban_member(&pool, team_id, manager_id, manager_id, None, None).await;

    assert!(result.is_err());
}

#[tokio::test]
async fn test_ban_member_who_is_still_member_kicks_then_bans() {
    let pool = setup_pool().await;
    let (team_id, manager_id, member_id) = create_team_with_member(&pool).await;

    // Le membre est encore présent dans la team au moment du ban
    let result = team_service::ban_member(
        &pool,
        team_id,
        manager_id,
        member_id,
        None,
        Some("comportement inapproprié".to_string()),
    )
    .await;

    assert!(result.is_ok());

    let is_member =
        vigil_server::repositories::team_repository::is_member(&pool, team_id, member_id)
            .await
            .unwrap();
    assert!(!is_member);

    let is_banned =
        vigil_server::repositories::team_repository::is_banned(&pool, team_id, member_id)
            .await
            .unwrap();
    assert!(is_banned);
}

#[tokio::test]
async fn test_unban_member_as_manager_succeeds() {
    let pool = setup_pool().await;
    let (team_id, manager_id, member_id) = create_team_with_member(&pool).await;

    team_service::ban_member(&pool, team_id, manager_id, member_id, None, None)
        .await
        .unwrap();

    let result = team_service::unban_member(&pool, team_id, manager_id, member_id).await;

    assert!(result.is_ok());

    let is_banned =
        vigil_server::repositories::team_repository::is_banned(&pool, team_id, member_id)
            .await
            .unwrap();
    assert!(!is_banned);
}

#[tokio::test]
async fn test_unban_member_as_non_manager_fails() {
    let pool = setup_pool().await;
    let (team_id, manager_id, member_id) = create_team_with_member(&pool).await;
    let outsider_id = create_test_user(&pool, &uuid::Uuid::new_v4().to_string()).await;

    team_service::ban_member(&pool, team_id, manager_id, member_id, None, None)
        .await
        .unwrap();

    let result = team_service::unban_member(&pool, team_id, member_id, outsider_id).await;

    assert!(result.is_err());
}

#[tokio::test]
async fn test_unban_member_targeting_self_fails() {
    let pool = setup_pool().await;
    let (team_id, manager_id, _member_id) = create_team_with_member(&pool).await;

    let result = team_service::unban_member(&pool, team_id, manager_id, manager_id).await;

    assert!(result.is_err());
}

#[tokio::test]
async fn test_get_banned_members_as_manager_returns_list() {
    let pool = setup_pool().await;
    let (team_id, manager_id, member_id) = create_team_with_member(&pool).await;

    team_service::ban_member(
        &pool,
        team_id,
        manager_id,
        member_id,
        None,
        Some("test".to_string()),
    )
    .await
    .unwrap();

    let result = team_service::get_banned_members(&pool, team_id, manager_id).await;

    assert!(result.is_ok());
    let banned = result.unwrap();
    assert_eq!(banned.len(), 1);
    assert_eq!(banned[0].user_id, member_id);
}

#[tokio::test]
async fn test_get_banned_members_as_non_manager_fails() {
    let pool = setup_pool().await;
    let (team_id, _manager_id, member_id) = create_team_with_member(&pool).await;

    let result = team_service::get_banned_members(&pool, team_id, member_id).await;

    assert!(result.is_err());
}
