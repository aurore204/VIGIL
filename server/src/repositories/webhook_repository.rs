use sqlx::PgPool;
use uuid::Uuid;

// Récupère le secret webhook configuré pour une team et un service donnés
pub async fn get_secret(
    pool: &PgPool,
    team_id: Uuid,
    service_name: &str,
) -> Result<Option<String>, sqlx::Error> {
    let result = sqlx::query!(
        r#"
        SELECT secret_hash
        FROM webhook_secrets
        WHERE team_id = $1 AND service_name = $2
        "#,
        team_id,
        service_name
    )
    .fetch_optional(pool)
    .await?;

    Ok(result.map(|r| r.secret_hash))
}

// Crée ou remplace le secret webhook d'une team pour un service donné
pub async fn upsert_secret(
    pool: &PgPool,
    team_id: Uuid,
    service_name: &str,
    secret_hash: &str,
) -> Result<(), sqlx::Error> {
    sqlx::query!(
        r#"
        INSERT INTO webhook_secrets (team_id, service_name, secret_hash)
        VALUES ($1, $2, $3)
        ON CONFLICT (team_id, service_name)
        DO UPDATE SET secret_hash = $3
        "#,
        team_id,
        service_name,
        secret_hash
    )
    .execute(pool)
    .await?;

    Ok(())
}
