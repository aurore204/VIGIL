use sqlx::PgPool;
use vigil_server::models::team::TeamRole;
use vigil_server::models::user::RegisterRequest;
use vigil_server::repositories::team_repository;
use vigil_server::services::auth_service;

async fn setup_pool() -> PgPool {
    dotenv::dotenv().ok();
    let database_url = std::env::var("DATABASE_URL").unwrap();
    PgPool::connect(&database_url).await.unwrap()
}

async fn create_test_user(pool: &PgPool, suffix: &str) -> uuid::Uuid {
    let req = RegisterRequest {
        email: format!("team_repo_gap_{}@test.com", suffix),
        password: "password123".to_string(),
        username: format!("user_{}", suffix),
    };
    auth_service::register(pool, req).await.unwrap().user.id
}

#[tokio::test]
async fn test_update_member_role_persists_change() {
    let pool = setup_pool().await;
    let manager_id = create_test_user(&pool, &uuid::Uuid::new_v4().to_string()).await;
    let member_id = create_test_user(&pool, &uuid::Uuid::new_v4().to_string()).await;

    let team = team_repository::create_team(&pool, "Team Repo Gap", None, manager_id)
        .await
        .unwrap();
    team_repository::add_member(&pool, team.id, member_id, TeamRole::Observer)
        .await
        .unwrap();

    team_repository::update_member_role(&pool, team.id, member_id, TeamRole::Manager)
        .await
        .expect("la mise à jour doit réussir");

    let role = team_repository::get_member_role(&pool, team.id, member_id)
        .await
        .unwrap();

    assert_eq!(role, Some(TeamRole::Manager));
}

#[tokio::test]
async fn test_ban_member_upsert_updates_existing_ban() {
    let pool = setup_pool().await;
    let manager_id = create_test_user(&pool, &uuid::Uuid::new_v4().to_string()).await;
    let target_id = create_test_user(&pool, &uuid::Uuid::new_v4().to_string()).await;

    let team = team_repository::create_team(&pool, "Team Ban Upsert", None, manager_id)
        .await
        .unwrap();

    team_repository::ban_member(
        &pool,
        team.id,
        manager_id,
        target_id,
        None,
        Some("première raison".to_string()),
    )
    .await
    .unwrap();

    // Bannir à nouveau doit mettre à jour la raison plutôt que dupliquer la ligne
    team_repository::ban_member(
        &pool,
        team.id,
        manager_id,
        target_id,
        None,
        Some("raison mise à jour".to_string()),
    )
    .await
    .expect("le upsert doit réussir");

    let banned = team_repository::get_banned_members(&pool, team.id)
        .await
        .unwrap();
    assert_eq!(banned.len(), 1);
    assert_eq!(banned[0].reason.as_deref(), Some("raison mise à jour"));
}

#[tokio::test]
async fn test_unban_member_removes_ban() {
    let pool = setup_pool().await;
    let manager_id = create_test_user(&pool, &uuid::Uuid::new_v4().to_string()).await;
    let target_id = create_test_user(&pool, &uuid::Uuid::new_v4().to_string()).await;

    let team = team_repository::create_team(&pool, "Team Unban", None, manager_id)
        .await
        .unwrap();

    team_repository::ban_member(&pool, team.id, manager_id, target_id, None, None)
        .await
        .unwrap();

    team_repository::unban_member(&pool, team.id, target_id)
        .await
        .expect("le unban doit réussir");

    let is_banned = team_repository::is_banned(&pool, team.id, target_id)
        .await
        .unwrap();
    assert!(!is_banned);
}

#[tokio::test]
async fn test_get_banned_members_returns_empty_when_none() {
    let pool = setup_pool().await;
    let manager_id = create_test_user(&pool, &uuid::Uuid::new_v4().to_string()).await;

    let team = team_repository::create_team(&pool, "Team No Bans", None, manager_id)
        .await
        .unwrap();

    let banned = team_repository::get_banned_members(&pool, team.id)
        .await
        .unwrap();

    assert!(banned.is_empty());
}

#[tokio::test]
async fn test_get_banned_members_excludes_expired_bans() {
    let pool = setup_pool().await;
    let manager_id = create_test_user(&pool, &uuid::Uuid::new_v4().to_string()).await;
    let target_id = create_test_user(&pool, &uuid::Uuid::new_v4().to_string()).await;

    let team = team_repository::create_team(&pool, "Team Expired Ban", None, manager_id)
        .await
        .unwrap();

    // Ban déjà expiré (dans le passé)
    let expired = chrono::Utc::now() - chrono::Duration::days(1);
    team_repository::ban_member(&pool, team.id, manager_id, target_id, Some(expired), None)
        .await
        .unwrap();

    let banned = team_repository::get_banned_members(&pool, team.id)
        .await
        .unwrap();

    assert!(banned.is_empty());
}

#[tokio::test]
async fn test_is_banned_returns_false_when_ban_expired() {
    let pool = setup_pool().await;
    let manager_id = create_test_user(&pool, &uuid::Uuid::new_v4().to_string()).await;
    let target_id = create_test_user(&pool, &uuid::Uuid::new_v4().to_string()).await;

    let team = team_repository::create_team(&pool, "Team Expired Check", None, manager_id)
        .await
        .unwrap();

    let expired = chrono::Utc::now() - chrono::Duration::days(1);
    team_repository::ban_member(&pool, team.id, manager_id, target_id, Some(expired), None)
        .await
        .unwrap();

    let is_banned = team_repository::is_banned(&pool, team.id, target_id)
        .await
        .unwrap();

    assert!(!is_banned);
}
