use axum::Router;
use std::net::SocketAddr;
use tracing::info;

mod db;
mod handlers;
mod middleware;
mod models;
mod repositories;
mod routes;
mod services;
mod websocket;

#[tokio::main]
async fn main() {
    dotenv::dotenv().ok();
    // Initialise les logs
    tracing_subscriber::fmt::init();

    // Connexion à la base de données
    let pool = db::create_pool().await;
    // Construction du routeur
    let app = routes::create_router(pool);
    // Démarrage du serveur
    let addr = SocketAddr::from(([0, 0, 0, 0], 8080));
    info!("Serveur démarré sur http://{}", addr);

    let listener = tokio::net::TcpListener::bind(addr).await.unwrap();
    axum::serve(listener, app).await.unwrap();
}