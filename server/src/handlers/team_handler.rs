use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::IntoResponse,
    Extension, Json,
};
use chrono::DateTime;
use sqlx::PgPool;
use uuid::Uuid;

use crate::middleware::auth_middleware::AuthenticatedUser;
use crate::models::team::{
    BanMemberRequest, CreateTeamRequest, JoinTeamRequest, TransferManagerRequest,
};
use crate::services::team_service::{self, TeamError};

// POST /teams
pub async fn create_team(
    State(pool): State<PgPool>,
    Extension(auth_user): Extension<AuthenticatedUser>,
    Json(req): Json<CreateTeamRequest>,
) -> impl IntoResponse {
    match team_service::create_team(&pool, req, auth_user.id).await {
        Ok(team) => (StatusCode::CREATED, Json(serde_json::json!(team))),
        Err(_) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({"error": "Erreur lors de la création de la team"})),
        ),
    }
}

// GET /teams
pub async fn get_user_teams(
    State(pool): State<PgPool>,
    Extension(auth_user): Extension<AuthenticatedUser>,
) -> impl IntoResponse {
    match team_service::get_user_teams(&pool, auth_user.id).await {
        Ok(teams) => (StatusCode::OK, Json(serde_json::json!(teams))),
        Err(_) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({"error": "Erreur lors de la récupération des teams"})),
        ),
    }
}

// GET /teams/:team_id
pub async fn get_team(
    State(pool): State<PgPool>,
    Extension(auth_user): Extension<AuthenticatedUser>,
    Path(team_id): Path<Uuid>,
) -> impl IntoResponse {
    match team_service::get_team(&pool, team_id, auth_user.id).await {
        Ok(team) => (StatusCode::OK, Json(serde_json::json!(team))),
        Err(TeamError::NotMember) => (
            StatusCode::FORBIDDEN,
            Json(serde_json::json!({"error": "Vous n'êtes pas membre de cette team"})),
        ),
        Err(TeamError::TeamNotFound) => (
            StatusCode::NOT_FOUND,
            Json(serde_json::json!({"error": "Team introuvable"})),
        ),
        Err(_) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({"error": "Erreur interne du serveur"})),
        ),
    }
}

// POST /teams/join
pub async fn join_team(
    State(pool): State<PgPool>,
    Extension(auth_user): Extension<AuthenticatedUser>,
    Json(req): Json<JoinTeamRequest>,
) -> impl IntoResponse {
    match team_service::join_team(&pool, req, auth_user.id).await {
        Ok(team) => (StatusCode::OK, Json(serde_json::json!(team))),
        Err(TeamError::InvalidInvitationCode) => (
            StatusCode::BAD_REQUEST,
            Json(serde_json::json!({"error": "Code d'invitation invalide ou expiré"})),
        ),
        Err(TeamError::AlreadyMember) => (
            StatusCode::CONFLICT,
            Json(serde_json::json!({"error": "Vous êtes déjà membre de cette team"})),
        ),
        Err(TeamError::Banned) => (
            StatusCode::FORBIDDEN,
            Json(serde_json::json!({"error": "Vous êtes banni de cette team"})),
        ),
        Err(_) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({"error": "Erreur interne du serveur"})),
        ),
    }
}

// POST /teams/:team_id/invitations
pub async fn generate_invitation(
    State(pool): State<PgPool>,
    Extension(auth_user): Extension<AuthenticatedUser>,
    Path(team_id): Path<Uuid>,
) -> impl IntoResponse {
    match team_service::generate_invitation(&pool, team_id, auth_user.id).await {
        Ok(code) => (
            StatusCode::CREATED,
            Json(serde_json::json!({"code": code})),
        ),
        Err(TeamError::NotMember) => (
            StatusCode::FORBIDDEN,
            Json(serde_json::json!({"error": "Vous n'êtes pas membre de cette team"})),
        ),
        Err(TeamError::NotManager) => (
            StatusCode::FORBIDDEN,
            Json(serde_json::json!({"error": "Seul le Manager peut générer un code d'invitation"})),
        ),
        Err(_) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({"error": "Erreur interne du serveur"})),
        ),
    }
}

// POST /teams/:team_id/transfer
pub async fn transfer_manager(
    State(pool): State<PgPool>,
    Extension(auth_user): Extension<AuthenticatedUser>,
    Path(team_id): Path<Uuid>,
    Json(req): Json<TransferManagerRequest>,
) -> impl IntoResponse {
    match team_service::transfer_manager(&pool, team_id, auth_user.id, req).await {
        Ok(team) => (StatusCode::OK, Json(serde_json::json!(team))),
        Err(TeamError::NotMember) => (
            StatusCode::FORBIDDEN,
            Json(serde_json::json!({"error": "Vous n'êtes pas membre de cette team"})),
        ),
        Err(TeamError::NotManager) => (
            StatusCode::FORBIDDEN,
            Json(serde_json::json!({"error": "Seul le Manager peut transférer son rôle"})),
        ),
        Err(TeamError::CannotTargetSelf) => (
            StatusCode::BAD_REQUEST,
            Json(serde_json::json!({"error": "Vous ne pouvez pas vous transférer le rôle à vous-même"})),
        ),
        Err(_) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({"error": "Erreur interne du serveur"})),
        ),
    }
}

// DELETE /teams/:team_id/members/:user_id
pub async fn kick_member(
    State(pool): State<PgPool>,
    Extension(auth_user): Extension<AuthenticatedUser>,
    Path((team_id, user_id)): Path<(Uuid, Uuid)>,
) -> impl IntoResponse {
    match team_service::kick_member(&pool, team_id, auth_user.id, user_id).await {
        Ok(_) => (
            StatusCode::OK,
            Json(serde_json::json!({"message": "Membre retiré avec succès"})),
        ),
        Err(TeamError::NotMember) => (
            StatusCode::FORBIDDEN,
            Json(serde_json::json!({"error": "Vous n'êtes pas membre de cette team"})),
        ),
        Err(TeamError::NotManager) => (
            StatusCode::FORBIDDEN,
            Json(serde_json::json!({"error": "Seul le Manager peut retirer des membres"})),
        ),
        Err(TeamError::CannotTargetSelf) => (
            StatusCode::BAD_REQUEST,
            Json(serde_json::json!({"error": "Vous ne pouvez pas vous retirer vous-même"})),
        ),
        Err(_) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({"error": "Erreur interne du serveur"})),
        ),
    }
}

// POST /teams/:team_id/members/:user_id/ban
pub async fn ban_member(
    State(pool): State<PgPool>,
    Extension(auth_user): Extension<AuthenticatedUser>,
    Path((team_id, user_id)): Path<(Uuid, Uuid)>,
    Json(req): Json<BanMemberRequest>,
) -> impl IntoResponse {
    match team_service::ban_member(
        &pool,
        team_id,
        auth_user.id,
        user_id,
        req.expires_at,
        req.reason,
    )
    .await
    {
        Ok(_) => (
            StatusCode::OK,
            Json(serde_json::json!({"message": "Membre banni avec succès"})),
        ),
        Err(TeamError::NotMember) => (
            StatusCode::FORBIDDEN,
            Json(serde_json::json!({"error": "Vous n'êtes pas membre de cette team"})),
        ),
        Err(TeamError::NotManager) => (
            StatusCode::FORBIDDEN,
            Json(serde_json::json!({"error": "Seul le Manager peut bannir des membres"})),
        ),
        Err(TeamError::CannotTargetSelf) => (
            StatusCode::BAD_REQUEST,
            Json(serde_json::json!({"error": "Vous ne pouvez pas vous bannir vous-même"})),
        ),
        Err(_) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({"error": "Erreur interne du serveur"})),
        ),
    }
}

// DELETE /teams/:team_id/members/:user_id/ban
pub async fn unban_member(
    State(pool): State<PgPool>,
    Extension(auth_user): Extension<AuthenticatedUser>,
    Path((team_id, user_id)): Path<(Uuid, Uuid)>,
) -> impl IntoResponse {
    match team_service::unban_member(&pool, team_id, auth_user.id, user_id).await {
        Ok(_) => (
            StatusCode::OK,
            Json(serde_json::json!({"message": "Ban levé avec succès"})),
        ),
        Err(TeamError::NotMember) => (
            StatusCode::FORBIDDEN,
            Json(serde_json::json!({"error": "Vous n'êtes pas membre de cette team"})),
        ),
        Err(TeamError::NotManager) => (
            StatusCode::FORBIDDEN,
            Json(serde_json::json!({"error": "Seul le Manager peut lever un ban"})),
        ),
        Err(TeamError::CannotTargetSelf) => (
            StatusCode::BAD_REQUEST,
            Json(serde_json::json!({"error": "Action invalide"})),
        ),
        Err(_) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({"error": "Erreur interne du serveur"})),
        ),
    }
}