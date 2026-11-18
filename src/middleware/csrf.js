import { randomBytes, timingSafeEqual } from 'node:crypto';

export function issueCsrfToken(req, res, next) {
  if (!req.session.csrfToken) {
    req.session.csrfToken = randomBytes(32).toString('hex');
  }
  res.locals.csrfToken = req.session.csrfToken;
  next();
}

export function verifyCsrfToken(req, res, next) {
  const supplied = req.body?._csrf;
  const expected = req.session?.csrfToken;

  if (typeof supplied !== 'string' || typeof expected !== 'string') {
    return res.status(403).render('errors/403', { title: 'Request could not be verified' });
  }

  const suppliedBuffer = Buffer.from(supplied);
  const expectedBuffer = Buffer.from(expected);
  if (suppliedBuffer.length !== expectedBuffer.length || !timingSafeEqual(suppliedBuffer, expectedBuffer)) {
    return res.status(403).render('errors/403', { title: 'Request could not be verified' });
  }

  next();
}
