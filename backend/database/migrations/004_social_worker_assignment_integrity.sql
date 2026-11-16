-- Makes social worker assignments safe to create and change.
-- Existing assignments are kept as they are. Every statement is idempotent.

-- When a worker is replaced, the old row is kept as history and stamped with the time it ended.
ALTER TABLE social_worker_assignments
    ADD COLUMN IF NOT EXISTS ended_at TIMESTAMPTZ;

-- A child has at most one ACTIVE social worker at a time, so two parents (or two requests)
-- can never leave a child with conflicting or duplicate active assignments.
CREATE UNIQUE INDEX IF NOT EXISTS uq_active_child_assignment
    ON social_worker_assignments (child_id)
    WHERE assignment_status = 'ACTIVE';
