-- Add migration script here
ALTER TABLE user_tokens
ADD COLUMN encryption_nonce TEXT NOT NULL DEFAULT '';