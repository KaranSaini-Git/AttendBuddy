import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../../../.env') });

const env = {
  PORT: process.env.PORT || 5001,
  DATABASE_URL: process.env.DATABASE_URL || 'postgresql://attendbuddy:attendbuddy_dev@localhost:5433/attendbuddy',
  JWT_SECRET: process.env.JWT_SECRET || 'attendbuddy-dev-secret-change-in-production',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',
  RESEND_API_KEY: process.env.RESEND_API_KEY,
  EMAIL_FROM: process.env.EMAIL_FROM || 'AttendBuddy <onboarding@resend.dev>',
  FRONTEND_URL: process.env.FRONTEND_URL || 'http://localhost:5173',
  SETUP_CODE: process.env.ATTENDBUDDY_SETUP_CODE || 'attendbuddy-setup',
  NODE_ENV: process.env.NODE_ENV || 'development'
};

export default env;
