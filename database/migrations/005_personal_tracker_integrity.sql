-- Keep the student and timetable relationship consistent for personal attendance.
-- This migration is intentionally idempotent so it is safe to run on an existing database.

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'uq_personal_timetable_id_student'
    ) THEN
        ALTER TABLE personal_timetable
            ADD CONSTRAINT uq_personal_timetable_id_student UNIQUE (id, student_id);
    END IF;
END $$;

ALTER TABLE personal_attendance
    DROP CONSTRAINT IF EXISTS personal_attendance_timetable_id_fkey;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'fk_personal_attendance_student_timetable'
    ) THEN
        ALTER TABLE personal_attendance
            ADD CONSTRAINT fk_personal_attendance_student_timetable
            FOREIGN KEY (timetable_id, student_id)
            REFERENCES personal_timetable (id, student_id)
            ON DELETE RESTRICT;
    END IF;
END $$;
