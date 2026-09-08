import { query } from '../config/db.js';
import * as emailService from './emailService.js';

const processAttendanceNotifications = async ({ records, subjectId, date }) => {
  try {
    const subjectResult = await query(
      'SELECT subject_name FROM subjects WHERE id = $1',
      [subjectId]
    );

    if (!subjectResult.rows.length) {
      return { sent: 0, failed: 0, warnings: 0 };
    }

    const subjectName = subjectResult.rows[0].subject_name;
    let sent = 0;
    let failed = 0;
    let warnings = 0;

    await Promise.allSettled(
      records.map(async (record) => {
        try {
          const studentResult = await query(
            `SELECT name, email
             FROM students
             WHERE id = $1
             LIMIT 1`,
            [record.student_id]
          );

          const student = studentResult.rows[0];
          if (!student?.email) return;


          let emailResult;
          if (record.status === 'Present') {
            emailResult = await emailService.sendPresentEmail({
              toEmail: student.email,
              studentName: student.name,
              subjectName,
              date,
              percentage: record.percentage
            });
          } else {
            emailResult = await emailService.sendAbsentEmail({
              toEmail: student.email,
              studentName: student.name,
              subjectName,
              date,
              percentage: record.percentage
            });
          }

          if (emailResult?.success) {
            sent++;
          } else {
            failed++;
          }

          const previousStatus = record.previous_status;
          const previousTotal = previousStatus ? Number(record.total) : Number(record.total) - 1;
          const previousPresent = previousStatus === 'Present'
            ? Number(record.present) + 1
            : Number(record.present);
          const previousPercentage = previousTotal > 0
            ? (previousPresent / previousTotal) * 100
            : 100;

          const crossedBelow75 =
            Number(record.percentage) < 75 &&
            previousPercentage >= 75;
          if (crossedBelow75) {
            const warningResult = await emailService.sendLowAttendanceEmail({
              toEmail: student.email,
              studentName: student.name,
              subjectName,
              presentCount: record.present,
              absentCount: record.absent,
              totalClasses: record.total,
              percentage: record.percentage
            });

            if (warningResult?.success) {
              warnings++;
              sent++;
            } else {
              failed++;
            }
          }
        } catch (error) {
          console.error(`[NOTIFICATION ERROR] student ${record.student_id}`, error);
          failed++;
        }
      })
    );

    return { sent, failed, warnings };
  } catch (error) {
    console.error('[NOTIFICATION SERVICE ERROR]', error);
    return { sent: 0, failed: 0, warnings: 0 };
  }
};

export { processAttendanceNotifications };
