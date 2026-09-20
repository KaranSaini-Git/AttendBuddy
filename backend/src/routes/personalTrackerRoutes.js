import express from 'express';
import * as pc from '../controllers/personalTrackerController.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';

const router = express.Router();

router.use(authenticateToken, requireRole('student'));

router.get('/', pc.getTracker);
router.post('/timetable/import', pc.importTimetable);
router.put('/timetable/:id', pc.updateTimetableEntry);
router.delete('/timetable/:id', pc.deleteTimetableEntry);
router.put('/subjects/:id', pc.updateSubject);
router.delete('/subjects/:id', pc.deleteSubject);
router.post('/attendance', pc.saveAttendance);
router.delete('/attendance/:id', pc.deleteAttendance);

export default router;
