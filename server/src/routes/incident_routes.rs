use axum::{
    routing::{get, patch, post},
    Router,
};
use sqlx::PgPool;

use crate::handlers::incident_handler;

pub fn incident_routes() -> Router<PgPool> {
    Router::new()
        // Routes par team
        .route("/teams/:team_id/incidents", post(incident_handler::create_incident))
        .route("/teams/:team_id/incidents", get(incident_handler::get_team_incidents))
        // Routes par incident
        .route("/incidents/:incident_id", get(incident_handler::get_incident))
        .route("/incidents/:incident_id/acknowledge", patch(incident_handler::acknowledge_incident))
        .route("/incidents/:incident_id/escalate", patch(incident_handler::escalate_incident))
        .route("/incidents/:incident_id/resolve", patch(incident_handler::resolve_incident))
        .route("/incidents/:incident_id/assign", post(incident_handler::assign_responder))
        // Timeline
        .route("/incidents/:incident_id/timeline", post(incident_handler::add_timeline_entry))
        .route("/incidents/:incident_id/timeline/:entry_id", patch(incident_handler::edit_timeline_entry))
}