CREATE TABLE team_bans (
    id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    team_id     UUID        NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    user_id     UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    banned_by   UUID        NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    reason      TEXT,
    expires_at  TIMESTAMPTZ,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT unique_team_ban UNIQUE (team_id, user_id)
);