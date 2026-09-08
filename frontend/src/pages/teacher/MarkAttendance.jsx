import React, { useState, useEffect } from "react";
import api from "@/services/api";
import { useToast } from "@/context/ToastContext";
import { Card, CardContent } from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Select from "@/components/ui/Select";
import Input from "@/components/ui/Input";
import Spinner from "@/components/ui/Spinner";
import EmptyState from "@/components/ui/EmptyState";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { Users } from "lucide-react";

export default function MarkAttendance() {
  const [sections, setSections] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [filteredSubjects, setFilteredSubjects] = useState([]);
  const [assignments, setAssignments] = useState([]);

  const [selectedSection, setSelectedSection] = useState("");
  const [selectedSubject, setSelectedSubject] = useState("");
  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().split("T")[0],
  );

  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [studentsLoaded, setStudentsLoaded] = useState(false);

  const [confirmDialog, setConfirmDialog] = useState(false);

  const { showToast } = useToast();

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    try {
      const [sectionsRes, subjectsRes, assignmentsRes] = await Promise.all([
        api.get("/teacher/sections"),
        api.get("/teacher/subjects"),
        api.get("/teacher/assignments"),
      ]);
      setSections(sectionsRes.data || []);
      setSubjects(subjectsRes.data || []);
      setAssignments(assignmentsRes.data || []);
    } catch (error) {
      showToast("Failed to load initial data", "error");
    }
  };

  useEffect(() => {
    if (!selectedSection) {
      setFilteredSubjects([]);
      setSelectedSubject("");
      setStudentsLoaded(false);
      return;
    }

    // Build the subject dropdown directly from the teacher's assignments.
    // This avoids the common ID type mismatch between the assignments API
    // and the subjects API (e.g. numeric 3 vs string "3").
    const seen = new Set();
    const assignedSubjects = assignments
      .filter(
        (assignment) =>
          String(assignment.section_id) === String(selectedSection) &&
          assignment.active !== false,
      )
      .map((assignment) => ({
        id: assignment.subject_id,
        subject_name:
          assignment.subject_name ||
          subjects.find(
            (subject) => String(subject.id) === String(assignment.subject_id),
          )?.subject_name ||
          `Subject ${assignment.subject_id}`,
        subject_code:
          assignment.subject_code ||
          subjects.find(
            (subject) => String(subject.id) === String(assignment.subject_id),
          )?.subject_code ||
          "",
      }))
      .filter((subject) => {
        const key = String(subject.id);
        if (!key || seen.has(key)) return false;
        seen.add(key);
        return true;
      });

    setFilteredSubjects(assignedSubjects);
    setSelectedSubject("");
    setStudentsLoaded(false);
  }, [selectedSection, assignments, subjects]);

  const loadStudents = async () => {
    if (!selectedSection || !selectedSubject || !selectedDate) {
      showToast("Please select section, subject and date", "error");
      return;
    }

    setLoading(true);
    try {
      const res = await api.get("/attendance/by-date", {
        params: {
          section_id: selectedSection,
          subject_id: selectedSubject,
          date: selectedDate,
        },
      });

      if (res.data && res.data.length > 0) {
        setStudents(
          res.data.map((s) => ({
            student_id: s.student_id,
            name: s.student_name,
            student_code: s.student_id_code,
            status: s.status ? s.status.toLowerCase() : null,
          })),
        );
        showToast("Existing attendance loaded", "info");
      } else {
        const studentsRes = await api.get("/teacher/students", {
          params: { section_id: selectedSection },
        });
        setStudents(
          studentsRes.data.map((s) => ({
            student_id: s.id,
            name: s.name,
            student_code: s.student_id,
            status: null,
          })),
        );
      }
      setStudentsLoaded(true);
    } catch (error) {
      showToast("Failed to load students", "error");
    } finally {
      setLoading(false);
    }
  };

  const markStudent = (id, status) => {
    setStudents(
      students.map((s) => (s.student_id === id ? { ...s, status } : s)),
    );
  };

  const markAll = (status) => {
    setStudents(students.map((s) => ({ ...s, status })));
  };

  const presentCount = students.filter((s) => s.status === "present").length;
  const absentCount = students.filter((s) => s.status === "absent").length;

  const handleSubmit = async () => {
    const unrecorded = students.filter((s) => !s.status).length;
    if (unrecorded > 0) {
      showToast(
        `Please mark attendance for all students (${unrecorded} left)`,
        "warning",
      );
      return;
    }
    setConfirmDialog(true);
  };

  const confirmSubmit = async () => {
    setSubmitting(true);
    try {
      await api.post("/attendance", {
        section_id: selectedSection,
        subject_id: selectedSubject,
        date: selectedDate,
        records: students.map((s) => ({
          student_id: s.student_id,
          status: s.status === "present" ? "Present" : "Absent",
        })),
      });
      showToast("Attendance saved successfully", "success");
      setConfirmDialog(false);
    } catch (error) {
      showToast("Failed to save attendance", "error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 pb-24">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
        Mark Attendance
      </h1>

      <Card>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Select
              label="Section"
              value={selectedSection}
              onChange={(e) => setSelectedSection(e.target.value)}
              options={sections.map((s) => ({
                value: s.id,
                label: s.section_name,
              }))}
            />
            <Select
              label="Subject"
              value={selectedSubject}
              onChange={(e) => setSelectedSubject(e.target.value)}
              options={filteredSubjects.map((subject) => ({
                value: subject.id,
                label: subject.subject_code
                  ? `${subject.subject_name} (${subject.subject_code})`
                  : subject.subject_name,
              }))}
              disabled={!selectedSection || filteredSubjects.length === 0}
            />
            <Input
              type="date"
              label="Date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
            />
          </div>
          <Button
            onClick={loadStudents}
            loading={loading}
            disabled={!selectedSection || !selectedSubject}
            className="w-full md:w-auto"
          >
            Load Students
          </Button>
        </CardContent>
      </Card>

      {loading && !studentsLoaded ? (
        <div className="flex justify-center p-8">
          <Spinner />
        </div>
      ) : studentsLoaded && students.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No Students Found"
          description="No students are enrolled in this section."
        />
      ) : studentsLoaded ? (
        <div className="space-y-4">
          <div className="flex justify-between items-center bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border border-gray-100 dark:border-gray-700">
            <div className="text-sm font-medium">
              <span className="text-green-600 dark:text-green-400 mr-4">
                Present: {presentCount}
              </span>
              <span className="text-red-600 dark:text-red-400">
                Absent: {absentCount}
              </span>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => markAll("present")}
                className="text-green-600 border-green-600 hover:bg-green-50"
              >
                All Present
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => markAll("absent")}
                className="text-red-600 border-red-600 hover:bg-red-50"
              >
                All Absent
              </Button>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden divide-y divide-gray-100 dark:divide-gray-700">
            {students.map((student) => (
              <div
                key={student.student_id}
                className="flex flex-col sm:flex-row sm:items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors"
              >
                <div className="mb-3 sm:mb-0">
                  <div className="font-medium text-gray-900 dark:text-white">
                    {student.name}
                  </div>
                  <div className="text-sm text-gray-500">
                    {student.student_code}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => markStudent(student.student_id, "present")}
                    className={`flex-1 sm:flex-none px-6 py-2 rounded-md min-h-[44px] font-medium transition-colors ${
                      student.status === "present"
                        ? "bg-green-500 text-white border border-green-600"
                        : "bg-white text-green-600 border border-green-300 hover:bg-green-50 dark:bg-gray-800 dark:border-green-800"
                    }`}
                  >
                    Present
                  </button>
                  <button
                    onClick={() => markStudent(student.student_id, "absent")}
                    className={`flex-1 sm:flex-none px-6 py-2 rounded-md min-h-[44px] font-medium transition-colors ${
                      student.status === "absent"
                        ? "bg-red-500 text-white border border-red-600"
                        : "bg-white text-red-600 border border-red-300 hover:bg-red-50 dark:bg-gray-800 dark:border-red-800"
                    }`}
                  >
                    Absent
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="fixed bottom-0 left-0 right-0 p-4 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 shadow-lg lg:left-64 z-40">
            <div className="max-w-7xl mx-auto flex justify-between items-center">
              <div className="text-sm hidden sm:block">
                {students.filter((s) => !s.status).length > 0 ? (
                  <span className="text-yellow-600 font-medium">
                    Pending: {students.filter((s) => !s.status).length} students
                  </span>
                ) : (
                  <span className="text-green-600 font-medium">
                    Ready to submit
                  </span>
                )}
              </div>
              <Button
                size="lg"
                onClick={handleSubmit}
                className="w-full sm:w-auto px-8 py-3"
              >
                Submit Attendance ({students.length})
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      <ConfirmDialog
        isOpen={confirmDialog}
        onClose={() => setConfirmDialog(false)}
        onConfirm={confirmSubmit}
        title="Confirm Attendance Submission"
        message={
          <div className="space-y-2 text-left mt-2">
            <p>
              <strong>Date:</strong> {selectedDate}
            </p>
            <p>
              <strong>Present:</strong>{" "}
              <span className="text-green-600">{presentCount}</span>
            </p>
            <p>
              <strong>Absent:</strong>{" "}
              <span className="text-red-600">{absentCount}</span>
            </p>
            <p className="mt-4">Are you sure you want to save these records?</p>
          </div>
        }
        confirmText="Yes, Save Records"
        loading={submitting}
      />
    </div>
  );
}