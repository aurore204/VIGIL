use vigil_server::{db, routes, state::AppState, websocket::broadcaster::Broadcaster};

#[tokio::main]
async fn main() {
    dotenv::dotenv().ok();
    tracing_subscriber::fmt::init();

    let pool = db::create_pool().await;
    let broadcaster = Broadcaster::new();
    let state = AppState::new(pool, broadcaster);

    let app = routes::create_router(state);

    let addr = std::net::SocketAddr::from(([0, 0, 0, 0], 8080));
    tracing::info!("Serveur démarré sur http://{}", addr);

    let listener = tokio::net::TcpListener::bind(addr).await.unwrap();
    axum::serve(listener, app).await.unwrap();
}