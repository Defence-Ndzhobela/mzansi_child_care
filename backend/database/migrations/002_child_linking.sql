ALTER TABLE children
    ADD COLUMN IF NOT EXISTS national_id_lookup_hash CHAR(64);

CREATE UNIQUE INDEX IF NOT EXISTS uq_children_national_id_lookup_hash
    ON children (national_id_lookup_hash)
    WHERE national_id_lookup_hash IS NOT NULL;

CREATE TABLE IF NOT EXISTS child_link_requests (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    child_id            UUID NOT NULL REFERENCES children(id) ON DELETE CASCADE,
    requester_user_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    relationship_type   VARCHAR(50) NOT NULL
                        CHECK (relationship_type IN (
                            'MOTHER',
                            'FATHER',
                            'PRIMARY_CAREGIVER',
                            'PAYING_PARENT',
                            'LEGAL_GUARDIAN',
                            'EXTENDED_FAMILY_CAREGIVER'
                        )),
    status              VARCHAR(20) NOT NULL DEFAULT 'PENDING'
                        CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
    requested_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    reviewed_by         UUID REFERENCES users(id) ON DELETE SET NULL,
    responded_at        TIMESTAMPTZ,
    CONSTRAINT chk_link_request_not_self
        CHECK (reviewed_by IS NULL OR reviewed_by <> requester_user_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_pending_child_link_request
    ON child_link_requests (child_id, requester_user_id)
    WHERE status = 'PENDING';

CREATE INDEX IF NOT EXISTS idx_child_link_requests_owner_pending
    ON child_link_requests (child_id, status, requested_at DESC);

CREATE INDEX IF NOT EXISTS idx_child_link_requests_requester
    ON child_link_requests (requester_user_id, requested_at DESC);
