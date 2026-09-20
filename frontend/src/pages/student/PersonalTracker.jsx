import { useEffect, useMemo, useState } from "react";
import {
  CalendarClock,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  Clock3,
  Download,
  FileSpreadsheet,
  GraduationCap,
  MapPin,
  Pencil,
  Plus,
  RotateCcw,
  Trash2,
  Upload,
  X,
} from "lucide-react";

import api from "../../services/api";
import { useToast } from "../../context/ToastContext";

import Button from "../../components/ui/Button";
import Modal from "../../components/ui/Modal";
import Input from "../../components/ui/Input";
import Select from "../../components/ui/Select";
import Spinner from "../../components/ui/Spinner";

import {
  downloadTimetableTemplate,
  parseTimetableCsv,
} from "../../utils/timetableCsv";

import "./PersonalTracker.css";

const STATUS_OPTIONS = [
  { value: "Present", label: "Present" },
  { value: "Absent", label: "Absent" },
  { value: "Off-day", label: "Off-day" },
  { value: "Holiday", label: "Holiday" },
  { value: "Cancelled", label: "Cancelled" },
];

const DAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

const EMPTY_FORM = {
  subject_id: "",
  day: "Monday",
  start_time: "",
  end_time: "",
  room: "",
  notes: "",
};

/* =========================================================
   DATE HELPERS
========================================================= */

const formatLocalDate = (date) => {
  const pad = (value) => String(value).padStart(2, "0");

  return `${date.getFullYear()}-${pad(
    date.getMonth() + 1,
  )}-${pad(date.getDate())}`;
};

const toSafeDate = (value) => {
  if (!value) {
    return null;
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  const raw = String(value).trim();

  /*
   * PostgreSQL DATE values normally come back as
   * YYYY-MM-DD. Strip anything after that so the
   * browser does not get confused by timestamps.
   */
  const match = raw.match(/^(\d{4}-\d{2}-\d{2})/);

  const datePart = match ? match[1] : raw;

  const parsed = new Date(`${datePart}T00:00:00`);

  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const displayDate = (value) => {
  const date = toSafeDate(value);

  if (!date) {
    return "Date unavailable";
  }

  return date.toLocaleDateString(undefined, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
};

const displayHistoryDate = (value) => {
  const date = toSafeDate(value);

  if (!date) {
    return "Date unavailable";
  }

  return date.toLocaleDateString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const formatTime = (value) => {
  if (!value) {
    return "—";
  }

  const [hour, minute] = String(value).slice(0, 5).split(":");

  const date = new Date(2000, 0, 1, Number(hour), Number(minute));

  return date.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
};

const statusLabel = (status) => {
  if (status === "Unmarked") {
    return "Not marked";
  }

  return status;
};

/* =========================================================
   COMPONENT
========================================================= */

export default function PersonalTracker() {
  const [data, setData] = useState(null);

  const [selectedDate, setSelectedDate] = useState(formatLocalDate(new Date()));

  const [loading, setLoading] = useState(true);

  const [savingId, setSavingId] = useState(null);

  const [modal, setModal] = useState(null);

  const [editingEntry, setEditingEntry] = useState(null);

  const [form, setForm] = useState(EMPTY_FORM);

  const [savingForm, setSavingForm] = useState(false);

  const [importRows, setImportRows] = useState([]);

  const [importSource, setImportSource] = useState("");

  const [importing, setImporting] = useState(false);

  const [importError, setImportError] = useState("");

  const [subjectEditor, setSubjectEditor] = useState(null);

  const [historyFilter, setHistoryFilter] = useState("");

  const { showToast } = useToast();

  /* =======================================================
     LOAD DATA
  ======================================================= */

  const load = async (date = selectedDate, quiet = false) => {
    if (!quiet) {
      setLoading(true);
    }

    try {
      const response = await api.get("/personal-tracker", {
        params: {
          date,
        },
      });

      setData(response.data);
    } catch (error) {
      showToast(
        error.response?.data?.error || "Failed to load personal tracker.",
        "error",
      );
    } finally {
      if (!quiet) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    load(selectedDate);

    // selectedDate controls which day is displayed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate]);

  /* =======================================================
     DATA
  ======================================================= */

  const today = data?.today || [];

  const timetable = data?.timetable || [];

  const subjects = data?.subjects || [];

  const history = useMemo(() => {
    const rows = data?.history || [];

    if (!historyFilter) {
      return rows;
    }

    return rows.filter(
      (row) => String(row.subject_id) === String(historyFilter),
    );
  }, [data?.history, historyFilter]);

  const personalOverall = data?.overall || {
    total: 0,
    present: 0,
    absent: 0,
    percentage: 0,
    classes_needed: 0,
    safe_to_miss: 0,

    planned_total: 0,
    planned_present: 0,
    planned_absent: 0,

    projected_total: 0,
    projected_present: 0,
    projected_absent: 0,
    projected_percentage: 0,
    projected_classes_needed: 0,
    projected_safe_to_miss: 0,
  };

  /* =======================================================
     FUTURE PREVIEW
  ======================================================= */

  const hasForecast = Number(personalOverall.planned_total || 0) > 0;

  const projectionChange = Number(
    (
      Number(
        personalOverall.projected_percentage || personalOverall.percentage || 0,
      ) - Number(personalOverall.percentage || 0)
    ).toFixed(1),
  );

  /* =======================================================
     GROUP TIMETABLE BY DAY
  ======================================================= */

  const groupedTimetable = useMemo(() => {
    return DAYS.reduce((result, day) => {
      result[day] = timetable.filter((entry) => entry.day_of_week === day);

      return result;
    }, {});
  }, [timetable]);

  /* =======================================================
     DATE NAVIGATION
  ======================================================= */

  const moveDate = (amount) => {
    const current = new Date(`${selectedDate}T00:00:00`);

    current.setDate(current.getDate() + amount);

    setSelectedDate(formatLocalDate(current));
  };

  /* =======================================================
     TIMETABLE MODAL
  ======================================================= */

  const openAdd = () => {
    setEditingEntry(null);

    setForm({
      ...EMPTY_FORM,

      subject_id: subjects[0]?.id ? String(subjects[0].id) : "",

      day: new Date(`${selectedDate}T00:00:00`).toLocaleDateString(undefined, {
        weekday: "long",
      }),
    });

    setModal("entry");
  };

  const openEdit = (entry) => {
    setEditingEntry(entry);

    setForm({
      subject_id: String(entry.subject_id),
      day: entry.day_of_week,
      start_time: String(entry.start_time).slice(0, 5),
      end_time: String(entry.end_time).slice(0, 5),
      room: entry.room || "",
      notes: entry.notes || "",
    });

    setModal("entry");
  };

  const saveEntry = async (event) => {
    event.preventDefault();

    if (!form.subject_id || !form.start_time || !form.end_time) {
      showToast(
        "Please choose a subject and complete the time range.",
        "error",
      );

      return;
    }

    setSavingForm(true);

    try {
      if (editingEntry) {
        await api.put(`/personal-tracker/timetable/${editingEntry.id}`, form);

        showToast("Timetable class updated.", "success");
      } else {
        const subject = subjects.find(
          (item) => String(item.id) === String(form.subject_id),
        );

        if (!subject) {
          showToast(
            "Add a subject first, then create a timetable slot.",
            "error",
          );

          return;
        }

        await api.post("/personal-tracker/timetable/import", {
          rows: [
            {
              subject_name: subject.subject_name,
              subject_code: subject.subject_code || "",
              day: form.day,
              start_time: form.start_time,
              end_time: form.end_time,
              room: form.room,
              notes: form.notes,
            },
          ],
        });

        showToast("Timetable class added.", "success");
      }

      setModal(null);

      await load(selectedDate, true);
    } catch (error) {
      showToast(
        error.response?.data?.error || "Could not save timetable class.",
        "error",
      );
    } finally {
      setSavingForm(false);
    }
  };

  const removeEntry = async (entry) => {
    const confirmed = window.confirm(
      `Remove ${entry.subject_name} from ${entry.day_of_week}? Existing attendance history will be kept.`,
    );

    if (!confirmed) {
      return;
    }

    try {
      await api.delete(`/personal-tracker/timetable/${entry.id}`);

      showToast("Timetable class removed.", "success");

      await load(selectedDate, true);
    } catch (error) {
      showToast(
        error.response?.data?.error || "Could not remove timetable class.",
        "error",
      );
    }
  };

  /* =======================================================
     ATTENDANCE
  ======================================================= */

  const markStatus = async (entry, status) => {
    setSavingId(entry.id);

    try {
      if (status === "Reset") {
        if (entry.attendance_id) {
          await api.delete(
            `/personal-tracker/attendance/${entry.attendance_id}`,
          );
        }
      } else {
        await api.post("/personal-tracker/attendance", {
          timetable_id: entry.id,
          date: selectedDate,
          status,
        });
      }

      await load(selectedDate, true);
    } catch (error) {
      showToast(
        error.response?.data?.error || "Could not update attendance.",
        "error",
      );
    } finally {
      setSavingId(null);
    }
  };

  /* =======================================================
     CSV IMPORT
  ======================================================= */

  const handleCsvFile = async (event) => {
    const file = event.target.files?.[0];

    event.target.value = "";

    if (!file) {
      return;
    }

    try {
      const text = await file.text();

      const parsed = parseTimetableCsv(text);

      setImportRows(parsed);
      setImportSource(file.name);
      setImportError("");
    } catch (error) {
      setImportRows([]);
      setImportError(error.message || "Unable to read this CSV file.");
    }
  };

  const runImport = async () => {
    if (!importRows.length) {
      return;
    }

    setImporting(true);

    try {
      const response = await api.post("/personal-tracker/timetable/import", {
        rows: importRows,
      });

      showToast(
        `${response.data.created} new class${
          response.data.created === 1 ? "" : "es"
        } added, ${response.data.updated} updated.`,
        "success",
      );

      setModal(null);
      setImportRows([]);
      setImportSource("");
      setImportError("");

      await load(selectedDate, true);
    } catch (error) {
      showToast(
        error.response?.data?.details ||
          error.response?.data?.error ||
          "Could not import timetable.",
        "error",
      );
    } finally {
      setImporting(false);
    }
  };

  /* =======================================================
     SUBJECT EDITING
  ======================================================= */

  const openSubjectEditor = (subject) => {
    setSubjectEditor({
      id: subject.id,
      subject_name: subject.subject_name,
      subject_code: subject.subject_code || "",
    });
  };

  const saveSubject = async (event) => {
    event.preventDefault();

    if (!subjectEditor?.subject_name?.trim()) {
      return;
    }

    try {
      await api.put(`/personal-tracker/subjects/${subjectEditor.id}`, {
        subject_name: subjectEditor.subject_name,
        subject_code: subjectEditor.subject_code,
      });

      setSubjectEditor(null);

      showToast("Subject updated.", "success");

      await load(selectedDate, true);
    } catch (error) {
      showToast(
        error.response?.data?.error || "Could not update subject.",
        "error",
      );
    }
  };

  const removeSubject = async (subject) => {
    const confirmed = window.confirm(
      `Remove ${subject.subject_name} from your personal timetable? Attendance history will be preserved.`,
    );

    if (!confirmed) {
      return;
    }

    try {
      await api.delete(`/personal-tracker/subjects/${subject.id}`);

      showToast("Subject removed from your timetable.", "success");

      await load(selectedDate, true);
    } catch (error) {
      showToast(
        error.response?.data?.error || "Could not remove subject.",
        "error",
      );
    }
  };

  /* =======================================================
     LOADING
  ======================================================= */

  if (loading && !data) {
    return (
      <div className="personal-tracker-loading">
        <Spinner size="lg" />
      </div>
    );
  }

  const isFutureDate = selectedDate > formatLocalDate(new Date());

  const statusFor = (entry) => entry.status || "Unmarked";

  /* =======================================================
     UI
  ======================================================= */

  return (
    <div className="personal-tracker">
      {/* ===================================================
          HEADER
      =================================================== */}

      <section className="personal-tracker-header">
        <div>
          <div className="personal-eyebrow">Personal workspace</div>

          <h1>My attendance tracker</h1>

          <p>
            Keep your own timetable and attendance in one place. This tracker is
            separate from teacher-recorded attendance.
          </p>
        </div>

        <div className="personal-header-actions">
          <Button
            variant="outline"
            icon={Download}
            onClick={downloadTimetableTemplate}
          >
            CSV template
          </Button>

          <Button
            variant="outline"
            icon={Upload}
            onClick={() => setModal("import")}
          >
            Import timetable
          </Button>

          <Button icon={Plus} onClick={openAdd}>
            Add class
          </Button>
        </div>
      </section>

      {/* ===================================================
          SUMMARY
      =================================================== */}

      <section className="personal-summary-grid">
        <article className="personal-summary-card personal-summary-main">
          <div className="personal-summary-ring">
            <svg viewBox="0 0 120 120">
              <circle className="summary-ring-track" cx="60" cy="60" r="49" />

              <circle
                className="summary-ring-value"
                cx="60"
                cy="60"
                r="49"
                strokeDasharray="307.9"
                strokeDashoffset={
                  307.9 -
                  (307.9 * Math.min(personalOverall.percentage, 100)) / 100
                }
              />
            </svg>

            <div>
              <strong>{personalOverall.percentage}%</strong>

              <span>current</span>
            </div>
          </div>

          <div className="personal-summary-copy">
            <span className="personal-section-label">Current attendance</span>

            <h2>
              {personalOverall.present} attended · {personalOverall.absent}{" "}
              missed
            </h2>

            <p>
              {personalOverall.total} classes have actually been conducted and
              marked.
            </p>

            <div
              className={`personal-target-message ${
                personalOverall.percentage < 75 && personalOverall.total
                  ? "warning"
                  : ""
              }`}
            >
              {personalOverall.percentage < 75 && personalOverall.total ? (
                <>
                  <CircleAlert size={15} />
                  Attend the next{" "}
                  <strong>{personalOverall.classes_needed}</strong> conducted
                  classes to reach 75%.
                </>
              ) : personalOverall.total ? (
                <>
                  <Check size={15} />
                  You can miss <strong>
                    {personalOverall.safe_to_miss}
                  </strong>{" "}
                  more conducted classes and stay at or above 75%.
                </>
              ) : (
                <>
                  <GraduationCap size={15} />
                  Start marking classes to see your 75% target.
                </>
              )}
            </div>

            {/* =================================================
                FUTURE FORECAST
            ================================================= */}

            {hasForecast && (
              <div className="personal-forecast">
                <div className="personal-forecast-head">
                  <span>Future preview</span>

                  <strong className={projectionChange >= 0 ? "up" : "down"}>
                    {projectionChange > 0 ? "+" : ""}
                    {projectionChange} pts
                  </strong>
                </div>

                <div className="personal-forecast-main">
                  <strong>{personalOverall.projected_percentage}%</strong>

                  <span>projected attendance</span>
                </div>

                <p>
                  Based on {personalOverall.planned_total} future mark
                  {personalOverall.planned_total === 1 ? "" : "s"}:{" "}
                  {personalOverall.planned_present} present ·{" "}
                  {personalOverall.planned_absent} absent.
                </p>
              </div>
            )}
          </div>
        </article>

        <article className="personal-summary-card personal-summary-stat">
          <div className="personal-stat-icon present">
            <Check size={18} />
          </div>

          <div>
            <span>Present</span>

            <strong>{personalOverall.present}</strong>

            <small>classes attended</small>
          </div>
        </article>

        <article className="personal-summary-card personal-summary-stat">
          <div className="personal-stat-icon absent">
            <CircleAlert size={18} />
          </div>

          <div>
            <span>Absent</span>

            <strong>{personalOverall.absent}</strong>

            <small>classes missed</small>
          </div>
        </article>

        <article className="personal-summary-card personal-summary-stat">
          <div className="personal-stat-icon target">
            <CalendarClock size={18} />
          </div>

          <div>
            <span>Subjects</span>

            <strong>{subjects.length}</strong>

            <small>in your tracker</small>
          </div>
        </article>
      </section>

      {/* ===================================================
          DAILY ATTENDANCE
      =================================================== */}

      <section className="personal-panel today-panel">
        <div className="personal-panel-head">
          <div>
            <div className="personal-section-label">Daily attendance</div>

            <h2>{displayDate(selectedDate)}</h2>
          </div>

          <div className="date-picker-row">
            <button onClick={() => moveDate(-1)} aria-label="Previous day">
              <ChevronLeft size={17} />
            </button>

            <input
              type="date"
              value={selectedDate}
              onChange={(event) => setSelectedDate(event.target.value)}
            />

            <button onClick={() => moveDate(1)} aria-label="Next day">
              <ChevronRight size={17} />
            </button>
          </div>
        </div>

        {isFutureDate && (
          <div className="future-note">
            <Clock3 size={15} />
            You're viewing a future date. Marks saved here are used only for the
            future preview and do not change your current attendance.
          </div>
        )}

        {!today.length ? (
          <div className="personal-empty-day">
            <CalendarClock size={25} />

            <strong>No class is scheduled for this day.</strong>

            <p>Choose another date or add this class to your timetable.</p>
          </div>
        ) : (
          <div className="daily-class-list">
            {today.map((entry) => {
              const currentStatus = statusFor(entry);

              return (
                <article key={entry.id} className="daily-class-card">
                  <div className="daily-class-time">
                    <Clock3 size={15} />

                    <strong>{formatTime(entry.start_time)}</strong>

                    <span>– {formatTime(entry.end_time)}</span>
                  </div>

                  <div className="daily-class-main">
                    <span className="subject-code-pill">
                      {entry.subject_code || "SUBJECT"}
                    </span>

                    <h3>{entry.subject_name}</h3>

                    <div className="daily-class-meta">
                      {entry.room && (
                        <span>
                          <MapPin size={13} />

                          {entry.room}
                        </span>
                      )}

                      {entry.notes && <span>{entry.notes}</span>}
                    </div>
                  </div>

                  <div className="daily-class-actions">
                    <span
                      className={`attendance-status ${currentStatus
                        .toLowerCase()
                        .replace("-", "-")}`}
                    >
                      {statusLabel(currentStatus)}
                    </span>

                    <div className="status-buttons">
                      {STATUS_OPTIONS.map((option) => (
                        <button
                          key={option.value}
                          disabled={savingId === entry.id}
                          className={`status-button ${option.value
                            .toLowerCase()
                            .replace("-", "")} ${
                            currentStatus === option.value ? "selected" : ""
                          }`}
                          onClick={() => markStatus(entry, option.value)}
                        >
                          {option.label}
                        </button>
                      ))}

                      {entry.attendance_id && (
                        <button
                          className="status-reset"
                          disabled={savingId === entry.id}
                          onClick={() => markStatus(entry, "Reset")}
                        >
                          Clear
                        </button>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {/* ===================================================
          WEEKLY TIMETABLE
      =================================================== */}

      <section className="personal-panel">
        <div className="personal-panel-head">
          <div>
            <div className="personal-section-label">Weekly timetable</div>

            <h2>Your class schedule</h2>
          </div>

          <span className="personal-count-chip">
            {timetable.length} class slots
          </span>
        </div>

        {!timetable.length ? (
          <div className="personal-empty-day">
            <FileSpreadsheet size={25} />

            <strong>Your timetable is empty.</strong>

            <p>Import your CSV or add a class manually to get started.</p>

            <Button icon={Upload} onClick={() => setModal("import")}>
              Import timetable
            </Button>
          </div>
        ) : (
          <div className="weekly-grid">
            {DAYS.map((day) => (
              <div key={day} className="weekly-column">
                <div className="weekly-column-head">
                  <span>{day.slice(0, 3)}</span>

                  <strong>{groupedTimetable[day].length}</strong>
                </div>

                <div className="weekly-column-body">
                  {groupedTimetable[day].map((entry) => (
                    <div key={entry.id} className="weekly-class">
                      <div className="weekly-class-top">
                        <span>{formatTime(entry.start_time)}</span>

                        <div>
                          <button onClick={() => openEdit(entry)} title="Edit">
                            <Pencil size={12} />
                          </button>

                          <button
                            onClick={() => removeEntry(entry)}
                            title="Remove"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>

                      <strong>{entry.subject_name}</strong>

                      <small>{entry.subject_code || "No code"}</small>

                      {entry.room && (
                        <span>
                          <MapPin size={11} />

                          {entry.room}
                        </span>
                      )}
                    </div>
                  ))}

                  {!groupedTimetable[day].length && (
                    <div className="weekly-empty">No class</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ===================================================
          SUBJECTS
      =================================================== */}

      <section className="personal-panel">
        <div className="personal-panel-head">
          <div>
            <div className="personal-section-label">Subjects</div>

            <h2>Attendance by subject</h2>
          </div>
        </div>

        {!subjects.length ? (
          <div className="personal-empty-inline">
            Import a timetable first and your subject cards will appear here.
          </div>
        ) : (
          <div className="personal-subject-grid">
            {subjects.map((subject) => {
              const subjectHasForecast = Number(subject.planned_total || 0) > 0;

              const subjectProjection = Number(
                subject.projected_percentage || subject.percentage || 0,
              );

              const subjectDelta = Number(
                (subjectProjection - Number(subject.percentage || 0)).toFixed(
                  1,
                ),
              );

              return (
                <article key={subject.id} className="personal-subject-card">
                  <div className="personal-subject-top">
                    <div>
                      <span className="personal-subject-code">
                        {subject.subject_code || "SUB"}
                      </span>

                      <h3>{subject.subject_name}</h3>
                    </div>

                    <strong
                      className={
                        subject.percentage < 75 && subject.total ? "low" : ""
                      }
                    >
                      {subject.percentage}%
                    </strong>
                  </div>

                  <div className="personal-subject-bar">
                    <span
                      style={{
                        width: `${Math.min(subject.percentage, 100)}%`,
                      }}
                      className={
                        subject.percentage < 75 && subject.total ? "low" : ""
                      }
                    />
                  </div>

                  <div className="personal-subject-stats">
                    <span>{subject.present} present</span>

                    <span>{subject.absent} absent</span>

                    <span>{subject.total} conducted</span>
                  </div>

                  {/* =================================================
                      SUBJECT FUTURE PREVIEW
                  ================================================= */}

                  {subjectHasForecast && (
                    <div className="personal-subject-preview">
                      <div className="personal-subject-preview-head">
                        <span>Future preview</span>

                        <strong className={subjectDelta >= 0 ? "up" : "down"}>
                          {subjectProjection}%
                        </strong>
                      </div>

                      <span>
                        {subject.planned_present} future present ·{" "}
                        {subject.planned_absent} future absent
                      </span>

                      <small>
                        Based on {subject.planned_total} planned mark
                        {subject.planned_total === 1 ? "" : "s"}.
                      </small>

                      {subjectDelta !== 0 && (
                        <small className={subjectDelta > 0 ? "up" : "down"}>
                          {subjectDelta > 0 ? "+" : ""}
                          {subjectDelta} percentage points from current
                        </small>
                      )}
                    </div>
                  )}

                  <div className="personal-subject-target">
                    {subject.total === 0 ? (
                      "No attendance recorded yet."
                    ) : subject.percentage < 75 ? (
                      <>
                        Attend <strong>{subject.classes_needed}</strong> more
                        consecutive class
                        {subject.classes_needed === 1 ? "" : "es"} to reach 75%.
                      </>
                    ) : (
                      <>
                        You can miss <strong>{subject.safe_to_miss}</strong>{" "}
                        more class
                        {subject.safe_to_miss === 1 ? "" : "es"} and stay at
                        75%+.
                      </>
                    )}
                  </div>

                  <div className="personal-subject-actions">
                    <button onClick={() => openSubjectEditor(subject)}>
                      <Pencil size={13} />
                      Edit
                    </button>

                    <button onClick={() => removeSubject(subject)}>
                      <Trash2 size={13} />
                      Remove
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {/* ===================================================
          HISTORY
      =================================================== */}

      <section className="personal-panel">
        <div className="personal-panel-head">
          <div>
            <div className="personal-section-label">History</div>

            <h2>Recent personal attendance</h2>
          </div>

          <div className="history-filter-wrap">
            <select
              value={historyFilter}
              onChange={(event) => setHistoryFilter(event.target.value)}
            >
              <option value="">All subjects</option>

              {subjects.map((subject) => (
                <option key={subject.id} value={subject.id}>
                  {subject.subject_name}
                </option>
              ))}
            </select>

            <button onClick={() => load(selectedDate, true)} title="Refresh">
              <RotateCcw size={15} />
            </button>
          </div>
        </div>

        {!history.length ? (
          <div className="personal-empty-inline">
            No personal attendance records yet.
          </div>
        ) : (
          <div className="history-table-wrap">
            <table className="history-table">
              <thead>
                <tr>
                  <th>Date</th>

                  <th>Subject</th>

                  <th>Time</th>

                  <th>Status</th>
                </tr>
              </thead>

              <tbody>
                {history.map((row) => (
                  <tr key={row.id}>
                    <td>{displayHistoryDate(row.class_date)}</td>

                    <td>
                      <strong>{row.subject_name}</strong>

                      <small>{row.subject_code || "No code"}</small>
                    </td>

                    <td>
                      {formatTime(row.start_time)} – {formatTime(row.end_time)}
                    </td>

                    <td>
                      <span
                        className={`history-status ${row.status
                          .toLowerCase()
                          .replace("-", "")}`}
                      >
                        {row.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ===================================================
          IMPORT MODAL
      =================================================== */}

      <Modal
        isOpen={modal === "import"}
        onClose={() => setModal(null)}
        title="Import your timetable"
        size="xl"
      >
        <div className="import-modal">
          <div className="import-intro">
            <div className="import-icon">
              <FileSpreadsheet size={19} />
            </div>

            <div>
              <strong>CSV import</strong>

              <p>
                One row should represent one class slot. Existing matching slots
                are updated; old attendance history is never deleted.
              </p>
            </div>
          </div>

          <div className="import-tools">
            <Button
              variant="outline"
              icon={Download}
              onClick={downloadTimetableTemplate}
            >
              Download template
            </Button>

            <label className="upload-dropzone">
              <Upload size={18} />

              <span>{importSource || "Choose a .csv file"}</span>

              <input
                type="file"
                accept=".csv,text/csv"
                onChange={handleCsvFile}
              />
            </label>
          </div>

          {importError && (
            <div className="import-error">
              <CircleAlert size={16} />

              {importError}
            </div>
          )}

          {importRows.length > 0 && (
            <div className="import-preview">
              <div className="import-preview-head">
                <strong>Preview</strong>

                <span>
                  {importRows.length} class
                  {importRows.length === 1 ? "" : "es"}
                </span>

                <button onClick={() => setImportRows([])}>
                  <X size={15} />
                </button>
              </div>

              <div className="import-preview-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Subject</th>

                      <th>Code</th>

                      <th>Day</th>

                      <th>Time</th>

                      <th>Room</th>
                    </tr>
                  </thead>

                  <tbody>
                    {importRows.slice(0, 100).map((row, index) => (
                      <tr key={index}>
                        <td>{row.subject_name}</td>

                        <td>{row.subject_code || "—"}</td>

                        <td>{row.day}</td>

                        <td>
                          {formatTime(row.start_time)} –{" "}
                          {formatTime(row.end_time)}
                        </td>

                        <td>{row.room || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="import-actions">
            <Button variant="ghost" onClick={() => setModal(null)}>
              Cancel
            </Button>

            <Button
              icon={Upload}
              loading={importing}
              disabled={!importRows.length}
              onClick={runImport}
            >
              Import timetable
            </Button>
          </div>
        </div>
      </Modal>

      {/* ===================================================
          ADD / EDIT CLASS MODAL
      =================================================== */}

      <Modal
        isOpen={modal === "entry"}
        onClose={() => setModal(null)}
        title={editingEntry ? "Edit timetable class" : "Add timetable class"}
        size="lg"
      >
        <form onSubmit={saveEntry} className="tracker-form">
          <div className="tracker-form-note">
            <CalendarClock size={17} />

            <div>
              <strong>
                {editingEntry
                  ? "Update this class slot"
                  : "Add a weekly class slot"}
              </strong>

              <p>Attendance history remains attached to the slot.</p>
            </div>
          </div>

          <Select
            label="Subject"
            value={form.subject_id}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                subject_id: event.target.value,
              }))
            }
            options={subjects.map((subject) => ({
              value: subject.id,
              label: `${subject.subject_code || "SUB"} — ${
                subject.subject_name
              }`,
            }))}
            required
          />

          <div className="tracker-form-grid">
            <Select
              label="Day"
              value={form.day}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  day: event.target.value,
                }))
              }
              options={DAYS.map((day) => ({
                value: day,
                label: day,
              }))}
            />

            <Input
              type="time"
              label="Start time"
              value={form.start_time}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  start_time: event.target.value,
                }))
              }
              required
            />

            <Input
              type="time"
              label="End time"
              value={form.end_time}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  end_time: event.target.value,
                }))
              }
              required
            />
          </div>

          <div className="tracker-form-grid">
            <Input
              label="Room"
              value={form.room}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  room: event.target.value,
                }))
              }
              placeholder="C-111"
            />

            <Input
              label="Notes"
              value={form.notes}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  notes: event.target.value,
                }))
              }
              placeholder="Lab / tutorial / optional details"
            />
          </div>

          <div className="tracker-form-actions">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setModal(null)}
            >
              Cancel
            </Button>

            <Button type="submit" loading={savingForm}>
              {editingEntry ? "Save changes" : "Add class"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* ===================================================
          SUBJECT EDIT MODAL
      =================================================== */}

      <Modal
        isOpen={Boolean(subjectEditor)}
        onClose={() => setSubjectEditor(null)}
        title="Edit subject"
        size="md"
      >
        <form onSubmit={saveSubject} className="tracker-form">
          <Input
            label="Subject name"
            value={subjectEditor?.subject_name || ""}
            onChange={(event) =>
              setSubjectEditor((current) => ({
                ...current,
                subject_name: event.target.value,
              }))
            }
            required
          />

          <Input
            label="Subject code"
            value={subjectEditor?.subject_code || ""}
            onChange={(event) =>
              setSubjectEditor((current) => ({
                ...current,
                subject_code: event.target.value,
              }))
            }
            placeholder="Optional"
          />

          <div className="tracker-form-actions">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setSubjectEditor(null)}
            >
              Cancel
            </Button>

            <Button type="submit">Save subject</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
