import express from 'express';
const router = express.Router();
import { login, getSetupStatus, createInitialTeacher, changePassword, getMe, forgotPassword, resetPassword } from '../controllers/authController.js';
import { authenticateToken } from '../middleware/auth.js';

router.get('/setup-status', getSetupStatus);
router.post('/setup-teacher', createInitialTeacher);
router.post('/login', login);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);
router.post('/change-password', authenticateToken, changePassword);
router.get('/me', authenticateToken, getMe);

export default router;
