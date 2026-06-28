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
    tracing_subscriber::fmt::init();

    let pool = db::create_pool().await;
    let app = routes::create_router(pool);

    let addr = std::net::SocketAddr::from(([0, 0, 0, 0], 8080));
    tracing::info!("Serveur démarré sur http://{}", addr);

    let listener = tokio::net::TcpListener::bind(addr).await.unwrap();
    axum::serve(listener, app).await.unwrap();
}
