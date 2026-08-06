use chrono::Utc;
use sqlx::PgPool;
use uuid::Uuid;

use crate::models::incident::{
    Incident, IncidentResponse, IncidentSeverity, IncidentState, TimelineEntry,
};

// Crée un nouvel incident
pub async fn create_incident(
    pool: &PgPool,
    team_id: Uuid,
    created_by: Uuid,
    title: &str,
    description: Option<&str>,
    severity: IncidentSeverity,
) -> Result<Incident, sqlx::Error> {
    sqlx::query_as!(
        Incident,
        r#"
        INSERT INTO incidents (team_id, created_by, title, description, severity)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING
            id, team_id, created_by, assigned_to, title, description,
            state as "state: IncidentState",
            severity as "severity: IncidentSeverity",
            resolved_at, created_at, updated_at
        "#,
        team_id,
        created_by,
        title,
        description,
        severity as IncidentSeverity
    )
    .fetch_one(pool)
    .await
}

// Trouve un incident par son id
pub async fn find_by_id(pool: &PgPool, incident_id: Uuid) -> Result<Option<Incident>, sqlx::Error> {
    sqlx::query_as!(
        Incident,
        r#"
        SELECT
            id, team_id, created_by, assigned_to, title, description,
            state as "state: IncidentState",
            severity as "severity: IncidentSeverity",
            resolved_at, created_at, updated_at
        FROM incidents
        WHERE id = $1
        "#,
        incident_id
    )
    .fetch_optional(pool)
    .await
}

// Récupère tous les incidents d'une team
pub async fn find_by_team(pool: &PgPool, team_id: Uuid) -> Result<Vec<Incident>, sqlx::Error> {
    sqlx::query_as!(
        Incident,
        r#"
        SELECT
            id, team_id, created_by, assigned_to, title, description,
            state as "state: IncidentState",
            severity as "severity: IncidentSeverity",
            resolved_at, created_at, updated_at
        FROM incidents
        WHERE team_id = $1
        ORDER BY created_at DESC
        "#,
        team_id
    )
    .fetch_all(pool)
    .await
}

// Met à jour l'état d'un incident
pub async fn update_state(
    pool: &PgPool,
    incident_id: Uuid,
    new_state: IncidentState,
) -> Result<Incident, sqlx::Error> {
    let resolved_at = if new_state == IncidentState::Resolved {
        Some(Utc::now())
    } else {
        None
    };

    sqlx::query_as!(
        Incident,
        r#"
        UPDATE incidents
        SET 
            state = $1,
            resolved_at = $2,
            updated_at = NOW()
        WHERE id = $3
        RETURNING
            id, team_id, created_by, assigned_to, title, description,
            state as "state: IncidentState",
            severity as "severity: IncidentSeverity",
            resolved_at, created_at, updated_at
        "#,
        new_state as IncidentState,
        resolved_at,
        incident_id
    )
    .fetch_one(pool)
    .await
}

// Met à jour la sévérité d'un incident
pub async fn update_severity(
    pool: &PgPool,
    incident_id: Uuid,
    new_severity: IncidentSeverity,
) -> Result<Incident, sqlx::Error> {
    sqlx::query_as!(
        Incident,
        r#"
        UPDATE incidents
        SET severity = $1, updated_at = NOW()
        WHERE id = $2
        RETURNING
            id, team_id, created_by, assigned_to, title, description,
            state as "state: IncidentState",
            severity as "severity: IncidentSeverity",
            resolved_at, created_at, updated_at
        "#,
        new_severity as IncidentSeverity,
        incident_id
    )
    .fetch_one(pool)
    .await
}

// Assigne un Responder à un incident
pub async fn assign_responder(
    pool: &PgPool,
    incident_id: Uuid,
    user_id: Uuid,
) -> Result<Incident, sqlx::Error> {
    sqlx::query_as!(
        Incident,
        r#"
        UPDATE incidents
        SET assigned_to = $1, updated_at = NOW()
        WHERE id = $2
        RETURNING
            id, team_id, created_by, assigned_to, title, description,
            state as "state: IncidentState",
            severity as "severity: IncidentSeverity",
            resolved_at, created_at, updated_at
        "#,
        user_id,
        incident_id
    )
    .fetch_one(pool)
    .await
}

// Ajoute une entrée dans la timeline
pub async fn add_timeline_entry(
    pool: &PgPool,
    incident_id: Uuid,
    author_id: Uuid,
    content: &str,
) -> Result<TimelineEntry, sqlx::Error> {
    let row = sqlx::query!(
        r#"
        INSERT INTO incident_timeline (incident_id, author_id, content)
        VALUES ($1, $2, $3)
        RETURNING
            id,
            incident_id,
            author_id,
            (SELECT username FROM users WHERE id = author_id) as "author_username!",
            content,
            edited_at,
            created_at
        "#,
        incident_id,
        author_id,
        content
    )
    .fetch_one(pool)
    .await?;

    Ok(TimelineEntry {
        id: row.id,
        incident_id: row.incident_id,
        author_id: row.author_id,
        author_username: row.author_username,
        content: row.content,
        edited_at: row.edited_at,
        created_at: row.created_at,
        reactions: None,
    })
}

// Récupère la timeline d'un incident
pub async fn get_timeline(
    pool: &PgPool,
    incident_id: Uuid,
) -> Result<Vec<TimelineEntry>, sqlx::Error> {
    let rows = sqlx::query!(
        r#"
        SELECT
            it.id,
            it.incident_id,
            it.author_id,
            u.username as "author_username!",
            it.content,
            it.edited_at,
            it.created_at
        FROM incident_timeline it
        JOIN users u ON u.id = it.author_id
        WHERE it.incident_id = $1
        ORDER BY it.created_at ASC
        "#,
        incident_id
    )
    .fetch_all(pool)
    .await?;

    let mut entries = Vec::with_capacity(rows.len());
    for row in rows {
        let raw_reactions =
            crate::repositories::reaction_repository::get_reactions_for_entry(pool, row.id).await?;

        let mut summary: std::collections::HashMap<String, Vec<String>> =
            std::collections::HashMap::new();
        for (emoji, username) in raw_reactions {
            summary.entry(emoji).or_default().push(username);
        }

        let reactions = summary
            .into_iter()
            .map(|(emoji, users)| crate::models::reaction::ReactionSummary {
                count: users.len() as i64,
                emoji,
                users,
            })
            .collect();

        entries.push(TimelineEntry {
            id: row.id,
            incident_id: row.incident_id,
            author_id: row.author_id,
            author_username: row.author_username,
            content: row.content,
            edited_at: row.edited_at,
            created_at: row.created_at,
            reactions: Some(reactions),
        });
    }

    Ok(entries)
}

// Trouve une entrée de timeline par son id
pub async fn find_timeline_entry(
    pool: &PgPool,
    entry_id: Uuid,
) -> Result<Option<TimelineEntry>, sqlx::Error> {
    let row = sqlx::query!(
        r#"
        SELECT
            it.id,
            it.incident_id,
            it.author_id,
            u.username as "author_username!",
            it.content,
            it.edited_at,
            it.created_at
        FROM incident_timeline it
        JOIN users u ON u.id = it.author_id
        WHERE it.id = $1
        "#,
        entry_id
    )
    .fetch_optional(pool)
    .await?;

    Ok(row.map(|row| TimelineEntry {
        id: row.id,
        incident_id: row.incident_id,
        author_id: row.author_id,
        author_username: row.author_username,
        content: row.content,
        edited_at: row.edited_at,
        created_at: row.created_at,
        reactions: None,
    }))
}

// Édite une entrée de timeline (auteur uniquement)
pub async fn edit_timeline_entry(
    pool: &PgPool,
    entry_id: Uuid,
    content: &str,
) -> Result<TimelineEntry, sqlx::Error> {
    let row = sqlx::query!(
        r#"
        UPDATE incident_timeline
        SET content = $1, edited_at = NOW()
        WHERE id = $2
        RETURNING
            id,
            incident_id,
            author_id,
            (SELECT username FROM users WHERE id = author_id) as "author_username!",
            content,
            edited_at,
            created_at
        "#,
        content,
        entry_id
    )
    .fetch_one(pool)
    .await?;

    Ok(TimelineEntry {
        id: row.id,
        incident_id: row.incident_id,
        author_id: row.author_id,
        author_username: row.author_username,
        content: row.content,
        edited_at: row.edited_at,
        created_at: row.created_at,
        reactions: None,
    })
}
// Récupère un incident complet avec sa timeline
pub async fn get_incident_with_timeline(
    pool: &PgPool,
    incident_id: Uuid,
) -> Result<Option<IncidentResponse>, sqlx::Error> {
    let incident = match find_by_id(pool, incident_id).await? {
        Some(i) => i,
        None => return Ok(None),
    };

    let timeline = get_timeline(pool, incident_id).await?;

    Ok(Some(IncidentResponse {
        id: incident.id,
        team_id: incident.team_id,
        created_by: incident.created_by,
        assigned_to: incident.assigned_to,
        title: incident.title,
        description: incident.description,
        state: incident.state,
        severity: incident.severity,
        timeline,
        resolved_at: incident.resolved_at,
        created_at: incident.created_at,
        updated_at: incident.updated_at,
    }))
}

// Met à jour les informations d'un incident
pub async fn update_incident(
    pool: &PgPool,
    incident_id: Uuid,
    title: Option<&str>,
    description: Option<&str>,
    severity: Option<IncidentSeverity>,
) -> Result<Incident, sqlx::Error> {
    sqlx::query_as!(
        Incident,
        r#"
        UPDATE incidents
        SET
            title = COALESCE($1, title),
            description = COALESCE($2, description),
            severity = COALESCE($3, severity),
            updated_at = NOW()
        WHERE id = $4
        RETURNING
            id, team_id, created_by, assigned_to, title, description,
            state as "state: IncidentState",
            severity as "severity: IncidentSeverity",
            resolved_at, created_at, updated_at
        "#,
        title,
        description,
        severity as Option<IncidentSeverity>,
        incident_id
    )
    .fetch_one(pool)
    .await
}
// Supprime un incident
pub async fn delete_incident(pool: &PgPool, incident_id: Uuid) -> Result<(), sqlx::Error> {
    sqlx::query!(r#"DELETE FROM incidents WHERE id = $1"#, incident_id)
        .execute(pool)
        .await?;
    Ok(())
}
