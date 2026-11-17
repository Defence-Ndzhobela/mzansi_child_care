-- Rollback for 007_family_archive.sql. NOT run automatically: review it, then run it by hand in the
-- Neon SQL editor only if you must undo the migration. Run all of it, in this order.
--
-- Dropping the columns discards the archive markers and the saved family snapshots. Archived
-- children would then look like ordinary children with no family links. To restore a family first,
-- re-create its links from children.archived_family before dropping the column.

DROP INDEX IF EXISTS idx_children_archived;
ALTER TABLE children DROP COLUMN IF EXISTS archived_family;
ALTER TABLE children DROP COLUMN IF EXISTS archived_by;
ALTER TABLE children DROP COLUMN IF EXISTS archived_at;

-- Finally forget that the migration ran so it can be applied again later:
DELETE FROM schema_migrations WHERE version = '007_family_archive';
