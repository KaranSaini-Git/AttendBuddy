import { useEffect, useState } from "react";
import { CalendarX2, Filter, RotateCcw } from "lucide-react";
import { Card, CardContent } from "@/components/ui/Card";
import Spinner from "@/components/ui/Spinner";
import Table from "@/components/ui/Table";
import Badge from "@/components/ui/Badge";
import EmptyState from "@/components/ui/EmptyState";
import api from "@/services/api";
import { useToast } from "@/context/ToastContext";

export default function AttendanceHistory() {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const { showToast } = useToast();

  const [filters, setFilters] = useState({
    subject_id: "",
    date_from: "",
    date_to: "",
    status: "",
  });

  const [subjects, setSubjects] = useState([]);

  const fetchSubjects = async () => {
    try {
      const response = await api.get("/student/subjects");
      setSubjects(response.data || []);
    } catch (error) {
      console.error("Failed to load subjects:", error);
      showToast("Failed to load subjects", "error");
    }
  };

  const fetchHistory = async () => {
    setLoading(true);
    try {
      const params = {};

      if (filters.subject_id) params.subject_id = filters.subject_id;
      if (filters.date_from) params.date_from = filters.date_from;
      if (filters.date_to) params.date_to = filters.date_to;
      if (filters.status) params.status = filters.status;

      const response = await api.get("/student/attendance", { params });
      setRecords(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      console.error("Failed to load attendance history:", error);
      showToast("Failed to load attendance history", "error");
      setRecords([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSubjects();
  }, []);

  useEffect(() => {
    fetchHistory();
    // Filters are intentionally part of the request lifecycle.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.subject_id, filters.date_from, filters.date_to, filters.status]);

  const handleFilterChange = (event) => {
    const { name, value } = event.target;
    setFilters((current) => ({ ...current, [name]: value }));
  };

  const resetFilters = () => {
    setFilters({
      subject_id: "",
      date_from: "",
      date_to: "",
      status: "",
    });
  };

  const presentCount = records.filter(
    (record) => record.status === "Present",
  ).length;
  const absentCount = records.filter(
    (record) => record.status === "Absent",
  ).length;

  // IMPORTANT: Table expects key/label/render, not accessor/header.
  const columns = [
    {
      key: "date",
      label: "Date",
      render: (value) =>
        new Date(value).toLocaleDateString(undefined, {
          weekday: "short",
          year: "numeric",
          month: "short",
          day: "numeric",
        }),
    },
    {
      key: "subject_name",
      label: "Subject",
      render: (value) => value || "—",
    },
    {
      key: "section_name",
      label: "Section",
      render: (value) => value || "—",
    },
    {
      key: "status",
      label: "Status",
      render: (value) => (
        <Badge variant={value === "Present" ? "success" : "danger"}>
          {value}
        </Badge>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
          Student workspace
        </p>
        <div className="mt-1 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-950">
              Attendance History
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Review every attendance record recorded for you.
            </p>
          </div>
          <button
            type="button"
            onClick={fetchHistory}
            className="inline-flex w-fit items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
          >
            <RotateCcw className="h-4 w-4" />
            Refresh
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Records
            </p>
            <p className="mt-2 text-2xl font-bold text-slate-950">
              {records.length}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Present
            </p>
            <p className="mt-2 text-2xl font-bold text-emerald-600">
              {presentCount}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Absent
            </p>
            <p className="mt-2 text-2xl font-bold text-rose-600">
              {absentCount}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-4 sm:p-6">
          <div className="mb-5 flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
              <Filter className="h-4 w-4" />
            </div>
            <div>
              <h2 className="font-semibold text-slate-950">
                Filter attendance
              </h2>
              <p className="text-xs text-slate-500">
                Narrow your records by subject, date, or status.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">
                Subject
              </label>
              <select
                name="subject_id"
                value={filters.subject_id}
                onChange={handleFilterChange}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
              >
                <option value="">All Subjects</option>
                {subjects.map((subject) => (
                  <option key={subject.subject_id} value={subject.subject_id}>
                    {subject.subject_name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">
                From Date
              </label>
              <input
                type="date"
                name="date_from"
                value={filters.date_from}
                onChange={handleFilterChange}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">
                To Date
              </label>
              <input
                type="date"
                name="date_to"
                value={filters.date_to}
                onChange={handleFilterChange}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">
                Status
              </label>
              <select
                name="status"
                value={filters.status}
                onChange={handleFilterChange}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
              >
                <option value="">All Statuses</option>
                <option value="Present">Present</option>
                <option value="Absent">Absent</option>
              </select>
            </div>
          </div>

          {(filters.subject_id ||
            filters.date_from ||
            filters.date_to ||
            filters.status) && (
            <button
              type="button"
              onClick={resetFilters}
              className="mt-4 text-sm font-medium text-blue-600 hover:text-blue-700"
            >
              Clear filters
            </button>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 sm:p-6">
          {loading ? (
            <div className="flex min-h-[280px] items-center justify-center">
              <Spinner size="lg" />
            </div>
          ) : records.length === 0 ? (
            <EmptyState
              icon={CalendarX2}
              title="No attendance records found"
              description="Attendance will appear here after your teacher records a class."
            />
          ) : (
            <>
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h2 className="font-semibold text-slate-950">Your records</h2>
                  <p className="text-xs text-slate-500">
                    {records.length} attendance record
                    {records.length === 1 ? "" : "s"}
                  </p>
                </div>
              </div>

              <Table columns={columns} data={records} />
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
