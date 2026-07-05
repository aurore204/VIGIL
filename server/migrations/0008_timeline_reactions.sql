CREATE TABLE timeline_reactions (
    id         UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    entry_id   UUID        NOT NULL REFERENCES incident_timeline(id) ON DELETE CASCADE,
    user_id    UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    emoji      VARCHAR(10) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT unique_reaction UNIQUE (entry_id, user_id, emoji)
);