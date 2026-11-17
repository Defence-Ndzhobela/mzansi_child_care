-- Archiving a family. Additive and idempotent: three nullable columns and one index on children.
-- Nothing is dropped and no existing row changes. Rollback: database/rollbacks/007_family_archive.rollback.sql
--
-- An archived child keeps its row, so payments, evidence, confirmations, reviews, notes, messages and
-- assignment history all stay valid. The family links removed at archive time are copied into
-- archived_family first, so who belonged to the family is never lost.
ALTER TABLE children
    ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;

ALTER TABLE children
    ADD COLUMN IF NOT EXISTS archived_by UUID REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE children
    ADD COLUMN IF NOT EXISTS archived_family JSONB;

CREATE INDEX IF NOT EXISTS idx_children_archived
    ON children (archived_at)
    WHERE archived_at IS NOT NULL;
