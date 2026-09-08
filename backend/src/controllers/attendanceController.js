import { query, withTransaction } from '../config/db.js';
import { processAttendanceNotifications } from '../services/notificationService.js';

const normalizeStatus = (status) => {
  if (typeof status !== 'string') return null;
  const value = status.trim().toLowerCase();
  if (value === 'present') return 'Present';
  if (value === 'absent') return 'Absent';
  return null;
};

const getTeacherId = async (userId) => {
  const result = await query('SELECT id FROM teachers WHERE user_id = $1', [userId]);
  return result.rows[0]?.id || null;
};

const assertTeacherAssignment = async (userId, sectionId, subjectId) => {
  const teacherId = await getTeacherId(userId);
  if (!teacherId) return null;

  const result = await query(
    `SELECT ta.id
     FROM teacher_assignments ta
     JOIN sections sec ON sec.id = ta.section_id
     JOIN subjects sub ON sub.id = ta.subject_id
     WHERE ta.teacher_id = $1
       AND ta.section_id = $2
       AND ta.subject_id = $3
       AND ta.active = true
       AND sec.active = true
       AND sub.active = true
     LIMIT 1`,
    [teacherId, sectionId, subjectId]
  );

  return result.rows.length ? teacherId : null;
};

export const markAttendance = async (req, res) => {
  try {
    const { section_id, subject_id, date, records } = req.body;

    if (!section_id || !subject_id || !date || !Array.isArray(records) || records.length === 0) {
      return res.status(400).json({ error: 'Section, subject, date and attendance records are required.' });
    }

    const teacherId = await assertTeacherAssignment(req.user.id, section_id, subject_id);
    if (!teacherId) {
      return res.status(403).json({ error: 'You are not assigned to this section and subject.' });
    }

    const cleanRecords = records.map((record) => ({
      student_id: Number(record.student_id),
      status: normalizeStatus(record.status)
    }));

    if (cleanRecords.some((r) => !Number.isInteger(r.student_id) || !r.status)) {
      return res.status(400).json({ error: 'Every student must have a valid ID and Present/Absent status.' });
    }

    const uniqueStudentIds = [...new Set(cleanRecords.map((r) => r.student_id))];
    if (uniqueStudentIds.length !== cleanRecords.length) {
      return res.status(400).json({ error: 'Duplicate student records were submitted.' });
    }

    const results = await withTransaction(async (client) => {
      const enrollmentCheck = await client.query(
        `SELECT s.id
         FROM students s
         JOIN enrollments e ON e.student_id = s.id
         WHERE s.id = ANY($1::int[])
           AND s.section_id = $2
           AND s.active = true
           AND e.section_id = $2
           AND e.subject_id = $3
           AND e.active = true`,
        [uniqueStudentIds, section_id, subject_id]
      );

      const enrolledIds = new Set(enrollmentCheck.rows.map((row) => row.id));
      const unauthorized = uniqueStudentIds.filter((id) => !enrolledIds.has(id));
      if (unauthorized.length) {
        const err = new Error('One or more students are not enrolled in this section and subject.');
        err.status = 400;
        throw err;
      }

      const savedRecords = [];

      for (const record of cleanRecords) {
        const existing = await client.query(
          `SELECT id, status
           FROM attendance
           WHERE student_id = $1 AND subject_id = $2 AND date = $3`,
          [record.student_id, subject_id, date]
        );

        const previousStatus = existing.rows[0]?.status || null;

        const saved = await client.query(
          `INSERT INTO attendance
             (student_id, section_id, subject_id, date, status, marked_by)
           VALUES ($1, $2, $3, $4, $5, $6)
           ON CONFLICT (student_id, subject_id, date)
           DO UPDATE SET
             section_id = EXCLUDED.section_id,
             status = EXCLUDED.status,
             marked_by = EXCLUDED.marked_by,
             updated_at = NOW()
           RETURNING id, student_id, section_id, subject_id, date, status, marked_by, created_at, updated_at`,
          [record.student_id, section_id, subject_id, date, record.status, req.user.id]
        );

        savedRecords.push({
          ...saved.rows[0],
          previous_status: previousStatus
        });
      }

      const percentageRows = [];
      for (const studentId of uniqueStudentIds) {
        const stats = await client.query(
          `SELECT
             COUNT(*)::int AS total,
             COUNT(*) FILTER (WHERE status = 'Present')::int AS present,
             COUNT(*) FILTER (WHERE status = 'Absent')::int AS absent
           FROM attendance
           WHERE student_id = $1 AND subject_id = $2`,
          [studentId, subject_id]
        );

        const statsRow = stats.rows[0];
        const total = Number(statsRow.total);
        const present = Number(statsRow.present);
        const absent = Number(statsRow.absent);

        percentageRows.push({
          student_id: studentId,
          total,
          present,
          absent,
          percentage: total ? Number(((present / total) * 100).toFixed(1)) : 0
        });
      }

      return { savedRecords, percentages: percentageRows };
    });

    const notificationRecords = results.savedRecords.map((record) => {
      const stats = results.percentages.find((p) => p.student_id === record.student_id);
      return {
        student_id: record.student_id,
        status: record.status,
        previous_status: record.previous_status,
        total: stats?.total || 0,
        present: stats?.present || 0,
        absent: stats?.absent || 0,
        percentage: stats?.percentage || 0
      };
    });

    const notifications = await processAttendanceNotifications({
      records: notificationRecords,
      subjectId: subject_id,
      date,
      sectionId: section_id
    });

    res.json({
      message: 'Attendance saved successfully.',
      count: results.savedRecords.length,
      results: results.savedRecords,
      percentages: results.percentages,
      notifications
    });
  } catch (error) {
    console.error('Error marking attendance:', error);
    res.status(error.status || 500).json({ error: error.message || 'Server error marking attendance.' });
  }
};

export const getAttendance = async (req, res) => {
  try {
    const { section_id, subject_id, date, date_from, date_to, student_id } = req.query;

    let baseQuery = `
      SELECT
        a.*,
        s.name AS student_name,
        s.student_id AS student_id_code,
        s.email AS student_email,
        sub.subject_name,
        sec.section_name
      FROM attendance a
      JOIN students s ON a.student_id = s.id
      JOIN subjects sub ON a.subject_id = sub.id
      JOIN sections sec ON a.section_id = sec.id
      WHERE 1=1
    `;
    const params = [];
    let paramIndex = 1;

    if (req.user.role === 'student') {
      const studentRes = await query('SELECT id FROM students WHERE user_id = $1', [req.user.id]);
      if (!studentRes.rows.length) {
        return res.status(404).json({ error: 'Student profile not found.' });
      }

      baseQuery += ` AND a.student_id = $${paramIndex++}`;
      params.push(studentRes.rows[0].id);
    } else {
      const teacherId = await getTeacherId(req.user.id);
      if (!teacherId) return res.status(404).json({ error: 'Teacher profile not found.' });

      baseQuery += `
        AND EXISTS (
          SELECT 1
          FROM teacher_assignments ta
          WHERE ta.teacher_id = $${paramIndex++}
            AND ta.section_id = a.section_id
            AND ta.subject_id = a.subject_id
            AND ta.active = true
        )
      `;
      params.push(teacherId);
    }

    if (section_id) {
      baseQuery += ` AND a.section_id = $${paramIndex++}`;
      params.push(section_id);
    }
    if (subject_id) {
      baseQuery += ` AND a.subject_id = $${paramIndex++}`;
      params.push(subject_id);
    }
    if (date) {
      baseQuery += ` AND a.date = $${paramIndex++}`;
      params.push(date);
    }
    if (date_from) {
      baseQuery += ` AND a.date >= $${paramIndex++}`;
      params.push(date_from);
    }
    if (date_to) {
      baseQuery += ` AND a.date <= $${paramIndex++}`;
      params.push(date_to);
    }
    if (student_id && req.user.role !== 'student') {
      baseQuery += ` AND a.student_id = $${paramIndex++}`;
      params.push(student_id);
    }

    baseQuery += ` ORDER BY a.date DESC, s.name ASC`;

    const result = await query(baseQuery, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching attendance:', error);
    res.status(500).json({ error: 'Server error fetching attendance.' });
  }
};

export const updateAttendance = async (req, res) => {
  try {
    const { id } = req.params;
    const status = normalizeStatus(req.body.status);

    if (!status) {
      return res.status(400).json({ error: 'Status must be Present or Absent.' });
    }

    const teacherId = await getTeacherId(req.user.id);
    if (!teacherId) return res.status(404).json({ error: 'Teacher profile not found.' });

    const currentRes = await query(
      `SELECT * FROM attendance WHERE id = $1`,
      [id]
    );
    if (!currentRes.rows.length) {
      return res.status(404).json({ error: 'Attendance record not found.' });
    }

    const record = currentRes.rows[0];

    const assignmentRes = await query(
      `SELECT 1
       FROM teacher_assignments
       WHERE teacher_id = $1
         AND section_id = $2
         AND subject_id = $3
         AND active = true
       LIMIT 1`,
      [teacherId, record.section_id, record.subject_id]
    );

    if (!assignmentRes.rows.length) {
      return res.status(403).json({ error: 'Not authorized to update this attendance record.' });
    }

    const updated = await query(
      `UPDATE attendance
       SET status = $1, marked_by = $2, updated_at = NOW()
       WHERE id = $3
       RETURNING *`,
      [status, req.user.id, id]
    );

    const stats = await query(
      `SELECT
         COUNT(*)::int AS total,
         COUNT(*) FILTER (WHERE status = 'Present')::int AS present,
         COUNT(*) FILTER (WHERE status = 'Absent')::int AS absent
       FROM attendance
       WHERE student_id = $1 AND subject_id = $2`,
      [record.student_id, record.subject_id]
    );

    const s = stats.rows[0];
    const total = Number(s.total);
    const present = Number(s.present);
    const absent = Number(s.absent);
    const percentage = total ? Number(((present / total) * 100).toFixed(1)) : 0;

    const notification = await processAttendanceNotifications({
      sectionId: record.section_id,
      subjectId: record.subject_id,
      date: record.date,
      records: [{
        student_id: record.student_id,
        status,
        previous_status: record.status,
        total,
        present,
        absent,
        percentage
      }]
    });

    res.json({
      message: 'Attendance updated successfully.',
      record: updated.rows[0],
      percentage,
      notifications: notification
    });
  } catch (error) {
    console.error('Error updating attendance:', error);
    res.status(500).json({ error: 'Server error updating attendance.' });
  }
};

export const getAttendanceByDate = async (req, res) => {
  try {
    const { section_id, subject_id, date } = req.query;

    if (!section_id || !subject_id || !date) {
      return res.status(400).json({ error: 'Section, subject and date are required.' });
    }

    const teacherId = await getTeacherId(req.user.id);
    if (!teacherId) return res.status(404).json({ error: 'Teacher profile not found.' });

    const assignmentRes = await query(
      `SELECT 1 FROM teacher_assignments
       WHERE teacher_id = $1 AND section_id = $2 AND subject_id = $3 AND active = true
       LIMIT 1`,
      [teacherId, section_id, subject_id]
    );

    if (!assignmentRes.rows.length) {
      return res.status(403).json({ error: 'You are not assigned to this section and subject.' });
    }

    const result = await query(
      `SELECT
         a.*,
         s.name AS student_name,
         s.student_id AS student_id_code,
         s.email AS student_email
       FROM attendance a
       JOIN students s ON a.student_id = s.id
       WHERE a.section_id = $1 AND a.subject_id = $2 AND a.date = $3
       ORDER BY s.name ASC`,
      [section_id, subject_id, date]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching attendance by date:', error);
    res.status(500).json({ error: 'Server error fetching attendance by date.' });
  }
};
