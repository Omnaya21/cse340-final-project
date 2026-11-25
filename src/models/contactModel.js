import pool from '../models/db/pool.js';

export async function createContactMessage({ userId, name, email, subject, message }) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const inserted = await client.query(`
      INSERT INTO contact_messages (user_id, name, email, subject, message)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id
    `, [userId, name, email, subject, message]);
    const messageId = inserted.rows[0].id;
    await client.query(`
      INSERT INTO activity_logs (actor_id, action, entity_type, entity_id, details)
      VALUES ($1, 'contact_message.created', 'contact_message', $2, $3::jsonb)
    `, [userId, messageId, JSON.stringify({ status: 'Received' })]);
    await client.query('COMMIT');
    return messageId;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function getContactMessages() {
  const result = await pool.query(`
    SELECT id, name, email, subject, status, created_at
    FROM contact_messages
    ORDER BY created_at DESC, id DESC
  `);
  return result.rows;
}

export async function getContactMessageById(messageId) {
  const result = await pool.query(`
    SELECT id, user_id, name, email, subject, message,
           status, staff_response, created_at, updated_at
    FROM contact_messages
    WHERE id = $1
  `, [messageId]);
  return result.rows[0] ?? null;
}

const allowedStatuses = {
  Received: ['Received', 'Replied'],
  Replied: ['Replied', 'Closed'],
  Closed: ['Closed'],
};

export async function updateContactMessage({ messageId, actorId, staffResponse, status }) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const currentResult = await client.query(`
      SELECT status FROM contact_messages WHERE id = $1 FOR UPDATE
    `, [messageId]);
    const current = currentResult.rows[0];
    if (!current) {
      await client.query('ROLLBACK');
      return false;
    }
    if (!(allowedStatuses[current.status] ?? []).includes(status)) {
      const error = new Error('INVALID_CONTACT_STATUS_TRANSITION');
      error.code = 'INVALID_CONTACT_STATUS_TRANSITION';
      throw error;
    }

    await client.query(`
      UPDATE contact_messages
      SET staff_response = $1, status = $2, updated_at = NOW()
      WHERE id = $3
    `, [staffResponse || null, status, messageId]);
    await client.query(`
      INSERT INTO activity_logs (actor_id, action, entity_type, entity_id, details)
      VALUES ($1, 'contact_message.updated', 'contact_message', $2, $3::jsonb)
    `, [actorId, messageId, JSON.stringify({ fromStatus: current.status, toStatus: status })]);
    await client.query('COMMIT');
    return true;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
