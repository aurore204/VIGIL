use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::IntoResponse,
    Extension, Json,
};
use uuid::Uuid;

use crate::middleware::auth_middleware::AuthenticatedUser;
use crate::models::response::{ApiError, ApiResponse};
use crate::models::team::UpdateTeamRequest;
use crate::models::team::{
    BanMemberRequest, CreateTeamRequest, JoinTeamRequest, TransferManagerRequest,
    UpdateMemberRoleRequest,
};
use crate::repositories::user_repository;
use crate::services::team_service::{self, TeamError};
use crate::state::AppState;
use crate::websocket::events::WsEvent;

pub async fn create_team(
    State(state): State<AppState>,
    Extension(auth_user): Extension<AuthenticatedUser>,
    Json(req): Json<CreateTeamRequest>,
) -> impl IntoResponse {
    let name = req.name.clone();
    match team_service::create_team(&state.pool, req, auth_user.id).await {
        Ok(team) => (
            StatusCode::CREATED,
            Json(serde_json::json!(ApiResponse::success(
                &format!("Team '{}' crée avec succès", name),
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

pub async fn get_user_teams(
    State(state): State<AppState>,
    Extension(auth_user): Extension<AuthenticatedUser>,
) -> impl IntoResponse {
    match team_service::get_user_teams(&state.pool, auth_user.id).await {
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

pub async fn get_team(
    State(state): State<AppState>,
    Extension(auth_user): Extension<AuthenticatedUser>,
    Path(team_id): Path<Uuid>,
) -> impl IntoResponse {
    match team_service::get_team(&state.pool, team_id, auth_user.id).await {
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

pub async fn join_team(
    State(state): State<AppState>,
    Extension(auth_user): Extension<AuthenticatedUser>,
    Json(req): Json<JoinTeamRequest>,
) -> impl IntoResponse {
    let joining_username = user_repository::find_by_id(&state.pool, auth_user.id)
        .await
        .ok()
        .flatten()
        .map(|u| u.username)
        .unwrap_or_default();

    match team_service::join_team(&state.pool, req, auth_user.id).await {
        Ok(team) => {
            state.broadcaster.broadcast(WsEvent::MemberJoined {
                team_id: team.id,
                member: joining_username,
                role: "observer".to_string(),
            });
            (
                StatusCode::OK,
                Json(serde_json::json!(ApiResponse::success(
                    &format!("Vous avez rejoint la team '{}' avec succès", team.name),
                    team
                ))),
            )
        }
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

pub async fn generate_invitation(
    State(state): State<AppState>,
    Extension(auth_user): Extension<AuthenticatedUser>,
    Path(team_id): Path<Uuid>,
) -> impl IntoResponse {
    match team_service::generate_invitation(&state.pool, team_id, auth_user.id).await {
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

pub async fn leave_team(
    State(state): State<AppState>,
    Extension(auth_user): Extension<AuthenticatedUser>,
    Path(team_id): Path<Uuid>,
) -> impl IntoResponse {
    match team_service::leave_team(&state.pool, team_id, auth_user.id).await {
        Ok(_) => (
            StatusCode::OK,
            Json(serde_json::json!(ApiResponse::<()>::success_no_data(
                "Vous avez quitté la team avec succès"
            ))),
        ),
        Err(TeamError::NotMember) => (
            StatusCode::FORBIDDEN,
            Json(serde_json::json!(ApiError::new(
                "Vous n'êtes pas membre de cette team",
                "NOT_MEMBER"
            ))),
        ),
        Err(TeamError::CannotTargetSelf) => (
            StatusCode::BAD_REQUEST,
            Json(serde_json::json!(ApiError::new(
                "Vous devez transférer votre rôle Manager avant de quitter la team",
                "MANAGER_MUST_TRANSFER_FIRST"
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

pub async fn transfer_manager(
    State(state): State<AppState>,
    Extension(auth_user): Extension<AuthenticatedUser>,
    Path(team_id): Path<Uuid>,
    Json(req): Json<TransferManagerRequest>,
) -> impl IntoResponse {
    let previous_manager_name = user_repository::find_by_id(&state.pool, auth_user.id)
        .await
        .ok()
        .flatten()
        .map(|u| u.username)
        .unwrap_or_default();

    match team_service::transfer_manager(&state.pool, team_id, auth_user.id, req).await {
        Ok(team) => {
            let new_manager = team
                .members
                .iter()
                .find(|m| m.user_id == team.manager_id)
                .map(|m| m.username.clone())
                .unwrap_or_default();

            state.broadcaster.broadcast(WsEvent::ManagerTransferred {
                team_id,
                new_manager: new_manager.clone(),
                previous_manager: previous_manager_name,
            });

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

pub async fn kick_member(
    State(state): State<AppState>,
    Extension(auth_user): Extension<AuthenticatedUser>,
    Path((team_id, user_id)): Path<(Uuid, Uuid)>,
) -> impl IntoResponse {
    let kicked_username = user_repository::find_by_id(&state.pool, user_id)
        .await
        .ok()
        .flatten()
        .map(|u| u.username)
        .unwrap_or_default();

    let kicked_by = user_repository::find_by_id(&state.pool, auth_user.id)
        .await
        .ok()
        .flatten()
        .map(|u| u.username)
        .unwrap_or_default();

    match team_service::kick_member(&state.pool, team_id, auth_user.id, user_id).await {
        Ok(_) => {
            state.broadcaster.broadcast(WsEvent::MemberKicked {
                team_id,
                member: kicked_username,
                by: kicked_by,
            });
            (
                StatusCode::OK,
                Json(serde_json::json!(ApiResponse::<()>::success_no_data(
                    "Membre retiré de la team avec succès"
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

pub async fn update_member_role(
    State(state): State<AppState>,
    Extension(auth_user): Extension<AuthenticatedUser>,
    Path((team_id, user_id)): Path<(Uuid, Uuid)>,
    Json(req): Json<UpdateMemberRoleRequest>,
) -> impl IntoResponse {
    let target_username = user_repository::find_by_id(&state.pool, user_id)
        .await
        .ok()
        .flatten()
        .map(|u| u.username)
        .unwrap_or_default();

    let manager_username = user_repository::find_by_id(&state.pool, auth_user.id)
        .await
        .ok()
        .flatten()
        .map(|u| u.username)
        .unwrap_or_default();

    let new_role = format!("{:?}", req.role).to_lowercase();

    match team_service::update_member_role(&state.pool, team_id, auth_user.id, user_id, req.role)
        .await
    {
        Ok(_) => {
            state.broadcaster.broadcast(WsEvent::MemberRoleChanged {
                team_id,
                member: target_username,
                new_role,
                by: manager_username,
            });
            (
                StatusCode::OK,
                Json(serde_json::json!(ApiResponse::<()>::success_no_data(
                    "Rôle mis à jour avec succès"
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
                "Seul le Manager peut changer les rôles",
                "NOT_MANAGER"
            ))),
        ),
        Err(TeamError::CannotTargetSelf) => (
            StatusCode::BAD_REQUEST,
            Json(serde_json::json!(ApiError::new(
                "Vous ne pouvez pas modifier votre propre rôle",
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

pub async fn ban_member(
    State(state): State<AppState>,
    Extension(auth_user): Extension<AuthenticatedUser>,
    Path((team_id, user_id)): Path<(Uuid, Uuid)>,
    Json(req): Json<BanMemberRequest>,
) -> impl IntoResponse {
    let banned_username = user_repository::find_by_id(&state.pool, user_id)
        .await
        .ok()
        .flatten()
        .map(|u| u.username)
        .unwrap_or_default();

    let banned_by = user_repository::find_by_id(&state.pool, auth_user.id)
        .await
        .ok()
        .flatten()
        .map(|u| u.username)
        .unwrap_or_default();

    let expires_at = req.expires_at;
    let ban_type = if expires_at.is_some() {
        "temporairement banni"
    } else {
        "définitivement banni"
    };

    match team_service::ban_member(
        &state.pool,
        team_id,
        auth_user.id,
        user_id,
        req.expires_at,
        req.reason,
    )
    .await
    {
        Ok(_) => {
            state.broadcaster.broadcast(WsEvent::MemberBanned {
                team_id,
                member: banned_username,
                until: expires_at,
                by: banned_by,
            });
            (
                StatusCode::OK,
                Json(serde_json::json!(ApiResponse::<()>::success_no_data(
                    &format!("Membre {} de la team avec succès", ban_type)
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

pub async fn unban_member(
    State(state): State<AppState>,
    Extension(auth_user): Extension<AuthenticatedUser>,
    Path((team_id, user_id)): Path<(Uuid, Uuid)>,
) -> impl IntoResponse {
    let unbanned_username = user_repository::find_by_id(&state.pool, user_id)
        .await
        .ok()
        .flatten()
        .map(|u| u.username)
        .unwrap_or_default();

    let unbanned_by = user_repository::find_by_id(&state.pool, auth_user.id)
        .await
        .ok()
        .flatten()
        .map(|u| u.username)
        .unwrap_or_default();

    match team_service::unban_member(&state.pool, team_id, auth_user.id, user_id).await {
        Ok(_) => {
            state.broadcaster.broadcast(WsEvent::MemberUnbanned {
                team_id,
                member: unbanned_username,
                by: unbanned_by,
            });
            (
                StatusCode::OK,
                Json(serde_json::json!(ApiResponse::<()>::success_no_data(
                    "Ban levé avec succès"
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

pub async fn update_team(
    State(state): State<AppState>,
    Extension(auth_user): Extension<AuthenticatedUser>,
    Path(team_id): Path<Uuid>,
    Json(req): Json<UpdateTeamRequest>,
) -> impl IntoResponse {
    match team_service::update_team(&state.pool, team_id, auth_user.id, req).await {
        Ok(team) => (
            StatusCode::OK,
            Json(serde_json::json!(ApiResponse::success(
                "Team mise à jour avec succès",
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
        Err(TeamError::NotManager) => (
            StatusCode::FORBIDDEN,
            Json(serde_json::json!(ApiError::new(
                "Seul le Manager peut modifier la team",
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

pub async fn delete_team(
    State(state): State<AppState>,
    Extension(auth_user): Extension<AuthenticatedUser>,
    Path(team_id): Path<Uuid>,
) -> impl IntoResponse {
    match team_service::delete_team(&state.pool, team_id, auth_user.id).await {
        Ok(_) => (
            StatusCode::OK,
            Json(serde_json::json!(ApiResponse::<()>::success_no_data(
                "Team supprimée avec succès"
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
                "Seul le Manager peut supprimer la team",
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

pub async fn get_team_members(
    State(state): State<AppState>,
    Extension(auth_user): Extension<AuthenticatedUser>,
    Path(team_id): Path<Uuid>,
) -> impl IntoResponse {
    match team_service::get_team(&state.pool, team_id, auth_user.id).await {
        Ok(team) => (
            StatusCode::OK,
            Json(serde_json::json!(ApiResponse::success(
                "Membres récupérés avec succès",
                team.members
            ))),
        ),
        Err(TeamError::NotMember) => (
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

pub async fn get_banned_members(
    State(state): State<AppState>,
    Extension(auth_user): Extension<AuthenticatedUser>,
    Path(team_id): Path<Uuid>,
) -> impl IntoResponse {
    match team_service::get_banned_members(&state.pool, team_id, auth_user.id).await {
        Ok(banned) => (
            StatusCode::OK,
            Json(serde_json::json!(ApiResponse::success(
                "Membres bannis récupérés avec succès",
                banned
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
                "Seul le Manager peut voir les membres bannis",
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
