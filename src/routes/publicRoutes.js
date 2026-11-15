import {Router} from 'express';

const router = Router();

router.get('/', async (req, res) => {
  //const [featuredVehicles, categories] = await Promise.all([getFeaturedVehicles(), getCategories()]);
  const featuredVehicles = []; // Placeholder for featured vehicles
  const categories = []; // Placeholder for categories
  res.render('home', { title: 'Find your next vehicle', featuredVehicles, categories });
});

export default router;