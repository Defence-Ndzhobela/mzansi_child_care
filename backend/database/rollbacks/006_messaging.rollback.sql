-- Rollback for 006_messaging.sql. NOT run automatically: review it, then run it by hand in the
-- Neon SQL editor only if you must undo the migration. Run all of it, in this order.
--
-- WARNING: this permanently deletes every conversation and message. Export them first if they
-- must be kept (for example: SELECT * FROM messages; SELECT * FROM conversations;).

DROP TRIGGER IF EXISTS trg_messages_protect_history ON messages;
DROP TRIGGER IF EXISTS trg_messages_enforce_sender ON messages;
DROP FUNCTION IF EXISTS protect_message_history();
DROP FUNCTION IF EXISTS enforce_message_sender();

DROP TABLE IF EXISTS messages;
DROP TABLE IF EXISTS conversations;

-- Finally forget that the migration ran so it can be applied again later:
DELETE FROM schema_migrations WHERE version = '006_messaging';
