use axum::{
    routing::{get, patch, post,delete},
    Router,
};

use crate::handlers::incident_handler;
use crate::state::AppState;


pub fn incident_routes() -> Router<AppState> {
    Router::new()
        .route("/teams/:team_id/incidents", post(incident_handler::create_incident))
        .route("/teams/:team_id/incidents", get(incident_handler::get_team_incidents))
        .route("/incidents/:incident_id", get(incident_handler::get_incident))
        .route("/incidents/:incident_id/acknowledge", patch(incident_handler::acknowledge_incident))
        .route("/incidents/:incident_id/escalate", patch(incident_handler::escalate_incident))
        .route("/incidents/:incident_id/resolve", patch(incident_handler::resolve_incident))
        .route("/incidents/:incident_id/assign", post(incident_handler::assign_responder))
        .route("/incidents/:incident_id/timeline", post(incident_handler::add_timeline_entry))
        .route("/incidents/:incident_id/timeline/:entry_id", patch(incident_handler::edit_timeline_entry))
        .route("/incidents/:incident_id", patch(incident_handler::update_incident))
        .route("/incidents/:incident_id", delete(incident_handler::cancel_incident))
}