CREATE TABLE team_invitations (
    id           UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    team_id      UUID        NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    created_by   UUID        NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    code         VARCHAR(20) NOT NULL UNIQUE,
    expires_at   TIMESTAMPTZ,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);