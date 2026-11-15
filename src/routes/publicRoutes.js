import {Router} from 'express';

const router = Router();

router.get('/', async (req, res) => {
    //const featuredVehicles = await getFeaturedVehicles(); // Fetch featured vehicles from the database
    const featuredVehicles = []; // Placeholder for featured vehicles
    res.render('home', { title: 'Find your next vehicle', featuredVehicles });
});

export default router;