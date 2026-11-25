import {
  createReview,
  deleteReviewByEmployee,
  deleteReviewByUser,
  getReviewForUser,
  getReviewsForModeration,
  getVehicleForReview,
  updateReview,
} from '../models/reviewModel.js';

function validId(value) {
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

function reviewInput(body) {
  const rating = typeof body.rating === 'string' ? Number(body.rating) : NaN;
  const title = typeof body.title === 'string' ? body.title.trim() : '';
  const text = typeof body.body === 'string' ? body.body.trim() : '';
  return { rating, title, body: text };
}

function validateReview({ rating, title, body }) {
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) return 'Choose a rating from 1 to 5.';
  if (title.length > 120) return 'Keep the title under 120 characters.';
  if (body.length < 10 || body.length > 2000) return 'Write between 10 and 2,000 characters for your review.';
  return '';
}

function renderReviewForm(res, { vehicle, review = null, formAction, error = '', formData = {}, status = 200 }) {
  return res.status(status).render('reviews/form', {
    title: review ? 'Edit review' : 'Write a review',
    vehicle, review, formAction, error, formData,
  });
}

export async function showNewReview(req, res) {
  const vehicleId = validId(req.params.vehicleId);
  if (!vehicleId) return res.status(404).render('errors/404', { title: 'Vehicle not found' });
  const vehicle = await getVehicleForReview(vehicleId);
  if (!vehicle) return res.status(404).render('errors/404', { title: 'Vehicle not found' });
  renderReviewForm(res, { vehicle, formAction: `/vehicles/${vehicleId}/reviews` });
}

export async function submitReview(req, res) {
  const vehicleId = validId(req.params.vehicleId);
  if (!vehicleId) return res.status(404).render('errors/404', { title: 'Vehicle not found' });
  const vehicle = await getVehicleForReview(vehicleId);
  if (!vehicle) return res.status(404).render('errors/404', { title: 'Vehicle not found' });

  const values = reviewInput(req.body);
  const formData = { ...values };
  const error = validateReview(values);
  if (error) return renderReviewForm(res, { vehicle, formAction: `/vehicles/${vehicleId}/reviews`, error, formData, status: 400 });

  try {
    await createReview({ userId: req.session.user.id, vehicleId, ...values });
  } catch (dbError) {
    if (dbError.code === '23505') {
      return renderReviewForm(res, {
        vehicle, formAction: `/vehicles/${vehicleId}/reviews`, formData,
        error: 'You already reviewed this vehicle. Edit your existing review instead.', status: 409,
      });
    }
    throw dbError;
  }
  res.redirect(303, `/vehicles/${vehicleId}`);
}

export async function showEditReview(req, res) {
  const reviewId = validId(req.params.reviewId);
  if (!reviewId) return res.status(404).render('errors/404', { title: 'Review not found' });
  const review = await getReviewForUser(reviewId, req.session.user.id);
  if (!review) return res.status(404).render('errors/404', { title: 'Review not found' });
  const vehicle = { id: review.vehicle_id, make: review.make, model: review.model, model_year: review.model_year };
  renderReviewForm(res, { vehicle, review, formAction: `/account/reviews/${reviewId}` });
}

export async function saveReviewEdit(req, res) {
  const reviewId = validId(req.params.reviewId);
  if (!reviewId) return res.status(404).render('errors/404', { title: 'Review not found' });
  const review = await getReviewForUser(reviewId, req.session.user.id);
  if (!review) return res.status(404).render('errors/404', { title: 'Review not found' });
  const values = reviewInput(req.body);
  const formData = { ...values };
  const vehicle = { id: review.vehicle_id, make: review.make, model: review.model, model_year: review.model_year };
  const error = validateReview(values);
  if (error) return renderReviewForm(res, { vehicle, review, formAction: `/account/reviews/${reviewId}`, error, formData, status: 400 });

  const vehicleId = await updateReview({ reviewId, userId: req.session.user.id, ...values });
  if (!vehicleId) return res.status(404).render('errors/404', { title: 'Review not found' });
  res.redirect(303, `/vehicles/${vehicleId}`);
}

export async function removeOwnReview(req, res) {
  const reviewId = validId(req.params.reviewId);
  if (!reviewId) return res.status(404).render('errors/404', { title: 'Review not found' });
  const vehicleId = await deleteReviewByUser(reviewId, req.session.user.id);
  if (!vehicleId) return res.status(404).render('errors/404', { title: 'Review not found' });
  res.redirect(303, `/vehicles/${vehicleId}`);
}

export async function listReviewsForModeration(req, res) {
  const reviews = await getReviewsForModeration();
  res.render('employee/reviews', { title: 'Moderate reviews', reviews });
}

export async function removeReviewByEmployee(req, res) {
  const reviewId = validId(req.params.reviewId);
  if (!reviewId) return res.status(404).render('errors/404', { title: 'Review not found' });
  const removed = await deleteReviewByEmployee(reviewId, req.session.user.id);
  if (!removed) return res.status(404).render('errors/404', { title: 'Review not found' });
  res.redirect(303, '/employee/reviews');
}
