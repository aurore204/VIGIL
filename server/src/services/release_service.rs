use sqlx::PgPool;
use uuid::Uuid;

use crate::models::release::{CreateReleaseRequest, ReleaseResponse, ReleaseState, StepState};
use crate::models::team::TeamRole;
use crate::repositories::{release_repository, team_repository};

#[derive(Debug)]
pub enum ReleaseError {
    ReleaseNotFound,
    NotMember,
    Forbidden,
    NoSteps,
    StepNotFound,
    StepNotAvailable,
    ReleaseBlocked,
    InvalidStateTransition,
    DatabaseError(sqlx::Error),
}

pub async fn create_release(
    pool: &PgPool,
    team_id: Uuid,
    user_id: Uuid,
    req: CreateReleaseRequest,
) -> Result<ReleaseResponse, ReleaseError> {
    let role = team_repository::get_member_role(pool, team_id, user_id)
        .await
        .map_err(ReleaseError::DatabaseError)?
        .ok_or(ReleaseError::NotMember)?;

    if role != TeamRole::Manager {
        return Err(ReleaseError::Forbidden);
    }

    if req.steps.is_empty() {
        return Err(ReleaseError::NoSteps);
    }

    let release = release_repository::create_release(
        pool,
        team_id,
        user_id,
        &req.title,
        req.description.as_deref(),
    )
    .await
    .map_err(ReleaseError::DatabaseError)?;

    for (i, step) in req.steps.iter().enumerate() {
        release_repository::create_step(
            pool,
            release.id,
            &step.name,
            step.description.as_deref(),
            (i + 1) as i32,
        )
        .await
        .map_err(ReleaseError::DatabaseError)?;
    }

    release_repository::get_release_with_steps(pool, release.id)
        .await
        .map_err(ReleaseError::DatabaseError)?
        .ok_or(ReleaseError::ReleaseNotFound)
}

pub async fn get_release(
    pool: &PgPool,
    release_id: Uuid,
    user_id: Uuid,
) -> Result<ReleaseResponse, ReleaseError> {
    let release = release_repository::find_by_id(pool, release_id)
        .await
        .map_err(ReleaseError::DatabaseError)?
        .ok_or(ReleaseError::ReleaseNotFound)?;

    let is_member = team_repository::is_member(pool, release.team_id, user_id)
        .await
        .map_err(ReleaseError::DatabaseError)?;

    if !is_member {
        return Err(ReleaseError::NotMember);
    }

    release_repository::get_release_with_steps(pool, release_id)
        .await
        .map_err(ReleaseError::DatabaseError)?
        .ok_or(ReleaseError::ReleaseNotFound)
}

pub async fn get_team_releases(
    pool: &PgPool,
    team_id: Uuid,
    user_id: Uuid,
) -> Result<Vec<ReleaseResponse>, ReleaseError> {
    let is_member = team_repository::is_member(pool, team_id, user_id)
        .await
        .map_err(ReleaseError::DatabaseError)?;

    if !is_member {
        return Err(ReleaseError::NotMember);
    }

    let releases = release_repository::find_by_team(pool, team_id)
        .await
        .map_err(ReleaseError::DatabaseError)?;

    let mut responses = Vec::new();
    for release in releases {
        let steps = release_repository::get_steps(pool, release.id)
            .await
            .map_err(ReleaseError::DatabaseError)?;

        responses.push(ReleaseResponse {
            id: release.id,
            team_id: release.team_id,
            created_by: release.created_by,
            title: release.title,
            description: release.description,
            state: release.state,
            steps,
            created_at: release.created_at,
            updated_at: release.updated_at,
        });
    }

    Ok(responses)
}

pub async fn start_release(
    pool: &PgPool,
    release_id: Uuid,
    user_id: Uuid,
) -> Result<ReleaseResponse, ReleaseError> {
    let release = release_repository::find_by_id(pool, release_id)
        .await
        .map_err(ReleaseError::DatabaseError)?
        .ok_or(ReleaseError::ReleaseNotFound)?;

    let role = team_repository::get_member_role(pool, release.team_id, user_id)
        .await
        .map_err(ReleaseError::DatabaseError)?
        .ok_or(ReleaseError::NotMember)?;

    if role != TeamRole::Manager {
        return Err(ReleaseError::Forbidden);
    }

    if release.state != ReleaseState::Created {
        return Err(ReleaseError::InvalidStateTransition);
    }

    release_repository::update_state(pool, release_id, ReleaseState::InProgress)
        .await
        .map_err(ReleaseError::DatabaseError)?;

    release_repository::get_release_with_steps(pool, release_id)
        .await
        .map_err(ReleaseError::DatabaseError)?
        .ok_or(ReleaseError::ReleaseNotFound)
}

pub async fn validate_step(
    pool: &PgPool,
    release_id: Uuid,
    step_id: Uuid,
    user_id: Uuid,
) -> Result<ReleaseResponse, ReleaseError> {
    let release = release_repository::find_by_id(pool, release_id)
        .await
        .map_err(ReleaseError::DatabaseError)?
        .ok_or(ReleaseError::ReleaseNotFound)?;

    let role = team_repository::get_member_role(pool, release.team_id, user_id)
        .await
        .map_err(ReleaseError::DatabaseError)?
        .ok_or(ReleaseError::NotMember)?;

    if role == TeamRole::Observer {
        return Err(ReleaseError::Forbidden);
    }

    if release.state == ReleaseState::Blocked {
        return Err(ReleaseError::ReleaseBlocked);
    }

    if release.state != ReleaseState::InProgress {
        return Err(ReleaseError::InvalidStateTransition);
    }

    let steps = release_repository::get_steps(pool, release_id)
        .await
        .map_err(ReleaseError::DatabaseError)?;

    let step = steps
        .iter()
        .find(|s| s.id == step_id)
        .ok_or(ReleaseError::StepNotFound)?;

    // Vérifier que toutes les étapes précédentes sont complétées
    let previous_steps_completed = steps
        .iter()
        .filter(|s| s.position < step.position)
        .all(|s| s.state == StepState::Completed);

    if !previous_steps_completed {
        return Err(ReleaseError::StepNotAvailable);
    }

    release_repository::validate_step(pool, step_id, user_id)
        .await
        .map_err(ReleaseError::DatabaseError)?;

    // Vérifier si toutes les étapes sont complétées
    let updated_steps = release_repository::get_steps(pool, release_id)
        .await
        .map_err(ReleaseError::DatabaseError)?;

    let all_completed = updated_steps
        .iter()
        .all(|s| s.state == StepState::Completed);

    if all_completed {
        release_repository::update_state(pool, release_id, ReleaseState::Completed)
            .await
            .map_err(ReleaseError::DatabaseError)?;
    }

    release_repository::get_release_with_steps(pool, release_id)
        .await
        .map_err(ReleaseError::DatabaseError)?
        .ok_or(ReleaseError::ReleaseNotFound)
}

pub async fn cancel_release(
    pool: &PgPool,
    release_id: Uuid,
    user_id: Uuid,
) -> Result<(), ReleaseError> {
    let release = release_repository::find_by_id(pool, release_id)
        .await
        .map_err(ReleaseError::DatabaseError)?
        .ok_or(ReleaseError::ReleaseNotFound)?;

    let role = team_repository::get_member_role(pool, release.team_id, user_id)
        .await
        .map_err(ReleaseError::DatabaseError)?
        .ok_or(ReleaseError::NotMember)?;

    if role != TeamRole::Manager {
        return Err(ReleaseError::Forbidden);
    }

    release_repository::update_state(pool, release_id, ReleaseState::Cancelled)
        .await
        .map_err(ReleaseError::DatabaseError)?;

    Ok(())
}

// Bloque automatiquement une release si un incident lié est actif
pub async fn block_release_if_needed(
    pool: &PgPool,
    release_id: Uuid,
    incident_id: Uuid,
) -> Result<bool, ReleaseError> {
    release_repository::link_incident(pool, release_id, incident_id)
        .await
        .map_err(ReleaseError::DatabaseError)?;

    let release = release_repository::find_by_id(pool, release_id)
        .await
        .map_err(ReleaseError::DatabaseError)?
        .ok_or(ReleaseError::ReleaseNotFound)?;

    if release.state == ReleaseState::InProgress {
        release_repository::update_state(pool, release_id, ReleaseState::Blocked)
            .await
            .map_err(ReleaseError::DatabaseError)?;
        return Ok(true);
    }

    Ok(false)
}

// Débloque une release si tous ses incidents sont résolus
pub async fn unblock_release_if_resolved(
    pool: &PgPool,
    release_id: Uuid,
) -> Result<bool, ReleaseError> {
    let release = release_repository::find_by_id(pool, release_id)
        .await
        .map_err(ReleaseError::DatabaseError)?
        .ok_or(ReleaseError::ReleaseNotFound)?;

    if release.state != ReleaseState::Blocked {
        return Ok(false);
    }

    let has_active = release_repository::has_active_incidents(pool, release_id)
        .await
        .map_err(ReleaseError::DatabaseError)?;

    if !has_active {
        release_repository::update_state(pool, release_id, ReleaseState::InProgress)
            .await
            .map_err(ReleaseError::DatabaseError)?;
        return Ok(true);
    }

    Ok(false)
}
