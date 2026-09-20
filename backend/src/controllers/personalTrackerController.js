import { query, withTransaction } from '../config/db.js';

const VALID_DAYS = new Set([
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday'
]);

const VALID_STATUSES = new Set([
  'Present',
  'Absent',
  'Off-day',
  'Holiday',
  'Cancelled'
]);

const normalizeText = (value, maxLength = 255) => {
  if (value === undefined || value === null) return '';
  return String(value).trim().slice(0, maxLength);
};

const normalizeSubjectCode = (value) => {
  const code = normalizeText(value, 30);
  return code || null;
};

const normalizeDay = (value) => {
  const raw = normalizeText(value, 20).toLowerCase().replace(/\.$/, '');
  if (!raw) return null;

  const aliases = {
    mon: 'Monday',
    tue: 'Tuesday',
    tues: 'Tuesday',
    wed: 'Wednesday',
    thu: 'Thursday',
    thur: 'Thursday',
    thurs: 'Thursday',
    fri: 'Friday',
    sat: 'Saturday',
    sun: 'Sunday',
  };

  return (aliases[raw] || [...VALID_DAYS].find((day) => day.toLowerCase() === raw)) || null;
};

const normalizeTime = (value) => {
  const raw = normalizeText(value, 20).toUpperCase().replace(/\s+/g, ' ');
  if (!raw) return null;

  const twentyFourHour = raw.match(/^(\d{1,2}):(\d{2})$/);
  if (twentyFourHour) {
    const hour = Number(twentyFourHour[1]);
    const minute = Number(twentyFourHour[2]);

    if (hour > 23 || minute > 59) return null;
    return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
  }

  const twelveHour = raw.match(/^(\d{1,2}):(\d{2}) ?(AM|PM)$/);
  if (!twelveHour) return null;

  let hour = Number(twelveHour[1]);
  const minute = Number(twelveHour[2]);
  const period = twelveHour[3];

  if (hour < 1 || hour > 12 || minute > 59) return null;
  if (period === 'AM' && hour === 12) hour = 0;
  if (period === 'PM' && hour !== 12) hour += 12;

  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
};

const normalizeDate = (value) => {
  const date = normalizeText(value, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;

  const parsed = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return null;

  const matchesInput =
    parsed.getUTCFullYear() === Number(date.slice(0, 4)) &&
    parsed.getUTCMonth() + 1 === Number(date.slice(5, 7)) &&
    parsed.getUTCDate() === Number(date.slice(8, 10));

  return matchesInput ? date : null;
};

const getStudentId = async (userId) => {
  const result = await query(
    'SELECT id, student_id, name FROM students WHERE user_id = $1 AND active = true LIMIT 1',
    [userId]
  );
  return result.rows[0] || null;
};

const dayNameFromDate = (dateString) => {
  const date = new Date(`${dateString}T00:00:00Z`);
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    timeZone: 'UTC'
  }).format(date);
};

const attendanceMath = (present, absent) => {
  const total = present + absent;
  const percentage = total ? Number(((present / total) * 100).toFixed(1)) : 0;
  const isBelowTarget = total > 0 && present * 4 < total * 3;

  const classesNeeded = isBelowTarget
    ? Math.max(0, Math.ceil(3 * total - 4 * present))
    : 0;

  const safeToMiss = !isBelowTarget && total > 0
    ? Math.max(0, Math.floor((4 * present - 3 * total) / 3))
    : 0;

  return {
    total,
    present,
    absent,
    percentage,
    classes_needed: classesNeeded,
    safe_to_miss: safeToMiss
  };
};

const validateTimetableRow = (row, rowNumber) => {
  const subjectName = normalizeText(
    row.subject_name ?? row.subject ?? row['Subject Name'],
    120
  );
  const subjectCode = normalizeSubjectCode(
    row.subject_code ?? row.code ?? row['Subject Code']
  );
  const day = normalizeDay(row.day ?? row.day_of_week ?? row['Day of Week']);
  const startTime = normalizeTime(
    row.start_time ?? row.start ?? row['Start Time']
  );
  const endTime = normalizeTime(
    row.end_time ?? row.end ?? row['End Time']
  );
  const room = normalizeText(row.room ?? row.room_number ?? row['Room Number'], 50);
  const notes = normalizeText(row.notes ?? row.details ?? row['Additional Details'], 255);

  const errors = [];

  if (!subjectName) errors.push('Subject name is required.');
  if (!day) errors.push('Day must be Monday through Sunday.');
  if (!startTime) errors.push('Start time must use HH:MM.');
  if (!endTime) errors.push('End time must use HH:MM.');
  if (startTime && endTime && startTime >= endTime) {
    errors.push('End time must be later than start time.');
  }

  if (errors.length) {
    return { error: `Row ${rowNumber}: ${errors.join(' ')}` };
  }

  return {
    subjectName,
    subjectCode,
    day,
    startTime,
    endTime,
    room: room || null,
    notes: notes || null
  };
};

export const getTracker = async (req, res) => {
  try {
    const student = await getStudentId(req.user.id);
    if (!student) return res.status(404).json({ error: 'Student profile not found.' });

    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const selectedDate = req.query.date === undefined ? today : normalizeDate(req.query.date);

    if (!selectedDate) {
      return res.status(400).json({ error: 'Date must use YYYY-MM-DD format.' });
    }
    const selectedDay = dayNameFromDate(selectedDate);

    const subjectsResult = await query(
      `SELECT
         ps.id,
         ps.subject_name,
         ps.subject_code,
         ps.active,
         COUNT(pa.id) FILTER (WHERE pa.status IN ('Present', 'Absent'))::int AS total,
         COUNT(pa.id) FILTER (WHERE pa.status = 'Present')::int AS present,
         COUNT(pa.id) FILTER (WHERE pa.status = 'Absent')::int AS absent
       FROM personal_subjects ps
       LEFT JOIN personal_timetable pt
         ON pt.personal_subject_id = ps.id
        AND pt.student_id = $1
       LEFT JOIN personal_attendance pa
         ON pa.timetable_id = pt.id
        AND pa.student_id = $1
       WHERE ps.student_id = $1
         AND ps.active = true
       GROUP BY ps.id, ps.subject_name, ps.subject_code, ps.active
       ORDER BY ps.subject_name ASC`,
      [student.id]
    );

    const timetableResult = await query(
      `SELECT
         pt.id,
         pt.personal_subject_id AS subject_id,
         ps.subject_name,
         ps.subject_code,
         pt.day_of_week,
         TO_CHAR(pt.start_time, 'HH24:MI') AS start_time,
         TO_CHAR(pt.end_time, 'HH24:MI') AS end_time,
         pt.room,
         pt.notes
       FROM personal_timetable pt
       JOIN personal_subjects ps ON ps.id = pt.personal_subject_id
       WHERE pt.student_id = $1
         AND pt.active = true
         AND ps.active = true
       ORDER BY
         CASE pt.day_of_week
           WHEN 'Monday' THEN 1
           WHEN 'Tuesday' THEN 2
           WHEN 'Wednesday' THEN 3
           WHEN 'Thursday' THEN 4
           WHEN 'Friday' THEN 5
           WHEN 'Saturday' THEN 6
           WHEN 'Sunday' THEN 7
         END,
         pt.start_time`,
      [student.id]
    );

    const dayResult = await query(
      `SELECT
         pt.id,
         pt.personal_subject_id AS subject_id,
         ps.subject_name,
         ps.subject_code,
         pt.day_of_week,
         TO_CHAR(pt.start_time, 'HH24:MI') AS start_time,
         TO_CHAR(pt.end_time, 'HH24:MI') AS end_time,
         pt.room,
         pt.notes,
         pa.id AS attendance_id,
         COALESCE(pa.status, 'Unmarked') AS status
       FROM personal_timetable pt
       JOIN personal_subjects ps ON ps.id = pt.personal_subject_id
       LEFT JOIN personal_attendance pa
         ON pa.timetable_id = pt.id
        AND pa.class_date = $2
       WHERE pt.student_id = $1
         AND pt.day_of_week = $3
         AND pt.active = true
         AND ps.active = true
       ORDER BY pt.start_time`,
      [student.id, selectedDate, selectedDay]
    );

    const historyResult = await query(
      `SELECT
         pa.id,
         pa.class_date,
         pa.status,
         pt.id AS timetable_id,
         ps.id AS subject_id,
         ps.subject_name,
         ps.subject_code,
         TO_CHAR(pt.start_time, 'HH24:MI') AS start_time,
         TO_CHAR(pt.end_time, 'HH24:MI') AS end_time,
         pt.room
       FROM personal_attendance pa
       JOIN personal_timetable pt ON pt.id = pa.timetable_id
       JOIN personal_subjects ps ON ps.id = pt.personal_subject_id
       WHERE pa.student_id = $1
       ORDER BY pa.class_date DESC, pt.start_time DESC
       LIMIT 200`,
      [student.id]
    );

    const subjects = subjectsResult.rows.map((row) => {
      const stats = attendanceMath(
        Number(row.present),
        Number(row.absent)
      );
      return {
        ...row,
        total: stats.total,
        present: stats.present,
        absent: stats.absent,
        percentage: stats.percentage,
        classes_needed: stats.classes_needed,
        safe_to_miss: stats.safe_to_miss
      };
    });

    const overall = subjects.reduce(
      (result, subject) => {
        result.present += subject.present;
        result.absent += subject.absent;
        return result;
      },
      { present: 0, absent: 0 }
    );

    const overallStats = attendanceMath(overall.present, overall.absent);

    res.json({
      student: {
        id: student.id,
        student_id: student.student_id,
        name: student.name
      },
      selected_date: selectedDate,
      selected_day: selectedDay,
      overall: overallStats,
      subjects,
      timetable: timetableResult.rows,
      today: dayResult.rows,
      history: historyResult.rows
    });
  } catch (error) {
    console.error('Personal tracker load error:', error);
    res.status(500).json({ error: 'Failed to load personal attendance tracker.' });
  }
};

export const importTimetable = async (req, res) => {
  try {
    const student = await getStudentId(req.user.id);
    if (!student) return res.status(404).json({ error: 'Student profile not found.' });

    const rows = req.body?.rows;
    if (!Array.isArray(rows) || rows.length === 0) {
      return res.status(400).json({ error: 'A non-empty timetable rows array is required.' });
    }
    if (rows.length > 300) {
      return res.status(400).json({ error: 'You can import up to 300 timetable rows at once.' });
    }

    const validated = rows.map((row, index) => validateTimetableRow(row || {}, index + 1));
    const firstError = validated.find((item) => item.error);
    if (firstError) return res.status(400).json({ error: firstError.error });

    const result = await withTransaction(async (client) => {
      let created = 0;
      let updated = 0;
      const imported = [];

      for (const row of validated) {
        // Find the student's existing personal subject first instead of relying on
        // ON CONFLICT inference against an expression-based unique index. This is
        // easier to reason about and also lets us reactivate a previously removed
        // subject cleanly.
        const existingSubject = await client.query(
          `SELECT id
           FROM personal_subjects
           WHERE student_id = $1
             AND LOWER(subject_name) = LOWER($2)
             AND COALESCE(LOWER(subject_code), '') = COALESCE(LOWER($3), '')
           LIMIT 1
           FOR UPDATE`,
          [student.id, row.subjectName, row.subjectCode]
        );

        let subjectId;

        if (existingSubject.rows.length) {
          subjectId = existingSubject.rows[0].id;

          await client.query(
            `UPDATE personal_subjects
             SET active = true,
                 subject_name = $1,
                 subject_code = $2,
                 updated_at = NOW()
             WHERE id = $3 AND student_id = $4`,
            [row.subjectName, row.subjectCode, subjectId, student.id]
          );
        } else {
          const subjectResult = await client.query(
            `INSERT INTO personal_subjects
               (student_id, subject_name, subject_code, active)
             VALUES ($1, $2, $3, true)
             RETURNING id`,
            [student.id, row.subjectName, row.subjectCode]
          );
          subjectId = subjectResult.rows[0].id;
        }

        const existingSlot = await client.query(
          `SELECT id
           FROM personal_timetable
           WHERE student_id = $1
             AND personal_subject_id = $2
             AND day_of_week = $3
             AND start_time = $4
             AND end_time = $5
           LIMIT 1`,
          [student.id, subjectId, row.day, row.startTime, row.endTime]
        );

        let saved;

        if (existingSlot.rows.length) {
          const updatedSlot = await client.query(
            `UPDATE personal_timetable
             SET room = $1,
                 notes = $2,
                 active = true,
                 updated_at = NOW()
             WHERE id = $3
             RETURNING id`,
            [row.room, row.notes, existingSlot.rows[0].id]
          );
          saved = updatedSlot.rows[0];
          updated += 1;
        } else {
          const createdSlot = await client.query(
            `INSERT INTO personal_timetable
               (student_id, personal_subject_id, day_of_week, start_time, end_time, room, notes, active)
             VALUES ($1, $2, $3, $4, $5, $6, $7, true)
             RETURNING id`,
            [
              student.id,
              subjectId,
              row.day,
              row.startTime,
              row.endTime,
              row.room,
              row.notes
            ]
          );
          saved = createdSlot.rows[0];
          created += 1;
        }

        imported.push({
          id: saved.id,
          subject_id: subjectId,
          subject_name: row.subjectName,
          subject_code: row.subjectCode,
          day_of_week: row.day,
          start_time: row.startTime,
          end_time: row.endTime,
          room: row.room,
          notes: row.notes
        });
      }

      return { created, updated, imported };
    });

    res.status(201).json({
      message: 'Timetable imported successfully.',
      created: result.created,
      updated: result.updated,
      imported: result.imported
    });
  } catch (error) {
    console.error('Timetable import error:', error);
    if (error.code === '23505') {
      return res.status(409).json({
        error: 'The timetable contains a duplicate subject or class slot.'
      });
    }

    res.status(500).json({
      error: 'Failed to import timetable.',
      ...(process.env.NODE_ENV !== 'production' && { details: error.message })
    });
  }
};

export const updateTimetableEntry = async (req, res) => {
  try {
    const student = await getStudentId(req.user.id);
    if (!student) return res.status(404).json({ error: 'Student profile not found.' });

    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid timetable entry.' });

    const existingResult = await query(
      `SELECT * FROM personal_timetable WHERE id = $1 AND student_id = $2 LIMIT 1`,
      [id, student.id]
    );
    if (!existingResult.rows.length) return res.status(404).json({ error: 'Timetable entry not found.' });

    const current = existingResult.rows[0];
    const day = req.body.day === undefined ? current.day_of_week : normalizeDay(req.body.day);
    const startTime = req.body.start_time === undefined ? String(current.start_time).slice(0, 5) : normalizeTime(req.body.start_time);
    const endTime = req.body.end_time === undefined ? String(current.end_time).slice(0, 5) : normalizeTime(req.body.end_time);
    const room = req.body.room === undefined ? current.room : normalizeText(req.body.room, 50) || null;
    const notes = req.body.notes === undefined ? current.notes : normalizeText(req.body.notes, 255) || null;
    const subjectId = req.body.subject_id === undefined ? current.personal_subject_id : Number(req.body.subject_id);

    if (!day || !startTime || !endTime || startTime >= endTime) {
      return res.status(400).json({ error: 'Please provide a valid day and time range.' });
    }
    if (!Number.isInteger(subjectId)) return res.status(400).json({ error: 'Invalid subject.' });

    const subjectResult = await query(
      `SELECT id FROM personal_subjects WHERE id = $1 AND student_id = $2 AND active = true LIMIT 1`,
      [subjectId, student.id]
    );
    if (!subjectResult.rows.length) return res.status(400).json({ error: 'Subject not found.' });

    const identityChanged =
      Number(subjectId) !== Number(current.personal_subject_id) ||
      day !== current.day_of_week ||
      startTime !== String(current.start_time).slice(0, 5) ||
      endTime !== String(current.end_time).slice(0, 5);

    if (identityChanged) {
      const attendanceResult = await query(
        'SELECT 1 FROM personal_attendance WHERE timetable_id = $1 LIMIT 1',
        [id]
      );

      if (attendanceResult.rows.length) {
        return res.status(400).json({
          error: 'This class already has attendance history. Only the room and notes can be changed.'
        });
      }
    }

    const updated = await query(
      `UPDATE personal_timetable
       SET personal_subject_id = $1,
           day_of_week = $2,
           start_time = $3,
           end_time = $4,
           room = $5,
           notes = $6,
           updated_at = NOW()
       WHERE id = $7
         AND student_id = $8
       RETURNING *`,
      [subjectId, day, startTime, endTime, room, notes, id, student.id]
    );

    res.json(updated.rows[0]);
  } catch (error) {
    console.error('Timetable update error:', error);
    if (error.code === '23505') {
      return res.status(409).json({ error: 'Another class already uses that same subject, day and time.' });
    }
    res.status(500).json({ error: 'Failed to update timetable entry.' });
  }
};

export const deleteTimetableEntry = async (req, res) => {
  try {
    const student = await getStudentId(req.user.id);
    if (!student) return res.status(404).json({ error: 'Student profile not found.' });

    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid timetable entry.' });

    const result = await query(
      `UPDATE personal_timetable
       SET active = false, updated_at = NOW()
       WHERE id = $1 AND student_id = $2
       RETURNING id`,
      [id, student.id]
    );

    if (!result.rows.length) return res.status(404).json({ error: 'Timetable entry not found.' });
    res.json({ message: 'Timetable entry removed.' });
  } catch (error) {
    console.error('Timetable delete error:', error);
    res.status(500).json({ error: 'Failed to remove timetable entry.' });
  }
};

export const updateSubject = async (req, res) => {
  try {
    const student = await getStudentId(req.user.id);
    if (!student) return res.status(404).json({ error: 'Student profile not found.' });

    const id = Number(req.params.id);
    const subjectName = normalizeText(req.body.subject_name, 120);
    const subjectCode = normalizeSubjectCode(req.body.subject_code);

    if (!Number.isInteger(id) || !subjectName) {
      return res.status(400).json({ error: 'A valid subject ID and name are required.' });
    }

    const result = await query(
      `UPDATE personal_subjects
       SET subject_name = $1,
           subject_code = $2,
           active = true,
           updated_at = NOW()
       WHERE id = $3 AND student_id = $4
       RETURNING *`,
      [subjectName, subjectCode, id, student.id]
    );

    if (!result.rows.length) return res.status(404).json({ error: 'Subject not found.' });
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Personal subject update error:', error);
    if (error.code === '23505') {
      return res.status(409).json({ error: 'A subject with the same name and code already exists.' });
    }
    res.status(500).json({ error: 'Failed to update subject.' });
  }
};

export const deleteSubject = async (req, res) => {
  try {
    const student = await getStudentId(req.user.id);
    if (!student) return res.status(404).json({ error: 'Student profile not found.' });

    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid subject.' });

    await withTransaction(async (client) => {
      const result = await client.query(
        `UPDATE personal_subjects
         SET active = false, updated_at = NOW()
         WHERE id = $1 AND student_id = $2
         RETURNING id`,
        [id, student.id]
      );

      if (!result.rows.length) {
        const error = new Error('Subject not found.');
        error.status = 404;
        throw error;
      }

      await client.query(
        `UPDATE personal_timetable
         SET active = false, updated_at = NOW()
         WHERE personal_subject_id = $1 AND student_id = $2`,
        [id, student.id]
      );
    });

    res.json({ message: 'Subject removed from your timetable.' });
  } catch (error) {
    console.error('Personal subject delete error:', error);
    res.status(error.status || 500).json({ error: error.message || 'Failed to remove subject.' });
  }
};

export const saveAttendance = async (req, res) => {
  try {
    const student = await getStudentId(req.user.id);
    if (!student) return res.status(404).json({ error: 'Student profile not found.' });

    const timetableId = Number(req.body.timetable_id);
    const date = normalizeDate(req.body.date);
    const status = normalizeText(req.body.status, 12);

    if (!Number.isInteger(timetableId) || !date || !VALID_STATUSES.has(status)) {
      return res.status(400).json({
        error: 'Timetable entry, date and a valid attendance status are required.'
      });
    }

    const today = await query(`SELECT CURRENT_DATE::text AS today`);
    if (date > today.rows[0].today) {
      return res.status(400).json({ error: 'Attendance cannot be marked for a future date.' });
    }

    const timetableResult = await query(
      `SELECT id, day_of_week
       FROM personal_timetable
       WHERE id = $1 AND student_id = $2 AND active = true
       LIMIT 1`,
      [timetableId, student.id]
    );

    if (!timetableResult.rows.length) {
      return res.status(404).json({ error: 'Timetable entry not found.' });
    }

    if (timetableResult.rows[0].day_of_week !== dayNameFromDate(date)) {
      return res.status(400).json({ error: 'That class is not scheduled for this date.' });
    }

    const result = await query(
      `INSERT INTO personal_attendance
         (student_id, timetable_id, class_date, status)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (student_id, timetable_id, class_date)
       DO UPDATE SET
         status = EXCLUDED.status,
         updated_at = NOW()
       RETURNING *`,
      [student.id, timetableId, date, status]
    );

    res.json({ message: 'Attendance updated.', attendance: result.rows[0] });
  } catch (error) {
    console.error('Personal attendance save error:', error);
    res.status(500).json({ error: 'Failed to save personal attendance.' });
  }
};

export const deleteAttendance = async (req, res) => {
  try {
    const student = await getStudentId(req.user.id);
    if (!student) return res.status(404).json({ error: 'Student profile not found.' });

    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid attendance record.' });

    const result = await query(
      `DELETE FROM personal_attendance
       WHERE id = $1 AND student_id = $2
       RETURNING id`,
      [id, student.id]
    );

    if (!result.rows.length) return res.status(404).json({ error: 'Attendance record not found.' });
    res.json({ message: 'Attendance entry cleared.' });
  } catch (error) {
    console.error('Personal attendance delete error:', error);
    res.status(500).json({ error: 'Failed to clear attendance entry.' });
  }
};
