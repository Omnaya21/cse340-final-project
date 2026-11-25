import session from 'express-session';
import connectPgSimple from 'connect-pg-simple';
import pool from '../models/db/pool.js';

const sessionSecret = process.env.SESSION_SECRET;
if (!sessionSecret || sessionSecret.length < 32) {
  throw new Error('Set SESSION_SECRET to a random value at least 32 characters long.');
}

const PgSessionStore = connectPgSimple(session);
export const sessionCookieName = 'northstar.sid';

export const sessionMiddleware = session({
  name: sessionCookieName,
  store: new PgSessionStore({
    pool,
    tableName: 'user_sessions',
    createTableIfMissing: true,
  }),
  secret: sessionSecret,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 8 * 60 * 60 * 1000,
    path: '/',
  },
});
