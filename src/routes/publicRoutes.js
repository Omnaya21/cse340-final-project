import {Router} from 'express';
import { requireRole } from '../middleware/auth.js';
import { verifyCsrfToken } from '../middleware/csrf.js';
import { showContact, submitContact } from '../controllers/contactController.js';
import { showNewReview, submitReview } from '../controllers/reviewController.js';

import {
  getAvailableVehicles,
  getCategories,
  getFeaturedVehicles,
  getVehicleDetails,
} from '../models/vehicleModel.js';

const router = Router();
const allowedSorts = new Set(['newest', 'price-asc', 'price-desc']);

router.get('/', async (req, res) => {
  const [featuredVehicles, categories] = await Promise.all([getFeaturedVehicles(), getCategories()]);
  res.render('home', { title: 'Find your next vehicle', featuredVehicles, categories });
});

router.get('/contact', showContact);
router.post('/contact', verifyCsrfToken, submitContact);

router.get('/vehicles', async (req, res) => {
  const requestedCategory = typeof req.query.category === 'string' ? req.query.category : '';
  const requestedSort = typeof req.query.sort === 'string' ? req.query.sort : 'newest';
  const sort = allowedSorts.has(requestedSort) ? requestedSort : 'newest';
  const [categories, vehicles] = await Promise.all([
    getCategories(),
    getAvailableVehicles({ categorySlug: requestedCategory, sort }),
  ]);

  const categoryExists = !requestedCategory || categories.some((category) => category.slug === requestedCategory);
  res.render('vehicles/index', {
    title: 'Browse vehicles',
    categories,
    vehicles,
    selectedCategory: categoryExists ? requestedCategory : '',
    sort,
  });
});

router.get('/vehicles/:vehicleId/reviews/new', requireRole('customer'), showNewReview);
router.post('/vehicles/:vehicleId/reviews', requireRole('customer'), verifyCsrfToken, submitReview);

router.get('/vehicles/:vehicleId', async (req, res) => {
  if (!/^\d+$/.test(req.params.vehicleId)) {
    return res.status(404).render('errors/404', { title: 'Vehicle not found' });
  }

  const result = await getVehicleDetails(req.params.vehicleId);
  if (!result) return res.status(404).render('errors/404', { title: 'Vehicle not found' });

  res.render('vehicles/show', {
    title: `${result.vehicle.model_year} ${result.vehicle.make} ${result.vehicle.model}`,
    ...result,
  });
});

export default router;