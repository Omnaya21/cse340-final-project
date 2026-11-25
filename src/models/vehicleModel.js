import pool from '../models/db/pool.js';

export async function getFeaturedVehicles() {
  const result = await pool.query(`
    SELECT v.id, v.make, v.model, v.model_year, v.price, v.mileage,
           image.image_url, image.alt_text AS image_alt
    FROM vehicles AS v
    LEFT JOIN LATERAL (
      SELECT vi.image_url, vi.alt_text
      FROM vehicle_images AS vi
      WHERE vi.vehicle_id = v.id
      ORDER BY vi.display_order, vi.id
      LIMIT 1
    ) AS image ON TRUE
    WHERE v.is_available = TRUE AND v.is_featured = TRUE
    ORDER BY v.updated_at DESC, v.id DESC
    LIMIT 6
  `);
  return result.rows;
}

export async function getCategories() {
  const result = await pool.query(`
    SELECT id, name, slug
    FROM categories
    ORDER BY name
  `);
  return result.rows;
}

const sortClauses = {
  newest: 'v.model_year DESC, v.id DESC',
  'price-asc': 'v.price ASC, v.id DESC',
  'price-desc': 'v.price DESC, v.id DESC',
};

export async function getAvailableVehicles({ categorySlug = '', sort = 'newest' } = {}) {
  const orderBy = sortClauses[sort] ?? sortClauses.newest;
  const values = [];
  let categoryClause = '';

  if (categorySlug) {
    values.push(categorySlug);
    categoryClause = 'AND c.slug = $1';
  }

  const result = await pool.query(`
    SELECT v.id, v.make, v.model, v.model_year, v.price, v.mileage,
           v.transmission, c.name AS category_name,
           image.image_url, image.alt_text AS image_alt
    FROM vehicles AS v
    JOIN categories AS c ON c.id = v.category_id
    LEFT JOIN LATERAL (
      SELECT vi.image_url, vi.alt_text
      FROM vehicle_images AS vi
      WHERE vi.vehicle_id = v.id
      ORDER BY vi.display_order, vi.id
      LIMIT 1
    ) AS image ON TRUE
    WHERE v.is_available = TRUE ${categoryClause}
    ORDER BY ${orderBy}
  `, values);

  return result.rows;
}

export async function getVehicleDetails(vehicleId) {
  const vehicleResult = await pool.query(`
    SELECT v.*, c.name AS category_name
    FROM vehicles AS v
    JOIN categories AS c ON c.id = v.category_id
    WHERE v.id = $1
  `, [vehicleId]);

  if (!vehicleResult.rows[0]) return null;

  const [imagesResult, reviewsResult] = await Promise.all([
    pool.query(`
      SELECT id, image_url, alt_text, display_order
      FROM vehicle_images
      WHERE vehicle_id = $1
      ORDER BY display_order, id
    `, [vehicleId]),
    pool.query(`
      SELECT r.id, r.user_id, r.rating, r.title, r.body, r.created_at,
             u.full_name AS reviewer_name
      FROM reviews AS r
      JOIN users AS u ON u.id = r.user_id
      WHERE r.vehicle_id = $1 AND r.is_approved = TRUE
      ORDER BY r.created_at DESC, r.id DESC
    `, [vehicleId]),
  ]);

  return {
    vehicle: vehicleResult.rows[0],
    images: imagesResult.rows,
    reviews: reviewsResult.rows,
  };
}
