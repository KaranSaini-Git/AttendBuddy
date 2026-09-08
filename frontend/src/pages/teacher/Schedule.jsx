import React, { useEffect, useMemo, useState } from "react";
import "./Schedule.css";
import {
  CalendarDays,
  Clock3,
  MapPin,
  Plus,
  Pencil,
  Trash2,
  MoreHorizontal,
  Sparkles,
} from "lucide-react";
import api from "@/services/api";
import { useToast } from "@/context/ToastContext";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import Spinner from "@/components/ui/Spinner";

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
  section_id: "",
  subject_id: "",
  day: "",
  start_time: "",
  end_time: "",
  room: "",
};

export default function Schedule() {
  const [schedule, setSchedule] = useState([]);
  const [sections, setSections] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const { showToast } = useToast();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [scheduleRes, sectionRes, subjectRes] = await Promise.all([
        api.get("/teacher/schedule"),
        api.get("/teacher/sections"),
        api.get("/teacher/subjects"),
      ]);
      setSchedule(scheduleRes.data || []);
      setSections(sectionRes.data || []);
      setSubjects(subjectRes.data || []);
    } catch (error) {
      showToast(
        error.response?.data?.message || "Failed to load schedule data",
        "error",
      );
    } finally {
      setLoading(false);
    }
  };

  const grouped = useMemo(() => {
    const map = Object.fromEntries(DAYS.map((day) => [day, []]));
    schedule.forEach((item) => {
      if (map[item.day]) map[item.day].push(item);
    });
    Object.values(map).forEach((items) => {
      items.sort((a, b) =>
        String(a.start_time).localeCompare(String(b.start_time)),
      );
    });
    return map;
  }, [schedule]);

  const stats = useMemo(() => {
    const activeDays = DAYS.filter((day) => grouped[day]?.length).length;
    const busiestDay = DAYS.reduce(
      (best, day) =>
        grouped[day].length > (grouped[best]?.length || 0) ? day : best,
      DAYS[0],
    );
    return { total: schedule.length, activeDays, busiestDay };
  }, [grouped, schedule]);

  const todayName = new Intl.DateTimeFormat("en-US", {
    weekday: "long",
  }).format(new Date());

  const openCreate = (day = "") => {
    setEditing(null);
    setForm({ ...EMPTY_FORM, day });
    setModalOpen(true);
  };

  const openEdit = (item) => {
    setEditing(item);
    setForm({
      section_id: String(item.section_id ?? ""),
      subject_id: String(item.subject_id ?? ""),
      day: item.day || "",
      start_time: item.start_time || "",
      end_time: item.end_time || "",
      room: item.room || "",
    });
    setModalOpen(true);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (form.start_time && form.end_time && form.start_time >= form.end_time) {
      showToast("End time must be later than start time.", "error");
      return;
    }

    setSaving(true);
    try {
      if (editing) {
        await api.put(`/teacher/assignments/${editing.id}`, {
          ...form,
          active: true,
        });
        showToast("Schedule updated", "success");
      } else {
        await api.post("/teacher/assignments", form);
        showToast("Schedule added", "success");
      }
      setModalOpen(false);
      await fetchData();
    } catch (error) {
      showToast(
        error.response?.data?.message ||
          error.response?.data?.error ||
          "Unable to save schedule",
        "error",
      );
    } finally {
      setSaving(false);
    }
  };

  const deactivate = async (item) => {
    const confirmed = window.confirm(
      `Remove ${item.subject_name} from ${item.day}?`,
    );
    if (!confirmed) return;

    try {
      await api.put(`/teacher/assignments/${item.id}`, { active: false });
      showToast("Schedule removed", "success");
      await fetchData();
    } catch (error) {
      showToast(
        error.response?.data?.message || "Unable to remove schedule",
        "error",
      );
    }
  };

  if (loading) {
    return (
      <div className="schedule-loading">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="schedule-page">
      <header className="schedule-header">
        <div>
          <div className="schedule-kicker">
            <CalendarDays size={14} /> Teacher workspace
          </div>
          <h1>Weekly schedule</h1>
          <p>
            Keep your teaching week organized and jump into the right class when
            attendance is due.
          </p>
        </div>
        <Button onClick={() => openCreate()} icon={Plus}>
          Add schedule
        </Button>
      </header>

      <section className="schedule-stat-strip" aria-label="Schedule summary">
        <div className="schedule-stat">
          <span className="schedule-stat-label">Classes / week</span>
          <strong>{stats.total}</strong>
        </div>
        <div className="schedule-stat">
          <span className="schedule-stat-label">Teaching days</span>
          <strong>{stats.activeDays}</strong>
        </div>
        <div className="schedule-stat schedule-stat-featured">
          <div className="schedule-stat-icon">
            <Sparkles size={15} />
          </div>
          <div>
            <span className="schedule-stat-label">Busiest day</span>
            <strong>{stats.total ? stats.busiestDay : "—"}</strong>
          </div>
        </div>
        <div className="schedule-stat schedule-stat-tip">
          <span className="schedule-stat-label">Quick tip</span>
          <span>
            Tap a day’s + button to add a class directly to that column.
          </span>
        </div>
      </section>

      <section className="schedule-board-wrap">
        <div className="schedule-board-head">
          <div>
            <span className="schedule-section-label">Week at a glance</span>
            <h2>Teaching plan</h2>
          </div>
          <span className="schedule-today-chip">Today · {todayName}</span>
        </div>

        <div className="schedule-board">
          {DAYS.map((day) => {
            const items = grouped[day];
            const isToday = day === todayName;

            return (
              <section
                key={day}
                className={`schedule-column ${isToday ? "is-today" : ""}`}
              >
                <div className="schedule-column-head">
                  <div>
                    <span>{day.slice(0, 3)}</span>
                    <strong>{day}</strong>
                  </div>
                  <button
                    className="schedule-add-icon"
                    onClick={() => openCreate(day)}
                    aria-label={`Add schedule for ${day}`}
                  >
                    <Plus size={15} />
                  </button>
                </div>

                <div className="schedule-column-body">
                  {items.length === 0 ? (
                    <button
                      className="schedule-empty-day"
                      onClick={() => openCreate(day)}
                    >
                      <Plus size={16} />
                      <span>Add class</span>
                    </button>
                  ) : (
                    items.map((item) => (
                      <article key={item.id} className="schedule-card">
                        <div className="schedule-card-accent" />
                        <div className="schedule-card-head">
                          <span className="schedule-time">
                            <Clock3 size={13} /> {formatTime(item.start_time)}
                          </span>
                          <div className="schedule-more-wrap">
                            <button
                              className="schedule-more"
                              aria-label="Schedule actions"
                            >
                              <MoreHorizontal size={16} />
                            </button>
                            <div className="schedule-actions-popover">
                              <button onClick={() => openEdit(item)}>
                                <Pencil size={14} /> Edit
                              </button>
                              <button
                                className="danger"
                                onClick={() => deactivate(item)}
                              >
                                <Trash2 size={14} /> Remove
                              </button>
                            </div>
                          </div>
                        </div>

                        <h3>{item.subject_name}</h3>
                        <div className="schedule-section-pill">
                          {item.section_name}
                        </div>
                        <div className="schedule-card-meta">
                          <span>
                            <Clock3 size={12} /> {formatTime(item.start_time)}–
                            {formatTime(item.end_time)}
                          </span>
                          {item.room && (
                            <span>
                              <MapPin size={12} /> {item.room}
                            </span>
                          )}
                        </div>
                      </article>
                    ))
                  )}
                </div>
              </section>
            );
          })}
        </div>
      </section>

      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? "Edit schedule" : "Add schedule"}
        size="lg"
      >
        <form onSubmit={handleSubmit} className="schedule-form">
          <div className="schedule-form-intro">
            <div className="schedule-form-icon">
              <CalendarDays size={18} />
            </div>
            <div>
              <strong>Set up a class slot</strong>
              <p>Choose the section, subject and weekly time for this class.</p>
            </div>
          </div>

          <div className="schedule-form-grid">
            <Select
              label="Section"
              value={form.section_id}
              onChange={(e) =>
                setForm((current) => ({
                  ...current,
                  section_id: e.target.value,
                }))
              }
              options={sections
                .filter((section) => section.active)
                .map((section) => ({
                  value: String(section.id),
                  label: section.section_name,
                }))}
              required
            />

            <Select
              label="Subject"
              value={form.subject_id}
              onChange={(e) =>
                setForm((current) => ({
                  ...current,
                  subject_id: e.target.value,
                }))
              }
              options={subjects
                .filter((subject) => subject.active)
                .map((subject) => ({
                  value: String(subject.id),
                  label: `${subject.subject_name}${subject.subject_code ? ` (${subject.subject_code})` : ""}`,
                }))}
              required
            />

            <Select
              label="Day"
              value={form.day}
              onChange={(e) =>
                setForm((current) => ({ ...current, day: e.target.value }))
              }
              options={DAYS.map((day) => ({ value: day, label: day }))}
              required
            />

            <Input
              type="text"
              label="Room"
              placeholder="e.g. Lab 204"
              value={form.room}
              onChange={(e) =>
                setForm((current) => ({ ...current, room: e.target.value }))
              }
            />

            <Input
              type="time"
              label="Start time"
              value={form.start_time}
              onChange={(e) =>
                setForm((current) => ({
                  ...current,
                  start_time: e.target.value,
                }))
              }
              required
            />

            <Input
              type="time"
              label="End time"
              value={form.end_time}
              onChange={(e) =>
                setForm((current) => ({ ...current, end_time: e.target.value }))
              }
              required
            />
          </div>

          <div className="schedule-form-actions">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setModalOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" loading={saving}>
              {editing ? "Save changes" : "Add schedule"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

function formatTime(value) {
  if (!value) return "--:--";
  const [hours, minutes] = String(value).slice(0, 5).split(":").map(Number);
  if (Number.isNaN(hours) || Number.isNaN(minutes))
    return String(value).slice(0, 5);
  const suffix = hours >= 12 ? "PM" : "AM";
  const hour12 = hours % 12 || 12;
  return `${hour12}:${String(minutes).padStart(2, "0")} ${suffix}`;
}
