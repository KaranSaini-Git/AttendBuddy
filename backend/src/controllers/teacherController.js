import { query, withTransaction } from '../config/db.js';
import bcrypt from 'bcryptjs';
import * as helpers from '../utils/helpers.js';

export const getDashboard = async (req, res) => {
    try {
        const teacherRes = await query('SELECT id FROM teachers WHERE user_id = $1', [req.user.id]);
        if (teacherRes.rows.length === 0) {
            return res.status(404).json({ error: 'Teacher profile not found' });
        }
        const teacherId = teacherRes.rows[0].id;

        const studentsRes = await query('SELECT count(*) FROM students WHERE created_by = $1 AND active = true', [req.user.id]);
        const sectionsRes = await query('SELECT count(*) FROM sections WHERE created_by = $1 AND active = true', [req.user.id]);
        const subjectsRes = await query('SELECT count(*) FROM subjects WHERE created_by = $1 AND active = true', [req.user.id]);

        const todayName = new Date().toLocaleDateString('en-US', { weekday: 'long' });
        const classesTodayRes = await query('SELECT count(*) FROM teacher_assignments WHERE teacher_id = $1 AND day = $2 AND active = true', [teacherId, todayName]);

        const presentTodayRes = await query('SELECT count(*) FROM attendance WHERE marked_by = $1 AND date = CURRENT_DATE AND status = \'Present\'', [req.user.id]);
        const absentTodayRes = await query('SELECT count(*) FROM attendance WHERE marked_by = $1 AND date = CURRENT_DATE AND status = \'Absent\'', [req.user.id]);

        const avgRes = await query(`
            SELECT 
                COUNT(CASE WHEN status = 'Present' THEN 1 END) * 100.0 / NULLIF(COUNT(*), 0) as avg_attendance
            FROM attendance a
            JOIN students s ON a.student_id = s.id
            WHERE s.created_by = $1
        `, [req.user.id]);
        const avgAttendance = parseFloat(avgRes.rows[0]?.avg_attendance || 0).toFixed(2);

        const below75Res = await query(`
            SELECT COUNT(*) 
            FROM (
                SELECT s.id, 
                       COUNT(CASE WHEN a.status = 'Present' THEN 1 END) * 100.0 / NULLIF(COUNT(a.id), 0) as percentage
                FROM students s
                LEFT JOIN attendance a ON s.id = a.student_id
                WHERE s.created_by = $1
                GROUP BY s.id
                HAVING COUNT(CASE WHEN a.status = 'Present' THEN 1 END) * 100.0 / NULLIF(COUNT(a.id), 0) < 75
            ) as sub
        `, [req.user.id]);

        const below75StudentsRes = await query(`
            SELECT
              s.student_id,
              s.name,
              sub.subject_name AS subject,
              COUNT(a.id)::int AS total,
              COUNT(a.id) FILTER (WHERE a.status = 'Present')::int AS present,
              ROUND(
                COUNT(a.id) FILTER (WHERE a.status = 'Present') * 100.0
                / NULLIF(COUNT(a.id), 0), 1
              ) AS percentage
            FROM attendance a
            JOIN students s ON a.student_id = s.id
            JOIN subjects sub ON a.subject_id = sub.id
            WHERE EXISTS (
              SELECT 1
              FROM teacher_assignments ta
              WHERE ta.teacher_id = $1
                AND ta.section_id = a.section_id
                AND ta.subject_id = a.subject_id
                AND ta.active = true
            )
            GROUP BY s.id, s.student_id, s.name, sub.id, sub.subject_name
            HAVING COUNT(a.id) FILTER (WHERE a.status = 'Present') * 100.0 / NULLIF(COUNT(a.id), 0) < 75
            ORDER BY percentage ASC, s.name ASC
            LIMIT 25
        `, [teacherId]);

        const recentAttendanceRes = await query(`
            SELECT a.id, s.name AS student_name, sub.subject_name,
                   sec.section_name, a.status, a.date
            FROM attendance a
            JOIN students s ON a.student_id = s.id
            JOIN subjects sub ON a.subject_id = sub.id
            JOIN sections sec ON a.section_id = sec.id
            WHERE a.marked_by = $1
            ORDER BY a.created_at DESC
            LIMIT 10
        `, [req.user.id]);

        const subjectStatsRes = await query(`
            SELECT sub.subject_name,
                   COUNT(a.id) as total_classes,
                   COUNT(CASE WHEN a.status = 'Present' THEN 1 END) as total_present,
                   COALESCE(COUNT(CASE WHEN a.status = 'Present' THEN 1 END) * 100.0 / NULLIF(COUNT(a.id), 0), 0) as percentage
            FROM subjects sub
            LEFT JOIN attendance a ON sub.id = a.subject_id
            WHERE sub.created_by = $1
            GROUP BY sub.id, sub.subject_name
        `, [req.user.id]);

        const trendRes = await query(`
            SELECT date, 
                   COUNT(CASE WHEN status = 'Present' THEN 1 END) as present_count,
                   COUNT(CASE WHEN status = 'Absent' THEN 1 END) as absent_count,
                   COUNT(*) as total
            FROM attendance
            WHERE marked_by = $1 AND date >= CURRENT_DATE - INTERVAL '30 days'
            GROUP BY date
            ORDER BY date ASC
        `, [req.user.id]);

        res.json({
            stats: {
                total_students: parseInt(studentsRes.rows[0].count),
                total_sections: parseInt(sectionsRes.rows[0].count),
                total_subjects: parseInt(subjectsRes.rows[0].count),
                classes_today: parseInt(classesTodayRes.rows[0].count),
                present_today: parseInt(presentTodayRes.rows[0].count),
                absent_today: parseInt(absentTodayRes.rows[0].count),
                average_attendance: Number(avgAttendance),
                below_75_count: parseInt(below75Res.rows[0].count)
            },
            recent_attendance: recentAttendanceRes.rows.map((row) => ({
                date: row.date,
                section: row.section_name,
                subject: row.subject_name,
                present: row.status === 'Present' ? 1 : 0,
                absent: row.status === 'Absent' ? 1 : 0
            })),
            subject_stats: subjectStatsRes.rows.map((row) => ({
                subject_name: row.subject_name,
                average_percentage: Number(row.percentage || 0)
            })),
            attendance_trend: trendRes.rows.map((row) => ({
                date: row.date,
                percentage: row.total ? Number(((Number(row.present_count) / Number(row.total)) * 100).toFixed(1)) : 0
            })),
            below_75_students: below75StudentsRes.rows
        });
    } catch (error) {
        console.error('Dashboard Error:', error);
        res.status(500).json({ error: 'Failed to fetch dashboard data' });
    }
};

export const getStudents = async (req, res) => {
    try {
        const { search, section_id } = req.query;
        const active = req.query.active !== 'false';

        const teacherRes = await query('SELECT id FROM teachers WHERE user_id = $1', [req.user.id]);
        if (!teacherRes.rows.length) return res.status(404).json({ error: 'Teacher profile not found' });

        let queryStr = `
            SELECT DISTINCT st.id, st.student_id, st.name, st.email, st.section_id, st.active,
                   st.created_at, sec.section_name
            FROM students st
            LEFT JOIN sections sec ON st.section_id = sec.id
            WHERE st.active = $2
              AND (
                st.created_by = $1
                OR EXISTS (
                  SELECT 1 FROM teacher_assignments ta
                  WHERE ta.teacher_id = $3
                    AND ta.section_id = st.section_id
                    AND ta.active = true
                )
              )
        `;
        const params = [req.user.id, active, teacherRes.rows[0].id];

        if (search) {
            params.push(`%${search}%`);
            queryStr += ` AND (st.name ILIKE $${params.length} OR st.student_id ILIKE $${params.length})`;
        }
        if (section_id) {
            params.push(section_id);
            queryStr += ` AND st.section_id = $${params.length}`;
        }
        queryStr += ` ORDER BY st.name ASC`;

        const { rows } = await query(queryStr, params);
        res.json(rows);
    } catch (error) {
        console.error('Get students error:', error);
        res.status(500).json({ error: 'Failed to fetch students' });
    }
};


export const importStudents = async (req, res) => {
    try {
        const { section_id, students } = req.body;
        if (!section_id || !Array.isArray(students) || students.length === 0) {
            return res.status(400).json({ error: 'section_id and a non-empty students array are required.' });
        }
        if (students.length > 500) {
            return res.status(400).json({ error: 'You can import up to 500 students at a time.' });
        }

        const teacherRes = await query('SELECT id FROM teachers WHERE user_id = $1', [req.user.id]);
        if (!teacherRes.rows.length) return res.status(404).json({ error: 'Teacher profile not found.' });
        const teacherId = teacherRes.rows[0].id;

        const sectionCheck = await query(
            `SELECT 1 FROM sections s
             WHERE s.id = $1 AND s.active = true
               AND (s.created_by = $2 OR EXISTS (
                    SELECT 1 FROM teacher_assignments ta
                    WHERE ta.teacher_id = $3 AND ta.section_id = s.id AND ta.active = true
               ))`,
            [section_id, req.user.id, teacherId]
        );
        if (!sectionCheck.rows.length) return res.status(403).json({ error: 'You are not authorized to import into this section.' });

        const normalized = students.map((row, index) => ({
            row: index + 1,
            student_id: String(row.student_id || row.regd_no || row['Regd no.'] || '').trim(),
            name: String(row.name || row.student_name || row['Student name'] || '').trim(),
            email: String(row.email || row.email_id || row['email id'] || '').trim()
        }));

        const result = await withTransaction(async (client) => {
            const out = { created: [], skipped: [], errors: [] };
            const assignments = await client.query(
                'SELECT DISTINCT subject_id FROM teacher_assignments WHERE teacher_id = $1 AND section_id = $2 AND active = true',
                [teacherId, section_id]
            );

            for (const row of normalized) {
                if (!row.student_id || !row.name || !row.email) {
                    out.errors.push({ row: row.row, reason: 'Student ID, name and email are required.', data: row });
                    continue;
                }

                const duplicate = await client.query('SELECT id FROM users WHERE user_id = $1', [row.student_id]);
                if (duplicate.rows.length) {
                    out.skipped.push({ row: row.row, reason: 'Student ID already exists.', student_id: row.student_id });
                    continue;
                }

                const tempPassword = helpers.generateTempPassword();
                const hashedPassword = await bcrypt.hash(tempPassword, 10);
                const userRes = await client.query(
                    `INSERT INTO users (user_id, password_hash, role, email, name, must_change_password)
                     VALUES ($1, $2, 'student', $3, $4, true) RETURNING id`,
                    [row.student_id, hashedPassword, row.email, row.name]
                );
                const studentRes = await client.query(
                    `INSERT INTO students (user_id, student_id, name, email, section_id, created_by)
                     VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, student_id, name, email`,
                    [userRes.rows[0].id, row.student_id, row.name, row.email, section_id, req.user.id]
                );

                for (const assignment of assignments.rows) {
                    await client.query(
                        `INSERT INTO enrollments (student_id, section_id, subject_id)
                         VALUES ($1, $2, $3) ON CONFLICT (student_id, section_id, subject_id) DO UPDATE SET active = true`,
                        [studentRes.rows[0].id, section_id, assignment.subject_id]
                    );
                }

                out.created.push({
                    ...studentRes.rows[0],
                    temp_password: tempPassword
                });
            }
            return out;
        });

        res.status(201).json({
            message: `Import finished: ${result.created.length} created, ${result.skipped.length} skipped, ${result.errors.length} with errors.`,
            ...result
        });
    } catch (error) {
        console.error('Import Students Error:', error);
        res.status(500).json({ error: 'Failed to import students.' });
    }
};

export const createStudent = async (req, res) => {
    try {
        const { student_id, name, email, section_id } = req.body;
        if (!student_id || !name || !email || !section_id) {
            return res.status(400).json({ error: 'student_id, name, email, section_id are required' });
        }

        const teacherRes = await query('SELECT id FROM teachers WHERE user_id = $1', [req.user.id]);
        if (!teacherRes.rows.length) return res.status(404).json({ error: 'Teacher profile not found' });

        const sectionCheck = await query(
            `SELECT s.id
             FROM sections s
             WHERE s.id = $1
               AND s.active = true
               AND (
                 s.created_by = $2
                 OR EXISTS (
                   SELECT 1 FROM teacher_assignments ta
                   WHERE ta.teacher_id = $3
                     AND ta.section_id = s.id
                     AND ta.active = true
                 )
               )`,
            [section_id, req.user.id, teacherRes.rows[0].id]
        );
        if (!sectionCheck.rows.length) {
            return res.status(403).json({ error: 'You are not authorized to manage students in this section.' });
        }

        const userCheck = await query('SELECT id FROM users WHERE user_id = $1', [student_id]);
        if (userCheck.rows.length > 0) {
            return res.status(400).json({ error: 'Student ID already exists' });
        }

        const tempPassword = helpers.generateTempPassword();
        const hashedPassword = await bcrypt.hash(tempPassword, 10);

        let newStudent;
        await withTransaction(async (client) => {
            const userRes = await client.query(
                `INSERT INTO users (user_id, password_hash, role, email, name, must_change_password) 
                 VALUES ($1, $2, 'student', $3, $4, true) RETURNING id`,
                [student_id, hashedPassword, email, name]
            );
            const newUserId = userRes.rows[0].id;

            const studentRes = await client.query(
                `INSERT INTO students (user_id, student_id, name, email, section_id, created_by) 
                 VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
                [newUserId, student_id, name, email, section_id, req.user.id]
            );
            newStudent = studentRes.rows[0];

            const teacherRes = await client.query('SELECT id FROM teachers WHERE user_id = $1', [req.user.id]);
            if (teacherRes.rows.length > 0) {
                const teacherId = teacherRes.rows[0].id;
                const assignments = await client.query(
                    `SELECT DISTINCT subject_id FROM teacher_assignments WHERE teacher_id = $1 AND section_id = $2 AND active = true`,
                    [teacherId, section_id]
                );
                for (const assignment of assignments.rows) {
                    await client.query(
                        `INSERT INTO enrollments (student_id, section_id, subject_id) VALUES ($1, $2, $3)`,
                        [newStudent.id, section_id, assignment.subject_id]
                    );
                }
            }
        });

        res.status(201).json({ student: newStudent, tempPassword });
    } catch (error) {
        console.error('Create Student Error:', error);
        res.status(500).json({ error: 'Failed to create student' });
    }
};

export const updateStudent = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, email, section_id, active } = req.body;

        const teacherRes = await query('SELECT id FROM teachers WHERE user_id = $1', [req.user.id]);
        if (!teacherRes.rows.length) return res.status(404).json({ error: 'Teacher profile not found' });

        const checkRes = await query(
            `SELECT s.section_id
             FROM students s
             WHERE s.id = $1
               AND (
                 s.created_by = $2
                 OR EXISTS (
                   SELECT 1 FROM teacher_assignments ta
                   WHERE ta.teacher_id = $3
                     AND ta.section_id = s.section_id
                     AND ta.active = true
                 )
               )`,
            [id, req.user.id, teacherRes.rows[0].id]
        );
        if (checkRes.rows.length === 0) {
            return res.status(404).json({ error: 'Student not found or unauthorized' });
        }

        const oldSectionId = checkRes.rows[0].section_id;

        const destinationCheck = await query(
            `SELECT s.id
             FROM sections s
             WHERE s.id = $1 AND s.active = true
               AND (
                 s.created_by = $2
                 OR EXISTS (
                   SELECT 1 FROM teacher_assignments ta
                   WHERE ta.teacher_id = $3 AND ta.section_id = s.id AND ta.active = true
                 )
               )`,
            [section_id, req.user.id, teacherRes.rows[0].id]
        );
        if (!destinationCheck.rows.length) {
            return res.status(403).json({ error: 'You are not authorized to move the student to this section.' });
        }

        const updateRes = await query(
            `UPDATE students SET name = $1, email = $2, section_id = $3, active = $4, updated_at = NOW() 
             WHERE id = $5 RETURNING *`,
            [name, email, section_id, active !== undefined ? active : true, id]
        );

        if (oldSectionId != section_id) {
             await query('DELETE FROM enrollments WHERE student_id = $1 AND section_id = $2', [id, oldSectionId]);
             const teacherRes = await query('SELECT id FROM teachers WHERE user_id = $1', [req.user.id]);
             if (teacherRes.rows.length > 0) {
                 const teacherId = teacherRes.rows[0].id;
                 const assignments = await query(
                     `SELECT DISTINCT subject_id FROM teacher_assignments WHERE teacher_id = $1 AND section_id = $2 AND active = true`,
                     [teacherId, section_id]
                 );
                 for (const assignment of assignments.rows) {
                     await query(
                         `INSERT INTO enrollments (student_id, section_id, subject_id) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
                         [id, section_id, assignment.subject_id]
                     );
                 }
             }
        }

        res.json(updateRes.rows[0]);
    } catch (error) {
        res.status(500).json({ error: 'Failed to update student' });
    }
};

export const getSections = async (req, res) => {
    try {
        const active = req.query.active !== 'false';
        const { rows } = await query(`
            SELECT s.*, count(st.id) as student_count
            FROM sections s
            LEFT JOIN students st ON s.id = st.section_id AND st.active = true
            WHERE s.active = $2
              AND (
                s.created_by = $1
                OR EXISTS (
                  SELECT 1 FROM teacher_assignments ta
                  WHERE ta.teacher_id = (SELECT id FROM teachers WHERE user_id = $1)
                    AND ta.section_id = s.id
                    AND ta.active = true
                )
              )
            GROUP BY s.id
            ORDER BY s.section_name
        `, [req.user.id, active]);
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch sections' });
    }
};

export const createSection = async (req, res) => {
    try {
        const { section_name, semester, academic_year } = req.body;
        if (!section_name) return res.status(400).json({ error: 'section_name is required' });

        const { rows } = await query(
            `INSERT INTO sections (section_name, semester, academic_year, created_by) VALUES ($1, $2, $3, $4) RETURNING *`,
            [section_name, semester, academic_year, req.user.id]
        );
        res.status(201).json(rows[0]);
    } catch (error) {
        res.status(500).json({ error: 'Failed to create section' });
    }
};

export const updateSection = async (req, res) => {
    try {
        const { id } = req.params;
        const { section_name, semester, academic_year, active } = req.body;

        const { rows } = await query(
            `UPDATE sections SET section_name = $1, semester = $2, academic_year = $3, active = $4, updated_at = NOW() 
             WHERE id = $5 AND created_by = $6 RETURNING *`,
            [section_name, semester, academic_year, active !== undefined ? active : true, id, req.user.id]
        );
        if (rows.length === 0) return res.status(404).json({ error: 'Section not found' });
        res.json(rows[0]);
    } catch (error) {
        res.status(500).json({ error: 'Failed to update section' });
    }
};

export const getSubjects = async (req, res) => {
    try {
        const active = req.query.active !== 'false';
        const { rows } = await query(`
            SELECT sub.*, count(e.id) as enrolled_students
            FROM subjects sub
            LEFT JOIN enrollments e ON sub.id = e.subject_id AND e.active = true
            WHERE sub.active = $2
              AND (
                sub.created_by = $1
                OR EXISTS (
                  SELECT 1 FROM teacher_assignments ta
                  WHERE ta.teacher_id = (SELECT id FROM teachers WHERE user_id = $1)
                    AND ta.subject_id = sub.id
                    AND ta.active = true
                )
              )
            GROUP BY sub.id
            ORDER BY sub.subject_name
        `, [req.user.id, active]);
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch subjects' });
    }
};

export const createSubject = async (req, res) => {
    try {
        const { subject_code, subject_name } = req.body;
        if (!subject_code || !subject_name) return res.status(400).json({ error: 'subject_code and subject_name are required' });

        const checkRes = await query('SELECT id FROM subjects WHERE subject_code = $1', [subject_code]);
        if (checkRes.rows.length > 0) return res.status(400).json({ error: 'Subject code already exists' });

        const { rows } = await query(
            `INSERT INTO subjects (subject_code, subject_name, created_by) VALUES ($1, $2, $3) RETURNING *`,
            [subject_code, subject_name, req.user.id]
        );
        res.status(201).json(rows[0]);
    } catch (error) {
        res.status(500).json({ error: 'Failed to create subject' });
    }
};

export const updateSubject = async (req, res) => {
    try {
        const { id } = req.params;
        const { subject_code, subject_name, active } = req.body;

        const { rows } = await query(
            `UPDATE subjects SET subject_code = $1, subject_name = $2, active = $3, updated_at = NOW() 
             WHERE id = $4 AND created_by = $5 RETURNING *`,
            [subject_code, subject_name, active !== undefined ? active : true, id, req.user.id]
        );
        if (rows.length === 0) return res.status(404).json({ error: 'Subject not found' });
        res.json(rows[0]);
    } catch (error) {
        res.status(500).json({ error: 'Failed to update subject' });
    }
};

export const getAssignments = async (req, res) => {
    try {
        const teacherRes = await query('SELECT id FROM teachers WHERE user_id = $1', [req.user.id]);
        if (teacherRes.rows.length === 0) return res.status(404).json({ error: 'Teacher profile not found' });
        
        const { rows } = await query(`
            SELECT ta.*, sec.section_name, sub.subject_name, sub.subject_code
            FROM teacher_assignments ta
            JOIN sections sec ON ta.section_id = sec.id
            JOIN subjects sub ON ta.subject_id = sub.id
            WHERE ta.teacher_id = $1
            ORDER BY ta.created_at DESC
        `, [teacherRes.rows[0].id]);
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch assignments' });
    }
};

export const createAssignment = async (req, res) => {
    try {
        const { section_id, subject_id, day, start_time, end_time, room } = req.body;
        if (!section_id || !subject_id || !day || !start_time || !end_time) {
            return res.status(400).json({ error: 'Missing required fields' });
        }
        if (start_time >= end_time) {
            return res.status(400).json({ error: 'End time must be later than start time.' });
        }

        const resourceCheck = await query(
            `SELECT 1
             FROM sections sec
             CROSS JOIN subjects sub
             WHERE sec.id = $1 AND sec.active = true
               AND sub.id = $2 AND sub.active = true`,
            [section_id, subject_id]
        );
        if (!resourceCheck.rows.length) {
            return res.status(400).json({ error: 'Section or subject does not exist or is inactive.' });
        }

        const teacherRes = await query('SELECT id FROM teachers WHERE user_id = $1', [req.user.id]);
        if (teacherRes.rows.length === 0) return res.status(404).json({ error: 'Teacher profile not found' });
        
        const { rows } = await withTransaction(async (client) => {
            const assignmentRes = await client.query(
                `INSERT INTO teacher_assignments (teacher_id, section_id, subject_id, day, start_time, end_time, room)
                 VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
                [teacherRes.rows[0].id, section_id, subject_id, day, start_time, end_time, room]
            );

            await client.query(
                `INSERT INTO enrollments (student_id, section_id, subject_id)
                 SELECT id, $1, $2
                 FROM students
                 WHERE section_id = $1 AND active = true
                 ON CONFLICT (student_id, section_id, subject_id)
                 DO UPDATE SET active = true`,
                [section_id, subject_id]
            );

            return assignmentRes.rows;
        });

        res.status(201).json(rows[0]);
    } catch (error) {
        res.status(500).json({ error: 'Failed to create assignment' });
    }
};

export const updateAssignment = async (req, res) => {
    try {
        const { id } = req.params;

        const teacherRes = await query(
            'SELECT id FROM teachers WHERE user_id = $1',
            [req.user.id]
        );
        if (!teacherRes.rows.length) {
            return res.status(404).json({ error: 'Teacher profile not found' });
        }

        const currentRes = await query(
            'SELECT * FROM teacher_assignments WHERE id = $1 AND teacher_id = $2',
            [id, teacherRes.rows[0].id]
        );
        if (!currentRes.rows.length) {
            return res.status(404).json({ error: 'Assignment not found' });
        }

        const current = currentRes.rows[0];
        const section_id = req.body.section_id ?? current.section_id;
        const subject_id = req.body.subject_id ?? current.subject_id;
        const day = req.body.day ?? req.body.day_of_week ?? current.day;
        const start_time = req.body.start_time ?? current.start_time;
        const end_time = req.body.end_time ?? current.end_time;
        const room = req.body.room ?? current.room;
        const active = req.body.active ?? current.active;

        if (start_time >= end_time) {
            return res.status(400).json({ error: 'End time must be later than start time.' });
        }

        const resourceCheck = await query(
            `SELECT 1
             FROM sections sec
             CROSS JOIN subjects sub
             WHERE sec.id = $1 AND sec.active = true
               AND sub.id = $2 AND sub.active = true`,
            [section_id, subject_id]
        );
        if (!resourceCheck.rows.length) {
            return res.status(400).json({ error: 'Section or subject does not exist or is inactive.' });
        }

        const { rows } = await query(
            `UPDATE teacher_assignments
             SET section_id = $1,
                 subject_id = $2,
                 day = $3,
                 start_time = $4,
                 end_time = $5,
                 room = $6,
                 active = $7
             WHERE id = $8 AND teacher_id = $9
             RETURNING *`,
            [
                section_id,
                subject_id,
                day,
                start_time,
                end_time,
                room,
                active,
                id,
                teacherRes.rows[0].id
            ]
        );

        // Keep current students in the destination subject automatically enrolled.
        if (active) {
            await query(
                `INSERT INTO enrollments (student_id, section_id, subject_id)
                 SELECT id, $1, $2
                 FROM students
                 WHERE section_id = $1 AND active = true
                 ON CONFLICT (student_id, section_id, subject_id)
                 DO UPDATE SET active = true`,
                [section_id, subject_id]
            );
        }

        res.json(rows[0]);
    } catch (error) {
        console.error('Update assignment error:', error);
        if (error.code === '23505') {
            return res.status(409).json({ error: 'This teaching assignment already exists.' });
        }
        res.status(500).json({ error: 'Failed to update assignment' });
    }
};

export const getSchedule = async (req, res) => {
    try {
        const teacherRes = await query('SELECT id FROM teachers WHERE user_id = $1', [req.user.id]);
        if (teacherRes.rows.length === 0) return res.status(404).json({ error: 'Teacher profile not found' });

        const { rows } = await query(`
            SELECT ta.*, sec.section_name, sub.subject_name, sub.subject_code
            FROM teacher_assignments ta
            JOIN sections sec ON ta.section_id = sec.id
            JOIN subjects sub ON ta.subject_id = sub.id
            WHERE ta.teacher_id = $1 AND ta.active = true
            ORDER BY 
                CASE day 
                    WHEN 'Monday' THEN 1 
                    WHEN 'Tuesday' THEN 2 
                    WHEN 'Wednesday' THEN 3 
                    WHEN 'Thursday' THEN 4 
                    WHEN 'Friday' THEN 5 
                    WHEN 'Saturday' THEN 6 
                    WHEN 'Sunday' THEN 7 
                END, 
                ta.start_time
        `, [teacherRes.rows[0].id]);
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch schedule' });
    }
};

export const getProfile = async (req, res) => {
    try {
        const { rows } = await query(`
            SELECT t.name, t.email, t.teacher_id, t.created_at 
            FROM teachers t
            WHERE t.user_id = $1
        `, [req.user.id]);
        
        if (rows.length === 0) return res.status(404).json({ error: 'Profile not found' });
        res.json(rows[0]);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch profile' });
    }
};

export const updateProfile = async (req, res) => {
    try {
        const { name, email } = req.body;
        if (!name || !email) return res.status(400).json({ error: 'Name and email are required' });

        await withTransaction(async (client) => {
            await client.query(`UPDATE users SET name = $1, email = $2, updated_at = NOW() WHERE id = $3`, [name, email, req.user.id]);
            await client.query(`UPDATE teachers SET name = $1, email = $2 WHERE user_id = $3`, [name, email, req.user.id]);
        });

        res.json({ success: true, name, email });
    } catch (error) {
        res.status(500).json({ error: 'Failed to update profile' });
    }
};
