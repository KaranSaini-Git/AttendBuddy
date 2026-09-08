# AttendBuddy — Complete User & Project Navigation Guide

AttendBuddy is a full-stack attendance management system with two roles:

- **Teacher** — manages sections, subjects, students, schedules, assignments, attendance, reports, and exports.
- **Student** — views personal attendance, subject-wise attendance, calendar/history, and attendance warnings.

This guide explains **how the project is organized, how to run it, how to configure it, and how to use every major feature**.

---

## 1. How AttendBuddy Works

The application has three main parts:

```text
React + Vite Frontend
        ↓
Node.js + Express Backend
        ↓
PostgreSQL Database
```

PostgreSQL runs through Docker during local development.

Typical local ports:

```text
Frontend       http://localhost:5173
Backend        http://localhost:5001
PostgreSQL     localhost:5433
```

The exact ports are controlled by your `.env` and `docker-compose.yml`.

---

# 2. Project Structure

The project is organized roughly like this:

```text
AttendBuddy/
│
├── backend/
│   ├── src/
│   │   ├── controllers/
│   │   ├── routes/
│   │   ├── middleware/
│   │   ├── services/
│   │   ├── models/
│   │   ├── utils/
│   │   ├── config/
│   │   ├── server.js
│   │   └── migrate.js
│   ├── package.json
│   └── .env
│
├── database/
│   └── migrations/
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── context/
│   │   ├── layouts/
│   │   ├── pages/
│   │   ├── services/
│   │   ├── hooks/
│   │   └── utils/
│   ├── package.json
│   └── vite.config.js
│
├── docker-compose.yml
├── .env
└── README.md
```

### Where to look when changing something

| Area | Main location |
|---|---|
| Login/authentication UI | `frontend/src/pages/...` |
| Teacher pages | `frontend/src/pages/teacher/` |
| Student pages | `frontend/src/pages/student/` |
| Shared UI components | `frontend/src/components/` |
| Teacher/student layouts | `frontend/src/layouts/` |
| API routes | `backend/src/routes/` |
| Business logic | `backend/src/controllers/` / `backend/src/services/` |
| Authentication middleware | `backend/src/middleware/` |
| Database migrations | `database/migrations/` |
| Database connection/config | `backend/src/config/` and `.env` |
| Docker PostgreSQL | `docker-compose.yml` |

---

# 3. First-Time Local Setup

## Step 1 — Open the project

```bash
cd ~/Downloads/AttendBuddy
```

Check:

```bash
ls
```

You should see the `backend`, `frontend`, `database`, and `docker-compose.yml`.

---

## Step 2 — Configure environment variables

Create the root `.env` if it does not exist:

```bash
cp .env.example .env
```

Your local database URL should match the Docker port mapping.

Example:

```env
DATABASE_URL=postgresql://attendbuddy:attendbuddy_dev@localhost:5433/attendbuddy
JWT_SECRET=change-this-in-production
JWT_EXPIRES_IN=7d

PORT=5001
NODE_ENV=development
FRONTEND_URL=http://localhost:5173

ATTENDBUDDY_SETUP_CODE=change-this
EMAIL_PROVIDER=resend
EMAIL_API_KEY=
EMAIL_FROM=
```

Never commit real secrets to Git.

---

# 4. Start PostgreSQL

From the project root:

```bash
docker compose up -d
```

Check:

```bash
docker compose ps
```

You want the PostgreSQL service to show as running.

Example:

```text
attendbuddy-postgres    Up
0.0.0.0:5433->5432/tcp
```

### Important

PostgreSQL's internal Docker port remains `5432`.

The Mac host port can be `5433` if port `5432` is already occupied.

---

# 5. Install Backend Dependencies

```bash
cd backend
npm install
```

---

# 6. Create/Update Database Tables

Run:

```bash
npm run migrate
```

A successful migration should finish without a PostgreSQL authentication error.

Do not rerun a seed migration later if you intentionally wiped the demo data and want to keep your database empty.

---

# 7. Start Backend

From:

```text
AttendBuddy/backend
```

run:

```bash
npm run dev
```

You should see a successful database connection and the backend listening on your configured port.

Example:

```text
[database] Connected successfully.
Server running on port 5001
```

### If you get `EADDRINUSE`

That means the port is already being used.

Check:

```bash
lsof -nP -iTCP:5001 -sTCP:LISTEN
```

Stop the old process or change the backend port consistently in `.env` and the frontend proxy.

---

# 8. Start Frontend

Open a second terminal:

```bash
cd ~/Downloads/AttendBuddy/frontend
npm install
npm run dev
```

Open:

```text
http://localhost:5173
```

---

# 9. Important Local Services

Keep these running while testing:

```text
Terminal 1 → Docker/PostgreSQL
Terminal 2 → Node/Express backend
Terminal 3 → React/Vite frontend
```

---

# 10. Creating the First Teacher Account

AttendBuddy does not use an unrestricted public teacher signup.

Instead, first-time setup uses the teacher setup page:

```text
http://localhost:5173/setup/teacher
```

The page asks for:

- Teacher ID
- Full name
- Email address
- Password
- Confirm password
- Setup code

The setup code is the secret stored in:

```env
ATTENDBUDDY_SETUP_CODE=...
```

Use the value from your environment file.

### Why the setup code exists

Without it, anybody who discovers the setup URL could create a teacher account.

Once a teacher account exists, normal users should use the login page.

---

# 11. Teacher Login

Open:

```text
http://localhost:5173/login
```

Enter:

```text
Teacher ID
Password
```

The backend authenticates the account and redirects to the Teacher Dashboard.

---

# 12. Teacher Navigation

The teacher workspace contains the following major areas:

```text
Dashboard
Mark Attendance
Attendance History
Reports

Students
Sections
Subjects
Assignments
My Schedule

Export
Profile
Logout
```

The exact appearance may change as the UI is redesigned, but these are the main workflows.

---

# 13. Teacher Dashboard

The dashboard is the teacher's overview.

It should show information such as:

- Total students
- Classes today
- Present today
- Absent today
- Average attendance
- Students below 75%
- Attendance trends
- Subject performance
- At-risk students

### What to use it for

Use the dashboard to quickly answer:

- How many students do I manage?
- How many classes are scheduled?
- Who has low attendance?
- What is today's attendance situation?
- Is attendance improving or declining?

---

# 14. Create Sections

Go to:

```text
Teacher → Sections
```

Create your real sections.

Examples:

```text
24E1G1
24E1G2
24E2G1
```

Use the names actually used by your institution.

### Do not confuse a section with a subject

A section is the student group/class.

A subject is the course taught to that group.

---

# 15. Create Subjects

Go to:

```text
Teacher → Subjects
```

Add:

- Subject name
- Subject code

Example:

```text
Data Structures
CS301
```

or:

```text
PPWC
CS304
```

Create each subject that the teacher actually teaches.

---

# 16. Add Students

Go to:

```text
Teacher → Students
```

You can add students individually or use the bulk import workflow when available.

A student should have:

- Student ID / registration number
- Name
- Email
- Section

Example:

```text
Student ID: 24E118A32
Name: Ankit Raj
Email: example@gmail.com
Section: 24E1G1
```

The student's email is important because it is used for attendance notifications and password-reset emails.

---

# 17. Bulk Student Import

This is the preferred method for importing a large class.

The Google Sheet format you showed is:

```text
Timestamp
Student name
Regd no.
email id
```

The intended mapping is:

```text
Student name → Student Name
Regd no.     → Student ID
email id     → Email
```

### Recommended workflow

1. Export/download the Google Sheet as CSV.
2. Open AttendBuddy.
3. Go to:
   `Teacher → Students`
4. Choose:
   `Import from Sheet` / CSV import.
5. Select the section.
6. Upload the CSV or paste the copied rows.
7. Review the preview.
8. Confirm import.
9. Verify the students appear in the Students page.

### What should happen

For each valid row, AttendBuddy should:

```text
Create student
↓
Create login account
↓
Assign student to section
↓
Enroll in the applicable subjects
↓
Generate temporary credentials if required
```

Always review the import result before starting attendance.

---

# 18. Student Credentials

Students log in using:

```text
Student ID
Password
```

The email address is not the login ID.

If a student receives a temporary password, they should change it after first login.

Keep credential files private.

Do not publish student passwords in Git or a public repository.

---

# 19. Assign Subjects to Sections

This is one of the most important parts of AttendBuddy.

Go to:

```text
Teacher → Assignments
```

Create a teacher assignment connecting:

```text
Section + Subject + Schedule
```

Example:

```text
Section: 24E1G1
Subject: PPWC
Day: Wednesday
Start: 10:00 AM
End: 11:00 AM
Room: 111
```

### Why this is necessary

Students can belong to a section without the teacher actually teaching every subject to that section.

The assignment tells AttendBuddy:

> This teacher is allowed to teach this subject to this section.

This assignment is also what makes the subject appear in the attendance workflow.

---

# 20. My Schedule

Go to:

```text
Teacher → My Schedule
```

Use this page to define the weekly timetable.

A schedule should normally contain:

- Section
- Subject
- Day
- Start time
- End time
- Room (optional)

Example:

```text
Monday
09:00–10:00
Data Structures
CSE-A
Room 101
```

### Important

A schedule does not automatically mark anyone Present.

It only describes the teaching timetable.

Attendance is still manually recorded by the teacher.

---

# 21. Mark Attendance

Go to:

```text
Teacher → Mark Attendance
```

Typical workflow:

```text
Select Section
↓
Select Subject
↓
Select Date
↓
Load Students
↓
Mark Present/Absent
↓
Review
↓
Submit Attendance
```

### Example

```text
Section: 24E1G1
Subject: PPWC
Date: 09/09/2026
```

Then mark each student.

Useful actions:

- Mark all Present
- Mark all Absent
- Change individual status
- Reset
- Submit

---

# 22. Attendance Rules

An attendance record represents:

```text
Student + Subject + Date
```

There must not be duplicate records for the same combination.

The database should enforce uniqueness.

### Example

Valid:

```text
24E118A32 + PPWC + 2026-09-09
```

Invalid duplicate:

```text
24E118A32 + PPWC + 2026-09-09
```

again.

If the teacher needs to correct attendance, use the edit functionality rather than creating a second record.

---

# 23. Editing Attendance

Go to:

```text
Teacher → Attendance History
```

Filter by:

- Section
- Subject
- Date range

Find the record and edit Present/Absent as needed.

The system should update the existing record rather than inserting a duplicate.

---

# 24. Attendance Calculation

AttendBuddy should calculate attendance as:

```text
Present Classes / Total Classes × 100
```

Example:

```text
Present = 18
Absent = 2
Total = 20

Attendance = 18 / 20 × 100
           = 90%
```

Calculations should be based on actual counts.

---

# 25. Student 75% Warning

The required attendance threshold is:

```text
75%
```

When a student's attendance drops below the threshold, the system should:

- show a warning on the student dashboard
- highlight the affected subject
- send the appropriate warning email

Example:

```text
Attendance: 72%

Warning:
Your attendance is below the required 75%.
```

The system should avoid repeatedly sending identical warning emails.

---

# 26. Email Notifications

Students can receive emails for attendance activity.

## Present

The email should contain:

- Student name
- Subject
- Date
- Present status
- Current attendance percentage

## Absent

The email should contain:

- Student name
- Subject
- Date
- Absent status
- Current attendance percentage

## Low Attendance

When attendance crosses below 75%, the warning should contain:

- Subject
- Current percentage
- Present count
- Absent count
- Total classes
- Attendance warning

---

# 27. Email Configuration

A production-friendly transactional email provider should be configured through environment variables.

Example:

```env
EMAIL_PROVIDER=resend
EMAIL_API_KEY=...
EMAIL_FROM=...
```

Never put API keys directly inside JavaScript files.

### Local development without email configuration

If email delivery is not configured, use the application's local development/reset behavior for testing where supported.

Before deployment, configure a real transactional email provider.

---

# 28. Forgot Password

The login page should have:

```text
Forgot password?
```

Typical workflow:

```text
Forgot password
↓
Enter User ID + Email
↓
Request reset
↓
Receive reset link
↓
Open reset page
↓
Set new password
↓
Login normally
```

Reset tokens should be:

- time-limited
- one-time use
- stored securely
- invalid after use

---

# 29. Student Dashboard

Students should use:

```text
Student → Dashboard
```

The dashboard should show:

- Overall attendance
- Present count
- Absent count
- Total classes
- Subject-wise attendance
- Low-attendance warnings
- Recent attendance trend
- Quick links to Attendance and Calendar

Students must never see another student's information.

---

# 30. Student Attendance Page

Go to:

```text
Student → Attendance
```

This is the student's detailed attendance history.

Useful filters:

- Subject
- From date
- To date
- Status

The table should display:

```text
Date
Subject
Section
Status
```

Example:

```text
09 Sep 2026
PPWC
24E1G1
Present
```

---

# 31. Student Calendar

Go to:

```text
Student → Calendar
```

Use the calendar to identify attendance by date.

The calendar should make it easy to see:

- Present days
- Absent days

This is a visual alternative to the attendance history table.

---

# 32. Student Subjects

Go to:

```text
Student → Subjects
```

This should list the subjects the student is enrolled in.

For each subject, show:

- Subject code
- Subject name
- Present
- Absent
- Total classes
- Attendance percentage
- 75% status

---

# 33. Student Profile

Go to:

```text
Student → Profile
```

The student should be able to review their account information.

Do not expose sensitive data unnecessarily.

---

# 34. Teacher Reports

Go to:

```text
Teacher → Reports
```

Use filters such as:

- Section
- Subject
- Student
- Date range

Useful report information:

```text
Total classes
Present
Absent
Attendance %
Students below 75%
```

Reports should reflect database data rather than hardcoded demo values.

---

# 35. Exporting Attendance

Go to:

```text
Teacher → Export
```

Available formats should include:

```text
CSV
Excel (.xlsx)
```

Recommended columns:

```text
Date
Student ID
Student Name
Section
Subject
Status
Attendance Percentage
```

Apply filters before exporting.

Example:

```text
Section: 24E1G1
Subject: PPWC
From: 01/09/2026
To: 09/09/2026
```

Then export the result.

---

# 36. How the Data is Related

The simplest way to understand the database is:

```text
Teacher
  │
  ├── teaches
  │      ↓
  │   Subject
  │      +
  │   Section
  │
  └── manages
         ↓
      Students
         ↓
     Enrollment
         ↓
    Attendance
```

Schedule connects the teacher's teaching plan to:

```text
Section + Subject + Day + Time + Room
```

---

# 37. Recommended Setup Order for a New Semester

For a clean semester setup, do things in this order:

```text
1. Create teacher account
2. Create sections
3. Create subjects
4. Import/add students
5. Assign students to sections
6. Create teacher assignments
7. Create weekly schedules
8. Verify subject appears in Mark Attendance
9. Mark attendance
10. Check student dashboard
11. Test emails
12. Test reports
13. Test exports
```

Do not begin marking attendance until assignments are configured.

---

# 38. If a Subject Does Not Appear

Go through this checklist:

```text
1. Does the subject exist?
2. Does the section exist?
3. Does the teacher have an assignment for that section + subject?
4. Is the assignment active?
5. Is the teacher logged into the correct account?
6. Does the browser show stale data?
7. Is the backend running?
8. Is the frontend proxy pointing to the correct backend port?
```

For example:

```text
Section: 24E1G1
Subject: PPWC
```

will only appear in the teacher's attendance page if the teacher is authorized to teach PPWC to 24E1G1.

---

# 39. If Attendance Shows Blank

Check:

```text
Section selected
+
Subject selected
+
Teacher assignment exists
+
Students belong to that section
+
Student enrollment exists
```

If the student list loads but attendance is blank, check the Attendance History filters and date range.

---

# 40. If Login Fails

Check:

```text
1. Backend is running
2. Database is running
3. Frontend proxy points to backend
4. Correct User ID
5. Correct password
6. User exists in database
```

Check the backend terminal immediately after pressing Login.

An API error there is more useful than the generic browser error.

---

# 41. If PostgreSQL Authentication Fails

Typical error:

```text
password authentication failed for user "attendbuddy"
```

Check:

```text
DATABASE_URL
```

For the current local setup:

```env
DATABASE_URL=postgresql://attendbuddy:attendbuddy_dev@localhost:5433/attendbuddy
```

Then test Docker directly:

```bash
docker compose exec postgres sh -c "PGPASSWORD=attendbuddy_dev psql -h localhost -U attendbuddy -d attendbuddy -c 'SELECT 1;'"
```

A result containing:

```text
1
```

means the database itself is accepting the credentials.

---

# 42. If Port 5433/5432 is Busy

Check:

```bash
lsof -nP -iTCP:5433 -sTCP:LISTEN
```

or:

```bash
lsof -nP -iTCP:5432 -sTCP:LISTEN
```

If another service already uses the port, choose a different host port and update:

```text
docker-compose.yml
.env
frontend proxy
```

consistently.

---

# 43. If Backend Port 5001 is Busy

Check:

```bash
lsof -nP -iTCP:5001 -sTCP:LISTEN
```

Stop the old development process or use a different backend port.

If the backend port changes, update the frontend Vite proxy too.

---

# 44. Database Reset for Development

Only do this if you intentionally want to delete development data.

To remove the Docker database volume:

```bash
docker compose down -v
docker compose up -d
```

This permanently removes local PostgreSQL data.

Do **not** use `-v` on a database containing real attendance records.

---

# 45. Clearing Data Without Deleting the Database

If you want to keep the schema but remove all application data, use a controlled database reset rather than deleting the entire PostgreSQL installation.

Example concept:

```sql
TRUNCATE TABLE
    attendance,
    enrollments,
    teacher_assignments,
    students,
    subjects,
    sections,
    teachers,
    users
RESTART IDENTITY CASCADE;
```

Only use this when you intentionally want to wipe all current application records.

---

# 46. Development vs Production

## Development

Typical:

```text
React → localhost:5173
Node  → localhost:5001
DB    → Docker localhost:5433
```

## Production

Typical architecture:

```text
User
 ↓
Vercel/Netlify
 ↓
React frontend
 ↓
Deployed Node API
 ↓
Hosted PostgreSQL
 ↓
Email provider
```

Production should use real environment variables and secrets.

---

# 47. Deployment Checklist

Before deployment:

```text
[ ] Production DATABASE_URL set
[ ] Strong JWT_SECRET
[ ] Strong setup code
[ ] Real email provider configured
[ ] EMAIL_API_KEY configured
[ ] Production FRONTEND_URL set
[ ] Backend CORS configured
[ ] Database migrations applied
[ ] Seed/demo data removed if not wanted
[ ] No secrets committed to Git
[ ] Frontend API URL configured
[ ] Password reset tested
[ ] Login tested
[ ] Attendance tested
[ ] Email tested
[ ] Export tested
[ ] Mobile UI tested
```

---

# 48. Git Safety

Never commit:

```text
.env
API keys
database passwords
JWT secrets
student passwords
private credentials
```

Keep:

```text
.env.example
```

with placeholder values.

---

# 49. How to Navigate the Codebase When You Need to Change Something

## Change the dashboard UI

Look under:

```text
frontend/src/pages/teacher/
frontend/src/pages/student/
```

and the related CSS file.

## Change the sidebar

Look under:

```text
frontend/src/layouts/
```

## Change login

Look under:

```text
frontend/src/pages/
```

for the login/authentication pages.

Also inspect backend:

```text
backend/src/routes/
backend/src/controllers/
```

## Change attendance behavior

Look in:

```text
frontend/src/pages/teacher/MarkAttendance.jsx
backend/src/routes/
backend/src/controllers/
backend/src/services/
```

## Change email behavior

Look in:

```text
backend/src/services/
```

for notification/email logic.

## Change database structure

Add/update migration files in:

```text
database/migrations/
```

Then run:

```bash
npm run migrate
```

---

# 50. Safe Development Rule

When changing a feature, avoid editing everything at once.

Use this pattern:

```text
UI problem
→ fix frontend page/component

API problem
→ fix backend route/controller/service

Database problem
→ fix migration/schema

Configuration problem
→ fix .env / docker-compose / Vite proxy
```

This makes bugs much easier to isolate.

---

# 51. Complete Teacher Workflow

A normal teacher session looks like:

```text
Login
 ↓
Dashboard
 ↓
Check schedule
 ↓
Select today's class
 ↓
Mark attendance
 ↓
Submit
 ↓
Student attendance recalculates
 ↓
Present/Absent emails sent
 ↓
75% warnings evaluated
 ↓
Reports update
 ↓
Export when needed
```

For a new semester:

```text
Create sections
 ↓
Create subjects
 ↓
Import students
 ↓
Create assignments
 ↓
Create schedules
 ↓
Start attendance
```

---

# 52. Complete Student Workflow

A student session looks like:

```text
Login
 ↓
Change temporary password if required
 ↓
Dashboard
 ↓
Check overall attendance
 ↓
Check subject-wise attendance
 ↓
Open attendance history
 ↓
Open calendar
 ↓
Review low-attendance warnings
 ↓
Receive attendance emails
```

Students should never be responsible for changing attendance records.

---

# 53. Before You Start Using Real Data

Do one complete test:

### Teacher

```text
1. Create/login as teacher
2. Create one section
3. Create one subject
4. Create one assignment
5. Add/import 2–3 students
6. Create one schedule
7. Mark one student Present
8. Mark one student Absent
```

### Student

```text
1. Login as student
2. Change password if required
3. Verify Present record
4. Verify Absent record
5. Verify subject percentage
6. Verify history
7. Verify 75% warning behavior
```

### Email

Verify:

```text
Present email
Absent email
Low attendance email
Password reset email
```

Only after this test passes should you load the full class list.

---

# 54. Current Real-World Setup

For your actual AttendBuddy setup, the intended data hierarchy is:

```text
Teacher
SHAHID AFRIDI SAIKIA
Teacher ID: T-24

        ↓

Sections
        ↓

Subjects
        ↓

Students
        ↓

Assignments / Schedule
        ↓

Attendance
        ↓

Reports + Emails + Student Dashboard
```

Your real student list should be imported rather than manually entering every student one by one.

---

# 55. Quick Command Reference

## Start database

```bash
docker compose up -d
```

## Stop database

```bash
docker compose down
```

## Reset database volume

```bash
docker compose down -v
docker compose up -d
```

## Backend

```bash
cd backend
npm install
npm run migrate
npm run dev
```

## Frontend

```bash
cd frontend
npm install
npm run dev
```

## Check database container

```bash
docker compose ps
```

## Check backend port

```bash
lsof -nP -iTCP:5001 -sTCP:LISTEN
```

## Check PostgreSQL host port

```bash
lsof -nP -iTCP:5433 -sTCP:LISTEN
```

---

# 56. Final Mental Model

When using AttendBuddy, think of the system in this order:

```text
WHO teaches?
      ↓
TEACHER

WHAT do they teach?
      ↓
SUBJECT

WHO do they teach?
      ↓
SECTION / STUDENTS

WHEN do they teach?
      ↓
SCHEDULE

WHAT happened in class?
      ↓
ATTENDANCE

WHAT does that change?
      ↓
PERCENTAGE
↓
EMAILS
↓
WARNINGS
↓
REPORTS
↓
STUDENT DASHBOARD
```

That is the core logic of AttendBuddy.

---

## Quick Start for a Brand-New Database

```bash
cd ~/Downloads/AttendBuddy

docker compose up -d

cd backend
npm install
npm run migrate
npm run dev
```

Open another terminal:

```bash
cd ~/Downloads/AttendBuddy/frontend
npm install
npm run dev
```

Open:

```text
http://localhost:5173/setup/teacher
```

Create the teacher account, then:

```text
Login
→ Sections
→ Subjects
→ Students / Import
→ Assignments
→ My Schedule
→ Mark Attendance
→ Reports / Export
```

For students:

```text
Login
→ Dashboard
→ Attendance
→ Calendar
→ Subjects
→ Profile
```

---

## Final Rule

Before changing database structure, authentication, attendance logic, or deployment configuration, make a backup of production data.

For normal UI work, replace only the relevant frontend page/CSS files and keep the backend/database untouched unless the feature actually requires backend changes.
