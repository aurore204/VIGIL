use sqlx::PgPool;
use uuid::Uuid;

use crate::models::incident::UpdateIncidentRequest;
use crate::models::incident::{
    AddTimelineEntryRequest, AssignIncidentRequest, CreateIncidentRequest,
    EditTimelineEntryRequest, EscalateIncidentRequest, IncidentResponse, IncidentState,
    TimelineEntry,
};
use crate::models::team::TeamRole;
use crate::repositories::{incident_repository, team_repository};

#[derive(Debug)]
pub enum IncidentError {
    IncidentNotFound,
    NotMember,
    Forbidden,
    InvalidStateTransition,
    DatabaseError(sqlx::Error),
}

fn validate_state_transition(current: &IncidentState, next: &IncidentState) -> bool {
    matches!(
        (current, next),
        (IncidentState::Open, IncidentState::Acknowledged)
            | (IncidentState::Acknowledged, IncidentState::Escalated)
            | (IncidentState::Escalated, IncidentState::Resolved)
            | (IncidentState::Acknowledged, IncidentState::Resolved)
            | (IncidentState::Open, IncidentState::Resolved)
    )
}

// Crée un nouvel incident (Manager uniquement)
pub async fn create_incident(
    pool: &PgPool,
    team_id: Uuid,
    user_id: Uuid,
    req: CreateIncidentRequest,
) -> Result<IncidentResponse, IncidentError> {
    let role = team_repository::get_member_role(pool, team_id, user_id)
        .await
        .map_err(IncidentError::DatabaseError)?
        .ok_or(IncidentError::NotMember)?;

    if role != TeamRole::Manager {
        return Err(IncidentError::Forbidden);
    }

    let incident = incident_repository::create_incident(
        pool,
        team_id,
        user_id,
        &req.title,
        req.description.as_deref(),
        req.severity,
    )
    .await
    .map_err(IncidentError::DatabaseError)?;

    Ok(IncidentResponse {
        id: incident.id,
        team_id: incident.team_id,
        created_by: incident.created_by,
        assigned_to: incident.assigned_to,
        title: incident.title,
        description: incident.description,
        state: incident.state,
        severity: incident.severity,
        timeline: vec![],
        resolved_at: incident.resolved_at,
        created_at: incident.created_at,
        updated_at: incident.updated_at,
    })
}

pub async fn get_incident(
    pool: &PgPool,
    incident_id: Uuid,
    user_id: Uuid,
) -> Result<IncidentResponse, IncidentError> {
    let incident = incident_repository::find_by_id(pool, incident_id)
        .await
        .map_err(IncidentError::DatabaseError)?
        .ok_or(IncidentError::IncidentNotFound)?;

    let is_member = team_repository::is_member(pool, incident.team_id, user_id)
        .await
        .map_err(IncidentError::DatabaseError)?;

    if !is_member {
        return Err(IncidentError::NotMember);
    }

    incident_repository::get_incident_with_timeline(pool, incident_id)
        .await
        .map_err(IncidentError::DatabaseError)?
        .ok_or(IncidentError::IncidentNotFound)
}

pub async fn get_team_incidents(
    pool: &PgPool,
    team_id: Uuid,
    user_id: Uuid,
) -> Result<Vec<IncidentResponse>, IncidentError> {
    let is_member = team_repository::is_member(pool, team_id, user_id)
        .await
        .map_err(IncidentError::DatabaseError)?;

    if !is_member {
        return Err(IncidentError::NotMember);
    }

    let incidents = incident_repository::find_by_team(pool, team_id)
        .await
        .map_err(IncidentError::DatabaseError)?;

    let mut responses = Vec::new();
    for incident in incidents {
        let timeline = incident_repository::get_timeline(pool, incident.id)
            .await
            .map_err(IncidentError::DatabaseError)?;

        responses.push(IncidentResponse {
            id: incident.id,
            team_id: incident.team_id,
            created_by: incident.created_by,
            assigned_to: incident.assigned_to,
            title: incident.title,
            description: incident.description,
            state: incident.state,
            severity: incident.severity,
            timeline,
            resolved_at: incident.resolved_at,
            created_at: incident.created_at,
            updated_at: incident.updated_at,
        });
    }

    Ok(responses)
}

pub async fn acknowledge_incident(
    pool: &PgPool,
    incident_id: Uuid,
    user_id: Uuid,
) -> Result<IncidentResponse, IncidentError> {
    let incident = incident_repository::find_by_id(pool, incident_id)
        .await
        .map_err(IncidentError::DatabaseError)?
        .ok_or(IncidentError::IncidentNotFound)?;

    let role = team_repository::get_member_role(pool, incident.team_id, user_id)
        .await
        .map_err(IncidentError::DatabaseError)?
        .ok_or(IncidentError::NotMember)?;

    if role == TeamRole::Observer {
        return Err(IncidentError::Forbidden);
    }

    if !validate_state_transition(&incident.state, &IncidentState::Acknowledged) {
        return Err(IncidentError::InvalidStateTransition);
    }

    incident_repository::update_state(pool, incident_id, IncidentState::Acknowledged)
        .await
        .map_err(IncidentError::DatabaseError)?;

    incident_repository::get_incident_with_timeline(pool, incident_id)
        .await
        .map_err(IncidentError::DatabaseError)?
        .ok_or(IncidentError::IncidentNotFound)
}

pub async fn update_incident(
    pool: &PgPool,
    incident_id: Uuid,
    user_id: Uuid,
    req: UpdateIncidentRequest,
) -> Result<IncidentResponse, IncidentError> {
    let incident = incident_repository::find_by_id(pool, incident_id)
        .await
        .map_err(IncidentError::DatabaseError)?
        .ok_or(IncidentError::IncidentNotFound)?;

    let role = team_repository::get_member_role(pool, incident.team_id, user_id)
        .await
        .map_err(IncidentError::DatabaseError)?
        .ok_or(IncidentError::NotMember)?;

    if role != TeamRole::Manager {
        return Err(IncidentError::Forbidden);
    }

    incident_repository::update_incident(
        pool,
        incident_id,
        req.title.as_deref(),
        req.description.as_deref(),
        req.severity,
    )
    .await
    .map_err(IncidentError::DatabaseError)?;

    incident_repository::get_incident_with_timeline(pool, incident_id)
        .await
        .map_err(IncidentError::DatabaseError)?
        .ok_or(IncidentError::IncidentNotFound)
}

pub async fn cancel_incident(
    pool: &PgPool,
    incident_id: Uuid,
    user_id: Uuid,
) -> Result<(), IncidentError> {
    let incident = incident_repository::find_by_id(pool, incident_id)
        .await
        .map_err(IncidentError::DatabaseError)?
        .ok_or(IncidentError::IncidentNotFound)?;

    let role = team_repository::get_member_role(pool, incident.team_id, user_id)
        .await
        .map_err(IncidentError::DatabaseError)?
        .ok_or(IncidentError::NotMember)?;

    if role != TeamRole::Manager {
        return Err(IncidentError::Forbidden);
    }

    incident_repository::delete_incident(pool, incident_id)
        .await
        .map_err(IncidentError::DatabaseError)
}

pub async fn escalate_incident(
    pool: &PgPool,
    incident_id: Uuid,
    user_id: Uuid,
    req: EscalateIncidentRequest,
) -> Result<IncidentResponse, IncidentError> {
    let incident = incident_repository::find_by_id(pool, incident_id)
        .await
        .map_err(IncidentError::DatabaseError)?
        .ok_or(IncidentError::IncidentNotFound)?;

    let role = team_repository::get_member_role(pool, incident.team_id, user_id)
        .await
        .map_err(IncidentError::DatabaseError)?
        .ok_or(IncidentError::NotMember)?;

    if role == TeamRole::Observer {
        return Err(IncidentError::Forbidden);
    }

    // L'incident doit être acquitté ou déjà escaladé pour pouvoir (re)escalader la sévérité.
    if !matches!(
        incident.state,
        IncidentState::Acknowledged | IncidentState::Escalated
    ) {
        return Err(IncidentError::InvalidStateTransition);
    }

    // La transition d'état ne se fait qu'une fois, au premier passage vers Escalated.
    if incident.state != IncidentState::Escalated {
        incident_repository::update_state(pool, incident_id, IncidentState::Escalated)
            .await
            .map_err(IncidentError::DatabaseError)?;
    }

    incident_repository::update_severity(pool, incident_id, req.severity)
        .await
        .map_err(IncidentError::DatabaseError)?;

    incident_repository::get_incident_with_timeline(pool, incident_id)
        .await
        .map_err(IncidentError::DatabaseError)?
        .ok_or(IncidentError::IncidentNotFound)
}

pub async fn resolve_incident(
    pool: &PgPool,
    incident_id: Uuid,
    user_id: Uuid,
) -> Result<IncidentResponse, IncidentError> {
    let incident = incident_repository::find_by_id(pool, incident_id)
        .await
        .map_err(IncidentError::DatabaseError)?
        .ok_or(IncidentError::IncidentNotFound)?;

    let role = team_repository::get_member_role(pool, incident.team_id, user_id)
        .await
        .map_err(IncidentError::DatabaseError)?
        .ok_or(IncidentError::NotMember)?;

    if role != TeamRole::Manager {
        return Err(IncidentError::Forbidden);
    }

    if !validate_state_transition(&incident.state, &IncidentState::Resolved) {
        return Err(IncidentError::InvalidStateTransition);
    }

    incident_repository::update_state(pool, incident_id, IncidentState::Resolved)
        .await
        .map_err(IncidentError::DatabaseError)?;

    incident_repository::get_incident_with_timeline(pool, incident_id)
        .await
        .map_err(IncidentError::DatabaseError)?
        .ok_or(IncidentError::IncidentNotFound)
}

pub async fn assign_responder(
    pool: &PgPool,
    incident_id: Uuid,
    user_id: Uuid,
    req: AssignIncidentRequest,
) -> Result<IncidentResponse, IncidentError> {
    let incident = incident_repository::find_by_id(pool, incident_id)
        .await
        .map_err(IncidentError::DatabaseError)?
        .ok_or(IncidentError::IncidentNotFound)?;

    let role = team_repository::get_member_role(pool, incident.team_id, user_id)
        .await
        .map_err(IncidentError::DatabaseError)?
        .ok_or(IncidentError::NotMember)?;

    if role != TeamRole::Manager {
        return Err(IncidentError::Forbidden);
    }

    let assignee_role = team_repository::get_member_role(pool, incident.team_id, req.user_id)
        .await
        .map_err(IncidentError::DatabaseError)?
        .ok_or(IncidentError::NotMember)?;

    if assignee_role != TeamRole::Responder {
        return Err(IncidentError::Forbidden);
    }

    incident_repository::assign_responder(pool, incident_id, req.user_id)
        .await
        .map_err(IncidentError::DatabaseError)?;

    incident_repository::get_incident_with_timeline(pool, incident_id)
        .await
        .map_err(IncidentError::DatabaseError)?
        .ok_or(IncidentError::IncidentNotFound)
}

pub async fn add_timeline_entry(
    pool: &PgPool,
    incident_id: Uuid,
    user_id: Uuid,
    req: AddTimelineEntryRequest,
) -> Result<TimelineEntry, IncidentError> {
    let incident = incident_repository::find_by_id(pool, incident_id)
        .await
        .map_err(IncidentError::DatabaseError)?
        .ok_or(IncidentError::IncidentNotFound)?;

    let role = team_repository::get_member_role(pool, incident.team_id, user_id)
        .await
        .map_err(IncidentError::DatabaseError)?
        .ok_or(IncidentError::NotMember)?;

    if role == TeamRole::Observer {
        return Err(IncidentError::Forbidden);
    }

    incident_repository::add_timeline_entry(pool, incident_id, user_id, &req.content)
        .await
        .map_err(IncidentError::DatabaseError)
}

pub async fn edit_timeline_entry(
    pool: &PgPool,
    entry_id: Uuid,
    user_id: Uuid,
    req: EditTimelineEntryRequest,
) -> Result<TimelineEntry, IncidentError> {
    let entry = incident_repository::find_timeline_entry(pool, entry_id)
        .await
        .map_err(IncidentError::DatabaseError)?
        .ok_or(IncidentError::IncidentNotFound)?;

    if entry.author_id != user_id {
        return Err(IncidentError::Forbidden);
    }

    incident_repository::edit_timeline_entry(pool, entry_id, &req.content)
        .await
        .map_err(IncidentError::DatabaseError)
}
