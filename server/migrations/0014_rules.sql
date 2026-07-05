CREATE TABLE rules (
    id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    team_id     UUID        NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    created_by  UUID        NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    name        VARCHAR(255) NOT NULL,
    enabled     BOOLEAN     NOT NULL DEFAULT true,
    trigger     JSONB       NOT NULL,
    reaction    JSONB       NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);