use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::IntoResponse,
    Extension, Json,
};
use uuid::Uuid;

use crate::middleware::auth_middleware::AuthenticatedUser;
use crate::models::incident::{
    AddTimelineEntryRequest, AssignIncidentRequest, CreateIncidentRequest,
    EditTimelineEntryRequest, EscalateIncidentRequest,
};
use crate::models::incident::UpdateIncidentRequest;
use crate::models::response::{ApiError, ApiResponse};
use crate::repositories::user_repository;
use crate::services::incident_service::{self, IncidentError};
use crate::state::AppState;
use crate::websocket::events::{TimelineEntryPayload, WsEvent};

pub async fn create_incident(
    State(state): State<AppState>,
    Extension(auth_user): Extension<AuthenticatedUser>,
    Path(team_id): Path<Uuid>,
    Json(req): Json<CreateIncidentRequest>,
) -> impl IntoResponse {
    let title = req.title.clone();
    match incident_service::create_incident(&state.pool, team_id, auth_user.id, req).await {
        Ok(incident) => (
            StatusCode::CREATED,
            Json(serde_json::json!(ApiResponse::success(
                &format!("Incident '{}' créé avec succès", title),
                incident
            ))),
        ),
        Err(IncidentError::NotMember) => (
            StatusCode::FORBIDDEN,
            Json(serde_json::json!(ApiError::new(
                "Vous n'êtes pas membre de cette team",
                "NOT_MEMBER"
            ))),
        ),
        Err(IncidentError::Forbidden) => (
            StatusCode::FORBIDDEN,
            Json(serde_json::json!(ApiError::new(
                "Seul le Manager peut créer un incident",
                "NOT_MANAGER"
            ))),
        ),
        Err(_) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!(ApiError::new(
                "Erreur interne du serveur",
                "INTERNAL_ERROR"
            ))),
        ),
    }
}

pub async fn get_team_incidents(
    State(state): State<AppState>,
    Extension(auth_user): Extension<AuthenticatedUser>,
    Path(team_id): Path<Uuid>,
) -> impl IntoResponse {
    match incident_service::get_team_incidents(&state.pool, team_id, auth_user.id).await {
        Ok(incidents) => (
            StatusCode::OK,
            Json(serde_json::json!(ApiResponse::success(
                "Incidents récupérés avec succès",
                incidents
            ))),
        ),
        Err(IncidentError::NotMember) => (
            StatusCode::FORBIDDEN,
            Json(serde_json::json!(ApiError::new(
                "Vous n'êtes pas membre de cette team",
                "NOT_MEMBER"
            ))),
        ),
        Err(_) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!(ApiError::new(
                "Erreur interne du serveur",
                "INTERNAL_ERROR"
            ))),
        ),
    }
}

pub async fn get_incident(
    State(state): State<AppState>,
    Extension(auth_user): Extension<AuthenticatedUser>,
    Path(incident_id): Path<Uuid>,
) -> impl IntoResponse {
    match incident_service::get_incident(&state.pool, incident_id, auth_user.id).await {
        Ok(incident) => (
            StatusCode::OK,
            Json(serde_json::json!(ApiResponse::success(
                "Incident récupéré avec succès",
                incident
            ))),
        ),
        Err(IncidentError::IncidentNotFound) => (
            StatusCode::NOT_FOUND,
            Json(serde_json::json!(ApiError::new(
                "Incident introuvable",
                "INCIDENT_NOT_FOUND"
            ))),
        ),
        Err(IncidentError::NotMember) => (
            StatusCode::FORBIDDEN,
            Json(serde_json::json!(ApiError::new(
                "Vous n'êtes pas membre de cette team",
                "NOT_MEMBER"
            ))),
        ),
        Err(_) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!(ApiError::new(
                "Erreur interne du serveur",
                "INTERNAL_ERROR"
            ))),
        ),
    }
}

pub async fn acknowledge_incident(
    State(state): State<AppState>,
    Extension(auth_user): Extension<AuthenticatedUser>,
    Path(incident_id): Path<Uuid>,
) -> impl IntoResponse {
    // Récupérer le username pour l'event WS
    let username = user_repository::find_by_id(&state.pool, auth_user.id)
        .await
        .ok()
        .flatten()
        .map(|u| u.username)
        .unwrap_or_default();

    match incident_service::acknowledge_incident(&state.pool, incident_id, auth_user.id).await {
        Ok(incident) => {
            // Diffuser l'événement WebSocket
            state.broadcaster.broadcast(WsEvent::IncidentStateChanged {
                incident_id,
                new_state: "acknowledged".to_string(),
                by: username,
            });
            (
                StatusCode::OK,
                Json(serde_json::json!(ApiResponse::success(
                    "Incident acquitté avec succès",
                    incident
                ))),
            )
        }
        Err(IncidentError::IncidentNotFound) => (
            StatusCode::NOT_FOUND,
            Json(serde_json::json!(ApiError::new(
                "Incident introuvable",
                "INCIDENT_NOT_FOUND"
            ))),
        ),
        Err(IncidentError::NotMember) => (
            StatusCode::FORBIDDEN,
            Json(serde_json::json!(ApiError::new(
                "Vous n'êtes pas membre de cette team",
                "NOT_MEMBER"
            ))),
        ),
        Err(IncidentError::Forbidden) => (
            StatusCode::FORBIDDEN,
            Json(serde_json::json!(ApiError::new(
                "Les Observers ne peuvent pas acquitter un incident",
                "FORBIDDEN"
            ))),
        ),
        Err(IncidentError::InvalidStateTransition) => (
            StatusCode::BAD_REQUEST,
            Json(serde_json::json!(ApiError::new(
                "Transition d'état invalide",
                "INVALID_STATE_TRANSITION"
            ))),
        ),
        Err(_) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!(ApiError::new(
                "Erreur interne du serveur",
                "INTERNAL_ERROR"
            ))),
        ),
    }
}

pub async fn escalate_incident(
    State(state): State<AppState>,
    Extension(auth_user): Extension<AuthenticatedUser>,
    Path(incident_id): Path<Uuid>,
    Json(req): Json<EscalateIncidentRequest>,
) -> impl IntoResponse {
    let username = user_repository::find_by_id(&state.pool, auth_user.id)
        .await
        .ok()
        .flatten()
        .map(|u| u.username)
        .unwrap_or_default();

    let new_severity = format!("{:?}", req.severity).to_lowercase();

    match incident_service::escalate_incident(&state.pool, incident_id, auth_user.id, req).await {
        Ok(incident) => {
            // Diffuser incident_state_changed
            state.broadcaster.broadcast(WsEvent::IncidentStateChanged {
                incident_id,
                new_state: "escalated".to_string(),
                by: username.clone(),
            });
            // Diffuser incident_escalated
            state.broadcaster.broadcast(WsEvent::IncidentEscalated {
                incident_id,
                new_severity,
                by: username,
            });
            (
                StatusCode::OK,
                Json(serde_json::json!(ApiResponse::success(
                    "Incident escaladé avec succès",
                    incident
                ))),
            )
        }
        Err(IncidentError::IncidentNotFound) => (
            StatusCode::NOT_FOUND,
            Json(serde_json::json!(ApiError::new(
                "Incident introuvable",
                "INCIDENT_NOT_FOUND"
            ))),
        ),
        Err(IncidentError::Forbidden) => (
            StatusCode::FORBIDDEN,
            Json(serde_json::json!(ApiError::new(
                "Les Observers ne peuvent pas escalader un incident",
                "FORBIDDEN"
            ))),
        ),
        Err(IncidentError::InvalidStateTransition) => (
            StatusCode::BAD_REQUEST,
            Json(serde_json::json!(ApiError::new(
                "Transition d'état invalide pour l'escalade",
                "INVALID_STATE_TRANSITION"
            ))),
        ),
        Err(_) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!(ApiError::new(
                "Erreur interne du serveur",
                "INTERNAL_ERROR"
            ))),
        ),
    }
}

pub async fn resolve_incident(
    State(state): State<AppState>,
    Extension(auth_user): Extension<AuthenticatedUser>,
    Path(incident_id): Path<Uuid>,
) -> impl IntoResponse {
    let username = user_repository::find_by_id(&state.pool, auth_user.id)
        .await
        .ok()
        .flatten()
        .map(|u| u.username)
        .unwrap_or_default();

    match incident_service::resolve_incident(&state.pool, incident_id, auth_user.id).await {
        Ok(incident) => {
            state.broadcaster.broadcast(WsEvent::IncidentStateChanged {
                incident_id,
                new_state: "resolved".to_string(),
                by: username,
            });
            (
                StatusCode::OK,
                Json(serde_json::json!(ApiResponse::success(
                    "Incident résolu avec succès",
                    incident
                ))),
            )
        }
        Err(IncidentError::IncidentNotFound) => (
            StatusCode::NOT_FOUND,
            Json(serde_json::json!(ApiError::new(
                "Incident introuvable",
                "INCIDENT_NOT_FOUND"
            ))),
        ),
        Err(IncidentError::NotMember) => (
            StatusCode::FORBIDDEN,
            Json(serde_json::json!(ApiError::new(
                "Vous n'êtes pas membre de cette team",
                "NOT_MEMBER"
            ))),
        ),
        Err(IncidentError::Forbidden) => (
            StatusCode::FORBIDDEN,
            Json(serde_json::json!(ApiError::new(
                "Seul le Manager peut résoudre un incident",
                "NOT_MANAGER"
            ))),
        ),
        Err(IncidentError::InvalidStateTransition) => (
            StatusCode::BAD_REQUEST,
            Json(serde_json::json!(ApiError::new(
                "Transition d'état invalide pour la résolution",
                "INVALID_STATE_TRANSITION"
            ))),
        ),
        Err(_) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!(ApiError::new(
                "Erreur interne du serveur",
                "INTERNAL_ERROR"
            ))),
        ),
    }
}

pub async fn assign_responder(
    State(state): State<AppState>,
    Extension(auth_user): Extension<AuthenticatedUser>,
    Path(incident_id): Path<Uuid>,
    Json(req): Json<AssignIncidentRequest>,
) -> impl IntoResponse {
    let assigned_to_id = req.user_id;

    // Récupérer le username de la personne assignée
    let assigned_username = user_repository::find_by_id(&state.pool, assigned_to_id)
        .await
        .ok()
        .flatten()
        .map(|u| u.username)
        .unwrap_or_default();

    match incident_service::assign_responder(&state.pool, incident_id, auth_user.id, req).await {
        Ok(incident) => {
            // Diffuser incident_assigned
            state.broadcaster.broadcast(WsEvent::IncidentAssigned {
                incident_id,
                assigned_to: assigned_username,
            });
            (
                StatusCode::OK,
                Json(serde_json::json!(ApiResponse::success(
                    "Responder assigné avec succès",
                    incident
                ))),
            )
        }
        Err(IncidentError::IncidentNotFound) => (
            StatusCode::NOT_FOUND,
            Json(serde_json::json!(ApiError::new(
                "Incident introuvable",
                "INCIDENT_NOT_FOUND"
            ))),
        ),
        Err(IncidentError::NotMember) => (
            StatusCode::FORBIDDEN,
            Json(serde_json::json!(ApiError::new(
                "Vous n'êtes pas membre de cette team",
                "NOT_MEMBER"
            ))),
        ),
        Err(IncidentError::Forbidden) => (
            StatusCode::FORBIDDEN,
            Json(serde_json::json!(ApiError::new(
                "Seul le Manager peut assigner un Responder",
                "NOT_MANAGER"
            ))),
        ),
        Err(_) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!(ApiError::new(
                "Erreur interne du serveur",
                "INTERNAL_ERROR"
            ))),
        ),
    }
}

pub async fn add_timeline_entry(
    State(state): State<AppState>,
    Extension(auth_user): Extension<AuthenticatedUser>,
    Path(incident_id): Path<Uuid>,
    Json(req): Json<AddTimelineEntryRequest>,
) -> impl IntoResponse {
    match incident_service::add_timeline_entry(&state.pool, incident_id, auth_user.id, req).await {
        Ok(entry) => {
            // Diffuser timeline_entry_added
            state.broadcaster.broadcast(WsEvent::TimelineEntryAdded {
                incident_id,
                entry: TimelineEntryPayload {
                    content: entry.content.clone(),
                    author: entry.author_username.clone(),
                    at: entry.created_at,
                },
            });
            (
                StatusCode::CREATED,
                Json(serde_json::json!(ApiResponse::success(
                    "Entrée ajoutée à la timeline",
                    entry
                ))),
            )
        }
        Err(IncidentError::IncidentNotFound) => (
            StatusCode::NOT_FOUND,
            Json(serde_json::json!(ApiError::new(
                "Incident introuvable",
                "INCIDENT_NOT_FOUND"
            ))),
        ),
        Err(IncidentError::NotMember) => (
            StatusCode::FORBIDDEN,
            Json(serde_json::json!(ApiError::new(
                "Vous n'êtes pas membre de cette team",
                "NOT_MEMBER"
            ))),
        ),
        Err(IncidentError::Forbidden) => (
            StatusCode::FORBIDDEN,
            Json(serde_json::json!(ApiError::new(
                "Les Observers ne peuvent pas ajouter d'entrée à la timeline",
                "FORBIDDEN"
            ))),
        ),
        Err(_) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!(ApiError::new(
                "Erreur interne du serveur",
                "INTERNAL_ERROR"
            ))),
        ),
    }
}

pub async fn edit_timeline_entry(
    State(state): State<AppState>,
    Extension(auth_user): Extension<AuthenticatedUser>,
    Path((incident_id, entry_id)): Path<(Uuid, Uuid)>,
    Json(req): Json<EditTimelineEntryRequest>,
) -> impl IntoResponse {
    let _ = incident_id;
    match incident_service::edit_timeline_entry(&state.pool, entry_id, auth_user.id, req).await {
        Ok(entry) => {
            // Diffuser timeline_entry_edited
            state.broadcaster.broadcast(WsEvent::TimelineEntryEdited {
                incident_id: entry.incident_id,
                entry_id,
                new_content: entry.content.clone(),
                edited_at: entry.edited_at.unwrap_or(entry.created_at),
            });
            (
                StatusCode::OK,
                Json(serde_json::json!(ApiResponse::success(
                    "Entrée de timeline modifiée avec succès",
                    entry
                ))),
            )
        }
        Err(IncidentError::IncidentNotFound) => (
            StatusCode::NOT_FOUND,
            Json(serde_json::json!(ApiError::new(
                "Entrée de timeline introuvable",
                "ENTRY_NOT_FOUND"
            ))),
        ),
        Err(IncidentError::Forbidden) => (
            StatusCode::FORBIDDEN,
            Json(serde_json::json!(ApiError::new(
                "Vous ne pouvez modifier que vos propres entrées",
                "FORBIDDEN"
            ))),
        ),
        Err(_) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!(ApiError::new(
                "Erreur interne du serveur",
                "INTERNAL_ERROR"
            ))),
        ),
    }
}

// PATCH /incidents/:incident_id
pub async fn update_incident(
    State(state): State<AppState>,
    Extension(auth_user): Extension<AuthenticatedUser>,
    Path(incident_id): Path<Uuid>,
    Json(req): Json<UpdateIncidentRequest>,
) -> impl IntoResponse {
    match incident_service::update_incident(&state.pool, incident_id, auth_user.id, req).await {
        Ok(incident) => (
            StatusCode::OK,
            Json(serde_json::json!(ApiResponse::success(
                "Incident mis à jour avec succès",
                incident
            ))),
        ),
        Err(IncidentError::IncidentNotFound) => (
            StatusCode::NOT_FOUND,
            Json(serde_json::json!(ApiError::new(
                "Incident introuvable",
                "INCIDENT_NOT_FOUND"
            ))),
        ),
        Err(IncidentError::Forbidden) => (
            StatusCode::FORBIDDEN,
            Json(serde_json::json!(ApiError::new(
                "Seul le Manager peut modifier un incident",
                "NOT_MANAGER"
            ))),
        ),
        Err(_) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!(ApiError::new(
                "Erreur interne du serveur",
                "INTERNAL_ERROR"
            ))),
        ),
    }
}

// DELETE /incidents/:incident_id
pub async fn cancel_incident(
    State(state): State<AppState>,
    Extension(auth_user): Extension<AuthenticatedUser>,
    Path(incident_id): Path<Uuid>,
) -> impl IntoResponse {
    match incident_service::cancel_incident(&state.pool, incident_id, auth_user.id).await {
        Ok(_) => (
            StatusCode::OK,
            Json(serde_json::json!(ApiResponse::<()>::success_no_data(
                "Incident supprimé avec succès"
            ))),
        ),
        Err(IncidentError::IncidentNotFound) => (
            StatusCode::NOT_FOUND,
            Json(serde_json::json!(ApiError::new(
                "Incident introuvable",
                "INCIDENT_NOT_FOUND"
            ))),
        ),
        Err(IncidentError::Forbidden) => (
            StatusCode::FORBIDDEN,
            Json(serde_json::json!(ApiError::new(
                "Seul le Manager peut supprimer un incident",
                "NOT_MANAGER"
            ))),
        ),
        Err(_) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!(ApiError::new(
                "Erreur interne du serveur",
                "INTERNAL_ERROR"
            ))),
        ),
    }
}