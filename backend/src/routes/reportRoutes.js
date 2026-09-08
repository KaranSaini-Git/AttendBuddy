import express from 'express';
const router = express.Router();
import * as rc from '../controllers/reportController.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';

router.use(authenticateToken, requireRole('teacher'));

router.get('/', rc.getReports);
router.get('/export/csv', rc.exportCSV);
router.get('/export/excel', rc.exportExcel);

export default router;
