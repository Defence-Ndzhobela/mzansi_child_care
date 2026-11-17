const { ApiError } = require("../utils/apiResponse");

const NOT_FOUND = "Conversation not found.";
const READ_ONLY = "This conversation is read-only because the social worker is no longer assigned to this child.";
const NOTIFICATION_LIMIT = 10;

const isParent = (user) => user.role === "PARENT_CAREGIVER";

function toConversation(row) {
  return {
    id: row.id,
    childId: row.child_id,
    childName: `${row.first_name} ${row.last_name}`,
    maintenanceArrangementId: row.maintenance_arrangement_id,
    parent: { id: row.parent_id, fullName: row.parent_name },
    socialWorker: { id: row.worker_id, fullName: row.worker_name },
    // Derived live from the current assignment, so an ended or reassigned case becomes read-only.
    canSend: row.can_send,
    unreadCount: row.unread_count,
    lastMessage: row.last_message_id
      ? { preview: row.last_message, senderId: row.last_sender_id, createdAt: row.last_message_at }
      : null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toMessage(row) {
  return {
    id: row.id,
    conversationId: row.conversation_id,
    senderId: row.sender_id,
    message: row.message,
    isRead: row.is_read,
    readAt: row.read_at,
    createdAt: row.created_at,
  };
}

// Private messages between a parent and the social worker actively assigned to their child. Every
// statement re-checks who is asking against the conversation, the family link and the assignment; no
// ID from the client (conversation, sender, parent or worker) is trusted on its own. Message text is
// never logged and no admin path reads it.
function createMessageService({ sql }) {
  // Conversations the user takes part in. A parent must still be linked to the child; a social worker
  // keeps read access to their own history after an assignment ends. Optional filters narrow the list.
  async function selectConversations(userId, { id = null, search = null, childId = null, unreadOnly = false } = {}) {
    const pattern = search ? `%${search.replace(/[\\%_]/g, "\\$&")}%` : null;
    const rows = await sql`
      SELECT c.id, c.child_id, c.maintenance_arrangement_id, c.created_at, c.updated_at,
             ch.first_name, ch.last_name,
             p.id AS parent_id, p.full_name AS parent_name,
             w.id AS worker_id, w.full_name AS worker_name,
             COALESCE(u.unread_count, 0)::int AS unread_count,
             (p.role = 'PARENT_CAREGIVER' AND p.account_status = 'ACTIVE'
              AND w.role = 'SOCIAL_WORKER' AND w.account_status = 'ACTIVE'
              AND EXISTS (SELECT 1 FROM family_relationships fr
                          WHERE fr.child_id = c.child_id AND fr.user_id = c.parent_user_id)
              AND EXISTS (SELECT 1 FROM social_worker_assignments a
                          WHERE a.child_id = c.child_id AND a.social_worker_id = c.social_worker_id
                            AND a.assignment_status = 'ACTIVE')) AS can_send,
             lm.id AS last_message_id, left(lm.message, 140) AS last_message,
             lm.sender_id AS last_sender_id, lm.created_at AS last_message_at
      FROM conversations c
      JOIN children ch ON ch.id = c.child_id
      JOIN users p ON p.id = c.parent_user_id
      JOIN users w ON w.id = c.social_worker_id
      LEFT JOIN LATERAL (
        SELECT COUNT(*) AS unread_count FROM messages m
        WHERE m.conversation_id = c.id AND m.sender_id <> ${userId}::uuid AND NOT m.is_read
      ) u ON TRUE
      LEFT JOIN LATERAL (
        SELECT m.id, m.message, m.sender_id, m.created_at FROM messages m
        WHERE m.conversation_id = c.id ORDER BY m.created_at DESC, m.id DESC LIMIT 1
      ) lm ON TRUE
      WHERE (c.social_worker_id = ${userId}::uuid
             OR (c.parent_user_id = ${userId}::uuid AND EXISTS (
                   SELECT 1 FROM family_relationships fr
                   WHERE fr.child_id = c.child_id AND fr.user_id = c.parent_user_id)))
        AND (${id}::uuid IS NULL OR c.id = ${id}::uuid)
        AND (${childId}::uuid IS NULL OR c.child_id = ${childId}::uuid)
        AND (${unreadOnly}::boolean = FALSE OR COALESCE(u.unread_count, 0) > 0)
        AND (${pattern}::text IS NULL
             OR (ch.first_name || ' ' || ch.last_name) ILIKE ${pattern}::text
             OR p.full_name ILIKE ${pattern}::text
             OR w.full_name ILIKE ${pattern}::text
             OR EXISTS (SELECT 1 FROM messages sm WHERE sm.conversation_id = c.id AND sm.message ILIKE ${pattern}::text))
      ORDER BY COALESCE(lm.created_at, c.created_at) DESC, c.id
    `;
    return rows.map(toConversation);
  }

  // The same answer for "does not exist" and "belongs to someone else", so IDs cannot be probed.
  async function requireConversation(user, conversationId) {
    const [conversation] = await selectConversations(user.id, { id: conversationId });
    if (!conversation) throw new ApiError(404, NOT_FOUND);
    return conversation;
  }

  async function listConversations(user, filters) {
    return selectConversations(user.id, filters);
  }

  async function getConversation(user, conversationId) {
    return requireConversation(user, conversationId);
  }

  // Who the user may start a conversation with: a parent sees each linked child that has an active
  // social worker; a social worker sees each linked parent of every child they are actively assigned to.
  async function listContacts(user) {
    const parent = isParent(user);
    const rows = parent
      ? await sql`
          SELECT c.id AS child_id, c.first_name, c.last_name,
                 w.id AS worker_id, w.full_name AS worker_name,
                 conv.id AS conversation_id,
                 (SELECT COALESCE(json_agg(json_build_object(
                           'id', arr.id, 'expectedAmount', arr.expected_amount::float8,
                           'frequency', arr.frequency, 'status', arr.status) ORDER BY arr.created_at DESC), '[]'::json)
                  FROM maintenance_arrangements arr
                  WHERE arr.child_id = c.id AND ${user.id}::uuid IN (arr.paying_user_id, arr.receiving_user_id)) AS arrangements
          FROM children c
          JOIN social_worker_assignments a ON a.child_id = c.id AND a.assignment_status = 'ACTIVE'
          JOIN users w ON w.id = a.social_worker_id AND w.role = 'SOCIAL_WORKER' AND w.account_status = 'ACTIVE'
          LEFT JOIN conversations conv ON conv.child_id = c.id
                AND conv.parent_user_id = ${user.id}::uuid AND conv.social_worker_id = a.social_worker_id
          WHERE EXISTS (SELECT 1 FROM family_relationships fr WHERE fr.child_id = c.id AND fr.user_id = ${user.id}::uuid)
          ORDER BY c.first_name, c.last_name, c.id
        `
      : await sql`
          SELECT c.id AS child_id, c.first_name, c.last_name,
                 p.id AS parent_id, p.full_name AS parent_name,
                 conv.id AS conversation_id,
                 (SELECT COALESCE(json_agg(json_build_object(
                           'id', arr.id, 'expectedAmount', arr.expected_amount::float8,
                           'frequency', arr.frequency, 'status', arr.status) ORDER BY arr.created_at DESC), '[]'::json)
                  FROM maintenance_arrangements arr
                  WHERE arr.child_id = c.id AND p.id IN (arr.paying_user_id, arr.receiving_user_id)) AS arrangements
          FROM social_worker_assignments a
          JOIN children c ON c.id = a.child_id
          JOIN (SELECT DISTINCT child_id, user_id FROM family_relationships) f ON f.child_id = c.id
          JOIN users p ON p.id = f.user_id AND p.role = 'PARENT_CAREGIVER' AND p.account_status = 'ACTIVE'
          LEFT JOIN conversations conv ON conv.child_id = c.id
                AND conv.parent_user_id = p.id AND conv.social_worker_id = a.social_worker_id
          WHERE a.social_worker_id = ${user.id}::uuid AND a.assignment_status = 'ACTIVE'
          ORDER BY c.first_name, c.last_name, p.full_name, c.id
        `;
    return rows.map((row) => ({
      childId: row.child_id,
      childName: `${row.first_name} ${row.last_name}`,
      parent: parent ? { id: user.id, fullName: user.fullName } : { id: row.parent_id, fullName: row.parent_name },
      socialWorker: parent ? { id: row.worker_id, fullName: row.worker_name } : { id: user.id, fullName: user.fullName },
      conversationId: row.conversation_id,
      arrangements: row.arrangements,
    }));
  }

  // Creates the conversation, or returns the existing one for the same parent, child and worker. The
  // worker is always the child's ACTIVE assignment, never a value from the client, and the parent must be
  // linked to the child. One statement, so the checks and the insert cannot drift apart.
  async function startConversation(user, { childId, parentUserId, arrangementId }) {
    const parentId = isParent(user) ? user.id : parentUserId;
    const workerId = isParent(user) ? null : user.id;
    const rows = await sql`
      WITH target AS (
        SELECT a.child_id, a.social_worker_id, p.id AS parent_user_id,
               (${arrangementId}::uuid IS NULL OR EXISTS (
                  SELECT 1 FROM maintenance_arrangements arr
                  WHERE arr.id = ${arrangementId}::uuid AND arr.child_id = a.child_id
                    AND p.id IN (arr.paying_user_id, arr.receiving_user_id))) AS arrangement_ok
        FROM social_worker_assignments a
        JOIN users w ON w.id = a.social_worker_id AND w.role = 'SOCIAL_WORKER' AND w.account_status = 'ACTIVE'
        JOIN users p ON p.id = ${parentId}::uuid AND p.role = 'PARENT_CAREGIVER' AND p.account_status = 'ACTIVE'
        WHERE a.child_id = ${childId}::uuid AND a.assignment_status = 'ACTIVE'
          AND (${workerId}::uuid IS NULL OR a.social_worker_id = ${workerId}::uuid)
          AND EXISTS (SELECT 1 FROM family_relationships fr WHERE fr.child_id = a.child_id AND fr.user_id = p.id)
      ), inserted AS (
        INSERT INTO conversations (parent_user_id, social_worker_id, child_id, maintenance_arrangement_id)
        SELECT t.parent_user_id, t.social_worker_id, t.child_id, ${arrangementId}::uuid
        FROM target t WHERE t.arrangement_ok
        ON CONFLICT ON CONSTRAINT uq_conversation_parent_child_worker DO NOTHING
        RETURNING id
      )
      SELECT t.parent_user_id, t.social_worker_id, t.child_id, t.arrangement_ok,
             COALESCE((SELECT id FROM inserted),
                      (SELECT cv.id FROM conversations cv
                       WHERE cv.parent_user_id = t.parent_user_id AND cv.child_id = t.child_id
                         AND cv.social_worker_id = t.social_worker_id)) AS conversation_id,
             EXISTS (SELECT 1 FROM inserted) AS created
      FROM target t
    `;
    if (!rows.length) {
      throw new ApiError(403, isParent(user)
        ? "This child does not have an active social worker you can message."
        : "You can only message parents of children you are actively assigned to.");
    }
    const [target] = rows;
    if (!target.arrangement_ok) {
      throw new ApiError(400, "Choose one of the maintenance arrangements for this child.");
    }
    let conversationId = target.conversation_id;
    if (!conversationId) {
      // Another request created the same conversation at the same moment.
      const existing = await sql`
        SELECT id FROM conversations
        WHERE parent_user_id = ${target.parent_user_id}::uuid AND child_id = ${target.child_id}::uuid
          AND social_worker_id = ${target.social_worker_id}::uuid
      `;
      conversationId = existing[0].id;
    }
    return { created: target.created, conversation: await requireConversation(user, conversationId) };
  }

  // Oldest first, in pages that walk backwards from `before` (a message ID). `hasMore` says whether
  // older messages exist.
  async function listMessages(user, { conversationId, before, limit }) {
    await requireConversation(user, conversationId);
    const rows = await sql`
      SELECT m.id, m.conversation_id, m.sender_id, m.message, m.is_read, m.read_at, m.created_at
      FROM messages m
      WHERE m.conversation_id = ${conversationId}::uuid
        AND (${before}::uuid IS NULL OR (m.created_at, m.id) < (
              SELECT b.created_at, b.id FROM messages b
              WHERE b.id = ${before}::uuid AND b.conversation_id = ${conversationId}::uuid))
      ORDER BY m.created_at DESC, m.id DESC
      LIMIT ${limit + 1}
    `;
    return { messages: rows.slice(0, limit).reverse().map(toMessage), hasMore: rows.length > limit };
  }

  async function sendMessage(user, { conversationId, message }) {
    await requireConversation(user, conversationId);
    const rows = await sql`
      WITH target AS (
        SELECT c.id FROM conversations c
        JOIN users p ON p.id = c.parent_user_id AND p.role = 'PARENT_CAREGIVER' AND p.account_status = 'ACTIVE'
        JOIN users w ON w.id = c.social_worker_id AND w.role = 'SOCIAL_WORKER' AND w.account_status = 'ACTIVE'
        WHERE c.id = ${conversationId}::uuid
          AND ${user.id}::uuid IN (c.parent_user_id, c.social_worker_id)
          AND EXISTS (SELECT 1 FROM family_relationships fr
                      WHERE fr.child_id = c.child_id AND fr.user_id = c.parent_user_id)
          AND EXISTS (SELECT 1 FROM social_worker_assignments a
                      WHERE a.child_id = c.child_id AND a.social_worker_id = c.social_worker_id
                        AND a.assignment_status = 'ACTIVE')
      ), inserted AS (
        INSERT INTO messages (conversation_id, sender_id, message)
        SELECT t.id, ${user.id}::uuid, ${message}::text FROM target t
        RETURNING id, conversation_id, sender_id, message, is_read, read_at, created_at
      ), touched AS (
        UPDATE conversations SET updated_at = NOW()
        WHERE id IN (SELECT conversation_id FROM inserted)
        RETURNING id
      )
      SELECT * FROM inserted
    `;
    if (!rows.length) throw new ApiError(403, READ_ONLY);
    return toMessage(rows[0]);
  }

  // Marks one message the user received as read. Idempotent; messages the user sent cannot be marked.
  async function markMessageRead(user, messageId) {
    const rows = await sql`
      WITH visible AS (
        SELECT m.id, m.sender_id, m.is_read, m.read_at
        FROM messages m JOIN conversations c ON c.id = m.conversation_id
        WHERE m.id = ${messageId}::uuid
          AND (c.social_worker_id = ${user.id}::uuid
               OR (c.parent_user_id = ${user.id}::uuid AND EXISTS (
                     SELECT 1 FROM family_relationships fr
                     WHERE fr.child_id = c.child_id AND fr.user_id = c.parent_user_id)))
      ), updated AS (
        UPDATE messages SET is_read = TRUE, read_at = NOW()
        WHERE id IN (SELECT id FROM visible WHERE sender_id <> ${user.id}::uuid AND NOT is_read)
        RETURNING id, read_at
      )
      SELECT v.id, v.sender_id, COALESCE(u.read_at, v.read_at) AS read_at
      FROM visible v LEFT JOIN updated u ON u.id = v.id
    `;
    if (!rows.length) throw new ApiError(404, "Message not found.");
    if (rows[0].sender_id === user.id) {
      throw new ApiError(403, "You can only mark messages sent to you as read.");
    }
    return { id: rows[0].id, isRead: true, readAt: rows[0].read_at };
  }

  async function markConversationRead(user, conversationId) {
    await requireConversation(user, conversationId);
    const rows = await sql`
      WITH updated AS (
        UPDATE messages SET is_read = TRUE, read_at = NOW()
        WHERE conversation_id = ${conversationId}::uuid AND sender_id <> ${user.id}::uuid AND NOT is_read
        RETURNING id
      )
      SELECT COUNT(*)::int AS updated FROM updated
    `;
    return { updated: rows[0].updated };
  }

  // The in-app notification feed: unread messages grouped by conversation. It names the sender and
  // child only; the message text stays inside the conversation.
  async function getUnreadSummary(user) {
    const rows = await sql`
      SELECT c.id AS conversation_id, ch.first_name, ch.last_name, s.full_name AS sender_name,
             COUNT(*)::int AS unread_count, MAX(m.created_at) AS last_message_at
      FROM messages m
      JOIN conversations c ON c.id = m.conversation_id
      JOIN children ch ON ch.id = c.child_id
      JOIN users s ON s.id = m.sender_id
      WHERE m.sender_id <> ${user.id}::uuid AND NOT m.is_read
        AND (c.social_worker_id = ${user.id}::uuid
             OR (c.parent_user_id = ${user.id}::uuid AND EXISTS (
                   SELECT 1 FROM family_relationships fr
                   WHERE fr.child_id = c.child_id AND fr.user_id = c.parent_user_id)))
      GROUP BY c.id, ch.first_name, ch.last_name, s.full_name
      ORDER BY MAX(m.created_at) DESC
    `;
    return {
      unreadCount: rows.reduce((total, row) => total + row.unread_count, 0),
      conversations: rows.slice(0, NOTIFICATION_LIMIT).map((row) => ({
        conversationId: row.conversation_id,
        childName: `${row.first_name} ${row.last_name}`,
        senderName: row.sender_name,
        unreadCount: row.unread_count,
        lastMessageAt: row.last_message_at,
      })),
    };
  }

  return {
    getConversation, getUnreadSummary, listContacts, listConversations, listMessages,
    markConversationRead, markMessageRead, sendMessage, startConversation,
  };
}

module.exports = { READ_ONLY, createMessageService };
