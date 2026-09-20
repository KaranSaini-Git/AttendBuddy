-- Personal attendance tracker is intentionally separate from teacher-managed attendance.
-- Attendance is linked to a timetable slot so two classes of the same subject on one
-- day can be recorded independently.

CREATE TABLE IF NOT EXISTS personal_subjects (
    id SERIAL PRIMARY KEY,
    student_id INT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    subject_name VARCHAR(120) NOT NULL,
    subject_code VARCHAR(30),
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_personal_subject_name_code
    ON personal_subjects (
        student_id,
        LOWER(subject_name),
        COALESCE(LOWER(subject_code), '')
    );

CREATE TABLE IF NOT EXISTS personal_timetable (
    id SERIAL PRIMARY KEY,
    student_id INT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    personal_subject_id INT NOT NULL REFERENCES personal_subjects(id) ON DELETE RESTRICT,
    day_of_week VARCHAR(12) NOT NULL CHECK (
        day_of_week IN (
            'Monday', 'Tuesday', 'Wednesday', 'Thursday',
            'Friday', 'Saturday', 'Sunday'
        )
    ),
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    room VARCHAR(50),
    notes VARCHAR(255),
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT personal_timetable_time_check CHECK (start_time < end_time),
    UNIQUE (
        student_id,
        personal_subject_id,
        day_of_week,
        start_time,
        end_time
    )
);

CREATE INDEX IF NOT EXISTS idx_personal_timetable_student
    ON personal_timetable(student_id, active);

CREATE INDEX IF NOT EXISTS idx_personal_timetable_day
    ON personal_timetable(student_id, day_of_week, start_time);

CREATE TABLE IF NOT EXISTS personal_attendance (
    id SERIAL PRIMARY KEY,
    student_id INT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    timetable_id INT NOT NULL REFERENCES personal_timetable(id) ON DELETE RESTRICT,
    class_date DATE NOT NULL,
    status VARCHAR(12) NOT NULL CHECK (
        status IN ('Present', 'Absent', 'Off-day', 'Holiday', 'Cancelled')
    ),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (student_id, timetable_id, class_date)
);

CREATE INDEX IF NOT EXISTS idx_personal_attendance_student_date
    ON personal_attendance(student_id, class_date DESC);

CREATE INDEX IF NOT EXISTS idx_personal_attendance_timetable
    ON personal_attendance(timetable_id, class_date DESC);

DROP TRIGGER IF EXISTS update_personal_subjects_updated_at ON personal_subjects;
CREATE TRIGGER update_personal_subjects_updated_at
    BEFORE UPDATE ON personal_subjects
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_personal_timetable_updated_at ON personal_timetable;
CREATE TRIGGER update_personal_timetable_updated_at
    BEFORE UPDATE ON personal_timetable
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_personal_attendance_updated_at ON personal_attendance;
CREATE TRIGGER update_personal_attendance_updated_at
    BEFORE UPDATE ON personal_attendance
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
