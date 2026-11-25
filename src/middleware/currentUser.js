import { findSessionUser } from '../models/userModel.js';

export async function loadCurrentUser(req, res, next) {
  const sessionUser = req.session?.user;
  if (!sessionUser) {
    res.locals.currentUser = null;
    return next();
  }

  try {
    const currentUser = await findSessionUser(sessionUser.id);
    if (!currentUser) {
      req.session.destroy((error) => {
        if (error) return next(error);
        res.locals.currentUser = null;
        next();
      });
      return;
    }
    req.session.user = currentUser;
    res.locals.currentUser = currentUser;
    next();
  } catch (error) {
    next(error);
  }
}
