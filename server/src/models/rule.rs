use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use uuid::Uuid;

#[derive(Debug, Serialize, Deserialize, Clone, sqlx::FromRow)]
pub struct Rule {
    pub id: Uuid,
    pub team_id: Uuid,
    pub created_by: Uuid,
    pub name: String,
    pub enabled: bool,
    pub trigger: Value,
    pub reaction: Value,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
pub struct CreateRuleRequest {
    pub name: String,
    pub enabled: Option<bool>,
    pub trigger: Value,
    pub reaction: Value,
}

#[derive(Debug, sqlx::Type, Serialize, Deserialize, Clone, PartialEq)]
#[sqlx(type_name = "rule_log_status", rename_all = "lowercase")]
#[serde(rename_all = "lowercase")]
pub enum RuleLogStatus {
    Success,
    Failed,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct RuleLog {
    pub id: Uuid,
    pub rule_id: Uuid,
    pub status: RuleLogStatus,
    pub result: Option<Value>,
    pub error: Option<String>,
    pub triggered_at: DateTime<Utc>,
}