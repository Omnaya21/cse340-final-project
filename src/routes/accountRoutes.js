import { Router } from 'express';
import { requireRole } from '../middleware/auth.js';
import { verifyCsrfToken } from '../middleware/csrf.js';
import { getServiceRequestsForUser } from '../models/accountModel.js';
import {
  addVehicle,
  showNewServiceRequest,
  showNewVehicle,
  showServiceRequest,
  showVehicles,
  submitServiceRequest,
} from '../controllers/accountController.js';
import { showEditReview, saveReviewEdit, removeOwnReview } from '../controllers/reviewController.js';

const router = Router();

router.get('/', requireRole('customer'), async (req, res) => {
  const serviceRequests = await getServiceRequestsForUser(req.session.user.id);
  res.render('account/index', { title: 'My account', serviceRequests });
});

router.get('/vehicles', requireRole('customer'), showVehicles);
router.get('/vehicles/new', requireRole('customer'), showNewVehicle);
router.post('/vehicles', requireRole('customer'), verifyCsrfToken, addVehicle);
router.get('/service-requests/new', requireRole('customer'), showNewServiceRequest);
router.post('/service-requests', requireRole('customer'), verifyCsrfToken, submitServiceRequest);
router.get('/service-requests/:requestId', requireRole('customer'), showServiceRequest);
router.get('/reviews/:reviewId/edit', requireRole('customer'), showEditReview);
router.post('/reviews/:reviewId', requireRole('customer'), verifyCsrfToken, saveReviewEdit);
router.post('/reviews/:reviewId/delete', requireRole('customer'), verifyCsrfToken, removeOwnReview);

export default router;
