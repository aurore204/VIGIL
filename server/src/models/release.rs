use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::Type;
use uuid::Uuid;

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Type)]
#[sqlx(type_name = "release_state", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum ReleaseState {
    Created,
    InProgress,
    Completed,
    Cancelled,
    Blocked,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Type)]
#[sqlx(type_name = "step_state", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum StepState {
    Pending,
    InProgress,
    Completed,
    Cancelled,
}

#[derive(Debug, Serialize, Deserialize, Clone, sqlx::FromRow)]
pub struct Release {
    pub id: Uuid,
    pub team_id: Uuid,
    pub created_by: Uuid,
    pub title: String,
    pub description: Option<String>,
    pub state: ReleaseState,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, Deserialize, Clone, sqlx::FromRow)]
pub struct ReleaseStep {
    pub id: Uuid,
    pub release_id: Uuid,
    pub validated_by: Option<Uuid>,
    pub name: String,
    pub description: Option<String>,
    pub position: i32,
    pub state: StepState,
    pub validated_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
pub struct CreateReleaseRequest {
    pub title: String,
    pub description: Option<String>,
    pub steps: Vec<CreateStepRequest>,
}

#[derive(Debug, Deserialize)]
pub struct CreateStepRequest {
    pub name: String,
    pub description: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct ReleaseResponse {
    pub id: Uuid,
    pub team_id: Uuid,
    pub created_by: Uuid,
    pub title: String,
    pub description: Option<String>,
    pub state: ReleaseState,
    pub steps: Vec<ReleaseStep>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}
