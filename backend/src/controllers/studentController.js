import { query } from '../config/db.js';

// Helper to get current student info
const getStudentInfo = async (userId) => {
  const res = await query(`
    SELECT s.*, sec.section_name 
    FROM students s
    LEFT JOIN sections sec ON s.section_id = sec.id
    WHERE s.user_id = $1`, 
    [userId]
  );
  return res.rows[0];
};

export const getDashboard = async (req, res) => {
  try {
    const student = await getStudentInfo(req.user.id);
    if (!student) return res.status(404).json({ error: 'Student not found' });

    // Overall stats
    const overallStatsRes = await query(
      `SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'Present' THEN 1 ELSE 0 END) as present,
        SUM(CASE WHEN status = 'Absent' THEN 1 ELSE 0 END) as absent
       FROM attendance WHERE student_id = $1`,
      [student.id]
    );
    
    const overallTotal = parseInt(overallStatsRes.rows[0].total) || 0;
    const overallPresent = parseInt(overallStatsRes.rows[0].present) || 0;
    const overallAbsent = parseInt(overallStatsRes.rows[0].absent) || 0;
    const overallPercentage = overallTotal > 0 ? Number(((overallPresent / overallTotal) * 100).toFixed(1)) : 0;

    // Subject-wise stats
    const subjectStatsRes = await query(
      `SELECT 
        sub.id as subject_id, sub.subject_code, sub.subject_name,
        COUNT(a.id) as total,
        SUM(CASE WHEN a.status = 'Present' THEN 1 ELSE 0 END) as present,
        SUM(CASE WHEN a.status = 'Absent' THEN 1 ELSE 0 END) as absent
       FROM enrollments e
       JOIN subjects sub ON e.subject_id = sub.id
       LEFT JOIN attendance a ON a.student_id = e.student_id AND a.subject_id = sub.id
       WHERE e.student_id = $1 AND e.active = true
       GROUP BY sub.id, sub.subject_code, sub.subject_name`,
      [student.id]
    );

    const subjects = subjectStatsRes.rows.map(row => {
      const total = parseInt(row.total) || 0;
      const present = parseInt(row.present) || 0;
      const absent = parseInt(row.absent) || 0;
      const percentage = total > 0 ? Number(((present / total) * 100).toFixed(1)) : 0;
      
      return {
        ...row,
        total, present, absent, percentage,
        is_low: percentage < 75 && total > 0
      };
    });

    const hasLowAttendance = (overallTotal > 0 && overallPercentage < 75) || subjects.some(s => s.is_low);

    // Attendance trend (last 30 days)
    const trendRes = await query(
      `SELECT date,
        SUM(CASE WHEN status = 'Present' THEN 1 ELSE 0 END) as present_count,
        SUM(CASE WHEN status = 'Absent' THEN 1 ELSE 0 END) as absent_count,
        COUNT(*) as total
       FROM attendance 
       WHERE student_id = $1 AND date >= CURRENT_DATE - INTERVAL '30 days'
       GROUP BY date
       ORDER BY date ASC`,
      [student.id]
    );

    res.json({
      overall: {
        total: overallTotal,
        present: overallPresent,
        absent: overallAbsent,
        percentage: overallPercentage
      },
      subjects,
      lowAttendanceWarning: hasLowAttendance,
      trend: trendRes.rows
    });
  } catch (error) {
    console.error('Error fetching dashboard:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

export const getAttendanceHistory = async (req, res) => {
  try {
    const student = await getStudentInfo(req.user.id);
    if (!student) return res.status(404).json({ error: 'Student not found' });

    const { subject_id, date_from, date_to, status } = req.query;
    
    let baseQuery = `
      SELECT a.date, a.status, sub.subject_name, sec.section_name
      FROM attendance a
      JOIN subjects sub ON a.subject_id = sub.id
      JOIN sections sec ON a.section_id = sec.id
      WHERE a.student_id = $1
    `;
    const params = [student.id];
    let paramIndex = 2;

    if (subject_id) {
      baseQuery += ` AND a.subject_id = $${paramIndex++}`;
      params.push(subject_id);
    }
    if (date_from) {
      baseQuery += ` AND a.date >= $${paramIndex++}`;
      params.push(date_from);
    }
    if (date_to) {
      baseQuery += ` AND a.date <= $${paramIndex++}`;
      params.push(date_to);
    }
    if (status) {
      baseQuery += ` AND a.status = $${paramIndex++}`;
      params.push(status);
    }

    baseQuery += ` ORDER BY a.date DESC`;

    const result = await query(baseQuery, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching history:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

export const getCalendarData = async (req, res) => {
  try {
    const student = await getStudentInfo(req.user.id);
    if (!student) return res.status(404).json({ error: 'Student not found' });

    const { month, year } = req.query;
    if (!month || !year) return res.status(400).json({ error: 'Month and year are required' });

    const result = await query(
      `SELECT date,
        SUM(CASE WHEN status = 'Present' THEN 1 ELSE 0 END) as present_count,
        SUM(CASE WHEN status = 'Absent' THEN 1 ELSE 0 END) as absent_count,
        COUNT(*) as total
       FROM attendance
       WHERE student_id = $1 
         AND EXTRACT(MONTH FROM date) = $2 
         AND EXTRACT(YEAR FROM date) = $3
       GROUP BY date
       ORDER BY date ASC`,
      [student.id, month, year]
    );

    res.json(result.rows.map(row => ({
      date: row.date,
      present_count: parseInt(row.present_count),
      absent_count: parseInt(row.absent_count),
      total: parseInt(row.total)
    })));
  } catch (error) {
    console.error('Error fetching calendar data:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

export const getSubjects = async (req, res) => {
  try {
    const student = await getStudentInfo(req.user.id);
    if (!student) return res.status(404).json({ error: 'Student not found' });

    const result = await query(
      `SELECT 
        sub.id as subject_id, sub.subject_code, sub.subject_name,
        COUNT(a.id) as total,
        SUM(CASE WHEN a.status = 'Present' THEN 1 ELSE 0 END) as present,
        SUM(CASE WHEN a.status = 'Absent' THEN 1 ELSE 0 END) as absent
       FROM enrollments e
       JOIN subjects sub ON e.subject_id = sub.id
       LEFT JOIN attendance a ON a.student_id = e.student_id AND a.subject_id = sub.id
       WHERE e.student_id = $1 AND e.active = true
       GROUP BY sub.id, sub.subject_code, sub.subject_name
       ORDER BY sub.subject_name ASC`,
      [student.id]
    );

    const subjects = result.rows.map(row => {
      const total = parseInt(row.total) || 0;
      const present = parseInt(row.present) || 0;
      const absent = parseInt(row.absent) || 0;
      const percentage = total > 0 ? Number(((present / total) * 100).toFixed(1)) : 0;
      
      return {
        ...row,
        total, present, absent, percentage,
        is_low: percentage < 75 && total > 0
      };
    });

    res.json(subjects);
  } catch (error) {
    console.error('Error fetching subjects:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

export const getProfile = async (req, res) => {
  try {
    const result = await query(
      `SELECT s.student_id, s.name, s.email, sec.section_name, s.created_at
       FROM students s
       LEFT JOIN sections sec ON s.section_id = sec.id
       WHERE s.user_id = $1`,
      [req.user.id]
    );

    if (result.rows.length === 0) return res.status(404).json({ error: 'Student not found' });

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching profile:', error);
    res.status(500).json({ error: 'Server error' });
  }
};
