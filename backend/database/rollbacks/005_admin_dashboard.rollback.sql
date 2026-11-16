-- Rollback for 005_admin_dashboard.sql. NOT run automatically: review it, then run it by hand in the
-- Neon SQL editor only if you must undo the migration. Run all of it, in this order.
--
-- Before you start:
--   * Any ADMIN accounts must be deleted or changed first, or re-adding the role CHECK will fail:
--       DELETE FROM users WHERE role = 'ADMIN';
--   * Dropping the columns discards the registration numbers and the arrangement/ended_by links
--     recorded since the migration. Export them first if you need them.

DROP INDEX IF EXISTS idx_users_role_status;
DROP INDEX IF EXISTS idx_sw_assignments_assigned_by;
DROP INDEX IF EXISTS idx_sw_assignments_arrangement;

ALTER TABLE social_worker_assignments DROP CONSTRAINT IF EXISTS fk_assignment_arrangement_child;
ALTER TABLE social_worker_assignments DROP COLUMN IF EXISTS ended_by;
ALTER TABLE social_worker_assignments DROP COLUMN IF EXISTS maintenance_arrangement_id;

DROP INDEX IF EXISTS uq_users_registration_number;
ALTER TABLE users DROP COLUMN IF EXISTS registration_number;

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check
    CHECK (role IN ('PARENT_CAREGIVER', 'SOCIAL_WORKER'));

-- Finally forget that the migration ran so it can be applied again later:
DELETE FROM schema_migrations WHERE version = '005_admin_dashboard';
