import 'dotenv/config';
import pool from '../models/db/pool.js';

// Run `npm run seed:demo` first so the vehicle categories exist.
const vehicles = [
  {
    category: 'cars', make: 'Honda', model: 'Accord', year: 2022, price: 26950, mileage: 28410,
    vin: '1HGCV1F34NA012341', exterior: 'Modern Steel Metallic', interior: 'Black', transmission: 'Automatic', fuel: 'Gasoline', featured: true,
    description: 'A comfortable, efficient midsize sedan with a clean interior and a smooth ride.',
    //image: 'https://images.unsplash.com/photo-1617469767053-d3b523a0b982?auto=format&fit=crop&w=1200&q=85',
    image: 'https://img2.carmax.com/assets/28181521/hero.jpg?width=1200&height=1050&fit=crop&quality=85&auto=webp',
    alt: 'Dark sedan parked on a tree-lined street',
  },
  {
    category: 'suvs', make: 'Toyota', model: 'RAV4', year: 2021, price: 28400, mileage: 31750,
    vin: '2T3W1RFV5MW012342', exterior: 'Magnetic Gray', interior: 'Black', transmission: 'Automatic', fuel: 'Gasoline', featured: true,
    description: 'A versatile compact SUV with generous cargo space and dependable all-around performance.',
    image: 'https://images.unsplash.com/photo-1551830820-330a71b99659?auto=format&fit=crop&w=1200&q=85',
    alt: 'Silver SUV on a quiet road',
  },
  {
    category: 'trucks', make: 'Ford', model: 'F-150', year: 2020, price: 31900, mileage: 46820,
    vin: '1FTEW1EP5LFA12343', exterior: 'Oxford White', interior: 'Gray', transmission: 'Automatic', fuel: 'Gasoline', featured: true,
    description: 'A capable full-size pickup with a spacious cab and a practical bed for work or weekend projects.',
    image: 'https://images.unsplash.com/photo-1552519507-da3b142c6e3d?auto=format&fit=crop&w=1200&q=85',
    alt: 'Pickup truck photographed outdoors',
  },
  {
    category: 'vans', make: 'Honda', model: 'Odyssey', year: 2019, price: 22800, mileage: 59200,
    vin: '5FNRL6H72KB012344', exterior: 'Lunar Silver', interior: 'Gray', transmission: 'Automatic', fuel: 'Gasoline', featured: false,
    description: 'A family-friendly minivan with flexible seating, convenient storage, and room for everyone.',
    image: 'https://images.unsplash.com/photo-1566933293069-b55c7f326dd4?auto=format&fit=crop&w=1200&q=85',
    alt: 'Family van ready for a road trip',
  },
  {
    category: 'cars', make: 'Toyota', model: 'Camry', year: 2023, price: 27950, mileage: 15400,
    vin: '4T1G11AK5PU012345', exterior: 'Celestial Silver', interior: 'Black', transmission: 'Automatic', fuel: 'Gasoline', featured: true,
    description: 'A low-mileage sedan with a comfortable cabin, composed handling, and excellent everyday usability.',
    image: 'https://images.unsplash.com/photo-1590362891991-f776e747a588?auto=format&fit=crop&w=1200&q=85',
    alt: 'Silver sedan parked outdoors',
  },
  {
    category: 'suvs', make: 'Subaru', model: 'Outback', year: 2022, price: 29600, mileage: 24600,
    vin: '4S4BTGPD8N3123456', exterior: 'Autumn Green', interior: 'Gray', transmission: 'CVT', fuel: 'Gasoline', featured: false,
    description: 'A practical wagon-style SUV with generous cargo room and confidence for changing road conditions.',
    image: 'https://images.unsplash.com/photo-1519641471654-76ce0107ad1b?auto=format&fit=crop&w=1200&q=85',
    alt: 'SUV traveling along a scenic road',
  },
];

const client = await pool.connect();
try {
  await client.query('BEGIN');

  const categoryResult = await client.query('SELECT id, slug FROM categories');
  const categoryIds = new Map(categoryResult.rows.map((category) => [category.slug, category.id]));
  const missingCategories = [...new Set(vehicles.map((vehicle) => vehicle.category))]
    .filter((slug) => !categoryIds.has(slug));
  if (missingCategories.length) {
    throw new Error(`Missing categories: ${missingCategories.join(', ')}. Run npm run seed:demo first.`);
  }

  let added = 0;
  let updated = 0;
  for (const vehicle of vehicles) {
    const result = await client.query(`
      INSERT INTO vehicles (
        category_id, make, model, model_year, price, mileage, vin,
        exterior_color, interior_color, transmission, fuel_type, description, is_featured
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      ON CONFLICT (vin) DO UPDATE SET
        category_id = EXCLUDED.category_id,
        make = EXCLUDED.make,
        model = EXCLUDED.model,
        model_year = EXCLUDED.model_year,
        price = EXCLUDED.price,
        mileage = EXCLUDED.mileage,
        exterior_color = EXCLUDED.exterior_color,
        interior_color = EXCLUDED.interior_color,
        transmission = EXCLUDED.transmission,
        fuel_type = EXCLUDED.fuel_type,
        description = EXCLUDED.description,
        is_featured = EXCLUDED.is_featured,
        updated_at = NOW()
      RETURNING id, (xmax = 0) AS inserted
    `, [
      categoryIds.get(vehicle.category), vehicle.make, vehicle.model, vehicle.year,
      vehicle.price, vehicle.mileage, vehicle.vin, vehicle.exterior, vehicle.interior,
      vehicle.transmission, vehicle.fuel, vehicle.description, vehicle.featured,
    ]);

    const saved = result.rows[0];
    if (saved.inserted) added += 1;
    else updated += 1;

    await client.query(`
      INSERT INTO vehicle_images (vehicle_id, image_url, alt_text, display_order)
      SELECT $1, $2, $3, 0
      WHERE NOT EXISTS (
        SELECT 1 FROM vehicle_images WHERE vehicle_id = $1 AND image_url = $2
      )
    `, [saved.id, vehicle.image, vehicle.alt]);
  }

  await client.query('COMMIT');
  console.log(`Vehicle data ready: ${added} added, ${updated} updated.`);
} catch (error) {
  await client.query('ROLLBACK');
  console.error('Could not seed vehicle data:', error.message);
  process.exitCode = 1;
} finally {
  client.release();
  await pool.end();
}
