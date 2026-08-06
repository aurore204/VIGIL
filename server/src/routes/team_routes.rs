use axum::{
    routing::{delete, get, patch, post},
    Router,
};

use crate::handlers::team_handler;
use crate::state::AppState;

pub fn team_routes() -> Router<AppState> {
    Router::new()
        .route("/teams", get(team_handler::get_user_teams))
        .route("/teams", post(team_handler::create_team))
        .route("/teams/join", post(team_handler::join_team))
        .route("/teams/:team_id", get(team_handler::get_team))
        .route("/teams/:team_id", patch(team_handler::update_team))
        .route("/teams/:team_id", delete(team_handler::delete_team))
        .route(
            "/teams/:team_id/members",
            get(team_handler::get_team_members),
        )
        .route(
            "/teams/:team_id/invitations",
            post(team_handler::generate_invitation),
        )
        .route(
            "/teams/:team_id/transfer",
            post(team_handler::transfer_manager),
        )
        .route(
            "/teams/:team_id/members/:user_id",
            delete(team_handler::kick_member),
        )
        .route(
            "/teams/:team_id/members/:user_id/role",
            patch(team_handler::update_member_role),
        )
        .route(
            "/teams/:team_id/members/:user_id/ban",
            post(team_handler::ban_member),
        )
        .route(
            "/teams/:team_id/members/:user_id/ban",
            delete(team_handler::unban_member),
        )
        .route("/teams/:team_id/leave", delete(team_handler::leave_team))
        .route(
            "/teams/:team_id/bans",
            get(team_handler::get_banned_members),
        )
}
