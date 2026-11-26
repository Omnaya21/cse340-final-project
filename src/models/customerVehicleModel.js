import pool from '../models/db/pool.js';

export async function getCustomerVehicles(userId) {
  const result = await pool.query(`
    SELECT id, make, model, model_year, mileage, vin, created_at
    FROM customer_vehicles
    WHERE user_id = $1
    ORDER BY created_at DESC, id DESC
  `, [userId]);
  return result.rows;
}

export async function createCustomerVehicle(userId, vehicle) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await client.query(`
      INSERT INTO customer_vehicles (user_id, make, model, model_year, mileage, vin)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id
    `, [userId, vehicle.make, vehicle.model, vehicle.modelYear, vehicle.mileage, vehicle.vin || null]);
    const vehicleId = result.rows[0].id;
    await client.query(`
      INSERT INTO activity_logs (actor_id, action, entity_type, entity_id, details)
      VALUES ($1, 'customer_vehicle.created', 'customer_vehicle', $2, $3::jsonb)
    `, [userId, vehicleId, JSON.stringify({ make: vehicle.make, model: vehicle.model, modelYear: vehicle.modelYear })]);
    await client.query('COMMIT');
    return vehicleId;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
