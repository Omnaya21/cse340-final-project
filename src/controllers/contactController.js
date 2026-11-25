import { createContactMessage } from '../models/contactModel.js';
import { randomBytes } from 'crypto';

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function renderContact(res, { success = '', error = '', formData = {}, currentUser = {}, status = 200, csrfToken } = {}) {
  return res.status(status).render('contact', { 
    title: 'Contact us', csrfToken, success, error, formData, currentUser });
}

export function showContact(req, res) {
  req.session.csrfToken = randomBytes(32).toString('hex');
  renderContact(res, { 
    success: req.query.sent === '1' ? 'Your message was received. Our team will follow up.' : '',
    currentUser: res.locals.currentUser || {},
    csrfToken: req.session.csrfToken
  });
}

export async function submitContact(req, res) {
  const name = typeof req.body.name === 'string' ? req.body.name.trim() : '';
  const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  const subject = typeof req.body.subject === 'string' ? req.body.subject.trim() : '';
  const message = typeof req.body.message === 'string' ? req.body.message.trim() : '';
  const formData = { name, email, subject, message };

  if (!name || name.length > 120) {
    return renderContact(res, { error: 'Enter your name (up to 120 characters).', formData, status: 400 });
  }
  if (email.length > 255 || !emailPattern.test(email)) {
    return renderContact(res, { error: 'Enter a valid email address.', formData, status: 400 });
  }
  if (!subject || subject.length > 160) {
    return renderContact(res, { error: 'Enter a subject (up to 160 characters).', formData, status: 400 });
  }
  if (message.length < 10 || message.length > 5000) {
    return renderContact(res, { error: 'Write a message between 10 and 5,000 characters.', formData, status: 400 });
  }

  await createContactMessage({ userId: req.session.user?.id ?? null, name, email, subject, message });
  res.redirect(303, '/contact?sent=1');
}
