import express from 'express';
const router = express.Router();
import * as ac from '../controllers/attendanceController.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';

router.use(authenticateToken);

// Teacher-only routes
router.post('/', requireRole('teacher'), ac.markAttendance);
router.put('/:id', requireRole('teacher'), ac.updateAttendance);

// Shared routes (both roles, filtered by role in controller)
router.get('/', ac.getAttendance);
router.get('/by-date', requireRole('teacher'), ac.getAttendanceByDate);

export default router;
