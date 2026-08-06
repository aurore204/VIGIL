use axum::{extract::State, response::IntoResponse, Json};
use chrono::Utc;
use serde::Serialize;

use crate::state::AppState;

#[derive(Serialize)]
struct AboutResponse {
    client: ClientInfo,
    server: ServerInfo,
}

#[derive(Serialize)]
struct ClientInfo {
    host: String,
}

#[derive(Serialize)]
struct ServerInfo {
    current_time: i64,
    services: Vec<ServiceInfo>,
    token: String,
}

#[derive(Serialize)]
struct ServiceInfo {
    name: String,
    actions: Vec<ActionInfo>,
    reactions: Vec<ReactionInfo>,
}

#[derive(Serialize)]
struct ActionInfo {
    name: String,
    description: String,
}

#[derive(Serialize)]
struct ReactionInfo {
    name: String,
    description: String,
}

// GET /about.json
pub async fn get_about(State(_state): State<AppState>) -> impl IntoResponse {
    let token_hash = "d6d6ca2ec6a2382ef3913617246c235c6cbb488ed776598ebd80ccd87302197d".to_string();

    let services = vec![
        ServiceInfo {
            name: "github".to_string(),
            actions: vec![
                ActionInfo {
                    name: "workflow_run_failed".to_string(),
                    description: "A CI workflow run completes with a failure conclusion"
                        .to_string(),
                },
                ActionInfo {
                    name: "workflow_run_succeeded".to_string(),
                    description: "A CI workflow run completes successfully".to_string(),
                },
            ],
            reactions: vec![],
        },
        ServiceInfo {
            name: "vigil".to_string(),
            actions: vec![],
            reactions: vec![ReactionInfo {
                name: "create_incident".to_string(),
                description: "Create a VIGIL incident with configurable severity and title"
                    .to_string(),
            }],
        },
        ServiceInfo {
            name: "http".to_string(),
            actions: vec![],
            reactions: vec![ReactionInfo {
                name: "post".to_string(),
                description: "Send a POST request with the event payload to an external URL"
                    .to_string(),
            }],
        },
    ];

    Json(AboutResponse {
        client: ClientInfo {
            host: "localhost".to_string(),
        },
        server: ServerInfo {
            current_time: Utc::now().timestamp(),
            services,
            token: token_hash,
        },
    })
}
