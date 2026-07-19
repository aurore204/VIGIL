use axum::{
    extract::{
        ws::{Message, WebSocket, WebSocketUpgrade},
        Query, State,
    },
    http::{HeaderMap, StatusCode},
    response::IntoResponse,
};
use futures_util::{sink::SinkExt, stream::StreamExt};
use serde::Deserialize;
use sqlx::PgPool;
use uuid::Uuid;

use crate::repositories::user_repository;
use crate::services::auth_service::verify_token;
use crate::state::AppState;
use crate::websocket::broadcaster::Broadcaster;
use crate::websocket::events::WsEvent;

#[derive(Debug, Deserialize)]
pub struct WsQuery {
    pub token: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum ClientMessage {
    Watch {
        resource_id: Uuid,
        resource_type: String,
        team_id: Uuid,
    },
    Unwatch {
        resource_id: Uuid,
        resource_type: String,
        team_id: Uuid,
    },
}

pub async fn ws_handler(
    ws: WebSocketUpgrade,
    State(state): State<AppState>,
    Query(query): Query<WsQuery>,
    headers: HeaderMap,
) -> impl IntoResponse {
    let token = if let Some(t) = query.token {
        t
    } else if let Some(auth) = headers.get("Authorization") {
        let auth_str = auth.to_str().unwrap_or("");
        if auth_str.starts_with("Bearer ") {
            auth_str[7..].to_string()
        } else {
            return (StatusCode::UNAUTHORIZED, "Token manquant").into_response();
        }
    } else {
        return (StatusCode::UNAUTHORIZED, "Token manquant").into_response();
    };

    let claims = match verify_token(&token) {
        Ok(c) => c,
        Err(_) => return (StatusCode::UNAUTHORIZED, "Token invalide").into_response(),
    };

    let user_id = match Uuid::parse_str(&claims.sub) {
        Ok(id) => id,
        Err(_) => return (StatusCode::UNAUTHORIZED, "Token invalide").into_response(),
    };

    ws.on_upgrade(move |socket| handle_socket(socket, state.pool, state.broadcaster, user_id))
}

async fn handle_socket(
    socket: WebSocket,
    pool: PgPool,
    broadcaster: Broadcaster,
    user_id: Uuid,
) {
    let (mut sender, mut receiver) = socket.split();

    let _username = match user_repository::find_by_id(&pool, user_id).await {
        Ok(Some(u)) => u.username,
        _ => return,
    };

    // S'abonner au broadcast global
    let mut rx_global = broadcaster.subscribe();
    // S'abonner aux messages privés
    let mut rx_private = broadcaster.register_user(user_id).await;

    let send_task = tokio::spawn(async move {
        loop {
            tokio::select! {
                Ok(event) = rx_global.recv() => {
                    let json = match serde_json::to_string(&event) {
                        Ok(j) => j,
                        Err(_) => continue,
                    };
                    if sender.send(Message::Text(json)).await.is_err() {
                        break;
                    }
                }
                Ok(event) = rx_private.recv() => {
                    let json = match serde_json::to_string(&event) {
                        Ok(j) => j,
                        Err(_) => continue,
                    };
                    if sender.send(Message::Text(json)).await.is_err() {
                        break;
                    }
                }
                else => break,
            }
        }
    });

    let broadcaster_clone = broadcaster.clone();
    let recv_task = tokio::spawn(async move {
        while let Some(Ok(msg)) = receiver.next().await {
            if let Message::Text(text) = msg {
                if let Ok(client_msg) = serde_json::from_str::<ClientMessage>(&text) {
                    match client_msg {
                        ClientMessage::Watch { resource_id, resource_type, team_id } => {
                            broadcaster_clone
                                .add_presence(resource_id, user_id, team_id)
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

    tokio::select! {
        _ = send_task => {},
        _ = recv_task => {},
    }

    // Désenregistrer le user à la déconnexion
    broadcaster.unregister_user(user_id).await;
}