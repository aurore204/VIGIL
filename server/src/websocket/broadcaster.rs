use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::{broadcast, RwLock};
use uuid::Uuid;

use super::events::WsEvent;

const BROADCAST_CAPACITY: usize = 100;

#[derive(Clone)]
pub struct Broadcaster {
    sender: broadcast::Sender<WsEvent>,
    presence: Arc<RwLock<HashMap<Uuid, HashMap<Uuid, Vec<Uuid>>>>>,
    user_senders: Arc<RwLock<HashMap<Uuid, broadcast::Sender<WsEvent>>>>,
}

impl Broadcaster {
    pub fn new() -> Self {
        let (sender, _) = broadcast::channel(BROADCAST_CAPACITY);
        Self {
            sender,
            presence: Arc::new(RwLock::new(HashMap::new())),
            user_senders: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    // Diffuse à tous les clients connectés
    pub fn broadcast(&self, event: WsEvent) {
        let _ = self.sender.send(event);
    }

    // Envoie un event uniquement à un user spécifique
    pub async fn send_to_user(&self, user_id: Uuid, event: WsEvent) {
        let senders = self.user_senders.read().await;
        if let Some(sender) = senders.get(&user_id) {
            let _ = sender.send(event);
        }
    }

    // Enregistre un sender pour un user spécifique
    pub async fn register_user(&self, user_id: Uuid) -> broadcast::Receiver<WsEvent> {
        let mut senders = self.user_senders.write().await;
        let sender = senders
            .entry(user_id)
            .or_insert_with(|| broadcast::channel(BROADCAST_CAPACITY).0);
        sender.subscribe()
    }

    // Désenregistre un user
    pub async fn unregister_user(&self, user_id: Uuid) {
        let mut senders = self.user_senders.write().await;
        senders.remove(&user_id);
    }

    pub fn subscribe(&self) -> broadcast::Receiver<WsEvent> {
        self.sender.subscribe()
    }

    pub async fn add_presence(&self, resource_id: Uuid, user_id: Uuid, team_id: Uuid) {
        let mut presence = self.presence.write().await;
        presence
            .entry(team_id)
            .or_default()
            .entry(resource_id)
            .or_default()
            .push(user_id);
    }
    // Supprime un watcher d'une ressource spécifique
    pub async fn remove_presence(&self, resource_id: Uuid, user_id: Uuid, team_id: Uuid) {
        let mut presence = self.presence.write().await;
        if let Some(team_presence) = presence.get_mut(&team_id) {
            if let Some(watchers) = team_presence.get_mut(&resource_id) {
                watchers.retain(|id| id != &user_id);
            }
        }
    }
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