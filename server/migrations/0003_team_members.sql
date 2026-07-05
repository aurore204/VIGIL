CREATE TYPE team_role AS ENUM ('observer', 'responder', 'manager');

CREATE TABLE team_members (
    id         UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    team_id    UUID        NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    user_id    UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role       team_role   NOT NULL DEFAULT 'observer',
    joined_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT unique_team_member UNIQUE (team_id, user_id)
);