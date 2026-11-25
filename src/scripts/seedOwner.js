import 'dotenv/config';
import bcrypt from 'bcryptjs';
import pool from '../db/pool.js';

const fullName = process.env.OWNER_NAME?.trim();
const email = process.env.OWNER_EMAIL?.trim().toLowerCase();
const password = process.env.OWNER_PASSWORD;

if (!fullName || fullName.length > 120 || !email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
  throw new Error('Set a valid OWNER_NAME and OWNER_EMAIL in the environment.');
}
if (!password || password.length < 8 || Buffer.byteLength(password, 'utf8') > 72) {
  throw new Error('Set OWNER_PASSWORD to a password between 8 and 72 bytes.');
}

const client = await pool.connect();
try {
  await client.query('BEGIN');
  const existing = await client.query('SELECT id, role FROM users WHERE email = $1 FOR UPDATE', [email]);
  let ownerId;
  let previousRole;

  if (existing.rows[0]) {
    ownerId = existing.rows[0].id;
    previousRole = existing.rows[0].role;
    await client.query("UPDATE users SET role = 'owner', updated_at = NOW() WHERE id = $1", [ownerId]);
  } else {
    const passwordHash = await bcrypt.hash(password, 12);
    const created = await client.query(`
      INSERT INTO users (full_name, email, password_hash, role)
      VALUES ($1, $2, $3, 'owner')
      RETURNING id
    `, [fullName, email, passwordHash]);
    ownerId = created.rows[0].id;
    previousRole = null;
  }

  await client.query(`
    INSERT INTO activity_logs (actor_id, action, entity_type, entity_id, details)
    VALUES ($1, 'owner.account_bootstrapped', 'user', $1, $2::jsonb)
  `, [ownerId, JSON.stringify({ fromRole: previousRole, toRole: 'owner' })]);
  await client.query('COMMIT');
  console.log(`Owner account is ready for ${email}.`);
} catch (error) {
  await client.query('ROLLBACK');
  throw error;
} finally {
  client.release();
  await pool.end();
}
