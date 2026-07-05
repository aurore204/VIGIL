CREATE TYPE incident_state    AS ENUM ('open', 'acknowledged', 'escalated', 'resolved');
CREATE TYPE incident_severity AS ENUM ('low', 'medium', 'high', 'critical');

CREATE TABLE incidents (
    id           UUID              PRIMARY KEY DEFAULT uuid_generate_v4(),
    team_id      UUID              NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    created_by   UUID              NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    assigned_to  UUID              REFERENCES users(id) ON DELETE SET NULL,
    title        VARCHAR(255)      NOT NULL,
    description  TEXT,
    state        incident_state    NOT NULL DEFAULT 'open',
    severity     incident_severity NOT NULL DEFAULT 'low',
    resolved_at  TIMESTAMPTZ,
    created_at   TIMESTAMPTZ       NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ       NOT NULL DEFAULT NOW()
);