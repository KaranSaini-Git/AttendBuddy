import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import * as db from '../config/db.js';
import env from '../config/env.js';
import crypto from 'node:crypto';
import { sendPasswordResetEmail } from '../services/emailService.js';

const buildToken = (user) => jwt.sign({
  id: user.id,
  user_id: user.user_id,
  role: user.role,
  name: user.name,
  email: user.email,
  must_change_password: user.must_change_password
}, env.JWT_SECRET || 'attendbuddy_secret', {
  expiresIn: env.JWT_EXPIRES_IN || '1d'
});

const login = async (req, res) => {
  try {
    const { user_id, password } = req.body;
    if (!user_id || !password) return res.status(400).json({ error: 'User ID and password are required' });

    const result = await db.query('SELECT * FROM users WHERE user_id = $1', [user_id.trim()]);
    const user = result.rows[0];
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) return res.status(401).json({ error: 'Invalid credentials' });

    const tokenPayload = {
      id: user.id,
      user_id: user.user_id,
      role: user.role,
      name: user.name,
      email: user.email,
      must_change_password: user.must_change_password
    };

    res.json({ token: buildToken(tokenPayload), user: tokenPayload });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const getSetupStatus = async (req, res) => {
  try {
    const result = await db.query("SELECT COUNT(*)::int AS count FROM users WHERE role = 'teacher'");
    res.json({ available: result.rows[0].count === 0 });
  } catch (err) {
    console.error('Setup status error:', err);
    res.status(500).json({ error: 'Unable to determine setup status' });
  }
};

const createInitialTeacher = async (req, res) => {
  try {
    const { teacher_id, name, email, password, confirm_password, setup_code } = req.body;
    if (!teacher_id || !name || !email || !password || !confirm_password) {
      return res.status(400).json({ error: 'Teacher ID, name, email, password and confirmation are required' });
    }
    if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters long' });
    if (!setup_code || setup_code !== env.SETUP_CODE) return res.status(403).json({ error: 'Invalid setup code.' });
    if (password !== confirm_password) return res.status(400).json({ error: 'Passwords do not match' });

    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');

      const normalizedTeacherId = teacher_id.trim();
      const duplicate = await client.query('SELECT id FROM users WHERE user_id = $1', [normalizedTeacherId]);
      if (duplicate.rows.length) {
        await client.query('ROLLBACK');
        return res.status(409).json({ error: 'That Teacher ID is already in use.' });
      }

      const passwordHash = await bcrypt.hash(password, 12);
      const userResult = await client.query(
        `INSERT INTO users (user_id, password_hash, role, email, name, must_change_password)
         VALUES ($1, $2, 'teacher', $3, $4, false)
         RETURNING id, user_id, role, email, name, must_change_password`,
        [normalizedTeacherId, passwordHash, email.trim(), name.trim()]
      );
      const user = userResult.rows[0];

      await client.query(
        `INSERT INTO teachers (user_id, teacher_id, name, email) VALUES ($1, $2, $3, $4)`,
        [user.id, user.user_id, user.name, user.email]
      );

      await client.query('COMMIT');
      res.status(201).json({ message: 'Teacher account created successfully. You can now sign in.' });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Create initial teacher error:', err);
    if (err.code === '23505') return res.status(409).json({ error: 'That Teacher ID or email is already in use.' });
    res.status(500).json({ error: 'Unable to create teacher account' });
  }
};

const changePassword = async (req, res) => {
  try {
    const { current_password, new_password } = req.body;
    const userId = req.user.id;
    if (!current_password || !new_password) return res.status(400).json({ error: 'Current password and new password are required' });
    if (new_password.length < 8) return res.status(400).json({ error: 'New password must be at least 8 characters long' });

    const result = await db.query('SELECT * FROM users WHERE id = $1', [userId]);
    const user = result.rows[0];
    if (!user) return res.status(404).json({ error: 'User not found' });

    const isMatch = await bcrypt.compare(current_password, user.password_hash);
    if (!isMatch) return res.status(401).json({ error: 'Incorrect current password' });

    const passwordHash = await bcrypt.hash(new_password, 10);
    await db.query('UPDATE users SET password_hash = $1, must_change_password = false, updated_at = NOW() WHERE id = $2', [passwordHash, userId]);

    const tokenPayload = { id: user.id, user_id: user.user_id, role: user.role, name: user.name, email: user.email, must_change_password: false };
    res.json({ token: buildToken(tokenPayload), message: 'Password changed successfully' });
  } catch (err) {
    console.error('Change password error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};


const forgotPassword = async (req, res) => {
  try {
    const { user_id, email } = req.body;
    if (!user_id || !email) {
      return res.status(400).json({ error: 'User ID and email are required.' });
    }

    const result = await db.query(
      'SELECT id, user_id, name, email FROM users WHERE user_id = $1 AND LOWER(email) = LOWER($2) LIMIT 1',
      [user_id.trim(), email.trim()]
    );

    if (!result.rows.length) {
      return res.json({ message: 'If the details match an account, a password reset link has been sent.' });
    }

    const user = result.rows[0];
    await db.query('DELETE FROM password_reset_tokens WHERE user_id = $1 OR expires_at < NOW()', [user.id]);

    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    await db.query(
      'INSERT INTO password_reset_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, NOW() + INTERVAL \'60 minutes\')',
      [user.id, tokenHash]
    );

    const resetUrl = `${env.FRONTEND_URL}/reset-password?token=${rawToken}`;
    const emailResult = await sendPasswordResetEmail({ toEmail: user.email, userName: user.name, resetUrl });

    if (!emailResult.success) {
      console.error('Password reset email failed:', emailResult.error);
      return res.status(500).json({ error: 'Unable to send the reset email right now.' });
    }

    const payload = { message: 'If the details match an account, a password reset link has been sent.' };
    if (env.NODE_ENV !== 'production' && !env.RESEND_API_KEY) payload.dev_reset_url = resetUrl;
    res.json(payload);
  } catch (err) {
    console.error('Forgot password error:', err);
    res.status(500).json({ error: 'Unable to process password reset.' });
  }
};

const resetPassword = async (req, res) => {
  try {
    const { token, new_password, confirm_password } = req.body;
    if (!token || !new_password || !confirm_password) {
      return res.status(400).json({ error: 'Reset token and password fields are required.' });
    }
    if (new_password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters long.' });
    }
    if (new_password !== confirm_password) {
      return res.status(400).json({ error: 'Passwords do not match.' });
    }

    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const result = await db.query(
      `SELECT prt.id, prt.user_id, u.user_id AS login_id
       FROM password_reset_tokens prt
       JOIN users u ON u.id = prt.user_id
       WHERE prt.token_hash = $1
         AND prt.used_at IS NULL
         AND prt.expires_at > NOW()
       LIMIT 1`,
      [tokenHash]
    );

    if (!result.rows.length) {
      return res.status(400).json({ error: 'This reset link is invalid or has expired.' });
    }

    const passwordHash = await bcrypt.hash(new_password, 12);
    await db.withTransaction(async (client) => {
      await client.query(
        'UPDATE users SET password_hash = $1, must_change_password = false, updated_at = NOW() WHERE id = $2',
        [passwordHash, result.rows[0].user_id]
      );
      await client.query('UPDATE password_reset_tokens SET used_at = NOW() WHERE id = $1', [result.rows[0].id]);
      await client.query('DELETE FROM password_reset_tokens WHERE user_id = $1 AND id <> $2', [result.rows[0].user_id, result.rows[0].id]);
    });

    res.json({ message: 'Password reset successfully. You can now sign in.' });
  } catch (err) {
    console.error('Reset password error:', err);
    res.status(500).json({ error: 'Unable to reset password.' });
  }
};

const getMe = async (req, res) => {
  try {
    const result = await db.query(
      'SELECT id, user_id, role, name, email, must_change_password, created_at FROM users WHERE id = $1',
      [req.user.id]
    );
    const user = result.rows[0];
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  } catch (err) {
    console.error('Get me error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export { login, getSetupStatus, createInitialTeacher, changePassword, getMe, forgotPassword, resetPassword };
