export function requireAuth(req, res, next) {
  if (!req.session?.user) return res.redirect('/auth/login');
  next();
}

export function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!res.locals.currentUser) return res.redirect('/auth/login');
    if (!allowedRoles.includes(res.locals.currentUser.role)) {
      return res.status(403).render('errors/403', { title: 'Access denied' });
    }
    next();
  };
}
