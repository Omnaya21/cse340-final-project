import { createCustomerVehicle, getCustomerVehicles } from '../models/customerVehicleModel.js';
import {
  createServiceRequest,
  getServiceRequestForUser,
  getServiceRequestUpdates,
} from '../models/serviceRequestModel.js';

const serviceTypes = ['Oil change', 'Inspection', 'Tire service', 'Brake service', 'Other'];

function renderVehicleForm(res, { error = '', formData = {}, status = 200 } = {}) {
  return res.status(status).render('account/vehicle-form', { title: 'Add my vehicle', error, formData });
}

export async function showVehicles(req, res) {
  const vehicles = await getCustomerVehicles(req.session.user.id);
  res.render('account/vehicles', { title: 'My vehicles', vehicles });
}

export function showNewVehicle(req, res) {
  renderVehicleForm(res);
}

export async function addVehicle(req, res) {
  const make = typeof req.body.make === 'string' ? req.body.make.trim() : '';
  const model = typeof req.body.model === 'string' ? req.body.model.trim() : '';
  const modelYear = Number(req.body.model_year);
  const mileage = Number(req.body.mileage);
  const vin = typeof req.body.vin === 'string' ? req.body.vin.trim().toUpperCase() : '';
  const formData = { make, model, model_year: req.body.model_year, mileage: req.body.mileage, vin };

  if (!make || make.length > 80 || !model || model.length > 100) {
    return renderVehicleForm(res, { error: 'Enter a make and model within the length limits.', formData, status: 400 });
  }
  if (!Number.isInteger(modelYear) || modelYear < 1886 || modelYear > 2100) {
    return renderVehicleForm(res, { error: 'Enter a valid model year.', formData, status: 400 });
  }
  if (!Number.isSafeInteger(mileage) || mileage < 0 || mileage > 2147483647) {
    return renderVehicleForm(res, { error: 'Enter a valid mileage.', formData, status: 400 });
  }
  if (vin && !/^[A-Z0-9-]{5,17}$/.test(vin)) {
    return renderVehicleForm(res, { error: 'Enter a VIN between 5 and 17 letters or numbers, or leave it blank.', formData, status: 400 });
  }

  try {
    await createCustomerVehicle(req.session.user.id, { make, model, modelYear, mileage, vin });
  } catch (error) {
    if (error.code === '23505') {
      return renderVehicleForm(res, { error: 'That VIN is already registered.', formData, status: 409 });
    }
    throw error;
  }
  res.redirect(303, '/account/vehicles');
}

export async function showNewServiceRequest(req, res) {
  const customerVehicles = await getCustomerVehicles(req.session.user.id);
  res.render('account/service-request-form', {
    title: 'Request service', customerVehicles, error: '', formData: {},
  });
}

export async function submitServiceRequest(req, res) {
  const customerVehicleId = Number(req.body.customer_vehicle_id);
  const serviceType = typeof req.body.service_type === 'string' ? req.body.service_type : '';
  const description = typeof req.body.description === 'string' ? req.body.description.trim() : '';
  const formData = { customer_vehicle_id: req.body.customer_vehicle_id, service_type: serviceType, description };

  const customerVehicles = await getCustomerVehicles(req.session.user.id);
  const renderForm = (error, status = 400) => res.status(status).render('account/service-request-form', {
    title: 'Request service', customerVehicles, error, formData,
  });

  if (!Number.isSafeInteger(customerVehicleId) || customerVehicleId < 1 || !customerVehicles.some((vehicle) => Number(vehicle.id) === customerVehicleId)) {
    return renderForm('Choose a vehicle registered to your account.');
  }
  if (!serviceTypes.includes(serviceType)) return renderForm('Choose a valid service type.');
  if (description.length < 10 || description.length > 1500) {
    return renderForm('Describe the service needed in 10 to 1,500 characters.');
  }

  const request = await createServiceRequest(req.session.user.id, {
    customerVehicleId, serviceType, description,
  });
  res.redirect(303, `/account/service-requests/${request.id}`);
}

export async function showServiceRequest(req, res) {
  const requestId = Number(req.params.requestId);
  if (!Number.isSafeInteger(requestId) || requestId < 1) {
    return res.status(404).render('errors/404', { title: 'Request not found' });
  }

  const serviceRequest = await getServiceRequestForUser(requestId, req.session.user.id);
  if (!serviceRequest) return res.status(404).render('errors/404', { title: 'Request not found' });
  const updates = await getServiceRequestUpdates(requestId);
  res.render('account/service-request-show', { title: `Service request #${requestId}`, serviceRequest, updates });
}
