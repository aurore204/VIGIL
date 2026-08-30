use sqlx::PgPool;
use uuid::Uuid;

use crate::models::rule::{CreateRuleRequest, Rule};
use crate::models::team::TeamRole;
use crate::repositories::{rule_repository, team_repository};

#[derive(Debug)]
pub enum RuleError {
    NotMember,
    NotManager,
    DatabaseError(sqlx::Error),
}

// Crée une règle (Manager uniquement)
pub async fn create_rule(
    pool: &PgPool,
    team_id: Uuid,
    user_id: Uuid,
    req: CreateRuleRequest,
) -> Result<Rule, RuleError> {
    let role = team_repository::get_member_role(pool, team_id, user_id)
        .await
        .map_err(RuleError::DatabaseError)?
        .ok_or(RuleError::NotMember)?;

    if role != TeamRole::Manager {
        return Err(RuleError::NotManager);
    }

    rule_repository::create_rule(
        pool,
        team_id,
        user_id,
        &req.name,
        req.enabled.unwrap_or(true),
        req.trigger,
        req.reaction,
    )
    .await
    .map_err(RuleError::DatabaseError)
}

// Liste les règles d'une team
pub async fn get_team_rules(
    pool: &PgPool,
    team_id: Uuid,
    user_id: Uuid,
) -> Result<Vec<Rule>, RuleError> {
    let is_member = team_repository::is_member(pool, team_id, user_id)
        .await
        .map_err(RuleError::DatabaseError)?;

    if !is_member {
        return Err(RuleError::NotMember);
    }

    rule_repository::find_by_team(pool, team_id)
        .await
        .map_err(RuleError::DatabaseError)
}
