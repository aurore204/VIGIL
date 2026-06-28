CREATE TYPE release_state AS ENUM ('created', 'in_progress', 'completed', 'cancelled', 'blocked');

CREATE TABLE releases (
    id          UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
    team_id     UUID          NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    created_by  UUID          NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    title       VARCHAR(255)  NOT NULL,
    description TEXT,
    state       release_state NOT NULL DEFAULT 'created',
    created_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);