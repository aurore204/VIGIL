use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::IntoResponse,
    Extension, Json,
};
use sqlx::PgPool;
use uuid::Uuid;

use crate::middleware::auth_middleware::AuthenticatedUser;
use crate::models::incident::{
    AddTimelineEntryRequest, AssignIncidentRequest, CreateIncidentRequest,
    EditTimelineEntryRequest, EscalateIncidentRequest,
};
use crate::models::response::{ApiError, ApiResponse};
use crate::services::incident_service::{self, IncidentError};

// POST /teams/:team_id/incidents
pub async fn create_incident(
    State(pool): State<PgPool>,
    Extension(auth_user): Extension<AuthenticatedUser>,
    Path(team_id): Path<Uuid>,
    Json(req): Json<CreateIncidentRequest>,
) -> impl IntoResponse {
    let title = req.title.clone();
    match incident_service::create_incident(&pool, team_id, auth_user.id, req).await {
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

// GET /teams/:team_id/incidents
pub async fn get_team_incidents(
    State(pool): State<PgPool>,
    Extension(auth_user): Extension<AuthenticatedUser>,
    Path(team_id): Path<Uuid>,
) -> impl IntoResponse {
    match incident_service::get_team_incidents(&pool, team_id, auth_user.id).await {
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

// GET /incidents/:incident_id
pub async fn get_incident(
    State(pool): State<PgPool>,
    Extension(auth_user): Extension<AuthenticatedUser>,
    Path(incident_id): Path<Uuid>,
) -> impl IntoResponse {
    match incident_service::get_incident(&pool, incident_id, auth_user.id).await {
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

// PATCH /incidents/:incident_id/acknowledge
pub async fn acknowledge_incident(
    State(pool): State<PgPool>,
    Extension(auth_user): Extension<AuthenticatedUser>,
    Path(incident_id): Path<Uuid>,
) -> impl IntoResponse {
    match incident_service::acknowledge_incident(&pool, incident_id, auth_user.id).await {
        Ok(incident) => (
            StatusCode::OK,
            Json(serde_json::json!(ApiResponse::success(
                "Incident acquitté avec succès",
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

// PATCH /incidents/:incident_id/escalate
pub async fn escalate_incident(
    State(pool): State<PgPool>,
    Extension(auth_user): Extension<AuthenticatedUser>,
    Path(incident_id): Path<Uuid>,
    Json(req): Json<EscalateIncidentRequest>,
) -> impl IntoResponse {
    match incident_service::escalate_incident(&pool, incident_id, auth_user.id, req).await {
        Ok(incident) => (
            StatusCode::OK,
            Json(serde_json::json!(ApiResponse::success(
                "Incident escaladé avec succès",
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

// PATCH /incidents/:incident_id/resolve
pub async fn resolve_incident(
    State(pool): State<PgPool>,
    Extension(auth_user): Extension<AuthenticatedUser>,
    Path(incident_id): Path<Uuid>,
) -> impl IntoResponse {
    match incident_service::resolve_incident(&pool, incident_id, auth_user.id).await {
        Ok(incident) => (
            StatusCode::OK,
            Json(serde_json::json!(ApiResponse::success(
                "Incident résolu avec succès",
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

// POST /incidents/:incident_id/assign
pub async fn assign_responder(
    State(pool): State<PgPool>,
    Extension(auth_user): Extension<AuthenticatedUser>,
    Path(incident_id): Path<Uuid>,
    Json(req): Json<AssignIncidentRequest>,
) -> impl IntoResponse {
    match incident_service::assign_responder(&pool, incident_id, auth_user.id, req).await {
        Ok(incident) => (
            StatusCode::OK,
            Json(serde_json::json!(ApiResponse::success(
                "Responder assigné avec succès",
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

// POST /incidents/:incident_id/timeline
pub async fn add_timeline_entry(
    State(pool): State<PgPool>,
    Extension(auth_user): Extension<AuthenticatedUser>,
    Path(incident_id): Path<Uuid>,
    Json(req): Json<AddTimelineEntryRequest>,
) -> impl IntoResponse {
    match incident_service::add_timeline_entry(&pool, incident_id, auth_user.id, req).await {
        Ok(entry) => (
            StatusCode::CREATED,
            Json(serde_json::json!(ApiResponse::success(
                "Entrée ajoutée à la timeline",
                entry
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

// PATCH /incidents/:incident_id/timeline/:entry_id
pub async fn edit_timeline_entry(
    State(pool): State<PgPool>,
    Extension(auth_user): Extension<AuthenticatedUser>,
    Path((incident_id, entry_id)): Path<(Uuid, Uuid)>,
    Json(req): Json<EditTimelineEntryRequest>,
) -> impl IntoResponse {
    let _ = incident_id; // utilisé pour la route, la vérification se fait via l'entrée
    match incident_service::edit_timeline_entry(&pool, entry_id, auth_user.id, req).await {
        Ok(entry) => (
            StatusCode::OK,
            Json(serde_json::json!(ApiResponse::success(
                "Entrée de timeline modifiée avec succès",
                entry
            ))),
        ),
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