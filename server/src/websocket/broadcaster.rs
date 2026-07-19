use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::{broadcast, RwLock};
use uuid::Uuid;

use super::events::WsEvent;

// Capacité du channel de broadcast
const BROADCAST_CAPACITY: usize = 100;

// Structure qui gère toutes les connexions WebSocket actives
#[derive(Clone)]
pub struct Broadcaster {
    // sender global pour diffuser à tous les clients
    sender: broadcast::Sender<WsEvent>,
    presence: Arc<RwLock<HashMap<Uuid, HashMap<Uuid, Vec<Uuid>>>>>,
}

impl Broadcaster {
    pub fn new() -> Self {
        let (sender, _) = broadcast::channel(BROADCAST_CAPACITY);
        Self {
            sender,
            presence: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    // Diffuse un événement à tous les clients connectés
    pub fn broadcast(&self, event: WsEvent) {
        // Si personne n'écoute, on ignore l'erreur
        let _ = self.sender.send(event);
    }

    // Crée un receiver pour un nouveau client
    pub fn subscribe(&self) -> broadcast::Receiver<WsEvent> {
        self.sender.subscribe()
    }

    // Enregistre qu'un user regarde une ressource
    pub async fn add_presence(&self, resource_id: Uuid, user_id: Uuid, team_id: Uuid) {
        let mut presence = self.presence.write().await;
        presence
            .entry(team_id)
            .or_default()
            .entry(resource_id)
            .or_default()
            .push(user_id);
    }

    // Retire un user de la présence d'une ressource
    pub async fn remove_presence(&self, resource_id: Uuid, user_id: Uuid, team_id: Uuid) {
        let mut presence = self.presence.write().await;
        if let Some(team_presence) = presence.get_mut(&team_id) {
            if let Some(watchers) = team_presence.get_mut(&resource_id) {
                watchers.retain(|id| id != &user_id);
            }
        }
    }

    // Récupère les watchers d'une ressource
    pub async fn get_watchers(&self, resource_id: Uuid, team_id: Uuid) -> Vec<Uuid> {
        let presence = self.presence.read().await;
        presence
            .get(&team_id)
            .and_then(|team| team.get(&resource_id))
            .cloned()
            .unwrap_or_default()
    }
}

impl Default for Broadcaster {
    fn default() -> Self {
        Self::new()
    }
}