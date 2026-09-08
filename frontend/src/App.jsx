import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import Login from './pages/Login';
import SetupTeacher from './pages/SetupTeacher';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import ChangePassword from './pages/ChangePassword';
import ProtectedRoute from './components/ProtectedRoute';
import TeacherLayout from './layouts/TeacherLayout';
import StudentLayout from './layouts/StudentLayout';

// Teacher pages
import TeacherDashboard from './pages/teacher/Dashboard';
import MarkAttendance from './pages/teacher/MarkAttendance';
import AttendanceHistory from './pages/teacher/AttendanceHistory';
import Reports from './pages/teacher/Reports';
import Students from './pages/teacher/Students';
import Sections from './pages/teacher/Sections';
import Subjects from './pages/teacher/Subjects';
import Assignments from './pages/teacher/Assignments';
import Schedule from './pages/teacher/Schedule';
import ExportPage from './pages/teacher/Export';
import TeacherProfile from './pages/teacher/Profile';

// Student pages
import StudentDashboard from './pages/student/Dashboard';
import StudentAttendance from './pages/student/AttendanceHistory';
import StudentCalendar from './pages/student/Calendar';
import StudentSubjects from './pages/student/Subjects';
import StudentProfile from './pages/student/Profile';

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <Routes>
            {/* Public */}
            <Route path="/login" element={<Login />} />
            <Route path="/setup/teacher" element={<SetupTeacher />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/change-password" element={<ChangePassword />} />

            {/* Teacher Routes */}
            <Route element={<ProtectedRoute allowedRoles={['teacher']} />}>
              <Route element={<TeacherLayout />}>
                <Route path="/teacher/dashboard" element={<TeacherDashboard />} />
                <Route path="/teacher/attendance/mark" element={<MarkAttendance />} />
                <Route path="/teacher/attendance/history" element={<AttendanceHistory />} />
                <Route path="/teacher/reports" element={<Reports />} />
                <Route path="/teacher/students" element={<Students />} />
                <Route path="/teacher/sections" element={<Sections />} />
                <Route path="/teacher/subjects" element={<Subjects />} />
                <Route path="/teacher/assignments" element={<Assignments />} />
                <Route path="/teacher/schedule" element={<Schedule />} />
                <Route path="/teacher/export" element={<ExportPage />} />
                <Route path="/teacher/profile" element={<TeacherProfile />} />
              </Route>
            </Route>

            {/* Student Routes */}
            <Route element={<ProtectedRoute allowedRoles={['student']} />}>
              <Route element={<StudentLayout />}>
                <Route path="/student/dashboard" element={<StudentDashboard />} />
                <Route path="/student/attendance" element={<StudentAttendance />} />
                <Route path="/student/calendar" element={<StudentCalendar />} />
                <Route path="/student/subjects" element={<StudentSubjects />} />
                <Route path="/student/profile" element={<StudentProfile />} />
              </Route>
            </Route>

            {/* Redirects */}
            <Route path="/" element={<Navigate to="/login" replace />} />
            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
