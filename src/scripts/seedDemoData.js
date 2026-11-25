import 'dotenv/config';
import bcrypt from 'bcryptjs';
import pool from '../models/db/pool.js';

const testPassword = process.env.TEST_ACCOUNT_PASSWORD;
const accounts = [
  { key: 'owner', name: process.env.OWNER_NAME, email: process.env.OWNER_EMAIL, role: 'owner' },
  { key: 'employee', name: process.env.EMPLOYEE_NAME, email: process.env.EMPLOYEE_EMAIL, role: 'employee' },
  { key: 'customer', name: process.env.CUSTOMER_NAME, email: process.env.CUSTOMER_EMAIL, role: 'customer' },
];
const categories = [
  { name: 'Trucks', slug: 'trucks', description: 'Used pickup trucks.' },
  { name: 'Vans', slug: 'vans', description: 'Used passenger and cargo vans.' },
  { name: 'Cars', slug: 'cars', description: 'Used cars.' },
  { name: 'SUVs', slug: 'suvs', description: 'Used sport utility vehicles.' },
];

if (!testPassword || testPassword.length < 8 || Buffer.byteLength(testPassword, 'utf8') > 72) {
  throw new Error('Set TEST_ACCOUNT_PASSWORD to the shared course test password (8 to 72 bytes).');
}
for (const account of accounts) {
  if (!account.name || account.name.length > 120 || !account.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(account.email)) {
    throw new Error(`Set a valid name and email for the ${account.key} demo account.`);
  }
}
const normalizedAccounts = accounts.map((account) => ({ ...account, email: account.email.trim().toLowerCase() }));
if (new Set(normalizedAccounts.map((account) => account.email)).size !== normalizedAccounts.length) {
  throw new Error('The owner, employee, and customer demo accounts must use different email addresses.');
}

const passwordHash = await bcrypt.hash(testPassword, 12);
const client = await pool.connect();
try {
  await client.query('BEGIN');
  const seededUsers = {};

  // This explicit seed command is the only standard path that creates privileged demo roles.
  for (const account of normalizedAccounts) {
    const result = await client.query(`
      INSERT INTO users (full_name, email, password_hash, role)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (email) DO UPDATE
      SET full_name = EXCLUDED.full_name,
          password_hash = EXCLUDED.password_hash,
          role = EXCLUDED.role,
          updated_at = NOW()
      RETURNING id
    `, [account.name.trim(), account.email, passwordHash, account.role]);
    seededUsers[account.key] = result.rows[0].id;
  }

  for (const category of categories) {
    const inserted = await client.query(`
      INSERT INTO categories (name, slug, description)
      VALUES ($1, $2, $3)
      ON CONFLICT (slug) DO NOTHING
      RETURNING id
    `, [category.name, category.slug, category.description]);
    if (inserted.rows[0]) {
      await client.query(`
        INSERT INTO activity_logs (actor_id, action, entity_type, entity_id, details)
        VALUES ($1, 'category.seeded', 'category', $2, $3::jsonb)
      `, [seededUsers.owner, inserted.rows[0].id, JSON.stringify({ slug: category.slug })]);
    }
  }

  await client.query(`
    INSERT INTO activity_logs (actor_id, action, entity_type, entity_id, details)
    VALUES ($1, 'demo.accounts_seeded', 'user', $1, $2::jsonb)
  `, [seededUsers.owner, JSON.stringify({ accountCount: normalizedAccounts.length })]);
  await client.query('COMMIT');

  for (const account of normalizedAccounts) console.log(`${account.role}: ${account.email}`);
  console.log('Demo accounts and vehicle categories are ready. Passwords are not printed.');
} catch (error) {
  await client.query('ROLLBACK');
  throw error;
} finally {
  client.release();
  await pool.end();
}
