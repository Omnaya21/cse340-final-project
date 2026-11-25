import pool from '../models/db/pool.js';

export async function findUserByEmail(email) {
  const result = await pool.query(`
    SELECT id, full_name, email, password_hash, role
    FROM users
    WHERE email = $1
  `, [email]);
  return result.rows[0] ?? null;
}

export async function findSessionUser(userId) {
  const result = await pool.query(`
    SELECT id, full_name, email, role
    FROM users
    WHERE id = $1
  `, [userId]);
  return result.rows[0] ?? null;
}

export async function createCustomer({ fullName, email, passwordHash }) {
  const result = await pool.query(`
    INSERT INTO users (full_name, email, password_hash, role)
    VALUES ($1, $2, $3, 'customer')
    RETURNING id, full_name, email, role
  `, [fullName, email, passwordHash]);
  return result.rows[0];
}
