import pool from '../models/db/pool.js';

export async function getVehicleForReview(vehicleId) {
  const result = await pool.query(`
    SELECT id, make, model, model_year
    FROM vehicles
    WHERE id = $1
  `, [vehicleId]);
  return result.rows[0] ?? null;
}

export async function getReviewForUser(reviewId, userId) {
  const result = await pool.query(`
    SELECT r.id, r.user_id, r.vehicle_id, r.rating, r.title, r.body,
           v.make, v.model, v.model_year
    FROM reviews AS r
    JOIN vehicles AS v ON v.id = r.vehicle_id
    WHERE r.id = $1 AND r.user_id = $2
  `, [reviewId, userId]);
  return result.rows[0] ?? null;
}

export async function createReview({ userId, vehicleId, rating, title, body }) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await client.query(`
      INSERT INTO reviews (user_id, vehicle_id, rating, title, body)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id
    `, [userId, vehicleId, rating, title || null, body]);
    const reviewId = result.rows[0].id;
    await client.query(`
      INSERT INTO activity_logs (actor_id, action, entity_type, entity_id, details)
      VALUES ($1, 'review.created', 'review', $2, $3::jsonb)
    `, [userId, reviewId, JSON.stringify({ vehicleId, rating })]);
    await client.query('COMMIT');
    return reviewId;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function updateReview({ reviewId, userId, rating, title, body }) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const ownedReview = await client.query(`
      SELECT vehicle_id FROM reviews WHERE id = $1 AND user_id = $2 FOR UPDATE
    `, [reviewId, userId]);
    if (!ownedReview.rows[0]) {
      await client.query('ROLLBACK');
      return null;
    }
    await client.query(`
      UPDATE reviews SET rating = $1, title = $2, body = $3, updated_at = NOW()
      WHERE id = $4 AND user_id = $5
    `, [rating, title || null, body, reviewId, userId]);
    await client.query(`
      INSERT INTO activity_logs (actor_id, action, entity_type, entity_id, details)
      VALUES ($1, 'review.updated', 'review', $2, $3::jsonb)
    `, [userId, reviewId, JSON.stringify({ vehicleId: ownedReview.rows[0].vehicle_id, rating })]);
    await client.query('COMMIT');
    return ownedReview.rows[0].vehicle_id;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function deleteReviewByUser(reviewId, userId) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const ownedReview = await client.query(`
      SELECT vehicle_id FROM reviews WHERE id = $1 AND user_id = $2 FOR UPDATE
    `, [reviewId, userId]);
    if (!ownedReview.rows[0]) {
      await client.query('ROLLBACK');
      return null;
    }
    const vehicleId = ownedReview.rows[0].vehicle_id;
    await client.query(`
      INSERT INTO activity_logs (actor_id, action, entity_type, entity_id, details)
      VALUES ($1, 'review.deleted_by_user', 'review', $2, $3::jsonb)
    `, [userId, reviewId, JSON.stringify({ vehicleId })]);
    await client.query('DELETE FROM reviews WHERE id = $1 AND user_id = $2', [reviewId, userId]);
    await client.query('COMMIT');
    return vehicleId;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function getReviewsForModeration() {
  const result = await pool.query(`
    SELECT r.id, r.vehicle_id, r.rating, r.title, r.body, r.is_approved, r.created_at,
           u.full_name AS reviewer_name,
           CONCAT(v.model_year, ' ', v.make, ' ', v.model) AS vehicle_label
    FROM reviews AS r
    JOIN users AS u ON u.id = r.user_id
    JOIN vehicles AS v ON v.id = r.vehicle_id
    ORDER BY r.created_at DESC, r.id DESC
  `);
  return result.rows;
}

export async function deleteReviewByEmployee(reviewId, actorId) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const review = await client.query(`
      SELECT vehicle_id FROM reviews WHERE id = $1 FOR UPDATE
    `, [reviewId]);
    if (!review.rows[0]) {
      await client.query('ROLLBACK');
      return false;
    }
    await client.query(`
      INSERT INTO activity_logs (actor_id, action, entity_type, entity_id, details)
      VALUES ($1, 'review.deleted_by_employee', 'review', $2, $3::jsonb)
    `, [actorId, reviewId, JSON.stringify({ vehicleId: review.rows[0].vehicle_id })]);
    await client.query('DELETE FROM reviews WHERE id = $1', [reviewId]);
    await client.query('COMMIT');
    return true;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
