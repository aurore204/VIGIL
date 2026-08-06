use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

// Liste des emojis disponibles définie par le serveur
pub const AVAILABLE_EMOJIS: &[&str] = &["+1", "-1", "eyes", "warning", "check", "fire"];

#[derive(Debug, Serialize, Deserialize, Clone, sqlx::FromRow)]
pub struct Reaction {
    pub id: Uuid,
    pub entry_id: Uuid,
    pub user_id: Uuid,
    pub emoji: String,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
pub struct AddReactionRequest {
    pub emoji: String,
}

// Ce qu'on renvoie pour les réactions agrégées d'une entrée
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ReactionSummary {
    pub emoji: String,
    pub count: i64,
    pub users: Vec<String>,
}
