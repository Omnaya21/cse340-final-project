import pool from '../models/db/pool.js';

export async function getServiceRequestsForUser(userId) {
  const result = await pool.query(`
    SELECT sr.id, sr.service_type, sr.status, sr.submitted_at,
           CONCAT(v.model_year, ' ', v.make, ' ', v.model) AS vehicle_label
    FROM service_requests AS sr
    JOIN customer_vehicles AS v ON v.id = sr.customer_vehicle_id
    WHERE sr.user_id = $1
    ORDER BY sr.submitted_at DESC
  `, [userId]);
  return result.rows;
}
