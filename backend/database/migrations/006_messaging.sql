-- Parent / social worker messaging. Additive and idempotent: it only creates two new tables, their
-- indexes and two guard triggers. No existing table or row is changed.
-- Rollback instructions: database/rollbacks/006_messaging.rollback.sql
--
-- Design notes:
--   * One conversation per (parent, child, social worker). Whether it is "active" is not stored; it is
--     derived from the live ACTIVE row in social_worker_assignments, so a reassignment or an ended
--     assignment makes the conversation read-only without touching its history.
--   * History is never cascaded away: every foreign key to users, children and conversations is RESTRICT.

-- 1. Conversations
CREATE TABLE IF NOT EXISTS conversations (
    id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    parent_user_id              UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    social_worker_id            UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    child_id                    UUID NOT NULL REFERENCES children(id) ON DELETE RESTRICT,
    maintenance_arrangement_id  UUID,
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_conversation_distinct_users CHECK (parent_user_id <> social_worker_id),
    CONSTRAINT uq_conversation_parent_child_worker UNIQUE (parent_user_id, child_id, social_worker_id),
    -- The composite key guarantees the arrangement belongs to the same child as the conversation.
    -- If an arrangement is ever deleted only the link is cleared (needs PostgreSQL 15+).
    CONSTRAINT fk_conversation_arrangement_child
        FOREIGN KEY (maintenance_arrangement_id, child_id)
        REFERENCES maintenance_arrangements (id, child_id)
        ON DELETE SET NULL (maintenance_arrangement_id)
);

CREATE INDEX IF NOT EXISTS idx_conversations_parent
    ON conversations (parent_user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_conversations_social_worker
    ON conversations (social_worker_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_conversations_child
    ON conversations (child_id);
CREATE INDEX IF NOT EXISTS idx_conversations_arrangement
    ON conversations (maintenance_arrangement_id)
    WHERE maintenance_arrangement_id IS NOT NULL;

-- 2. Messages
CREATE TABLE IF NOT EXISTS messages (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id     UUID NOT NULL REFERENCES conversations(id) ON DELETE RESTRICT,
    sender_id           UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    message             TEXT NOT NULL,
    is_read             BOOLEAN NOT NULL DEFAULT FALSE,
    read_at             TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_message_not_blank CHECK (char_length(btrim(message)) > 0),
    CONSTRAINT chk_message_length CHECK (char_length(message) <= 2000),
    CONSTRAINT chk_message_read_state CHECK (is_read = (read_at IS NOT NULL))
);

CREATE INDEX IF NOT EXISTS idx_messages_conversation_created
    ON messages (conversation_id, created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_messages_unread
    ON messages (conversation_id, sender_id)
    WHERE is_read = FALSE;
CREATE INDEX IF NOT EXISTS idx_messages_sender
    ON messages (sender_id);

-- 3. Only the two people in a conversation can be the sender of its messages.
CREATE OR REPLACE FUNCTION enforce_message_sender() RETURNS trigger AS $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM conversations c
        WHERE c.id = NEW.conversation_id
          AND NEW.sender_id IN (c.parent_user_id, c.social_worker_id)
    ) THEN
        RAISE EXCEPTION 'The sender must take part in the conversation.' USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
END
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_messages_enforce_sender ON messages;
CREATE TRIGGER trg_messages_enforce_sender
    BEFORE INSERT ON messages
    FOR EACH ROW EXECUTE FUNCTION enforce_message_sender();

-- 4. Sent messages are history: only the read state may change, and only from unread to read.
CREATE OR REPLACE FUNCTION protect_message_history() RETURNS trigger AS $$
BEGIN
    IF NEW.conversation_id IS DISTINCT FROM OLD.conversation_id
       OR NEW.sender_id IS DISTINCT FROM OLD.sender_id
       OR NEW.message IS DISTINCT FROM OLD.message
       OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
        RAISE EXCEPTION 'Sent messages cannot be edited.' USING ERRCODE = '23514';
    END IF;
    IF OLD.is_read AND NOT NEW.is_read THEN
        RAISE EXCEPTION 'A message that was read cannot be marked unread.' USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
END
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_messages_protect_history ON messages;
CREATE TRIGGER trg_messages_protect_history
    BEFORE UPDATE ON messages
    FOR EACH ROW EXECUTE FUNCTION protect_message_history();
