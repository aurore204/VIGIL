use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::Type;
use uuid::Uuid;

// États possibles d'un incident
#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Type)]
#[sqlx(type_name = "incident_state", rename_all = "lowercase")]
#[serde(rename_all = "lowercase")]
    
pub enum IncidentState {
    Open,
    Acknowledged,
    Escalated,
    Resolved,
}

// Niveaux de sévérité
#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Type)]
#[sqlx(type_name = "incident_severity", rename_all = "lowercase")]
#[serde(rename_all = "lowercase")]
pub enum IncidentSeverity {
    Low,
    Medium,
    High,
    Critical,
}

// Représente un incident tel qu'il est en base
#[derive(Debug, Serialize, Deserialize, Clone, sqlx::FromRow)]
pub struct Incident {
    pub id: Uuid,
    pub team_id: Uuid,
    pub created_by: Uuid,
    pub assigned_to: Option<Uuid>,
    pub title: String,
    pub description: Option<String>,
    pub state: IncidentState,
    pub severity: IncidentSeverity,
    pub resolved_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

// Entrée de timeline liée à un incident
#[derive(Debug, Serialize, Deserialize, Clone, sqlx::FromRow)]
pub struct TimelineEntry {
    pub id: Uuid,
    pub incident_id: Uuid,
    pub author_id: Uuid,
    pub author_username: String,
    pub content: String,
    pub edited_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
    #[sqlx(default)] // permet à query_as! de ne pas exiger cette colonne en SQL
    pub reactions: Option<Vec<crate::models::reaction::ReactionSummary>>,
}

// Ce qu'on reçoit pour créer un incident
#[derive(Debug, Deserialize)]
pub struct CreateIncidentRequest {
    pub title: String,
    pub description: Option<String>,
    pub severity: IncidentSeverity,
}

// Ce qu'on reçoit pour assigner un Responder
#[derive(Debug, Deserialize)]
pub struct AssignIncidentRequest {
    pub user_id: Uuid,
}

// Ce qu'on reçoit pour escalader un incident
#[derive(Debug, Deserialize)]
pub struct EscalateIncidentRequest {
    pub severity: IncidentSeverity,
}

// Ce qu'on reçoit pour ajouter une entrée de timeline
#[derive(Debug, Deserialize)]
pub struct AddTimelineEntryRequest {
    pub content: String,
}

// Ce qu'on reçoit pour éditer une entrée de timeline
#[derive(Debug, Deserialize)]
pub struct EditTimelineEntryRequest {
    pub content: String,
}

// Ce qu'on renvoie pour un incident complet
#[derive(Debug, Serialize)]
pub struct IncidentResponse {
    pub id: Uuid,
    pub team_id: Uuid,
    pub created_by: Uuid,
    pub assigned_to: Option<Uuid>,
    pub title: String,
    pub description: Option<String>,
    pub state: IncidentState,
    pub severity: IncidentSeverity,
    pub timeline: Vec<TimelineEntry>,
    pub resolved_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateIncidentRequest {
    pub title: Option<String>,
    pub description: Option<String>,
    pub severity: Option<IncidentSeverity>,
}