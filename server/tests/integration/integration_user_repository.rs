use sqlx::PgPool;
use vigil_server::repositories::user_repository;

async fn setup_test_pool() -> PgPool {
    dotenv::dotenv().ok();
    let database_url = std::env::var("DATABASE_URL").unwrap();
    PgPool::connect(&database_url).await.unwrap()
}

fn unique_email(suffix: &str) -> String {
    format!("user_repo_{}@test.com", suffix)
}

#[tokio::test]
async fn test_create_user_then_find_by_email_returns_it() {
    let pool = setup_test_pool().await;
    let suffix = uuid::Uuid::new_v4().to_string();
    let email = unique_email(&suffix);

    let created = user_repository::create_user(&pool, &email, &format!("testuser_{}", suffix), "hashed-password")
        .await
        .expect("la création doit réussir");

    assert_eq!(created.email, email);
    assert_eq!(created.username, format!("testuser_{}", suffix));

    let found = user_repository::find_by_email(&pool, &email).await.unwrap();

    assert!(found.is_some());
    assert_eq!(found.unwrap().id, created.id);
}

#[tokio::test]
async fn test_find_by_email_returns_none_when_not_found() {
    let pool = setup_test_pool().await;

    let result = user_repository::find_by_email(&pool, "inexistant@test.com")
        .await
        .unwrap();

    assert!(result.is_none());
}

#[tokio::test]
async fn test_find_by_id_returns_created_user() {
    let pool = setup_test_pool().await;
    let suffix = uuid::Uuid::new_v4().to_string();
    let email = unique_email(&suffix);

    let created = user_repository::create_user(&pool, &email, &format!("testuser2_{}", suffix), "hashed-password")
        .await
        .unwrap();

    let found = user_repository::find_by_id(&pool, created.id)
        .await
        .unwrap();

    assert!(found.is_some());
    assert_eq!(found.unwrap().username, format!("testuser2_{}", suffix));
}

#[tokio::test]
async fn test_find_by_id_returns_none_for_unknown_id() {
    let pool = setup_test_pool().await;

    let result = user_repository::find_by_id(&pool, uuid::Uuid::new_v4())
        .await
        .unwrap();

    assert!(result.is_none());
}

#[tokio::test]
async fn test_find_full_by_id_includes_password_hash() {
    let pool = setup_test_pool().await;
    let suffix = uuid::Uuid::new_v4().to_string();
    let email = unique_email(&suffix);

    let created = user_repository::create_user(&pool, &email, &format!("testuser3_{}", suffix), "mon-hash-secret")
        .await
        .unwrap();

    let full_user = user_repository::find_full_by_id(&pool, created.id)
        .await
        .unwrap()
        .unwrap();

    assert_eq!(full_user.password_hash.as_deref(), Some("mon-hash-secret"));
}

#[tokio::test]
async fn test_invalidate_tokens_sets_invalidated_at() {
    let pool = setup_test_pool().await;
    let suffix = uuid::Uuid::new_v4().to_string();
    let email = unique_email(&suffix);

    let created = user_repository::create_user(&pool, &email, &format!("testuser4_{}", suffix), "hash")
        .await
        .unwrap();

    user_repository::invalidate_tokens(&pool, created.id)
        .await
        .expect("l'invalidation doit réussir");

    let full_user = user_repository::find_full_by_id(&pool, created.id)
        .await
        .unwrap()
        .unwrap();

    assert!(full_user.token_invalidated_at.is_some());
}

#[tokio::test]
async fn test_is_token_valid_returns_true_before_invalidation() {
    let pool = setup_test_pool().await;
    let suffix = uuid::Uuid::new_v4().to_string();
    let email = unique_email(&suffix);

    let created = user_repository::create_user(&pool, &email, &format!("testuser5_{}", suffix), "hash")
        .await
        .unwrap();

    let issued_at = chrono::Utc::now().timestamp();

    let is_valid = user_repository::is_token_valid(&pool, created.id, issued_at)
        .await
        .unwrap();

    assert!(is_valid);
}

#[tokio::test]
async fn test_is_token_valid_returns_false_after_invalidation() {
    let pool = setup_test_pool().await;
    let suffix = uuid::Uuid::new_v4().to_string();
    let email = unique_email(&suffix);

    let created = user_repository::create_user(&pool, &email, &format!("testuser6_{}", suffix), "hash")
        .await
        .unwrap();

    let issued_at = chrono::Utc::now().timestamp();

    // On attend un court instant pour garantir que invalidated_at soit après issued_at
    tokio::time::sleep(std::time::Duration::from_millis(50)).await;

    user_repository::invalidate_tokens(&pool, created.id)
        .await
        .unwrap();

    let is_valid = user_repository::is_token_valid(&pool, created.id, issued_at)
        .await
        .unwrap();

    assert!(!is_valid);
}

#[tokio::test]
async fn test_is_token_valid_returns_false_for_unknown_user() {
    let pool = setup_test_pool().await;

    let is_valid = user_repository::is_token_valid(
        &pool,
        uuid::Uuid::new_v4(),
        chrono::Utc::now().timestamp(),
    )
    .await
    .unwrap();

    assert!(!is_valid);
}

#[tokio::test]
async fn test_update_user_updates_only_provided_fields() {
    let pool = setup_test_pool().await;
    let suffix = uuid::Uuid::new_v4().to_string();
    let email = unique_email(&suffix);

    let created = user_repository::create_user(&pool, &email, &format!("nom_original_{}", suffix), "hash")
        .await
        .unwrap();

    let new_username = format!("nom_modifie_{}", suffix);
    let updated =
        user_repository::update_user(&pool, created.id, Some(&new_username), None, None, None)
            .await
            .unwrap();

    assert_eq!(updated.username, new_username);
    // L'email ne doit pas avoir changé puisqu'on a passé None
    assert_eq!(updated.email, email);
}

#[tokio::test]
async fn test_update_user_updates_language() {
    let pool = setup_test_pool().await;
    let suffix = uuid::Uuid::new_v4().to_string();
    let email = unique_email(&suffix);

    let created = user_repository::create_user(&pool, &email, &format!("user_lang_{}", suffix), "hash")
        .await
        .unwrap();

    let updated = user_repository::update_user(&pool, created.id, None, None, None, Some("en"))
        .await
        .unwrap();

    assert_eq!(updated.language, "en");
}