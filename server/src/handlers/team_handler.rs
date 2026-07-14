use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::IntoResponse,
    Extension, Json,
};
use sqlx::PgPool;
use uuid::Uuid;

use crate::middleware::auth_middleware::AuthenticatedUser;
use crate::models::response::{ApiError, ApiResponse};
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
    let name = req.name.clone();
    match team_service::create_team(&pool, req, auth_user.id).await {
        Ok(team) => (
            StatusCode::CREATED,
            Json(serde_json::json!(ApiResponse::success(
                &format!("Team '{}' créée avec succès", name),
                team
            ))),
        ),
        Err(_) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!(ApiError::new(
                "Erreur lors de la création de la team",
                "CREATE_TEAM_ERROR"
            ))),
        ),
    }
}

// GET /teams
pub async fn get_user_teams(
    State(pool): State<PgPool>,
    Extension(auth_user): Extension<AuthenticatedUser>,
) -> impl IntoResponse {
    match team_service::get_user_teams(&pool, auth_user.id).await {
        Ok(teams) => (
            StatusCode::OK,
            Json(serde_json::json!(ApiResponse::success(
                "Teams récupérées avec succès",
                teams
            ))),
        ),
        Err(_) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!(ApiError::new(
                "Erreur lors de la récupération des teams",
                "GET_TEAMS_ERROR"
            ))),
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
        Ok(team) => (
            StatusCode::OK,
            Json(serde_json::json!(ApiResponse::success(
                "Team récupérée avec succès",
                team
            ))),
        ),
        Err(TeamError::NotMember) => (
            StatusCode::FORBIDDEN,
            Json(serde_json::json!(ApiError::new(
                "Vous n'êtes pas membre de cette team",
                "NOT_MEMBER"
            ))),
        ),
        Err(TeamError::TeamNotFound) => (
            StatusCode::NOT_FOUND,
            Json(serde_json::json!(ApiError::new(
                "Team introuvable",
                "TEAM_NOT_FOUND"
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

// POST /teams/join
pub async fn join_team(
    State(pool): State<PgPool>,
    Extension(auth_user): Extension<AuthenticatedUser>,
    Json(req): Json<JoinTeamRequest>,
) -> impl IntoResponse {
    match team_service::join_team(&pool, req, auth_user.id).await {
        Ok(team) => (
            StatusCode::OK,
            Json(serde_json::json!(ApiResponse::success(
                &format!("Vous avez rejoint la team '{}' avec succès", team.name),
                team
            ))),
        ),
        Err(TeamError::InvalidInvitationCode) => (
            StatusCode::BAD_REQUEST,
            Json(serde_json::json!(ApiError::new(
                "Code d'invitation invalide ou expiré",
                "INVALID_CODE"
            ))),
        ),
        Err(TeamError::AlreadyMember) => (
            StatusCode::CONFLICT,
            Json(serde_json::json!(ApiError::new(
                "Vous êtes déjà membre de cette team",
                "ALREADY_MEMBER"
            ))),
        ),
        Err(TeamError::Banned) => (
            StatusCode::FORBIDDEN,
            Json(serde_json::json!(ApiError::new(
                "Vous êtes banni de cette team",
                "BANNED"
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

// POST /teams/:team_id/invitations
pub async fn generate_invitation(
    State(pool): State<PgPool>,
    Extension(auth_user): Extension<AuthenticatedUser>,
    Path(team_id): Path<Uuid>,
) -> impl IntoResponse {
    match team_service::generate_invitation(&pool, team_id, auth_user.id).await {
        Ok(code) => (
            StatusCode::CREATED,
            Json(serde_json::json!(ApiResponse::success(
                "Code d'invitation généré avec succès",
                serde_json::json!({"code": code})
            ))),
        ),
        Err(TeamError::NotMember) => (
            StatusCode::FORBIDDEN,
            Json(serde_json::json!(ApiError::new(
                "Vous n'êtes pas membre de cette team",
                "NOT_MEMBER"
            ))),
        ),
        Err(TeamError::NotManager) => (
            StatusCode::FORBIDDEN,
            Json(serde_json::json!(ApiError::new(
                "Seul le Manager peut générer un code d'invitation",
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

// POST /teams/:team_id/transfer
pub async fn transfer_manager(
    State(pool): State<PgPool>,
    Extension(auth_user): Extension<AuthenticatedUser>,
    Path(team_id): Path<Uuid>,
    Json(req): Json<TransferManagerRequest>,
) -> impl IntoResponse {
    match team_service::transfer_manager(&pool, team_id, auth_user.id, req).await {
        Ok(team) => {
            let new_manager = team.members.iter()
                .find(|m| m.user_id == team.manager_id)
                .map(|m| m.username.clone())
                .unwrap_or_default();
            (
                StatusCode::OK,
                Json(serde_json::json!(ApiResponse::success(
                    &format!("Le rôle Manager a été transféré à {}", new_manager),
                    team
                ))),
            )
        }
        Err(TeamError::NotMember) => (
            StatusCode::FORBIDDEN,
            Json(serde_json::json!(ApiError::new(
                "Vous n'êtes pas membre de cette team",
                "NOT_MEMBER"
            ))),
        ),
        Err(TeamError::NotManager) => (
            StatusCode::FORBIDDEN,
            Json(serde_json::json!(ApiError::new(
                "Seul le Manager peut transférer son rôle",
                "NOT_MANAGER"
            ))),
        ),
        Err(TeamError::CannotTargetSelf) => (
            StatusCode::BAD_REQUEST,
            Json(serde_json::json!(ApiError::new(
                "Vous ne pouvez pas vous transférer le rôle à vous-même",
                "CANNOT_TARGET_SELF"
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

// DELETE /teams/:team_id/members/:user_id
pub async fn kick_member(
    State(pool): State<PgPool>,
    Extension(auth_user): Extension<AuthenticatedUser>,
    Path((team_id, user_id)): Path<(Uuid, Uuid)>,
) -> impl IntoResponse {
    match team_service::kick_member(&pool, team_id, auth_user.id, user_id).await {
        Ok(_) => (
            StatusCode::OK,
            Json(serde_json::json!(ApiResponse::<()>::success_no_data(
                "Membre retiré de la team avec succès"
            ))),
        ),
        Err(TeamError::NotMember) => (
            StatusCode::FORBIDDEN,
            Json(serde_json::json!(ApiError::new(
                "Vous n'êtes pas membre de cette team",
                "NOT_MEMBER"
            ))),
        ),
        Err(TeamError::NotManager) => (
            StatusCode::FORBIDDEN,
            Json(serde_json::json!(ApiError::new(
                "Seul le Manager peut retirer des membres",
                "NOT_MANAGER"
            ))),
        ),
        Err(TeamError::CannotTargetSelf) => (
            StatusCode::BAD_REQUEST,
            Json(serde_json::json!(ApiError::new(
                "Vous ne pouvez pas vous retirer vous-même",
                "CANNOT_TARGET_SELF"
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

// POST /teams/:team_id/members/:user_id/ban
pub async fn ban_member(
    State(pool): State<PgPool>,
    Extension(auth_user): Extension<AuthenticatedUser>,
    Path((team_id, user_id)): Path<(Uuid, Uuid)>,
    Json(req): Json<BanMemberRequest>,
) -> impl IntoResponse {
    let ban_type = if req.expires_at.is_some() {
        "temporairement banni"
    } else {
        "définitivement banni"
    };

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
            Json(serde_json::json!(ApiResponse::<()>::success_no_data(
                &format!("Membre {} de la team avec succès", ban_type)
            ))),
        ),
        Err(TeamError::NotMember) => (
            StatusCode::FORBIDDEN,
            Json(serde_json::json!(ApiError::new(
                "Vous n'êtes pas membre de cette team",
                "NOT_MEMBER"
            ))),
        ),
        Err(TeamError::NotManager) => (
            StatusCode::FORBIDDEN,
            Json(serde_json::json!(ApiError::new(
                "Seul le Manager peut bannir des membres",
                "NOT_MANAGER"
            ))),
        ),
        Err(TeamError::CannotTargetSelf) => (
            StatusCode::BAD_REQUEST,
            Json(serde_json::json!(ApiError::new(
                "Vous ne pouvez pas vous bannir vous-même",
                "CANNOT_TARGET_SELF"
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

// DELETE /teams/:team_id/members/:user_id/ban
pub async fn unban_member(
    State(pool): State<PgPool>,
    Extension(auth_user): Extension<AuthenticatedUser>,
    Path((team_id, user_id)): Path<(Uuid, Uuid)>,
) -> impl IntoResponse {
    match team_service::unban_member(&pool, team_id, auth_user.id, user_id).await {
        Ok(_) => (
            StatusCode::OK,
            Json(serde_json::json!(ApiResponse::<()>::success_no_data(
                "Ban levé avec succès"
            ))),
        ),
        Err(TeamError::NotMember) => (
            StatusCode::FORBIDDEN,
            Json(serde_json::json!(ApiError::new(
                "Vous n'êtes pas membre de cette team",
                "NOT_MEMBER"
            ))),
        ),
        Err(TeamError::NotManager) => (
            StatusCode::FORBIDDEN,
            Json(serde_json::json!(ApiError::new(
                "Seul le Manager peut lever un ban",
                "NOT_MANAGER"
            ))),
        ),
        Err(TeamError::CannotTargetSelf) => (
            StatusCode::BAD_REQUEST,
            Json(serde_json::json!(ApiError::new(
                "Action invalide",
                "CANNOT_TARGET_SELF"
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