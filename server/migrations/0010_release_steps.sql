CREATE TYPE step_state AS ENUM ('pending', 'in_progress', 'completed', 'cancelled');

CREATE TABLE release_steps (
    id           UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    release_id   UUID        NOT NULL REFERENCES releases(id) ON DELETE CASCADE,
    validated_by UUID        REFERENCES users(id) ON DELETE SET NULL,
    name         VARCHAR(100) NOT NULL,
    description  TEXT,
    position     INTEGER     NOT NULL,
    state        step_state  NOT NULL DEFAULT 'pending',
    validated_at TIMESTAMPTZ,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT unique_step_position UNIQUE (release_id, position)
);