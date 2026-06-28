CREATE TYPE token_type AS ENUM ('oauth2', 'personal');

CREATE TABLE user_tokens (
    id            UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id       UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    service_name  VARCHAR(50) NOT NULL,
    token_type    token_type  NOT NULL,
    access_token  TEXT        NOT NULL,
    refresh_token TEXT,
    expires_at    TIMESTAMPTZ,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT unique_user_service UNIQUE (user_id, service_name)
);