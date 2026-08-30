use sqlx::PgPool;
use uuid::Uuid;

use crate::models::reaction::{AddReactionRequest, ReactionSummary, AVAILABLE_EMOJIS};
use crate::repositories::{incident_repository, reaction_repository, team_repository};

#[derive(Debug)]
pub enum ReactionError {
    EntryNotFound,
    NotMember,
    InvalidEmoji,
    AlreadyReacted,
    NotReacted,
    DatabaseError(sqlx::Error),
}

// Retourne la liste des emojis disponibles
pub fn get_available_emojis() -> Vec<&'static str> {
    AVAILABLE_EMOJIS.to_vec()
}

// Ajoute une réaction sur une entrée de timeline
pub async fn add_reaction(
    pool: &PgPool,
    entry_id: Uuid,
    user_id: Uuid,
    req: AddReactionRequest,
) -> Result<Vec<ReactionSummary>, ReactionError> {
    // Vérifier que l'emoji est valide
    if !AVAILABLE_EMOJIS.contains(&req.emoji.as_str()) {
        return Err(ReactionError::InvalidEmoji);
    }

    // Vérifier que l'entrée existe et récupérer l'incident
    let entry = incident_repository::find_timeline_entry(pool, entry_id)
        .await
        .map_err(ReactionError::DatabaseError)?
        .ok_or(ReactionError::EntryNotFound)?;

    // Vérifier que l'incident existe et que l'user est membre de la team
    let incident = incident_repository::find_by_id(pool, entry.incident_id)
        .await
        .map_err(ReactionError::DatabaseError)?
        .ok_or(ReactionError::EntryNotFound)?;

    let is_member = team_repository::is_member(pool, incident.team_id, user_id)
        .await
        .map_err(ReactionError::DatabaseError)?;

    if !is_member {
        return Err(ReactionError::NotMember);
    }

    // Vérifier que l'user n'a pas déjà réagi avec cet emoji
    let already_reacted = reaction_repository::reaction_exists(pool, entry_id, user_id, &req.emoji)
        .await
        .map_err(ReactionError::DatabaseError)?;

    if already_reacted {
        return Err(ReactionError::AlreadyReacted);
    }

    reaction_repository::add_reaction(pool, entry_id, user_id, &req.emoji)
        .await
        .map_err(ReactionError::DatabaseError)?;

    get_entry_reactions(pool, entry_id).await
}

// Retire une réaction
pub async fn remove_reaction(
    pool: &PgPool,
    entry_id: Uuid,
    user_id: Uuid,
    emoji: &str,
) -> Result<Vec<ReactionSummary>, ReactionError> {
    if !AVAILABLE_EMOJIS.contains(&emoji) {
        return Err(ReactionError::InvalidEmoji);
    }

    let exists = reaction_repository::reaction_exists(pool, entry_id, user_id, emoji)
        .await
        .map_err(ReactionError::DatabaseError)?;

    if !exists {
        return Err(ReactionError::NotReacted);
    }

    reaction_repository::remove_reaction(pool, entry_id, user_id, emoji)
        .await
        .map_err(ReactionError::DatabaseError)?;

    get_entry_reactions(pool, entry_id).await
}

// Récupère les réactions agrégées d'une entrée
async fn get_entry_reactions(
    pool: &PgPool,
    entry_id: Uuid,
) -> Result<Vec<ReactionSummary>, ReactionError> {
    let reactions = reaction_repository::get_reactions_for_entry(pool, entry_id)
        .await
        .map_err(ReactionError::DatabaseError)?;

    // Agréger par emoji
    let mut summary: std::collections::HashMap<String, Vec<String>> =
        std::collections::HashMap::new();
    for (emoji, username) in reactions {
        summary.entry(emoji).or_default().push(username);
    }

    Ok(summary
        .into_iter()
        .map(|(emoji, users)| ReactionSummary {
            count: users.len() as i64,
            emoji,
            users,
        })
        .collect())
}
