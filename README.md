# AttendBuddy — Deployment Guide

## 1. Recommended Production Stack

- **Frontend:** React + Vite → Vercel
- **Backend:** Node.js + Express → Render / Railway
- **Database:** PostgreSQL → Neon / Supabase / Railway
- **Email:** Resend / SendGrid

Do not use the local Docker database as the production database.

## 2. Production Environment Variables

Set these on the backend hosting platform:

```env
DATABASE_URL=<production-postgresql-url>
JWT_SECRET=<strong-random-secret>
JWT_EXPIRES_IN=7d
PORT=5001
NODE_ENV=production
FRONTEND_URL=https://your-frontend-domain.com
ATTENDBUDDY_SETUP_CODE=<strong-private-code>
EMAIL_PROVIDER=resend
EMAIL_API_KEY=<your-email-api-key>
EMAIL_FROM=<verified-sender>
```

Never commit `.env` or real secrets to Git.

## 3. Prepare the Repository

Keep:

```text
backend/
frontend/
database/migrations/
docker-compose.yml
.env.example
.gitignore
README.md
```

Remove development-only files, old ZIPs, `node_modules`, and build output.

Make sure demo credentials and fake student data are not committed.

## 4. Database

Create the production PostgreSQL database.

From the backend:

```bash
npm install
npm run migrate
```

Do not run destructive reset commands against production.

After migration, create the real teacher account through the setup page.

## 5. Deploy Backend

Push the repository to GitHub.

Create a Node/Express service on Render, Railway, or a similar platform.

Set the production environment variables.

Use the production start command from `package.json`, for example:

```bash
npm start
```

Confirm the backend is reachable.

## 6. Deploy Frontend

Create a Vercel/Netlify project from the `frontend` directory.

Build command:

```bash
npm run build
```

Set the production API URL/configuration required by the frontend.

Make sure the frontend points to the deployed backend, not `localhost`.

## 7. CORS

Configure the backend to allow only the production frontend domain.

Example:

```text
https://your-frontend-domain.com
```

Do not leave authenticated APIs open to all origins.

## 8. First Production Setup

After deployment:

```text
1. Open the teacher setup page
2. Create the real teacher account
3. Log in
4. Create sections
5. Create subjects
6. Import students
7. Create assignments
8. Create schedules
9. Test attendance
10. Test emails
```

## 9. Final Test

Verify:

- Teacher login
- Student login
- Mark/edit attendance
- Duplicate prevention
- Student dashboard
- 75% warning
- Present/Absent emails
- Forgot password
- CSV export
- Excel export
- Mobile layout

## 10. Important Security Rules

Never deploy:

```text
.env
API keys
JWT secrets
student passwords
database passwords
private CSV/Excel files
```

Use strong production secrets and HTTPS.

For backups, use your PostgreSQL provider's backup/restore features before making major production changes.
