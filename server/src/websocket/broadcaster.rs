use std::collections::HashMap;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Arc;
use tokio::sync::{broadcast, RwLock};
use uuid::Uuid;

use super::events::WsEvent;

const BROADCAST_CAPACITY: usize = 1000;

struct UserConnection {
    sender: broadcast::Sender<WsEvent>,
    generation: u64,
}

#[derive(Clone)]
pub struct Broadcaster {
    sender: broadcast::Sender<WsEvent>,
    presence: Arc<RwLock<HashMap<Uuid, HashMap<Uuid, Vec<Uuid>>>>>,
    user_senders: Arc<RwLock<HashMap<Uuid, UserConnection>>>,
    online_users: Arc<RwLock<HashMap<Uuid, String>>>,
    generation_counter: Arc<AtomicU64>,
}

impl Broadcaster {
    pub fn new() -> Self {
        let (sender, _) = broadcast::channel(BROADCAST_CAPACITY);
        Self {
            sender,
            presence: Arc::new(RwLock::new(HashMap::new())),
            user_senders: Arc::new(RwLock::new(HashMap::new())),
            online_users: Arc::new(RwLock::new(HashMap::new())),
            generation_counter: Arc::new(AtomicU64::new(0)),
        }
    }

    pub fn broadcast(&self, event: WsEvent) {
        let _ = self.sender.send(event);
    }

    pub async fn send_to_user(&self, user_id: Uuid, event: WsEvent) {
        let senders = self.user_senders.read().await;
        if let Some(conn) = senders.get(&user_id) {
            let _ = conn.sender.send(event);
        }
    }

    /// Enregistre une nouvelle connexion pour un user. Retourne le receiver
    pub async fn register_user(&self, user_id: Uuid, username: String) -> (broadcast::Receiver<WsEvent>, u64) {
    let generation = self.generation_counter.fetch_add(1, Ordering::SeqCst);

    let (new_sender, rx) = broadcast::channel(BROADCAST_CAPACITY);

    {
        let mut senders = self.user_senders.write().await;
        senders.insert(user_id, UserConnection { sender: new_sender, generation });
    }

    {
        let mut online = self.online_users.write().await;
        online.insert(user_id, username);
    }

    self.broadcast_online_users().await;
    (rx, generation)
}

  

    /// Désenregistre un user, MAIS uniquement si la génération correspond à la connexion qui se ferme réellement. Une connexion plus ancienne
    pub async fn unregister_user(&self, user_id: Uuid, generation: u64) {
        {
            let mut senders = self.user_senders.write().await;
            if let Some(conn) = senders.get(&user_id) {
                if conn.generation == generation {
                    senders.remove(&user_id);
                } else {
                    // Une connexion plus récente existe déjà : on ne touche à rien.
                    tracing::debug!(
                        "unregister_user ignoré pour user_id={} (génération {} obsolète, actuelle différente)",
                        user_id, generation
                    );
                    return;
                }
            }
        }

        {
            let mut online = self.online_users.write().await;
            online.remove(&user_id);
        }

        self.broadcast_online_users().await;
    }

    pub async fn online_usernames(&self) -> Vec<String> {
        let online = self.online_users.read().await;
        online.values().cloned().collect()
    }

    async fn broadcast_online_users(&self) {
        let usernames = self.online_usernames().await;
        tracing::info!("Diffusion presence_online: {:?}", usernames);
        self.broadcast(WsEvent::PresenceOnline { usernames });
    }

    pub fn subscribe(&self) -> broadcast::Receiver<WsEvent> {
        self.sender.subscribe()
    }

    pub async fn add_presence(&self, resource_id: Uuid, user_id: Uuid, team_id: Uuid) {
    let mut presence = self.presence.write().await;
    let watchers = presence
        .entry(team_id)
        .or_default()
        .entry(resource_id)
        .or_default();

    if !watchers.contains(&user_id) {
        watchers.push(user_id);
    }
}

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