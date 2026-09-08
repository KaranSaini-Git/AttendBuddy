import express from 'express';
const router = express.Router();
import * as sc from '../controllers/studentController.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';

router.use(authenticateToken, requireRole('student'));

router.get('/dashboard', sc.getDashboard);
router.get('/attendance', sc.getAttendanceHistory);
router.get('/calendar', sc.getCalendarData);
router.get('/subjects', sc.getSubjects);
router.get('/profile', sc.getProfile);

export default router;
