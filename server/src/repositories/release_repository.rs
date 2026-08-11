use sqlx::PgPool;
use uuid::Uuid;

use crate::models::release::{Release, ReleaseResponse, ReleaseState, ReleaseStep, StepState};

pub async fn create_release(
    pool: &PgPool,
    team_id: Uuid,
    created_by: Uuid,
    title: &str,
    description: Option<&str>,
) -> Result<Release, sqlx::Error> {
    sqlx::query_as!(
        Release,
        r#"
        INSERT INTO releases (team_id, created_by, title, description)
        VALUES ($1, $2, $3, $4)
        RETURNING
            id, team_id, created_by, title, description,
            state as "state: ReleaseState",
            created_at, updated_at
        "#,
        team_id,
        created_by,
        title,
        description
    )
    .fetch_one(pool)
    .await
}

pub async fn create_step(
    pool: &PgPool,
    release_id: Uuid,
    name: &str,
    description: Option<&str>,
    position: i32,
) -> Result<ReleaseStep, sqlx::Error> {
    sqlx::query_as!(
        ReleaseStep,
        r#"
        INSERT INTO release_steps (release_id, name, description, position)
        VALUES ($1, $2, $3, $4)
        RETURNING
            id, release_id, validated_by, name, description, position,
            state as "state: StepState",
            validated_at, created_at, updated_at
        "#,
        release_id,
        name,
        description,
        position
    )
    .fetch_one(pool)
    .await
}

// Récupère toutes les releases liées à un incident
pub async fn get_releases_by_incident(
    pool: &PgPool,
    incident_id: Uuid,
) -> Result<Vec<Uuid>, sqlx::Error> {
    let rows = sqlx::query!(
        r#"
        SELECT release_id
        FROM release_incidents
        WHERE incident_id = $1
        "#,
        incident_id
    )
    .fetch_all(pool)
    .await?;

    Ok(rows.into_iter().map(|r| r.release_id).collect())
}

pub async fn find_by_id(pool: &PgPool, release_id: Uuid) -> Result<Option<Release>, sqlx::Error> {
    sqlx::query_as!(
        Release,
        r#"
        SELECT
            id, team_id, created_by, title, description,
            state as "state: ReleaseState",
            created_at, updated_at
        FROM releases
        WHERE id = $1
        "#,
        release_id
    )
    .fetch_optional(pool)
    .await
}

// Récupère toutes les releases in_progress d'une team (pour blocage automatique)
pub async fn find_in_progress_by_team(
    pool: &PgPool,
    team_id: Uuid,
) -> Result<Vec<Release>, sqlx::Error> {
    sqlx::query_as!(
        Release,
        r#"
        SELECT
            id, team_id, created_by, title, description,
            state as "state: ReleaseState",
            created_at, updated_at
        FROM releases
        WHERE team_id = $1 AND state = 'in_progress'
        "#,
        team_id
    )
    .fetch_all(pool)
    .await
}
pub async fn find_by_team(pool: &PgPool, team_id: Uuid) -> Result<Vec<Release>, sqlx::Error> {
    sqlx::query_as!(
        Release,
        r#"
        SELECT
            id, team_id, created_by, title, description,
            state as "state: ReleaseState",
            created_at, updated_at
        FROM releases
        WHERE team_id = $1
        ORDER BY created_at DESC
        "#,
        team_id
    )
    .fetch_all(pool)
    .await
}

pub async fn get_steps(pool: &PgPool, release_id: Uuid) -> Result<Vec<ReleaseStep>, sqlx::Error> {
    sqlx::query_as!(
        ReleaseStep,
        r#"
        SELECT
            id, release_id, validated_by, name, description, position,
            state as "state: StepState",
            validated_at, created_at, updated_at
        FROM release_steps
        WHERE release_id = $1
        ORDER BY position ASC
        "#,
        release_id
    )
    .fetch_all(pool)
    .await
}

pub async fn update_state(
    pool: &PgPool,
    release_id: Uuid,
    new_state: ReleaseState,
) -> Result<Release, sqlx::Error> {
    sqlx::query_as!(
        Release,
        r#"
        UPDATE releases
        SET state = $1, updated_at = NOW()
        WHERE id = $2
        RETURNING
            id, team_id, created_by, title, description,
            state as "state: ReleaseState",
            created_at, updated_at
        "#,
        new_state as ReleaseState,
        release_id
    )
    .fetch_one(pool)
    .await
}

pub async fn validate_step(
    pool: &PgPool,
    step_id: Uuid,
    validated_by: Uuid,
) -> Result<ReleaseStep, sqlx::Error> {
    sqlx::query_as!(
        ReleaseStep,
        r#"
        UPDATE release_steps
        SET
            state = 'completed',
            validated_by = $1,
            validated_at = NOW(),
            updated_at = NOW()
        WHERE id = $2
        RETURNING
            id, release_id, validated_by, name, description, position,
            state as "state: StepState",
            validated_at, created_at, updated_at
        "#,
        validated_by,
        step_id
    )
    .fetch_one(pool)
    .await
}

pub async fn get_release_with_steps(
    pool: &PgPool,
    release_id: Uuid,
) -> Result<Option<ReleaseResponse>, sqlx::Error> {
    let release = match find_by_id(pool, release_id).await? {
        Some(r) => r,
        None => return Ok(None),
    };

    let steps = get_steps(pool, release_id).await?;

    Ok(Some(ReleaseResponse {
        id: release.id,
        team_id: release.team_id,
        created_by: release.created_by,
        title: release.title,
        description: release.description,
        state: release.state,
        steps,
        created_at: release.created_at,
        updated_at: release.updated_at,
    }))
}

pub async fn link_incident(
    pool: &PgPool,
    release_id: Uuid,
    incident_id: Uuid,
) -> Result<(), sqlx::Error> {
    sqlx::query!(
        r#"
        INSERT INTO release_incidents (release_id, incident_id)
        VALUES ($1, $2)
        ON CONFLICT DO NOTHING
        "#,
        release_id,
        incident_id
    )
    .execute(pool)
    .await?;
    Ok(())
}

pub async fn has_active_incidents(pool: &PgPool, release_id: Uuid) -> Result<bool, sqlx::Error> {
    let result = sqlx::query!(
        r#"
        SELECT COUNT(*) as count
        FROM release_incidents ri
        JOIN incidents i ON i.id = ri.incident_id
        WHERE ri.release_id = $1
        AND i.state != 'resolved'
        "#,
        release_id
    )
    .fetch_one(pool)
    .await?;

    Ok(result.count.unwrap_or(0) > 0)
}

pub async fn cancel_release(pool: &PgPool, release_id: Uuid) -> Result<(), sqlx::Error> {
    sqlx::query!(r#"DELETE FROM releases WHERE id = $1"#, release_id)
        .execute(pool)
        .await?;
    Ok(())
}
