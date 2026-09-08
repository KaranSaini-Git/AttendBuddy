import { Resend } from 'resend';
import env from '../config/env.js';

let resend = null;
if (env.RESEND_API_KEY) {
  resend = new Resend(env.RESEND_API_KEY);
}

const mockSend = (subject, toEmail, data) => {
  console.log(`[MOCK EMAIL] To: ${toEmail} | Subject: ${subject}`);
  console.log(JSON.stringify(data, null, 2));
  return { data: { id: 'mock_' + Date.now() }, error: null };
};

const sendEmailWrapper = async ({ toEmail, subject, html }) => {
  if (!resend) {
    const { data, error } = mockSend(subject, toEmail, { html });
    return { success: true, id: data.id };
  }

  try {
    const { data, error } = await resend.emails.send({
      from: env.EMAIL_FROM || 'AttendBuddy <noreply@attendbuddy.com>',
      to: toEmail,
      subject,
      html,
    });

    if (error) {
      console.error('[EMAIL ERROR]', error);
      return { success: false, error };
    }
    return { success: true, id: data?.id };
  } catch (error) {
    console.error('[EMAIL EXCEPTION]', error);
    return { success: false, error: error.message };
  }
};

const sendPresentEmail = async ({ toEmail, studentName, subjectName, date, percentage }) => {
  const subject = '✅ Attendance Marked — Present';
  const html = `
    <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden;">
      <div style="background-color: #4CAF50; color: white; padding: 20px; text-align: center;">
        <h2 style="margin: 0;">Attendance Present</h2>
      </div>
      <div style="padding: 20px;">
        <p>Hello <strong>${studentName}</strong>,</p>
        <p>Your attendance for <strong>${subjectName}</strong> on <strong>${date}</strong> has been marked as <strong style="color: #4CAF50;">Present</strong>.</p>
        <p>Your current attendance percentage for this subject is: <strong>${Number(percentage).toFixed(2)}%</strong></p>
        <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;">
        <p style="font-size: 12px; color: #888; text-align: center;">This is an automated message from AttendBuddy.</p>
      </div>
    </div>
  `;
  return sendEmailWrapper({ toEmail, subject, html });
};

const sendAbsentEmail = async ({ toEmail, studentName, subjectName, date, percentage }) => {
  const subject = '⚠️ Attendance Alert — You Were Absent';
  const html = `
    <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden;">
      <div style="background-color: #f44336; color: white; padding: 20px; text-align: center;">
        <h2 style="margin: 0;">Attendance Alert</h2>
      </div>
      <div style="padding: 20px;">
        <p>Hello <strong>${studentName}</strong>,</p>
        <p>Your attendance for <strong>${subjectName}</strong> on <strong>${date}</strong> has been marked as <strong style="color: #f44336;">Absent</strong>.</p>
        <p>Your current attendance percentage for this subject is: <strong>${Number(percentage).toFixed(2)}%</strong></p>
        <p>Regular attendance is crucial for your academic success. We encourage you to attend future classes.</p>
        <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;">
        <p style="font-size: 12px; color: #888; text-align: center;">This is an automated message from AttendBuddy.</p>
      </div>
    </div>
  `;
  return sendEmailWrapper({ toEmail, subject, html });
};

const sendLowAttendanceEmail = async ({ toEmail, studentName, subjectName, presentCount, absentCount, totalClasses, percentage }) => {
  const subject = '🚨 Attendance Warning — Below 75%';
  const html = `
    <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto; border: 2px solid #ff9800; border-radius: 8px; overflow: hidden;">
      <div style="background-color: #ff9800; color: white; padding: 20px; text-align: center;">
        <h2 style="margin: 0;">Low Attendance Warning</h2>
      </div>
      <div style="padding: 20px;">
        <p>Hello <strong>${studentName}</strong>,</p>
        <p>This is a formal warning that your attendance for <strong>${subjectName}</strong> has fallen below the mandatory 75% requirement.</p>
        <div style="background-color: #fff3e0; padding: 15px; border-radius: 5px; margin: 15px 0;">
          <h3 style="margin-top: 0; color: #e65100;">Current Stats</h3>
          <ul style="list-style: none; padding: 0; margin: 0;">
            <li style="margin-bottom: 5px;">Total Classes: <strong>${totalClasses}</strong></li>
            <li style="margin-bottom: 5px; color: #4CAF50;">Present: <strong>${presentCount}</strong></li>
            <li style="margin-bottom: 5px; color: #f44336;">Absent: <strong>${absentCount}</strong></li>
            <li style="margin-top: 10px; font-size: 18px;">Percentage: <strong style="color: #d32f2f;">${Number(percentage).toFixed(2)}%</strong></li>
          </ul>
        </div>
        <p>Please contact your instructor immediately to discuss your attendance and prevent any impact on your grades or eligibility.</p>
        <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;">
        <p style="font-size: 12px; color: #888; text-align: center;">This is an automated message from AttendBuddy.</p>
      </div>
    </div>
  `;
  return sendEmailWrapper({ toEmail, subject, html });
};

export { sendPresentEmail, sendAbsentEmail, sendLowAttendanceEmail };

const sendPasswordResetEmail = async ({ toEmail, userName, resetUrl }) => {
  const subject = 'Reset your AttendBuddy password';
  const html = `
    <div style="font-family:Inter,Arial,sans-serif;max-width:620px;margin:0 auto;padding:24px;background:#f8fafc;color:#0f172a">
      <div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:18px;padding:32px">
        <div style="font-size:14px;font-weight:700;color:#2563eb;letter-spacing:.04em">ATTENDBUDDY</div>
        <h2 style="margin:16px 0 8px;font-size:24px">Reset your password</h2>
        <p style="color:#475569;line-height:1.6">Hi ${userName || 'there'}, we received a request to reset your AttendBuddy password.</p>
        <p style="color:#475569;line-height:1.6">This link will expire in 60 minutes and can only be used once.</p>
        <a href="${resetUrl}" style="display:inline-block;margin:20px 0;padding:12px 18px;background:#2563eb;color:#fff;text-decoration:none;border-radius:10px;font-weight:700">Reset password</a>
        <p style="font-size:12px;color:#64748b;line-height:1.5">If you did not request this, you can safely ignore this email.</p>
      </div>
    </div>
  `;
  return sendEmailWrapper({ toEmail, subject, html });
};

export { sendPasswordResetEmail };
