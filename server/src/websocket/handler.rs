use axum::{
    extract::{
        ws::{Message, WebSocket, WebSocketUpgrade},
        Query, State,
    },
    http::{HeaderMap, StatusCode},
    response::IntoResponse,
    Json,
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
    tracing::info!("ws_handler appelé, token en query présent: {}", query.token.is_some());

    let token = if let Some(t) = query.token {
        t
    } else if let Some(auth) = headers.get("Authorization") {
        let auth_str = auth.to_str().unwrap_or("");
        if auth_str.starts_with("Bearer ") {
            auth_str[7..].to_string()
        } else {
            tracing::warn!("Header Authorization présent mais mal formé");
            return (StatusCode::UNAUTHORIZED, "Token manquant").into_response();
        }
    } else {
        tracing::warn!("Aucun token trouvé (ni query, ni header)");
        return (StatusCode::UNAUTHORIZED, "Token manquant").into_response();
    };

    let claims = match verify_token(&token) {
        Ok(c) => c,
        Err(e) => {
            tracing::warn!("Échec verify_token: {:?}", e);
            return (StatusCode::UNAUTHORIZED, "Token invalide").into_response();
        }
    };

    let user_id = match Uuid::parse_str(&claims.sub) {
        Ok(id) => id,
        Err(e) => {
            tracing::warn!("sub invalide dans le token: {:?}", e);
            return (StatusCode::UNAUTHORIZED, "Token invalide").into_response();
        }
    };

    tracing::info!("Upgrade WS accepté pour user_id={}", user_id);

    ws.on_upgrade(move |socket| handle_socket(socket, state.pool, state.broadcaster, user_id))
}

pub async fn get_online_users(State(state): State<AppState>) -> impl IntoResponse {
    let usernames = state.broadcaster.online_usernames().await;
    Json(serde_json::json!(crate::models::response::ApiResponse::success(
        "Utilisateurs en ligne",
        usernames
    )))
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
        Ok(None) => {
            tracing::warn!("Utilisateur introuvable en base pour user_id={}", user_id);
            return;
        }
        Err(e) => {
            tracing::error!("Erreur DB lors du find_by_id: {:?}", e);
            return;
        }
    };

    tracing::info!("Connexion WS établie pour {}", _username);

    // S'abonner au broadcast global
    let mut rx_global = broadcaster.subscribe();
    // S'abonner aux messages privés
    let (mut rx_private, connection_generation) = broadcaster.register_user(user_id, _username).await;

    let send_task = tokio::spawn(async move {
        loop {
            tokio::select! {
                result = rx_global.recv() => {
                    match result {
                        Ok(event) => {
                            let json = match serde_json::to_string(&event) {
                                Ok(j) => j,
                                Err(_) => continue,
                            };
                            if sender.send(Message::Text(json)).await.is_err() {
                                break;
                            }
                        }
                        Err(tokio::sync::broadcast::error::RecvError::Lagged(n)) => {
                            tracing::warn!("rx_global en retard de {} messages, on continue", n);
                            continue;
                        }
                        Err(tokio::sync::broadcast::error::RecvError::Closed) => {
                            tracing::warn!("rx_global fermé, arrêt de send_task");
                            break;
                        }
                    }
                }
                result = rx_private.recv() => {
                    match result {
                        Ok(event) => {
                            let json = match serde_json::to_string(&event) {
                                Ok(j) => j,
                                Err(_) => continue,
                            };
                            if sender.send(Message::Text(json)).await.is_err() {
                                break;
                            }
                        }
                        Err(tokio::sync::broadcast::error::RecvError::Lagged(n)) => {
                            tracing::warn!("rx_private en retard de {} messages, on continue", n);
                            continue;
                        }
                        Err(tokio::sync::broadcast::error::RecvError::Closed) => {
                            tracing::warn!("rx_private fermé, arrêt de send_task");
                            break;
                        }
                    }
                }
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
    broadcaster.unregister_user(user_id, connection_generation).await;
}