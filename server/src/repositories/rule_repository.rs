use sqlx::PgPool;
use uuid::Uuid;

use crate::models::rule::{Rule, RuleLogStatus};

// Cherche toutes les règles actives d'une team correspondant à un service et un event donnés
pub async fn find_matching_rules(
    pool: &PgPool,
    team_id: Uuid,
    service: &str,
    event_type: &str,
) -> Result<Vec<Rule>, sqlx::Error> {
    let rules = sqlx::query_as!(
        Rule,
        r#"
        SELECT
            id, team_id, created_by, name, enabled,
            trigger, reaction, created_at, updated_at
        FROM rules
        WHERE team_id = $1
          AND enabled = true
          AND trigger->>'service' = $2
          AND trigger->>'event' = $3
        "#,
        team_id,
        service,
        event_type
    )
    .fetch_all(pool)
    .await?;

    Ok(rules)
}

// Récupère une règle par son id
pub async fn find_by_id(pool: &PgPool, rule_id: Uuid) -> Result<Option<Rule>, sqlx::Error> {
    sqlx::query_as!(
        Rule,
        r#"
        SELECT
            id, team_id, created_by, name, enabled,
            trigger, reaction, created_at, updated_at
        FROM rules
        WHERE id = $1
        "#,
        rule_id
    )
    .fetch_optional(pool)
    .await
}

// Liste toutes les règles d'une team
pub async fn find_by_team(pool: &PgPool, team_id: Uuid) -> Result<Vec<Rule>, sqlx::Error> {
    sqlx::query_as!(
        Rule,
        r#"
        SELECT
            id, team_id, created_by, name, enabled,
            trigger, reaction, created_at, updated_at
        FROM rules
        WHERE team_id = $1
        ORDER BY created_at DESC
        "#,
        team_id
    )
    .fetch_all(pool)
    .await
}

// Crée une nouvelle règle
pub async fn create_rule(
    pool: &PgPool,
    team_id: Uuid,
    created_by: Uuid,
    name: &str,
    enabled: bool,
    trigger: serde_json::Value,
    reaction: serde_json::Value,
) -> Result<Rule, sqlx::Error> {
    sqlx::query_as!(
        Rule,
        r#"
        INSERT INTO rules (team_id, created_by, name, enabled, trigger, reaction)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING
            id, team_id, created_by, name, enabled,
            trigger, reaction, created_at, updated_at
        "#,
        team_id,
        created_by,
        name,
        enabled,
        trigger,
        reaction
    )
    .fetch_one(pool)
    .await
}

// Enregistre l'exécution d'une règle (succès ou échec) dans l'historique
pub async fn log_execution(
    pool: &PgPool,
    rule_id: Uuid,
    status: RuleLogStatus,
    result: &str,
    incident_id: Option<Uuid>,
) -> Result<(), sqlx::Error> {
    let result_json = serde_json::json!({ "message": result, "incident_id": incident_id });

    sqlx::query!(
        r#"
        INSERT INTO rule_logs (rule_id, status, result)
        VALUES ($1, $2, $3)
        "#,
        rule_id,
        status as RuleLogStatus,
        result_json
    )
    .execute(pool)
    .await?;

    Ok(())
}
