import pool from '../models/db/pool.js';

export const requestStatuses = ['Submitted', 'In Progress', 'Completed'];
const nextStatuses = {
  Submitted: ['Submitted', 'In Progress'],
  'In Progress': ['In Progress', 'Completed'],
  Completed: ['Completed'],
};

export function allowedNextStatuses(currentStatus) {
  return nextStatuses[currentStatus] ?? [];
}

export async function createServiceRequest(userId, { customerVehicleId, serviceType, description }) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const ownedVehicle = await client.query(`
      SELECT id FROM customer_vehicles WHERE id = $1 AND user_id = $2
    `, [customerVehicleId, userId]);
    if (!ownedVehicle.rows[0]) {
      const error = new Error('CUSTOMER_VEHICLE_NOT_FOUND');
      error.code = 'CUSTOMER_VEHICLE_NOT_FOUND';
      throw error;
    }

    const requestResult = await client.query(`
      INSERT INTO service_requests (user_id, customer_vehicle_id, service_type, description)
      VALUES ($1, $2, $3, $4)
      RETURNING id, status
    `, [userId, customerVehicleId, serviceType, description]);
    const request = requestResult.rows[0];

    await client.query(`
      INSERT INTO service_request_updates (service_request_id, author_id, status, note)
      VALUES ($1, $2, $3, $4)
    `, [request.id, userId, request.status, 'Request submitted']);
    await client.query(`
      INSERT INTO activity_logs (actor_id, action, entity_type, entity_id, details)
      VALUES ($1, 'service_request.created', 'service_request', $2, $3::jsonb)
    `, [userId, request.id, JSON.stringify({ serviceType })]);
    await client.query('COMMIT');
    return request;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function getServiceRequestForUser(requestId, userId) {
  const result = await pool.query(`
    SELECT sr.id, sr.user_id, sr.customer_vehicle_id, sr.service_type, sr.description,
           sr.status, sr.submitted_at, sr.updated_at,
           CONCAT(cv.model_year, ' ', cv.make, ' ', cv.model) AS vehicle_label
    FROM service_requests AS sr
    JOIN customer_vehicles AS cv ON cv.id = sr.customer_vehicle_id
    WHERE sr.id = $1 AND sr.user_id = $2
  `, [requestId, userId]);
  return result.rows[0] ?? null;
}

export async function getServiceRequestById(requestId) {
  const result = await pool.query(`
    SELECT sr.id, sr.user_id, sr.customer_vehicle_id, sr.service_type, sr.description,
           sr.status, sr.submitted_at, sr.updated_at,
           u.full_name AS customer_name, u.email AS customer_email,
           CONCAT(cv.model_year, ' ', cv.make, ' ', cv.model) AS vehicle_label
    FROM service_requests AS sr
    JOIN users AS u ON u.id = sr.user_id
    JOIN customer_vehicles AS cv ON cv.id = sr.customer_vehicle_id
    WHERE sr.id = $1
  `, [requestId]);
  return result.rows[0] ?? null;
}

export async function getServiceRequestUpdates(requestId) {
  const result = await pool.query(`
    SELECT sru.id, sru.status, sru.note, sru.created_at, u.full_name AS author_name
    FROM service_request_updates AS sru
    LEFT JOIN users AS u ON u.id = sru.author_id
    WHERE sru.service_request_id = $1
    ORDER BY sru.created_at, sru.id
  `, [requestId]);
  return result.rows;
}

export async function getServiceRequests({ status = '' } = {}) {
  const values = [];
  const statusClause = status ? (values.push(status), 'WHERE sr.status = $1') : '';
  const result = await pool.query(`
    SELECT sr.id, sr.service_type, sr.status, sr.submitted_at,
           u.full_name AS customer_name,
           CONCAT(cv.model_year, ' ', cv.make, ' ', cv.model) AS vehicle_label
    FROM service_requests AS sr
    JOIN users AS u ON u.id = sr.user_id
    JOIN customer_vehicles AS cv ON cv.id = sr.customer_vehicle_id
    ${statusClause}
    ORDER BY sr.submitted_at DESC, sr.id DESC
  `, values);
  return result.rows;
}

export async function updateServiceRequestStatus({ requestId, status, note, authorId }) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const currentResult = await client.query(`
      SELECT status FROM service_requests WHERE id = $1 FOR UPDATE
    `, [requestId]);
    const current = currentResult.rows[0];
    if (!current) {
      await client.query('ROLLBACK');
      return null;
    }

    if (!allowedNextStatuses(current.status).includes(status)) {
      const error = new Error('INVALID_STATUS_TRANSITION');
      error.code = 'INVALID_STATUS_TRANSITION';
      error.currentStatus = current.status;
      throw error;
    }
    if (status === current.status && !note) {
      const error = new Error('A note is required when the status does not change.');
      error.code = 'NOTE_REQUIRED_FOR_STATUS';
      throw error;
    }

    await client.query(`
      UPDATE service_requests
      SET status = $1, assigned_to = COALESCE(assigned_to, $2), updated_at = NOW()
      WHERE id = $3
    `, [status, authorId, requestId]);
    await client.query(`
      INSERT INTO service_request_updates (service_request_id, author_id, status, note)
      VALUES ($1, $2, $3, $4)
    `, [requestId, authorId, status, note || null]);
    await client.query(`
      INSERT INTO activity_logs (actor_id, action, entity_type, entity_id, details)
      VALUES ($1, 'service_request.updated', 'service_request', $2, $3::jsonb)
    `, [authorId, requestId, JSON.stringify({ fromStatus: current.status, toStatus: status })]);
    await client.query('COMMIT');
    return true;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
