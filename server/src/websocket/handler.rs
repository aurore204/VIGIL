use axum::{
    extract::{
        ws::{Message, WebSocket},
        State, WebSocketUpgrade,
    },
    response::IntoResponse,
    Extension,
};
use futures::{sink::SinkExt, stream::StreamExt};
use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use uuid::Uuid;

use crate::middleware::auth_middleware::AuthenticatedUser;
use crate::repositories::user_repository;
use super::broadcaster::Broadcaster;
use super::events::WsEvent;

// Message envoyé par le client pour s'abonner à une ressource
#[derive(Debug, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum ClientMessage {
    // Le client indique qu'il regarde une ressource
    Watch {
        resource_id: Uuid,
        resource_type: String,
        team_id: Uuid,
    },
    // Le client indique qu'il arrête de regarder
    Unwatch {
        resource_id: Uuid,
        resource_type: String,
        team_id: Uuid,
    },
}

// Handler WebSocket 
pub async fn ws_handler(
    ws: WebSocketUpgrade,
    State((pool, broadcaster)): State<(PgPool, Broadcaster)>,
    Extension(auth_user): Extension<AuthenticatedUser>,
) -> impl IntoResponse {
    ws.on_upgrade(move |socket| handle_socket(socket, pool, broadcaster, auth_user.id))
}

// Gère une connexion WebSocket individuelle
async fn handle_socket(
    socket: WebSocket,
    pool: PgPool,
    broadcaster: Broadcaster,
    user_id: Uuid,
) {
    let (mut sender, mut receiver) = socket.split();

    // Récupérer le username pour la présence
    let username = match user_repository::find_by_id(&pool, user_id).await {
        Ok(Some(u)) => u.username,
        _ => return,
    };

    // S'abonner au broadcaster global
    let mut rx = broadcaster.subscribe();

    // Task qui envoie les events au client
    let send_task = tokio::spawn(async move {
        while let Ok(event) = rx.recv().await {
            let json = match serde_json::to_string(&event) {
                Ok(j) => j,
                Err(_) => continue,
            };
            if sender.send(Message::Text(json)).await.is_err() {
                break;
            }
        }
    });

    // Task qui reçoit les messages du client (présence)
    let broadcaster_clone = broadcaster.clone();
    let username_clone = username.clone();
    let recv_task = tokio::spawn(async move {
        while let Some(Ok(msg)) = receiver.next().await {
            if let Message::Text(text) = msg {
                if let Ok(client_msg) = serde_json::from_str::<ClientMessage>(&text) {
                    match client_msg {
                        ClientMessage::Watch { resource_id, resource_type, team_id } => {
                            broadcaster_clone
                                .add_presence(resource_id, user_id, team_id)
                                .await;

                            // Diffuser la mise à jour de présence
                            let watchers = broadcaster_clone
                                .get_watchers(resource_id, team_id)
                                .await;

                            broadcaster_clone.broadcast(WsEvent::PresenceUpdate {
                                resource_id,
                                resource_type,
                                watchers: watchers.iter().map(|id| id.to_string()).collect(),
                            });
                        }
                        ClientMessage::Unwatch { resource_id, resource_type, team_id } => {
                            broadcaster_clone
                                .remove_presence(resource_id, user_id, team_id)
                                .await;

                            let watchers = broadcaster_clone
                                .get_watchers(resource_id, team_id)
                                .await;

                            broadcaster_clone.broadcast(WsEvent::PresenceUpdate {
                                resource_id,
                                resource_type,
                                watchers: watchers.iter().map(|id| id.to_string()).collect(),
                            });
                        }
                    }
                }
            } else if let Message::Close(_) = msg {
                break;
            }
        }
    });

    // Attendre que l'une des deux tasks se termine
    tokio::select! {
        _ = send_task => {},
        _ = recv_task => {},
    }
}