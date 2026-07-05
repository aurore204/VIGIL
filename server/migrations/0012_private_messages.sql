CREATE TABLE private_messages (
    id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    sender_id   UUID        NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    receiver_id UUID        NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    content     TEXT        NOT NULL CHECK (LENGTH(content) <= 2000),
    read_at     TIMESTAMPTZ,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);