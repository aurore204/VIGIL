use sqlx::PgPool;
use uuid::Uuid;

use crate::models::team::{
    BannedMember, Team, TeamInvitation, TeamMember, TeamMemberWithUser, TeamRole,
};

// Crée une nouvelle team et ajoute le créateur comme Manager
pub async fn create_team(
    pool: &PgPool,
    name: &str,
    description: Option<&str>,
    manager_id: Uuid,
) -> Result<Team, sqlx::Error> {
    let team = sqlx::query_as!(
        Team,
        r#"
        INSERT INTO teams (name, description, manager_id)
        VALUES ($1, $2, $3)
        RETURNING id, name, description, manager_id, created_at, updated_at
        "#,
        name,
        description,
        manager_id
    )
    .fetch_one(pool)
    .await?;

    // Ajouter le créateur comme Manager dans team_members
    sqlx::query!(
        r#"
        INSERT INTO team_members (team_id, user_id, role)
        VALUES ($1, $2, 'manager')
        "#,
        team.id,
        manager_id
    )
    .execute(pool)
    .await?;

    Ok(team)
}

// Trouve une team par son id
pub async fn find_by_id(pool: &PgPool, team_id: Uuid) -> Result<Option<Team>, sqlx::Error> {
    let team = sqlx::query_as!(
        Team,
        r#"
        SELECT id, name, description, manager_id, created_at, updated_at
        FROM teams
        WHERE id = $1
        "#,
        team_id
    )
    .fetch_optional(pool)
    .await?;

    Ok(team)
}

// Met à jour le rôle d'un membre
pub async fn update_member_role(
    pool: &PgPool,
    team_id: Uuid,
    user_id: Uuid,
    role: TeamRole,
) -> Result<(), sqlx::Error> {
    sqlx::query!(
        r#"
        UPDATE team_members
        SET role = $1
        WHERE team_id = $2 AND user_id = $3
        "#,
        role as TeamRole,
        team_id,
        user_id
    )
    .execute(pool)
    .await?;

    Ok(())
}

// Récupère tous les membres d'une team avec leurs infos
pub async fn get_members(
    pool: &PgPool,
    team_id: Uuid,
) -> Result<Vec<TeamMemberWithUser>, sqlx::Error> {
    let members = sqlx::query_as!(
        TeamMemberWithUser,
        r#"
        SELECT 
            tm.user_id,
            u.username,
            u.email,
            tm.role as "role: TeamRole",
            tm.joined_at
        FROM team_members tm
        JOIN users u ON u.id = tm.user_id
        WHERE tm.team_id = $1
        "#,
        team_id
    )
    .fetch_all(pool)
    .await?;

    Ok(members)
}

// Récupère toutes les teams d'un utilisateur
pub async fn get_user_teams(pool: &PgPool, user_id: Uuid) -> Result<Vec<Team>, sqlx::Error> {
    let teams = sqlx::query_as!(
        Team,
        r#"
        SELECT t.id, t.name, t.description, t.manager_id, t.created_at, t.updated_at
        FROM teams t
        JOIN team_members tm ON tm.team_id = t.id
        WHERE tm.user_id = $1
        "#,
        user_id
    )
    .fetch_all(pool)
    .await?;

    Ok(teams)
}

// Vérifie si un user est membre d'une team
pub async fn is_member(pool: &PgPool, team_id: Uuid, user_id: Uuid) -> Result<bool, sqlx::Error> {
    let result = sqlx::query!(
        r#"
        SELECT COUNT(*) as count
        FROM team_members
        WHERE team_id = $1 AND user_id = $2
        "#,
        team_id,
        user_id
    )
    .fetch_one(pool)
    .await?;

    Ok(result.count.unwrap_or(0) > 0)
}

// Récupère le rôle d'un membre dans une team
pub async fn get_member_role(
    pool: &PgPool,
    team_id: Uuid,
    user_id: Uuid,
) -> Result<Option<TeamRole>, sqlx::Error> {
    let result = sqlx::query!(
        r#"
        SELECT role as "role: TeamRole"
        FROM team_members
        WHERE team_id = $1 AND user_id = $2
        "#,
        team_id,
        user_id
    )
    .fetch_optional(pool)
    .await?;

    Ok(result.map(|r| r.role))
}

// Génère un code d'invitation unique
pub async fn create_invitation(
    pool: &PgPool,
    team_id: Uuid,
    created_by: Uuid,
) -> Result<TeamInvitation, sqlx::Error> {
    // Générer un code aléatoire de 8 caractères
    let code = generate_invitation_code();

    let invitation = sqlx::query_as!(
        TeamInvitation,
        r#"
        INSERT INTO team_invitations (team_id, created_by, code)
        VALUES ($1, $2, $3)
        RETURNING id, team_id, created_by, code, expires_at, created_at
        "#,
        team_id,
        created_by,
        code
    )
    .fetch_one(pool)
    .await?;

    Ok(invitation)
}

// Trouve une invitation par son code
pub async fn find_invitation_by_code(
    pool: &PgPool,
    code: &str,
) -> Result<Option<TeamInvitation>, sqlx::Error> {
    let invitation = sqlx::query_as!(
        TeamInvitation,
        r#"
        SELECT id, team_id, created_by, code, expires_at, created_at
        FROM team_invitations
        WHERE code = $1
        AND (expires_at IS NULL OR expires_at > NOW())
        "#,
        code
    )
    .fetch_optional(pool)
    .await?;

    Ok(invitation)
}

// Ajoute un membre à une team
pub async fn add_member(
    pool: &PgPool,
    team_id: Uuid,
    user_id: Uuid,
    role: TeamRole,
) -> Result<TeamMember, sqlx::Error> {
    let member = sqlx::query_as!(
        TeamMember,
        r#"
        INSERT INTO team_members (team_id, user_id, role)
        VALUES ($1, $2, $3)
        RETURNING id, team_id, user_id, role as "role: TeamRole", joined_at
        "#,
        team_id,
        user_id,
        role as TeamRole
    )
    .fetch_one(pool)
    .await?;

    Ok(member)
}

// Transfère le rôle Manager à un autre membre
pub async fn transfer_manager(
    pool: &PgPool,
    team_id: Uuid,
    current_manager_id: Uuid,
    new_manager_id: Uuid,
) -> Result<(), sqlx::Error> {
    // Mettre à jour la table teams
    sqlx::query!(
        r#"
        UPDATE teams
        SET manager_id = $1, updated_at = NOW()
        WHERE id = $2
        "#,
        new_manager_id,
        team_id
    )
    .execute(pool)
    .await?;

    // Mettre à jour le rôle de l'ancien manager en Responder
    sqlx::query!(
        r#"
        UPDATE team_members
        SET role = 'responder'
        WHERE team_id = $1 AND user_id = $2
        "#,
        team_id,
        current_manager_id
    )
    .execute(pool)
    .await?;

    // Mettre à jour le rôle du nouveau manager
    sqlx::query!(
        r#"
        UPDATE team_members
        SET role = 'manager'
        WHERE team_id = $1 AND user_id = $2
        "#,
        team_id,
        new_manager_id
    )
    .execute(pool)
    .await?;

    Ok(())
}

// Génère un code d'invitation aléatoire de 8 caractères
fn generate_invitation_code() -> String {
    use std::collections::hash_map::DefaultHasher;
    use std::hash::{Hash, Hasher};

    let id = Uuid::new_v4();
    let mut hasher = DefaultHasher::new();
    id.hash(&mut hasher);
    let hash = hasher.finish();

    format!("{:08X}", hash & 0xFFFFFFFF)
}

// Vérifie si un utilisateur est banni d'une team
pub async fn is_banned(pool: &PgPool, team_id: Uuid, user_id: Uuid) -> Result<bool, sqlx::Error> {
    let result = sqlx::query!(
        r#"
        SELECT COUNT(*) as count
        FROM team_bans
        WHERE team_id = $1 
        AND user_id = $2
        AND (expires_at IS NULL OR expires_at > NOW())
        "#,
        team_id,
        user_id
    )
    .fetch_one(pool)
    .await?;

    Ok(result.count.unwrap_or(0) > 0)
}

// Supprime un membre de la team (kick)
pub async fn kick_member(pool: &PgPool, team_id: Uuid, user_id: Uuid) -> Result<(), sqlx::Error> {
    sqlx::query!(
        r#"
        DELETE FROM team_members
        WHERE team_id = $1 AND user_id = $2
        "#,
        team_id,
        user_id
    )
    .execute(pool)
    .await?;

    Ok(())
}

// Bannit un membre de la team
pub async fn ban_member(
    pool: &PgPool,
    team_id: Uuid,
    banned_by: Uuid,
    user_id: Uuid,
    expires_at: Option<chrono::DateTime<chrono::Utc>>,
    reason: Option<String>,
) -> Result<(), sqlx::Error> {
    sqlx::query!(
        r#"
        INSERT INTO team_bans (team_id, user_id, banned_by, expires_at, reason)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (team_id, user_id)
        DO UPDATE SET expires_at = $4, reason = $5, banned_by = $3
        "#,
        team_id,
        user_id,
        banned_by,
        expires_at,
        reason
    )
    .execute(pool)
    .await?;

    Ok(())
}

// Lève un ban
pub async fn unban_member(pool: &PgPool, team_id: Uuid, user_id: Uuid) -> Result<(), sqlx::Error> {
    sqlx::query!(
        r#"
        DELETE FROM team_bans
        WHERE team_id = $1 AND user_id = $2
        "#,
        team_id,
        user_id
    )
    .execute(pool)
    .await?;

    Ok(())
}

// Met à jour une team
pub async fn update_team(
    pool: &PgPool,
    team_id: Uuid,
    name: Option<&str>,
    description: Option<&str>,
) -> Result<Team, sqlx::Error> {
    sqlx::query_as!(
        Team,
        r#"
        UPDATE teams
        SET
            name = COALESCE($1, name),
            description = COALESCE($2, description),
            updated_at = NOW()
        WHERE id = $3
        RETURNING id, name, description, manager_id, created_at, updated_at
        "#,
        name,
        description,
        team_id
    )
    .fetch_one(pool)
    .await
}

// Supprime une team
pub async fn delete_team(pool: &PgPool, team_id: Uuid) -> Result<(), sqlx::Error> {
    sqlx::query!(r#"DELETE FROM teams WHERE id = $1"#, team_id)
        .execute(pool)
        .await?;
    Ok(())
}

pub async fn get_banned_members(
    pool: &PgPool,
    team_id: Uuid,
) -> Result<Vec<BannedMember>, sqlx::Error> {
    let rows = sqlx::query!(
        r#"
        SELECT
            tb.user_id,
            u.username,
            u.email,
            tb.banned_by,
            banner.username as banned_by_username,
            tb.expires_at,
            tb.reason,
            tb.created_at
        FROM team_bans tb
        JOIN users u ON u.id = tb.user_id
        JOIN users banner ON banner.id = tb.banned_by
        WHERE tb.team_id = $1
        AND (tb.expires_at IS NULL OR tb.expires_at > NOW())
        ORDER BY tb.created_at DESC
        "#,
        team_id
    )
    .fetch_all(pool)
    .await?;

    Ok(rows
        .into_iter()
        .map(|r| BannedMember {
            user_id: r.user_id,
            username: r.username,
            email: r.email,
            banned_by: r.banned_by,
            banned_by_username: r.banned_by_username,
            expires_at: r.expires_at,
            reason: r.reason,
            created_at: r.created_at,
        })
        .collect())
}
