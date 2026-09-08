import express from 'express';
const router = express.Router();
import * as tc from '../controllers/teacherController.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';

// All teacher routes require authentication and teacher role
router.use(authenticateToken, requireRole('teacher'));

// Dashboard
router.get('/dashboard', tc.getDashboard);

// Students
router.get('/students', tc.getStudents);
router.post('/students', tc.createStudent);
router.post('/students/import', tc.importStudents);
router.put('/students/:id', tc.updateStudent);

// Sections
router.get('/sections', tc.getSections);
router.post('/sections', tc.createSection);
router.put('/sections/:id', tc.updateSection);

// Subjects
router.get('/subjects', tc.getSubjects);
router.post('/subjects', tc.createSubject);
router.put('/subjects/:id', tc.updateSubject);

// Assignments
router.get('/assignments', tc.getAssignments);
router.post('/assignments', tc.createAssignment);
router.put('/assignments/:id', tc.updateAssignment);

// Schedule
router.get('/schedule', tc.getSchedule);

// Profile
router.get('/profile', tc.getProfile);
router.put('/profile', tc.updateProfile);

export default router;
