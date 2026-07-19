use sqlx::PgPool;
use uuid::Uuid;

use crate::models::team::{
    CreateTeamRequest, JoinTeamRequest, TeamResponse, TeamRole, TransferManagerRequest,
};
use crate::repositories::team_repository;
use crate::models::team::UpdateTeamRequest;

#[derive(Debug)]
pub enum TeamError {
    TeamNotFound,
    AlreadyMember,
    NotMember,
    InvalidInvitationCode,
    NotManager,
    CannotTargetSelf,
    Banned,
    DatabaseError(sqlx::Error),
}

// Crée une nouvelle team
pub async fn create_team(
    pool: &PgPool,
    req: CreateTeamRequest,
    manager_id: Uuid,
) -> Result<TeamResponse, TeamError> {
    let team = team_repository::create_team(
        pool,
        &req.name,
        req.description.as_deref(),
        manager_id,
    )
    .await
    .map_err(TeamError::DatabaseError)?;

    let members = team_repository::get_members(pool, team.id)
        .await
        .map_err(TeamError::DatabaseError)?;

    Ok(TeamResponse {
        id: team.id,
        name: team.name,
        description: team.description,
        manager_id: team.manager_id,
        members,
        created_at: team.created_at,
    })
}

// Récupère une team par son id avec ses membres
pub async fn get_team(
    pool: &PgPool,
    team_id: Uuid,
    user_id: Uuid,
) -> Result<TeamResponse, TeamError> {
    let is_member = team_repository::is_member(pool, team_id, user_id)
        .await
        .map_err(TeamError::DatabaseError)?;

    if !is_member {
        return Err(TeamError::NotMember);
    }

    let team = team_repository::find_by_id(pool, team_id)
        .await
        .map_err(TeamError::DatabaseError)?
        .ok_or(TeamError::TeamNotFound)?;

    let members = team_repository::get_members(pool, team_id)
        .await
        .map_err(TeamError::DatabaseError)?;

    Ok(TeamResponse {
        id: team.id,
        name: team.name,
        description: team.description,
        manager_id: team.manager_id,
        members,
        created_at: team.created_at,
    })
}

// Récupère toutes les teams d'un utilisateur
pub async fn get_user_teams(
    pool: &PgPool,
    user_id: Uuid,
) -> Result<Vec<TeamResponse>, TeamError> {
    let teams = team_repository::get_user_teams(pool, user_id)
        .await
        .map_err(TeamError::DatabaseError)?;

    let mut responses = Vec::new();
    for team in teams {
        let members = team_repository::get_members(pool, team.id)
            .await
            .map_err(TeamError::DatabaseError)?;

        responses.push(TeamResponse {
            id: team.id,
            name: team.name,
            description: team.description,
            manager_id: team.manager_id,
            members,
            created_at: team.created_at,
        });
    }

    Ok(responses)
}

// Génère un code d'invitation (Manager uniquement)
pub async fn generate_invitation(
    pool: &PgPool,
    team_id: Uuid,
    user_id: Uuid,
) -> Result<String, TeamError> {
    let role = team_repository::get_member_role(pool, team_id, user_id)
        .await
        .map_err(TeamError::DatabaseError)?
        .ok_or(TeamError::NotMember)?;

    if role != TeamRole::Manager {
        return Err(TeamError::NotManager);
    }

    let invitation = team_repository::create_invitation(pool, team_id, user_id)
        .await
        .map_err(TeamError::DatabaseError)?;

    Ok(invitation.code)
}

// Change le rôle d'un membre (Manager uniquement)
pub async fn update_member_role(
    pool: &PgPool,
    team_id: Uuid,
    manager_id: Uuid,
    target_user_id: Uuid,
    role: TeamRole,
) -> Result<(), TeamError> {
    let manager_role = team_repository::get_member_role(pool, team_id, manager_id)
        .await
        .map_err(TeamError::DatabaseError)?
        .ok_or(TeamError::NotMember)?;

    if manager_role != TeamRole::Manager {
        return Err(TeamError::NotManager);
    }

    if manager_id == target_user_id {
        return Err(TeamError::CannotTargetSelf);
    }

    team_repository::update_member_role(pool, team_id, target_user_id, role)
        .await
        .map_err(TeamError::DatabaseError)?;

    Ok(())
}
// Rejoindre une team via un code d'invitation
pub async fn join_team(
    pool: &PgPool,
    req: JoinTeamRequest,
    user_id: Uuid,
) -> Result<TeamResponse, TeamError> {
    let invitation = team_repository::find_invitation_by_code(pool, &req.code)
        .await
        .map_err(TeamError::DatabaseError)?
        .ok_or(TeamError::InvalidInvitationCode)?;

    // Vérifier que l'utilisateur n'est pas banni (même avec un code valide)
    let is_banned = team_repository::is_banned(pool, invitation.team_id, user_id)
        .await
        .map_err(TeamError::DatabaseError)?;

    if is_banned {
        return Err(TeamError::Banned);
    }

    // Vérifier que l'utilisateur n'est pas déjà membre
    let is_member = team_repository::is_member(pool, invitation.team_id, user_id)
        .await
        .map_err(TeamError::DatabaseError)?;

    if is_member {
        return Err(TeamError::AlreadyMember);
    }

    team_repository::add_member(pool, invitation.team_id, user_id, TeamRole::Observer)
        .await
        .map_err(TeamError::DatabaseError)?;

    let team = team_repository::find_by_id(pool, invitation.team_id)
        .await
        .map_err(TeamError::DatabaseError)?
        .ok_or(TeamError::TeamNotFound)?;

    let members = team_repository::get_members(pool, invitation.team_id)
        .await
        .map_err(TeamError::DatabaseError)?;

    Ok(TeamResponse {
        id: team.id,
        name: team.name,
        description: team.description,
        manager_id: team.manager_id,
        members,
        created_at: team.created_at,
    })
}

// Transfère le rôle Manager à un autre membre
pub async fn transfer_manager(
    pool: &PgPool,
    team_id: Uuid,
    current_manager_id: Uuid,
    req: TransferManagerRequest,
) -> Result<TeamResponse, TeamError> {
    let role = team_repository::get_member_role(pool, team_id, current_manager_id)
        .await
        .map_err(TeamError::DatabaseError)?
        .ok_or(TeamError::NotMember)?;

    if role != TeamRole::Manager {
        return Err(TeamError::NotManager);
    }

    if current_manager_id == req.user_id {
        return Err(TeamError::CannotTargetSelf);
    }

    let is_member = team_repository::is_member(pool, team_id, req.user_id)
        .await
        .map_err(TeamError::DatabaseError)?;

    if !is_member {
        return Err(TeamError::NotMember);
    }

    team_repository::transfer_manager(pool, team_id, current_manager_id, req.user_id)
        .await
        .map_err(TeamError::DatabaseError)?;

    let team = team_repository::find_by_id(pool, team_id)
        .await
        .map_err(TeamError::DatabaseError)?
        .ok_or(TeamError::TeamNotFound)?;

    let members = team_repository::get_members(pool, team_id)
        .await
        .map_err(TeamError::DatabaseError)?;

    Ok(TeamResponse {
        id: team.id,
        name: team.name,
        description: team.description,
        manager_id: team.manager_id,
        members,
        created_at: team.created_at,
    })
}

// Kick un membre de la team (Manager uniquement)
pub async fn kick_member(
    pool: &PgPool,
    team_id: Uuid,
    manager_id: Uuid,
    target_user_id: Uuid,
) -> Result<(), TeamError> {
    // Vérifier que l'acteur est Manager
    let role = team_repository::get_member_role(pool, team_id, manager_id)
        .await
        .map_err(TeamError::DatabaseError)?
        .ok_or(TeamError::NotMember)?;

    if role != TeamRole::Manager {
        return Err(TeamError::NotManager);
    }

    // Le Manager ne peut pas se kicker lui-même
    if manager_id == target_user_id {
        return Err(TeamError::CannotTargetSelf);
    }

    // Vérifier que la cible est bien membre
    let is_member = team_repository::is_member(pool, team_id, target_user_id)
        .await
        .map_err(TeamError::DatabaseError)?;

    if !is_member {
        return Err(TeamError::NotMember);
    }

    team_repository::kick_member(pool, team_id, target_user_id)
        .await
        .map_err(TeamError::DatabaseError)?;

    Ok(())
}

// Ban temporaire ou permanent d'un membre (Manager uniquement)
pub async fn ban_member(
    pool: &PgPool,
    team_id: Uuid,
    manager_id: Uuid,
    target_user_id: Uuid,
    expires_at: Option<chrono::DateTime<chrono::Utc>>,
    reason: Option<String>,
) -> Result<(), TeamError> {
    // Vérifier que l'acteur est Manager
    let role = team_repository::get_member_role(pool, team_id, manager_id)
        .await
        .map_err(TeamError::DatabaseError)?
        .ok_or(TeamError::NotMember)?;

    if role != TeamRole::Manager {
        return Err(TeamError::NotManager);
    }

    // Le Manager ne peut pas se bannir lui-même
    if manager_id == target_user_id {
        return Err(TeamError::CannotTargetSelf);
    }

    // Kicker d'abord si encore membre
    let is_member = team_repository::is_member(pool, team_id, target_user_id)
        .await
        .map_err(TeamError::DatabaseError)?;

    if is_member {
        team_repository::kick_member(pool, team_id, target_user_id)
            .await
            .map_err(TeamError::DatabaseError)?;
    }

    // Appliquer le ban
    team_repository::ban_member(pool, team_id, manager_id, target_user_id, expires_at, reason)
        .await
        .map_err(TeamError::DatabaseError)?;

    Ok(())
}

// Lever un ban permanent (Manager uniquement)
pub async fn unban_member(
    pool: &PgPool,
    team_id: Uuid,
    manager_id: Uuid,
    target_user_id: Uuid,
) -> Result<(), TeamError> {
    let role = team_repository::get_member_role(pool, team_id, manager_id)
        .await
        .map_err(TeamError::DatabaseError)?
        .ok_or(TeamError::NotMember)?;

    if role != TeamRole::Manager {
        return Err(TeamError::NotManager);
    }

    if manager_id == target_user_id {
        return Err(TeamError::CannotTargetSelf);
    }

    team_repository::unban_member(pool, team_id, target_user_id)
        .await
        .map_err(TeamError::DatabaseError)?;

    Ok(())
}

// Quitter une team
pub async fn leave_team(
    pool: &PgPool,
    team_id: Uuid,
    user_id: Uuid,
) -> Result<(), TeamError> {
    let role = team_repository::get_member_role(pool, team_id, user_id)
        .await
        .map_err(TeamError::DatabaseError)?
        .ok_or(TeamError::NotMember)?;

    // Le Manager ne peut pas quitter sans transférer son rôle
    if role == TeamRole::Manager {
        return Err(TeamError::CannotTargetSelf);
    }

    team_repository::kick_member(pool, team_id, user_id)
        .await
        .map_err(TeamError::DatabaseError)
}

// Met à jour une team (Manager uniquement)
pub async fn update_team(
    pool: &PgPool,
    team_id: Uuid,
    user_id: Uuid,
    req: UpdateTeamRequest,
) -> Result<TeamResponse, TeamError> {
    let role = team_repository::get_member_role(pool, team_id, user_id)
        .await
        .map_err(TeamError::DatabaseError)?
        .ok_or(TeamError::NotMember)?;

    if role != TeamRole::Manager {
        return Err(TeamError::NotManager);
    }

    let team = team_repository::update_team(
        pool,
        team_id,
        req.name.as_deref(),
        req.description.as_deref(),
    )
    .await
    .map_err(TeamError::DatabaseError)?;

    let members = team_repository::get_members(pool, team_id)
        .await
        .map_err(TeamError::DatabaseError)?;

    Ok(TeamResponse {
        id: team.id,
        name: team.name,
        description: team.description,
        manager_id: team.manager_id,
        members,
        created_at: team.created_at,
    })
}

// Supprime une team (Manager uniquement)
pub async fn delete_team(
    pool: &PgPool,
    team_id: Uuid,
    user_id: Uuid,
) -> Result<(), TeamError> {
    let role = team_repository::get_member_role(pool, team_id, user_id)
        .await
        .map_err(TeamError::DatabaseError)?
        .ok_or(TeamError::NotMember)?;

    if role != TeamRole::Manager {
        return Err(TeamError::NotManager);
    }

    team_repository::delete_team(pool, team_id)
        .await
        .map_err(TeamError::DatabaseError)
}