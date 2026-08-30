use serde::{Deserialize, Serialize};

#[derive(Debug, Deserialize)]
pub struct SaveTokenRequest {
    pub service_name: String,
    pub token_type: String, // "oauth2" ou "personal"
    pub access_token: String,
}

#[derive(Debug, Serialize)]
pub struct ConnectedServicesResponse {
    pub services: Vec<String>,
}
