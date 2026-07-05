CREATE TABLE release_incidents (
    id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    release_id  UUID        NOT NULL REFERENCES releases(id) ON DELETE CASCADE,
    incident_id UUID        NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT unique_release_incident UNIQUE (release_id, incident_id)
);