-- Add migration script here
CREATE TABLE webhook_secrets (
    id            UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    team_id       UUID        NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    service_name  VARCHAR(50) NOT NULL,
    secret_hash   TEXT        NOT NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT unique_team_service_webhook UNIQUE (team_id, service_name)
);