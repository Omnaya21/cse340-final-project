import { Router } from 'express';
import { verifyCsrfToken } from '../middleware/csrf.js';
import { login, logout, register, showLogin, showRegister } from '../controllers/auth/authController.js';

const router = Router();
router.get('/register', showRegister);
router.post('/register', verifyCsrfToken, register);
router.get('/login', showLogin);
router.post('/login', verifyCsrfToken, login);
router.post('/logout', verifyCsrfToken, logout);

export default router;
