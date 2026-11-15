-- 001_initial_schema: the original nine application tables.
-- Idempotent. On a database that already has these tables the migration runner
-- records this version without executing it.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS users (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    full_name       VARCHAR(150) NOT NULL,
    email           VARCHAR(255) NOT NULL UNIQUE,
    password_hash   TEXT NOT NULL,
    phone           VARCHAR(30),
    role            VARCHAR(30) NOT NULL
                    CHECK (role IN ('PARENT_CAREGIVER', 'SOCIAL_WORKER')),
    account_status  VARCHAR(20) NOT NULL DEFAULT 'ACTIVE'
                    CHECK (account_status IN ('ACTIVE', 'INACTIVE', 'SUSPENDED')),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

CREATE TABLE IF NOT EXISTS children (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    first_name      VARCHAR(100) NOT NULL,
    last_name       VARCHAR(100) NOT NULL,
    date_of_birth   DATE NOT NULL CHECK (date_of_birth <= CURRENT_DATE),
    created_by      UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_children_created_by ON children(created_by);
CREATE INDEX IF NOT EXISTS idx_children_name ON children(last_name, first_name);

CREATE TABLE IF NOT EXISTS family_relationships (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    child_id                UUID NOT NULL REFERENCES children(id) ON DELETE CASCADE,
    user_id                 UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    relationship_type       VARCHAR(50) NOT NULL
                            CHECK (relationship_type IN (
                                'MOTHER',
                                'FATHER',
                                'PRIMARY_CAREGIVER',
                                'PAYING_PARENT',
                                'LEGAL_GUARDIAN',
                                'EXTENDED_FAMILY_CAREGIVER'
                            )),
    is_primary_caregiver    BOOLEAN NOT NULL DEFAULT FALSE,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_family_relationship UNIQUE (child_id, user_id, relationship_type)
);

CREATE INDEX IF NOT EXISTS idx_family_rel_child ON family_relationships(child_id);
CREATE INDEX IF NOT EXISTS idx_family_rel_user ON family_relationships(user_id);

CREATE TABLE IF NOT EXISTS maintenance_arrangements (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    child_id            UUID NOT NULL REFERENCES children(id) ON DELETE CASCADE,
    paying_user_id      UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    receiving_user_id   UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    expected_amount     DECIMAL(12,2) NOT NULL CHECK (expected_amount > 0),
    currency            CHAR(3) NOT NULL DEFAULT 'ZAR' CHECK (currency = 'ZAR'),
    frequency           VARCHAR(20) NOT NULL DEFAULT 'MONTHLY'
                        CHECK (frequency IN ('WEEKLY', 'FORTNIGHTLY', 'MONTHLY')),
    start_date          DATE NOT NULL,
    end_date            DATE,
    status              VARCHAR(20) NOT NULL DEFAULT 'ACTIVE'
                        CHECK (status IN ('ACTIVE', 'PAUSED', 'COMPLETED', 'CANCELLED')),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_different_parties CHECK (paying_user_id <> receiving_user_id),
    CONSTRAINT chk_valid_date_range CHECK (end_date IS NULL OR end_date >= start_date),
    CONSTRAINT uq_arrangement_id_child UNIQUE (id, child_id)
);

CREATE INDEX IF NOT EXISTS idx_arrangements_child ON maintenance_arrangements(child_id);
CREATE INDEX IF NOT EXISTS idx_arrangements_paying_user ON maintenance_arrangements(paying_user_id);
CREATE INDEX IF NOT EXISTS idx_arrangements_receiving_user ON maintenance_arrangements(receiving_user_id);
CREATE INDEX IF NOT EXISTS idx_arrangements_status ON maintenance_arrangements(status);

CREATE TABLE IF NOT EXISTS payments (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    arrangement_id      UUID NOT NULL,
    child_id            UUID NOT NULL REFERENCES children(id) ON DELETE RESTRICT,
    paying_user_id      UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    receiving_user_id   UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    amount              DECIMAL(12,2) NOT NULL CHECK (amount > 0),
    confirmed_amount    DECIMAL(12,2) CHECK (confirmed_amount IS NULL OR (confirmed_amount >= 0 AND confirmed_amount <= amount)),
    currency            CHAR(3) NOT NULL DEFAULT 'ZAR' CHECK (currency = 'ZAR'),
    payment_date        DATE NOT NULL,
    payment_method      VARCHAR(40) NOT NULL
                        CHECK (payment_method IN (
                            'EFT_BANK_TRANSFER',
                            'E_WALLET_INSTANT_MONEY',
                            'CASH_WITH_RECEIPT',
                            'RETAIL_MONEY_TRANSFER',
                            'OTHER'
                        )),
    payment_reference   VARCHAR(120),
    status              VARCHAR(30) NOT NULL DEFAULT 'SUBMITTED'
                        CHECK (status IN (
                            'SUBMITTED',
                            'AWAITING_CONFIRMATION',
                            'CONFIRMED_BY_RECIPIENT',
                            'PARTIALLY_CONFIRMED',
                            'DISPUTED'
                        )),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_payment_parties CHECK (paying_user_id <> receiving_user_id),
    CONSTRAINT fk_payment_arrangement_child
        FOREIGN KEY (arrangement_id, child_id)
        REFERENCES maintenance_arrangements(id, child_id)
        ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_payments_arrangement ON payments(arrangement_id);
CREATE INDEX IF NOT EXISTS idx_payments_child ON payments(child_id);
CREATE INDEX IF NOT EXISTS idx_payments_paying_user ON payments(paying_user_id);
CREATE INDEX IF NOT EXISTS idx_payments_receiving_user ON payments(receiving_user_id);
CREATE INDEX IF NOT EXISTS idx_payments_date ON payments(payment_date DESC);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);

CREATE TABLE IF NOT EXISTS payment_evidence (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payment_id      UUID NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
    uploaded_by     UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    file_name       VARCHAR(255) NOT NULL,
    file_url        TEXT NOT NULL,
    description     TEXT,
    uploaded_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_evidence_payment ON payment_evidence(payment_id);
CREATE INDEX IF NOT EXISTS idx_evidence_uploaded_by ON payment_evidence(uploaded_by);

CREATE TABLE IF NOT EXISTS social_worker_assignments (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    social_worker_id    UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    child_id            UUID NOT NULL REFERENCES children(id) ON DELETE CASCADE,
    assigned_by         UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    assignment_status   VARCHAR(20) NOT NULL DEFAULT 'ACTIVE'
                        CHECK (assignment_status IN ('ACTIVE', 'CLOSED', 'TRANSFERRED')),
    assigned_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_active_sw_assignment
    ON social_worker_assignments(social_worker_id, child_id)
    WHERE assignment_status = 'ACTIVE';

CREATE INDEX IF NOT EXISTS idx_sw_assignments_worker ON social_worker_assignments(social_worker_id);
CREATE INDEX IF NOT EXISTS idx_sw_assignments_child ON social_worker_assignments(child_id);

CREATE TABLE IF NOT EXISTS payment_reviews (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payment_id      UUID NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
    reviewed_by     UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    review_status   VARCHAR(40) NOT NULL DEFAULT 'PENDING_REVIEW'
                    CHECK (review_status IN (
                        'PENDING_REVIEW',
                        'REVIEWED',
                        'ADDITIONAL_INFO_REQUESTED',
                        'CONCERN_NOTED'
                    )),
    review_notes    TEXT NOT NULL,
    reviewed_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payment_reviews_payment ON payment_reviews(payment_id);
CREATE INDEX IF NOT EXISTS idx_payment_reviews_reviewer ON payment_reviews(reviewed_by);
CREATE INDEX IF NOT EXISTS idx_payment_reviews_status ON payment_reviews(review_status);

CREATE TABLE IF NOT EXISTS professional_notes (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    social_worker_id    UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    child_id            UUID NOT NULL REFERENCES children(id) ON DELETE CASCADE,
    note                TEXT NOT NULL CHECK (char_length(trim(note)) > 0),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_prof_notes_child ON professional_notes(child_id);
CREATE INDEX IF NOT EXISTS idx_prof_notes_worker ON professional_notes(social_worker_id);
