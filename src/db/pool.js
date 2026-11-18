import pg from 'pg';

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // Set DATABASE_SSL=true for a hosted database that requires TLS.
  ssl: process.env.DATABASE_SSL === 'true' ? true : undefined,
});

pool.on('error', (error) => {
  console.error('Unexpected PostgreSQL pool error:', error);
});

export default pool;
