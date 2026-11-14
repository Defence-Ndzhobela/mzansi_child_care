-- ============================================================================
-- MZANSI CHILDCARE — POSTGRESQL DATABASE SCHEMA (9 TABLES)
-- ============================================================================
-- Purpose: Backend database design for tracking child maintenance
--          arrangements, payment submissions, recipient confirmations,
--          payment evidence metadata, and social worker case reviews.
-- Currency: South African Rand (ZAR) stored as DECIMAL(12,2).
-- Note:    Authentication uses this database. The current dashboard prototype
--          still uses localStorage and fictional demo data only.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ----------------------------------------------------------------------------
-- 1. USERS
-- Stores parents, caregivers, and authorised social workers.
-- Role is strictly limited to PARENT_CAREGIVER or SOCIAL_WORKER.
-- ----------------------------------------------------------------------------
CREATE TABLE users (
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

CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_email ON users(email);

-- ----------------------------------------------------------------------------
-- 2. CHILDREN
-- Stores child profiles created by a parent or caregiver.
-- ----------------------------------------------------------------------------
CREATE TABLE children (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    first_name      VARCHAR(100) NOT NULL,
    last_name       VARCHAR(100) NOT NULL,
    date_of_birth   DATE NOT NULL CHECK (date_of_birth <= CURRENT_DATE),
    created_by      UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_children_created_by ON children(created_by);
CREATE INDEX idx_children_name ON children(last_name, first_name);

-- ----------------------------------------------------------------------------
-- 3. FAMILY_RELATIONSHIPS
-- Many-to-many junction table connecting users (parents/caregivers) to children.
--
-- DESIGN NOTE — Multi-child & Multi-caregiver support:
-- * One parent/caregiver can be connected to multiple children because a single
--   user_id can appear across multiple rows with different child_id values.
-- * One child can have more than one authorised caregiver (e.g. a mother,
--   father, grandmother, or legal guardian) because a single child_id can be
--   linked to multiple user_id records with distinct relationship_type roles.
-- ----------------------------------------------------------------------------
CREATE TABLE family_relationships (
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

CREATE INDEX idx_family_rel_child ON family_relationships(child_id);
CREATE INDEX idx_family_rel_user ON family_relationships(user_id);

-- ----------------------------------------------------------------------------
-- 4. MAINTENANCE_ARRANGEMENTS
-- Records the expected child maintenance contribution between a paying user
-- and a receiving user for a specific child.
-- Composite UNIQUE (id, child_id) enables strict child consistency in payments.
-- ----------------------------------------------------------------------------
CREATE TABLE maintenance_arrangements (
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

CREATE INDEX idx_arrangements_child ON maintenance_arrangements(child_id);
CREATE INDEX idx_arrangements_paying_user ON maintenance_arrangements(paying_user_id);
CREATE INDEX idx_arrangements_receiving_user ON maintenance_arrangements(receiving_user_id);
CREATE INDEX idx_arrangements_status ON maintenance_arrangements(status);

-- ----------------------------------------------------------------------------
-- 5. PAYMENTS
-- Records individual maintenance contributions, confirmations, and disputes.
--
-- DESIGN NOTE — Enforcing child_id consistency with maintenance_arrangements:
-- The composite foreign key fk_payment_arrangement_child references
-- maintenance_arrangements(id, child_id). PostgreSQL guarantees at the database
-- engine level that a payment's child_id MUST match the child_id on its
-- parent maintenance arrangement—preventing cross-child misattribution.
-- ----------------------------------------------------------------------------
CREATE TABLE payments (
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

CREATE INDEX idx_payments_arrangement ON payments(arrangement_id);
CREATE INDEX idx_payments_child ON payments(child_id);
CREATE INDEX idx_payments_paying_user ON payments(paying_user_id);
CREATE INDEX idx_payments_receiving_user ON payments(receiving_user_id);
CREATE INDEX idx_payments_date ON payments(payment_date DESC);
CREATE INDEX idx_payments_status ON payments(status);

-- ----------------------------------------------------------------------------
-- 6. PAYMENT_EVIDENCE
-- Keeps payment evidence metadata separate from payment records.
-- Uploaded files live in object storage; only metadata and file_url are stored.
-- ----------------------------------------------------------------------------
CREATE TABLE payment_evidence (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payment_id      UUID NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
    uploaded_by     UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    file_name       VARCHAR(255) NOT NULL,
    file_url        TEXT NOT NULL,
    description     TEXT,
    uploaded_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_evidence_payment ON payment_evidence(payment_id);
CREATE INDEX idx_evidence_uploaded_by ON payment_evidence(uploaded_by);

-- ----------------------------------------------------------------------------
-- 7. SOCIAL_WORKER_ASSIGNMENTS
-- Restricts social workers to only explicitly assigned child/family cases.
-- Partial unique index prevents duplicate ACTIVE assignments for the same
-- social worker and child while preserving historical closed assignments.
-- ----------------------------------------------------------------------------
CREATE TABLE social_worker_assignments (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    social_worker_id    UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    child_id            UUID NOT NULL REFERENCES children(id) ON DELETE CASCADE,
    assigned_by         UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    assignment_status   VARCHAR(20) NOT NULL DEFAULT 'ACTIVE'
                        CHECK (assignment_status IN ('ACTIVE', 'CLOSED', 'TRANSFERRED')),
    assigned_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX uq_active_sw_assignment
    ON social_worker_assignments(social_worker_id, child_id)
    WHERE assignment_status = 'ACTIVE';

CREATE INDEX idx_sw_assignments_worker ON social_worker_assignments(social_worker_id);
CREATE INDEX idx_sw_assignments_child ON social_worker_assignments(child_id);

-- ----------------------------------------------------------------------------
-- 8. PAYMENT_REVIEWS
-- Tracks social worker review decisions and information requests on payments.
-- ----------------------------------------------------------------------------
CREATE TABLE payment_reviews (
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

CREATE INDEX idx_payment_reviews_payment ON payment_reviews(payment_id);
CREATE INDEX idx_payment_reviews_reviewer ON payment_reviews(reviewed_by);
CREATE INDEX idx_payment_reviews_status ON payment_reviews(review_status);

-- ----------------------------------------------------------------------------
-- 9. PROFESSIONAL_NOTES
-- Records case observations entered by an assigned social worker for a child.
-- ----------------------------------------------------------------------------
CREATE TABLE professional_notes (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    social_worker_id    UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    child_id            UUID NOT NULL REFERENCES children(id) ON DELETE CASCADE,
    note                TEXT NOT NULL CHECK (char_length(trim(note)) > 0),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_prof_notes_child ON professional_notes(child_id);
CREATE INDEX idx_prof_notes_worker ON professional_notes(social_worker_id);

-- ============================================================================
-- SAMPLE FICTIONAL DEMO DATA (INSERT STATEMENTS)
-- All names, emails, and figures are strictly fictional demonstration data.
-- Demo password for these accounts: Demo@12345. Never use these accounts in production.
-- ============================================================================

INSERT INTO users (id, full_name, email, password_hash, phone, role, account_status) VALUES
    ('11111111-1111-4111-8111-111111111101', 'Thandiwe Mokoena', 'parent@demo.co.za', crypt('Demo@12345', gen_salt('bf', 12)), '+27 82 555 0141', 'PARENT_CAREGIVER', 'ACTIVE'),
    ('11111111-1111-4111-8111-111111111102', 'Sipho Mokoena', 'sipho@demo.co.za', crypt('Demo@12345', gen_salt('bf', 12)), '+27 83 555 0198', 'PARENT_CAREGIVER', 'ACTIVE'),
    ('11111111-1111-4111-8111-111111111103', 'Nomsa Dlamini', 'worker@demo.co.za', crypt('Demo@12345', gen_salt('bf', 12)), '+27 11 555 0110', 'SOCIAL_WORKER', 'ACTIVE'),
    ('11111111-1111-4111-8111-111111111104', 'Lerato Khumalo', 'lerato.khumalo@demo.co.za', crypt('Demo@12345', gen_salt('bf', 12)), '+27 72 555 0175', 'PARENT_CAREGIVER', 'ACTIVE'),
    ('11111111-1111-4111-8111-111111111105', 'Kabelo Khumalo', 'kabelo.khumalo@demo.co.za', crypt('Demo@12345', gen_salt('bf', 12)), '+27 76 555 0162', 'PARENT_CAREGIVER', 'ACTIVE');

INSERT INTO children (id, first_name, last_name, date_of_birth, created_by) VALUES
    ('22222222-2222-4222-8222-222222222201', 'Thabo', 'Mokoena', '2018-04-14', '11111111-1111-4111-8111-111111111101'),
    ('22222222-2222-4222-8222-222222222202', 'Lindiwe', 'Mokoena', '2021-09-03', '11111111-1111-4111-8111-111111111101'),
    ('22222222-2222-4222-8222-222222222203', 'Amahle', 'Khumalo', '2017-01-22', '11111111-1111-4111-8111-111111111104');

INSERT INTO family_relationships (id, child_id, user_id, relationship_type, is_primary_caregiver) VALUES
    ('33333333-3333-4333-8333-333333333301', '22222222-2222-4222-8222-222222222201', '11111111-1111-4111-8111-111111111101', 'MOTHER', TRUE),
    ('33333333-3333-4333-8333-333333333302', '22222222-2222-4222-8222-222222222201', '11111111-1111-4111-8111-111111111102', 'FATHER', FALSE),
    ('33333333-3333-4333-8333-333333333303', '22222222-2222-4222-8222-222222222202', '11111111-1111-4111-8111-111111111101', 'MOTHER', TRUE),
    ('33333333-3333-4333-8333-333333333304', '22222222-2222-4222-8222-222222222202', '11111111-1111-4111-8111-111111111102', 'FATHER', FALSE),
    ('33333333-3333-4333-8333-333333333305', '22222222-2222-4222-8222-222222222203', '11111111-1111-4111-8111-111111111104', 'MOTHER', TRUE),
    ('33333333-3333-4333-8333-333333333306', '22222222-2222-4222-8222-222222222203', '11111111-1111-4111-8111-111111111105', 'FATHER', FALSE);

INSERT INTO maintenance_arrangements (id, child_id, paying_user_id, receiving_user_id, expected_amount, currency, frequency, start_date, status) VALUES
    ('44444444-4444-4444-8444-444444444401', '22222222-2222-4222-8222-222222222201', '11111111-1111-4111-8111-111111111102', '11111111-1111-4111-8111-111111111101', 1500.00, 'ZAR', 'MONTHLY', '2026-01-01', 'ACTIVE'),
    ('44444444-4444-4444-8444-444444444402', '22222222-2222-4222-8222-222222222202', '11111111-1111-4111-8111-111111111102', '11111111-1111-4111-8111-111111111101', 1200.00, 'ZAR', 'MONTHLY', '2026-01-01', 'ACTIVE'),
    ('44444444-4444-4444-8444-444444444403', '22222222-2222-4222-8222-222222222203', '11111111-1111-4111-8111-111111111105', '11111111-1111-4111-8111-111111111104', 1800.00, 'ZAR', 'MONTHLY', '2026-02-01', 'ACTIVE');

INSERT INTO payments (id, arrangement_id, child_id, paying_user_id, receiving_user_id, amount, confirmed_amount, currency, payment_date, payment_method, payment_reference, status) VALUES
    ('55555555-5555-4555-8555-555555555501', '44444444-4444-4444-8444-444444444401', '22222222-2222-4222-8222-222222222201', '11111111-1111-4111-8111-111111111102', '11111111-1111-4111-8111-111111111101', 1000.00, 1000.00, 'ZAR', '2026-11-02', 'EFT_BANK_TRANSFER', 'EFT-NOV-THABO-01', 'CONFIRMED_BY_RECIPIENT'),
    ('55555555-5555-4555-8555-555555555502', '44444444-4444-4444-8444-444444444402', '22222222-2222-4222-8222-222222222202', '11111111-1111-4111-8111-111111111102', '11111111-1111-4111-8111-111111111101', 1200.00, NULL, 'ZAR', '2026-11-08', 'E_WALLET_INSTANT_MONEY', 'EW-NOV-LINDIWE-09', 'AWAITING_CONFIRMATION'),
    ('55555555-5555-4555-8555-555555555503', '44444444-4444-4444-8444-444444444403', '22222222-2222-4222-8222-222222222203', '11111111-1111-4111-8111-111111111105', '11111111-1111-4111-8111-111111111104', 1800.00, 900.00, 'ZAR', '2026-11-04', 'RETAIL_MONEY_TRANSFER', 'RMT-NOV-AMAHLE-04', 'DISPUTED');

INSERT INTO payment_evidence (id, payment_id, uploaded_by, file_name, file_url, description) VALUES
    ('66666666-6666-4666-8666-666666666601', '55555555-5555-4555-8555-555555555501', '11111111-1111-4111-8111-111111111102', 'eft_receipt_nov_2026.pdf', 'https://storage.example.invalid/demo-evidence/eft_receipt_nov_2026.pdf', 'EFT payment confirmation slip uploaded by paying parent'),
    ('66666666-6666-4666-8666-666666666602', '55555555-5555-4555-8555-555555555502', '11111111-1111-4111-8111-111111111102', 'ewallet_sms_screenshot.png', 'https://storage.example.invalid/demo-evidence/ewallet_sms_screenshot.png', 'Instant money voucher reference screenshot'),
    ('66666666-6666-4666-8666-666666666603', '55555555-5555-4555-8555-555555555503', '11111111-1111-4111-8111-111111111105', 'till_slip_nov_04.jpg', 'https://storage.example.invalid/demo-evidence/till_slip_nov_04.jpg', 'Retail money transfer slip submitted by Kabelo Khumalo');

INSERT INTO social_worker_assignments (id, social_worker_id, child_id, assigned_by, assignment_status) VALUES
    ('77777777-7777-4777-8777-777777777701', '11111111-1111-4111-8111-111111111103', '22222222-2222-4222-8222-222222222201', '11111111-1111-4111-8111-111111111103', 'ACTIVE'),
    ('77777777-7777-4777-8777-777777777702', '11111111-1111-4111-8111-111111111103', '22222222-2222-4222-8222-222222222202', '11111111-1111-4111-8111-111111111103', 'ACTIVE'),
    ('77777777-7777-4777-8777-777777777703', '11111111-1111-4111-8111-111111111103', '22222222-2222-4222-8222-222222222203', '11111111-1111-4111-8111-111111111103', 'ACTIVE');

INSERT INTO payment_reviews (id, payment_id, reviewed_by, review_status, review_notes) VALUES
    ('88888888-8888-4888-8888-888888888801', '55555555-5555-4555-8555-555555555501', '11111111-1111-4111-8111-111111111103', 'REVIEWED', 'Confirmed R1,000.00 against R1,500.00 monthly arrangement. R500.00 balance noted for follow-up.'),
    ('88888888-8888-4888-8888-888888888802', '55555555-5555-4555-8555-555555555503', '11111111-1111-4111-8111-111111111103', 'ADDITIONAL_INFO_REQUESTED', 'Discrepancy reported between R1,800.00 submitted and R900.00 collected. Requested clearer copy of collection receipt.');

INSERT INTO professional_notes (id, social_worker_id, child_id, note) VALUES
    ('99999999-9999-4999-8999-999999999901', '11111111-1111-4111-8111-111111111103', '22222222-2222-4222-8222-222222222201', 'Primary caregiver confirmed partial November contribution of R1,000.00 for Thabo Mokoena. Follow-up check-in scheduled for 20 November 2026.'),
    ('99999999-9999-4999-8999-999999999902', '11111111-1111-4111-8111-111111111103', '22222222-2222-4222-8222-222222222203', 'Requested additional receipt verification from both caregivers regarding the disputed November retail transfer.');
