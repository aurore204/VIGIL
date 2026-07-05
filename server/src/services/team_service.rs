use sqlx::PgPool;
use uuid::Uuid;

use crate::models::team::{
    CreateTeamRequest, JoinTeamRequest, TeamResponse, TeamRole, TransferManagerRequest,
};
use crate::repositories::team_repository;

// Erreurs possibles du service team
#[derive(Debug)]
pub enum TeamError {
    TeamNotFound,
    AlreadyMember,
    NotMember,
    InvalidInvitationCode,
    NotManager,
    CannotTargetSelf,
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
    // Vérifier que l'utilisateur est membre de la team
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
    // Vérifier que l'utilisateur est Manager
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

// Rejoindre une team via un code d'invitation
pub async fn join_team(
    pool: &PgPool,
    req: JoinTeamRequest,
    user_id: Uuid,
) -> Result<TeamResponse, TeamError> {
    // Vérifier que le code est valide
    let invitation = team_repository::find_invitation_by_code(pool, &req.code)
        .await
        .map_err(TeamError::DatabaseError)?
        .ok_or(TeamError::InvalidInvitationCode)?;

    // Vérifier que l'utilisateur n'est pas déjà membre
    let is_member = team_repository::is_member(pool, invitation.team_id, user_id)
        .await
        .map_err(TeamError::DatabaseError)?;

    if is_member {
        return Err(TeamError::AlreadyMember);
    }

    // Ajouter le membre avec le rôle Observer par défaut
    team_repository::add_member(pool, invitation.team_id, user_id, TeamRole::Observer)
        .await
        .map_err(TeamError::DatabaseError)?;

    // Retourner la team complète
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
    // Vérifier que l'utilisateur courant est Manager
    let role = team_repository::get_member_role(pool, team_id, current_manager_id)
        .await
        .map_err(TeamError::DatabaseError)?
        .ok_or(TeamError::NotMember)?;

    if role != TeamRole::Manager {
        return Err(TeamError::NotManager);
    }

    // Le Manager ne peut pas se transférer le rôle à lui-même
    if current_manager_id == req.user_id {
        return Err(TeamError::CannotTargetSelf);
    }

    // Vérifier que le nouveau manager est bien membre de la team
    let is_member = team_repository::is_member(pool, team_id, req.user_id)
        .await
        .map_err(TeamError::DatabaseError)?;

    if !is_member {
        return Err(TeamError::NotMember);
    }

    // Effectuer le transfert
    team_repository::transfer_manager(pool, team_id, current_manager_id, req.user_id)
        .await
        .map_err(TeamError::DatabaseError)?;

    // Retourner la team mise à jour
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