CREATE TYPE rule_log_status AS ENUM ('success', 'failed');

CREATE TABLE rule_logs (
    id         UUID            PRIMARY KEY DEFAULT uuid_generate_v4(),
    rule_id    UUID            NOT NULL REFERENCES rules(id) ON DELETE CASCADE,
    status     rule_log_status NOT NULL,
    result     JSONB,
    error      TEXT,
    triggered_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);