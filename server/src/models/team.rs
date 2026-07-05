use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::Type;
use uuid::Uuid;

// Représente les 3 rôles possibles dans une team
#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Type)]
#[sqlx(type_name = "team_role", rename_all = "lowercase")]
pub enum TeamRole {
    Observer,
    Responder,
    Manager,
}

// Représente une team telle qu'elle est en base
#[derive(Debug, Serialize, Deserialize, Clone, sqlx::FromRow)]
pub struct Team {
    pub id: Uuid,
    pub name: String,
    pub description: Option<String>,
    pub manager_id: Uuid,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

// Représente un membre d'une team avec son rôle
#[derive(Debug, Serialize, Deserialize, Clone, sqlx::FromRow)]
pub struct TeamMember {
    pub id: Uuid,
    pub team_id: Uuid,
    pub user_id: Uuid,
    pub role: TeamRole,
    pub joined_at: DateTime<Utc>,
}

// Représente un membre avec ses infos utilisateur
#[derive(Debug, Serialize, Deserialize, Clone, sqlx::FromRow)]
pub struct TeamMemberWithUser {
    pub user_id: Uuid,
    pub username: String,
    pub email: String,
    pub role: TeamRole,
    pub joined_at: DateTime<Utc>,
}

// Ce qu'on reçoit pour créer une team
#[derive(Debug, Deserialize)]
pub struct CreateTeamRequest {
    pub name: String,
    pub description: Option<String>,
}

// Ce qu'on reçoit pour rejoindre une team
#[derive(Debug, Deserialize)]
pub struct JoinTeamRequest {
    pub code: String,
}

// Ce qu'on reçoit pour transférer le rôle Manager
#[derive(Debug, Deserialize)]
pub struct TransferManagerRequest {
    pub user_id: Uuid,
}

// Ce qu'on renvoie après création/consultation d'une team
#[derive(Debug, Serialize)]
pub struct TeamResponse {
    pub id: Uuid,
    pub name: String,
    pub description: Option<String>,
    pub manager_id: Uuid,
    pub members: Vec<TeamMemberWithUser>,
    pub created_at: DateTime<Utc>,
}

// Représente un code d'invitation
#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct TeamInvitation {
    pub id: Uuid,
    pub team_id: Uuid,
    pub created_by: Uuid,
    pub code: String,
    pub expires_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
}

// Ce qu'on reçoit pour bannir un membre
#[derive(Debug, Deserialize)]
pub struct BanMemberRequest {
    pub expires_at: Option<DateTime<Utc>>,
    pub reason: Option<String>,
}