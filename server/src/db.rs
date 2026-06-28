//crée et gère un pool de connexions vers PostgreSQL pour que toute l'application puisse interroger la base de données en parallèle.
use sqlx::postgres::PgPoolOptions;
use sqlx::PgPool;
use std::env;

pub async fn create_pool() -> PgPool {
    let database_url = env::var("DATABASE_URL")
        .expect("DATABASE_URL doit être défini dans le fichier .env");

    PgPoolOptions::new()
        .max_connections(10)
        .connect(&database_url)
        .await
        .expect("Impossible de se connecter à PostgreSQL")
}