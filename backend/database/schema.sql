-- ============================================================================
-- MZANSI CHILDCARE — POSTGRESQL DATABASE SCHEMA (13 APPLICATION TABLES)
-- ============================================================================
-- Purpose: Backend database design for tracking child maintenance
--          arrangements, payment submissions, recipient confirmations,
--          payment evidence metadata, and social worker case reviews.
-- Currency: South African Rand (ZAR) stored as DECIMAL(12,2).
-- Note:    Authentication, child profiles/linking, maintenance arrangements,
--          payments, confirmations and evidence metadata all use this database
--          through the API. Social worker reviews and notes are still frontend
--          demo data. This file shows the final schema: existing databases get
--          changes through database/migrations (003_payment_persistence.sql).
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ----------------------------------------------------------------------------
-- 1. USERS
-- Stores parents, caregivers, and authorised social workers.
-- Role is limited to PARENT_CAREGIVER, SOCIAL_WORKER or ADMIN. Public registration can only
-- ever create PARENT_CAREGIVER; ADMIN accounts come from `npm run admin:seed`.
-- ----------------------------------------------------------------------------
CREATE TABLE users (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    full_name       VARCHAR(150) NOT NULL,
    email           VARCHAR(255) NOT NULL UNIQUE,
    password_hash   TEXT NOT NULL,
    phone           VARCHAR(30),
    registration_number VARCHAR(50),
    role            VARCHAR(30) NOT NULL
                    CHECK (role IN ('PARENT_CAREGIVER', 'SOCIAL_WORKER', 'ADMIN')),
    account_status  VARCHAR(20) NOT NULL DEFAULT 'ACTIVE'
                    CHECK (account_status IN ('ACTIVE', 'INACTIVE', 'SUSPENDED')),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role_status ON users(role, account_status);
CREATE UNIQUE INDEX uq_users_registration_number
    ON users (lower(registration_number)) WHERE registration_number IS NOT NULL;

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
    national_id_lookup_hash CHAR(64),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    -- Set when an administrator archives the family (migration 007). The removed family links are
    -- copied into archived_family so history is kept.
    archived_at     TIMESTAMPTZ,
    archived_by     UUID REFERENCES users(id) ON DELETE SET NULL,
    archived_family JSONB
);

CREATE INDEX idx_children_created_by ON children(created_by);
CREATE INDEX idx_children_name ON children(last_name, first_name);
CREATE UNIQUE INDEX uq_children_national_id_lookup_hash
    ON children(national_id_lookup_hash)
    WHERE national_id_lookup_hash IS NOT NULL;

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
-- 4. CHILD_LINK_REQUESTS
-- Keeps child ID numbers out of requests; parent approval authorizes each link.
-- ----------------------------------------------------------------------------
CREATE TABLE child_link_requests (
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

CREATE UNIQUE INDEX uq_pending_child_link_request
    ON child_link_requests (child_id, requester_user_id)
    WHERE status = 'PENDING';
CREATE INDEX idx_child_link_requests_owner_pending
    ON child_link_requests (child_id, status, requested_at DESC);
CREATE INDEX idx_child_link_requests_requester
    ON child_link_requests (requester_user_id, requested_at DESC);

-- ----------------------------------------------------------------------------
-- 5. MAINTENANCE_ARRANGEMENTS
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
    notes               TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_different_parties CHECK (paying_user_id <> receiving_user_id),
    CONSTRAINT chk_valid_date_range CHECK (end_date IS NULL OR end_date >= start_date),
    CONSTRAINT uq_arrangement_id_child UNIQUE (id, child_id),
    CONSTRAINT uq_arrangement_parties UNIQUE (id, paying_user_id, receiving_user_id)
);

CREATE INDEX idx_arrangements_child ON maintenance_arrangements(child_id);
CREATE INDEX idx_arrangements_paying_user ON maintenance_arrangements(paying_user_id);
CREATE INDEX idx_arrangements_receiving_user ON maintenance_arrangements(receiving_user_id);
CREATE INDEX idx_arrangements_status ON maintenance_arrangements(status);
CREATE UNIQUE INDEX uq_active_arrangement_parties
    ON maintenance_arrangements (child_id, paying_user_id, receiving_user_id)
    WHERE status = 'ACTIVE';

-- ----------------------------------------------------------------------------
-- 6. PAYMENTS
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
        ON DELETE RESTRICT,
    -- A payment always carries the paying and receiving users of its arrangement.
    CONSTRAINT fk_payment_arrangement_parties
        FOREIGN KEY (arrangement_id, paying_user_id, receiving_user_id)
        REFERENCES maintenance_arrangements(id, paying_user_id, receiving_user_id)
        ON DELETE RESTRICT,
    CONSTRAINT uq_payment_id_receiver UNIQUE (id, receiving_user_id)
);

CREATE INDEX idx_payments_arrangement ON payments(arrangement_id);
CREATE INDEX idx_payments_child ON payments(child_id);
CREATE INDEX idx_payments_paying_user ON payments(paying_user_id);
CREATE INDEX idx_payments_receiving_user ON payments(receiving_user_id);
CREATE INDEX idx_payments_date ON payments(payment_date DESC);
CREATE INDEX idx_payments_status ON payments(status);

-- ----------------------------------------------------------------------------
-- 7. PAYMENT_EVIDENCE
-- Keeps payment evidence metadata separate from payment records.
-- Uploaded files are not stored yet; only metadata and a storage_key reference are kept.
-- ----------------------------------------------------------------------------
CREATE TABLE payment_evidence (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payment_id      UUID NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
    uploaded_by     UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    file_name       VARCHAR(255) NOT NULL,
    storage_key     TEXT NOT NULL,
    file_type       VARCHAR(100),
    file_size_label VARCHAR(30),
    description     TEXT,
    uploaded_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_evidence_payment ON payment_evidence(payment_id);
CREATE INDEX idx_evidence_uploaded_by ON payment_evidence(uploaded_by);

-- ----------------------------------------------------------------------------
-- 7b. PAYMENT_CONFIRMATIONS
-- The receiving parent's single decision on a payment: confirmed in full,
-- partially confirmed, or disputed (a reason is required). The composite key
-- means only the payment's receiving user can be stored as the decision maker.
-- ----------------------------------------------------------------------------
CREATE TABLE payment_confirmations (
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

CREATE INDEX idx_payment_confirmations_decided_by ON payment_confirmations (decided_by);

-- ----------------------------------------------------------------------------
-- 8. SOCIAL_WORKER_ASSIGNMENTS
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
    assigned_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ended_at            TIMESTAMPTZ,
    -- Optional: the arrangement the administrator assigned the worker through. The composite key
    -- below guarantees it belongs to the same child.
    maintenance_arrangement_id UUID,
    ended_by            UUID REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT fk_assignment_arrangement_child
        FOREIGN KEY (maintenance_arrangement_id, child_id)
        REFERENCES maintenance_arrangements (id, child_id)
        ON DELETE SET NULL (maintenance_arrangement_id)
);

CREATE UNIQUE INDEX uq_active_sw_assignment
    ON social_worker_assignments(social_worker_id, child_id)
    WHERE assignment_status = 'ACTIVE';

-- A child has at most one ACTIVE social worker. Replacing a worker closes the old row as
-- TRANSFERRED (with ended_at) and opens a new one, so the history is kept.
CREATE UNIQUE INDEX uq_active_child_assignment
    ON social_worker_assignments(child_id)
    WHERE assignment_status = 'ACTIVE';

CREATE INDEX idx_sw_assignments_worker ON social_worker_assignments(social_worker_id);
CREATE INDEX idx_sw_assignments_child ON social_worker_assignments(child_id);
CREATE INDEX idx_sw_assignments_assigned_by ON social_worker_assignments(assigned_by);
CREATE INDEX idx_sw_assignments_arrangement
    ON social_worker_assignments(maintenance_arrangement_id)
    WHERE maintenance_arrangement_id IS NOT NULL;

-- ----------------------------------------------------------------------------
-- 9. PAYMENT_REVIEWS
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
-- 10. PROFESSIONAL_NOTES
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

-- ----------------------------------------------------------------------------
-- 11. CONVERSATIONS
-- A private conversation between a parent and the social worker assigned to their child. One per
-- (parent, child, worker); whether it can still receive messages is derived from the live ACTIVE
-- social_worker_assignments row, so history survives a reassignment. Foreign keys are RESTRICT.
-- ----------------------------------------------------------------------------
CREATE TABLE conversations (
    id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    parent_user_id              UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    social_worker_id            UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    child_id                    UUID NOT NULL REFERENCES children(id) ON DELETE RESTRICT,
    maintenance_arrangement_id  UUID,
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_conversation_distinct_users CHECK (parent_user_id <> social_worker_id),
    CONSTRAINT uq_conversation_parent_child_worker UNIQUE (parent_user_id, child_id, social_worker_id),
    CONSTRAINT fk_conversation_arrangement_child
        FOREIGN KEY (maintenance_arrangement_id, child_id)
        REFERENCES maintenance_arrangements (id, child_id)
        ON DELETE SET NULL (maintenance_arrangement_id)
);

CREATE INDEX idx_conversations_parent ON conversations (parent_user_id, updated_at DESC);
CREATE INDEX idx_conversations_social_worker ON conversations (social_worker_id, updated_at DESC);
CREATE INDEX idx_conversations_child ON conversations (child_id);
CREATE INDEX idx_conversations_arrangement
    ON conversations (maintenance_arrangement_id) WHERE maintenance_arrangement_id IS NOT NULL;

-- ----------------------------------------------------------------------------
-- 12. MESSAGES
-- Messages are history: triggers allow only the two people in the conversation to send, forbid editing
-- the text, and allow the read flag to change only from unread to read.
-- ----------------------------------------------------------------------------
CREATE TABLE messages (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id     UUID NOT NULL REFERENCES conversations(id) ON DELETE RESTRICT,
    sender_id           UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    message             TEXT NOT NULL,
    is_read             BOOLEAN NOT NULL DEFAULT FALSE,
    read_at             TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_message_not_blank CHECK (char_length(btrim(message)) > 0),
    CONSTRAINT chk_message_length CHECK (char_length(message) <= 2000),
    CONSTRAINT chk_message_read_state CHECK (is_read = (read_at IS NOT NULL))
);

CREATE INDEX idx_messages_conversation_created ON messages (conversation_id, created_at DESC, id DESC);
CREATE INDEX idx_messages_unread ON messages (conversation_id, sender_id) WHERE is_read = FALSE;
CREATE INDEX idx_messages_sender ON messages (sender_id);
-- The guard functions and triggers (enforce_message_sender, protect_message_history) are defined in
-- database/migrations/006_messaging.sql.

-- ============================================================================
-- Fictional demo data lives in database/seeds/demoData.sql (development only).
-- Incremental changes live in database/migrations/ and are applied with
-- `npm run db:migrate`. Do not rerun this file against an existing database.
-- ============================================================================