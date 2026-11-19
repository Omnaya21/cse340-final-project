import { randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { createCustomer, findUserByEmail } from '../../models/userModel.js';
import { sessionCookieName } from '../../middleware/session.js';

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const passwordCost = 12;


function renderRegister(res, { error = '', formData = {}, status = 200 } = {}) {
  return res.status(status).render('auth/register', { title: 'Create account', error, formData });
}


function renderLogin(res, { 
  error = '', formData = {}, registered = false, status = 200 } = {}) {
  return res.status(status).render('auth/login', { title: 'Sign in', error, formData, registered });
}


export function showRegister(req, res) {
  if (req.session.user) return res.redirect('/');
  renderRegister(res);
}


export async function register(req, res) {
  if (req.session.user) return res.redirect('/');
  const fullName = typeof req.body.full_name === 'string' ? req.body.full_name.trim() : '';
  const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  const password = typeof req.body.password === 'string' ? req.body.password : '';
  const formData = { full_name: fullName, email };

  if (!fullName || fullName.length > 120) {
    return renderRegister(res, { error: 'Enter your name (up to 120 characters).', formData, status: 400 });
  }
  if (email.length > 255 || !emailPattern.test(email)) {
    return renderRegister(res, { error: 'Enter a valid email address.', formData, status: 400 });
  }
  if (password.length < 8 || Buffer.byteLength(password, 'utf8') > 72) {
    return renderRegister(res, { error: 'Use a password between 8 and 72 bytes long.', formData, status: 400 });
  }

  const passwordHash = await bcrypt.hash(password, passwordCost);
  try {
    await createCustomer({ fullName, email, passwordHash });
  } catch (error) {
    if (error.code === '23505') {
      return renderRegister(res, { error: 'An account with that email already exists.', formData, status: 409 });
    }
    throw error;
  }

  res.redirect(303, '/auth/login?registered=1');
}


export async function showLogin(req, res) {
  if (req.session.user) 
    return res.redirect('/');
  renderLogin(res, { 
    registered: req.query.registered === '1' 
  });
}

export async function login(req, res) {
  const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  const password = typeof req.body.password === 'string' ? req.body.password : '';
  const user = email ? await findUserByEmail(email) : null;
  const passwordMatches = user && password ? await bcrypt.compare(password, user.password_hash) : false;

  if (!passwordMatches) {
    return renderLogin(res, { error: 'Email or password is incorrect.', formData: { email }, status: 401 });
  }

  await new Promise((resolve, reject) => {
    req.session.regenerate((error) => error ? reject(error) : resolve());
  });
  req.session.csrfToken = randomBytes(32).toString('hex');
  req.session.user = { id: user.id, full_name: user.full_name, email: user.email, role: user.role };
  await new Promise((resolve, reject) => {
    req.session.save((error) => error ? reject(error) : resolve());
  });

  const destination = user.role === 'owner' ? '/owner' : user.role === 'employee' ? '/employee' : '/account';
  res.redirect(303, destination);
}

export function logout(req, res, next) {
  req.session.destroy((error) => {
    if (error) return next(error);
    res.clearCookie(sessionCookieName, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
    });
    res.redirect(303, '/');
  });
}
