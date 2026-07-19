use sqlx::PgPool;
use vigil_server::models::message::SendMessageRequest;
use vigil_server::models::team::{CreateTeamRequest, JoinTeamRequest};
use vigil_server::models::user::RegisterRequest;
use vigil_server::services::{auth_service, message_service, team_service};

async fn setup_pool() -> PgPool {
    dotenv::dotenv().ok();
    let database_url = std::env::var("DATABASE_URL").unwrap();
    PgPool::connect(&database_url).await.unwrap()
}

async fn create_user(pool: &PgPool, suffix: &str) -> (uuid::Uuid, String) {
    let req = RegisterRequest {
        email: format!("msg_{}@test.com", suffix),
        password: "password123".to_string(),
        username: format!("user_{}", suffix),
    };
    let response = auth_service::register(pool, req).await.unwrap();
    (response.user.id, response.token)
}

async fn setup_two_users_in_team(pool: &PgPool) -> (uuid::Uuid, uuid::Uuid) {
    let id = uuid::Uuid::new_v4().to_string();
    let (user1_id, _) = create_user(pool, &format!("u1_{}", id)).await;
    let (user2_id, _) = create_user(pool, &format!("u2_{}", id)).await;

    let team = team_service::create_team(
        pool,
        CreateTeamRequest { name: format!("Team {}", id), description: None },
        user1_id,
    ).await.unwrap();

    let code = team_service::generate_invitation(pool, team.id, user1_id).await.unwrap();
    team_service::join_team(pool, JoinTeamRequest { code }, user2_id).await.unwrap();

    (user1_id, user2_id)
}

#[tokio::test]
async fn test_send_message_between_team_members_succeeds() {
    let pool = setup_pool().await;
    let (user1_id, user2_id) = setup_two_users_in_team(&pool).await;

    let result = message_service::send_message(
        &pool, user1_id, user2_id,
        SendMessageRequest { content: "Bonjour !".to_string() },
    ).await;

    assert!(result.is_ok());
    let message = result.unwrap();
    assert_eq!(message.content, "Bonjour !");
    assert_eq!(message.sender_id, user1_id);
    assert_eq!(message.receiver_id, user2_id);
}

#[tokio::test]
async fn test_send_message_without_shared_team_fails() {
    let pool = setup_pool().await;
    let id = uuid::Uuid::new_v4().to_string();
    let (user1_id, _) = create_user(&pool, &format!("u1_{}", id)).await;
    let (user2_id, _) = create_user(&pool, &format!("u2_{}", id)).await;

    let result = message_service::send_message(
        &pool, user1_id, user2_id,
        SendMessageRequest { content: "Bonjour !".to_string() },
    ).await;

    assert!(result.is_err());
}

#[tokio::test]
async fn test_send_message_to_self_fails() {
    let pool = setup_pool().await;
    let id = uuid::Uuid::new_v4().to_string();
    let (user_id, _) = create_user(&pool, &id).await;

    let result = message_service::send_message(
        &pool, user_id, user_id,
        SendMessageRequest { content: "Bonjour !".to_string() },
    ).await;

    assert!(result.is_err());
}

#[tokio::test]
async fn test_send_message_too_long_fails() {
    let pool = setup_pool().await;
    let (user1_id, user2_id) = setup_two_users_in_team(&pool).await;

    let result = message_service::send_message(
        &pool, user1_id, user2_id,
        SendMessageRequest { content: "a".repeat(2001) },
    ).await;

    assert!(result.is_err());
}

#[tokio::test]
async fn test_get_conversation_returns_messages_in_order() {
    let pool = setup_pool().await;
    let (user1_id, user2_id) = setup_two_users_in_team(&pool).await;

    message_service::send_message(
        &pool, user1_id, user2_id,
        SendMessageRequest { content: "Message 1".to_string() },
    ).await.unwrap();

    message_service::send_message(
        &pool, user2_id, user1_id,
        SendMessageRequest { content: "Message 2".to_string() },
    ).await.unwrap();

    let conversation = message_service::get_conversation(&pool, user1_id, user2_id).await.unwrap();
    assert_eq!(conversation.len(), 2);
    assert_eq!(conversation[0].content, "Message 1");
    assert_eq!(conversation[1].content, "Message 2");
}

#[tokio::test]
async fn test_get_conversation_without_shared_team_fails() {
    let pool = setup_pool().await;
    let id = uuid::Uuid::new_v4().to_string();
    let (user1_id, _) = create_user(&pool, &format!("u1_{}", id)).await;
    let (user2_id, _) = create_user(&pool, &format!("u2_{}", id)).await;

    let result = message_service::get_conversation(&pool, user1_id, user2_id).await;
    assert!(result.is_err());
}