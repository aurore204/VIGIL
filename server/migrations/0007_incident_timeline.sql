CREATE TABLE incident_timeline (
    id         UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    incident_id UUID       NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
    author_id  UUID        NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    content    TEXT        NOT NULL CHECK (LENGTH(content) <= 2000),
    edited_at  TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);