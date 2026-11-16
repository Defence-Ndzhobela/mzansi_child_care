-- Admin dashboard support. Additive and idempotent: nothing is dropped except the old role
-- CHECK, which is replaced in the same step by a wider one. Existing rows are never changed.
-- Rollback instructions: database/rollbacks/005_admin_dashboard.rollback.sql

-- 1. Allow the ADMIN role. The CHECK is replaced inside one DO block so it is never missing.
DO $$
BEGIN
    ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
    ALTER TABLE users ADD CONSTRAINT users_role_check
        CHECK (role IN ('PARENT_CAREGIVER', 'SOCIAL_WORKER', 'ADMIN'));
END
$$;

-- 2. Professional registration number for social workers (optional, unique when present).
ALTER TABLE users
    ADD COLUMN IF NOT EXISTS registration_number VARCHAR(50);

CREATE UNIQUE INDEX IF NOT EXISTS uq_users_registration_number
    ON users (lower(registration_number))
    WHERE registration_number IS NOT NULL;

-- 3. Link an assignment to a specific maintenance arrangement (optional, so every existing
--    child-level assignment stays valid) and record which administrator ended it.
ALTER TABLE social_worker_assignments
    ADD COLUMN IF NOT EXISTS maintenance_arrangement_id UUID;

ALTER TABLE social_worker_assignments
    ADD COLUMN IF NOT EXISTS ended_by UUID REFERENCES users(id) ON DELETE SET NULL;

-- The composite key guarantees the arrangement belongs to the same child as the assignment.
-- If an arrangement is ever deleted only the arrangement link is cleared (needs PostgreSQL 15+).
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_assignment_arrangement_child'
    ) THEN
        ALTER TABLE social_worker_assignments
            ADD CONSTRAINT fk_assignment_arrangement_child
            FOREIGN KEY (maintenance_arrangement_id, child_id)
            REFERENCES maintenance_arrangements (id, child_id)
            ON DELETE SET NULL (maintenance_arrangement_id);
    END IF;
END
$$;

-- 4. Indexes for the admin lists. Duplicate active assignments are already impossible:
--    uq_active_child_assignment (migration 004) allows one ACTIVE row per child, which also
--    covers any (worker, child, arrangement) combination.
CREATE INDEX IF NOT EXISTS idx_sw_assignments_arrangement
    ON social_worker_assignments (maintenance_arrangement_id)
    WHERE maintenance_arrangement_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_sw_assignments_assigned_by
    ON social_worker_assignments (assigned_by);

CREATE INDEX IF NOT EXISTS idx_users_role_status
    ON users (role, account_status);
