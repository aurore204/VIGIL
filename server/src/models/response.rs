use serde::Serialize;

// Réponse de succès standard
#[derive(Debug, Serialize)]
pub struct ApiResponse<T: Serialize> {
    pub success: bool,
    pub message: String,
    pub data: Option<T>,
}

// Réponse d'erreur standard
#[derive(Debug, Serialize)]
pub struct ApiError {
    pub success: bool,
    pub error: String,
    pub code: String,
}

impl<T: Serialize> ApiResponse<T> {
    pub fn success(message: &str, data: T) -> Self {
        Self {
            success: true,
            message: message.to_string(),
            data: Some(data),
        }
    }

    pub fn success_no_data(message: &str) -> ApiResponse<()> {
        ApiResponse {
            success: true,
            message: message.to_string(),
            data: None,
        }
    }
}

impl ApiError {
    pub fn new(error: &str, code: &str) -> Self {
        Self {
            success: false,
            error: error.to_string(),
            code: code.to_string(),
        }
    }
}