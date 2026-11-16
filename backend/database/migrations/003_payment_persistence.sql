-- Persists maintenance arrangements, payments, confirmations and evidence metadata.
-- Every statement is idempotent so an interrupted run can be repeated safely.

-- The deployed database names the evidence location column storage_key. Databases built
-- from the original schema still call it file_url, so align them with the deployed name.
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'payment_evidence' AND column_name = 'file_url'
    ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'payment_evidence' AND column_name = 'storage_key'
    ) THEN
        ALTER TABLE payment_evidence RENAME COLUMN file_url TO storage_key;
    END IF;
END
$$;

ALTER TABLE maintenance_arrangements
    ADD COLUMN IF NOT EXISTS notes TEXT;

ALTER TABLE payment_evidence
    ADD COLUMN IF NOT EXISTS file_type VARCHAR(100);

ALTER TABLE payment_evidence
    ADD COLUMN IF NOT EXISTS file_size_label VARCHAR(30);

-- A payment can only be created with the paying and receiving users of its arrangement.
ALTER TABLE maintenance_arrangements
    DROP CONSTRAINT IF EXISTS uq_arrangement_parties;

ALTER TABLE maintenance_arrangements
    ADD CONSTRAINT uq_arrangement_parties UNIQUE (id, paying_user_id, receiving_user_id);

ALTER TABLE payments
    DROP CONSTRAINT IF EXISTS fk_payment_arrangement_parties;

ALTER TABLE payments
    ADD CONSTRAINT fk_payment_arrangement_parties
    FOREIGN KEY (arrangement_id, paying_user_id, receiving_user_id)
    REFERENCES maintenance_arrangements (id, paying_user_id, receiving_user_id)
    ON DELETE RESTRICT;

ALTER TABLE payments
    DROP CONSTRAINT IF EXISTS uq_payment_id_receiver;

ALTER TABLE payments
    ADD CONSTRAINT uq_payment_id_receiver UNIQUE (id, receiving_user_id);

-- One recorded decision per payment. The composite key means only the payment's
-- receiving user can be stored as the decision maker.
CREATE TABLE IF NOT EXISTS payment_confirmations (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payment_id          UUID NOT NULL,
    decided_by          UUID NOT NULL,
    decision            VARCHAR(20) NOT NULL
                        CHECK (decision IN ('CONFIRMED_FULL', 'CONFIRMED_PARTIAL', 'DISPUTED')),
    confirmed_amount    DECIMAL(12,2) NOT NULL CHECK (confirmed_amount >= 0),
    note                TEXT,
    decided_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_payment_confirmations_payment UNIQUE (payment_id),
    CONSTRAINT fk_confirmation_payment_receiver
        FOREIGN KEY (payment_id, decided_by)
        REFERENCES payments (id, receiving_user_id)
        ON DELETE CASCADE,
    CONSTRAINT chk_dispute_has_reason
        CHECK (decision <> 'DISPUTED' OR char_length(trim(COALESCE(note, ''))) > 0)
);

CREATE INDEX IF NOT EXISTS idx_payment_confirmations_decided_by
    ON payment_confirmations (decided_by);

-- At most one active arrangement per child, paying user and receiving user.
CREATE UNIQUE INDEX IF NOT EXISTS uq_active_arrangement_parties
    ON maintenance_arrangements (child_id, paying_user_id, receiving_user_id)
    WHERE status = 'ACTIVE';
