import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowUpRight,
  CalendarDays,
  Check,
  ChevronRight,
  CircleAlert,
  Clock3,
  Flame,
  Target,
  TrendingUp,
} from "lucide-react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Filler,
} from "chart.js";
import { Line } from "react-chartjs-2";
import api from "../../services/api";
import Spinner from "../../components/ui/Spinner";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import "./Dashboard.css";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Filler,
);

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const formatDate = (value) =>
  new Date(value).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });

export default function Dashboard() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      try {
        const response = await api.get("/student/dashboard");
        if (mounted) setData(response.data);
      } catch (error) {
        if (mounted) showToast("Failed to load dashboard", "error");
      } finally {
        if (mounted) setLoading(false);
      }
    };

    load();
    return () => {
      mounted = false;
    };
  }, [showToast]);

  const computed = useMemo(() => {
    if (!data) return null;

    const percentage = Number(data.overall?.percentage ?? 0);
    const subjects = [...(data.subjects || [])].sort(
      (a, b) => Number(a.percentage) - Number(b.percentage),
    );
    const lowSubjects = subjects.filter((subject) => subject.is_low);
    const strongest = [...subjects].sort(
      (a, b) => Number(b.percentage) - Number(a.percentage),
    )[0];
    const trend = data.trend || [];
    const recent = [...trend].slice(-7);
    const recentPresent = recent.reduce(
      (sum, day) => sum + Number(day.present_count || 0),
      0,
    );
    const recentTotal = recent.reduce(
      (sum, day) => sum + Number(day.total || 0),
      0,
    );
    const recentRate = recentTotal
      ? Number(((recentPresent / recentTotal) * 100).toFixed(1))
      : 0;
    const targetGap = Math.max(0, Number((75 - percentage).toFixed(1)));
    const classesNeeded =
      percentage < 75 && percentage > 0
        ? Math.max(
            0,
            Math.ceil(
              (75 * data.overall.total - 100 * data.overall.present) / 25,
            ),
          )
        : 0;

    return {
      percentage,
      subjects,
      lowSubjects,
      strongest,
      recent,
      recentRate,
      targetGap,
      classesNeeded,
      isLow: percentage < 75 && data.overall.total > 0,
    };
  }, [data]);

  if (loading) {
    return (
      <div className="student-dashboard-loading">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!data || !computed) return null;

  const ringValue = clamp(computed.percentage, 0, 100);
  const circumference = 2 * Math.PI * 52;
  const dashOffset = circumference - (ringValue / 100) * circumference;

  const chartData = {
    labels: computed.recent.map((item) => formatDate(item.date)),
    datasets: [
      {
        data: computed.recent.map((item) => {
          const total = Number(item.total || 0);
          return total
            ? Number(
                ((Number(item.present_count || 0) / total) * 100).toFixed(1),
              )
            : 0;
        }),
        borderColor: "#176b3a",
        backgroundColor: "rgba(23, 107, 58, 0.08)",
        fill: true,
        tension: 0.38,
        pointRadius: 3,
        pointHoverRadius: 5,
        pointBorderWidth: 2,
        pointBackgroundColor: "#ffffff",
        pointBorderColor: "#176b3a",
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        displayColors: false,
        backgroundColor: "#111816",
        padding: 11,
        callbacks: { label: (context) => `${context.parsed.y}% attendance` },
      },
    },
    scales: {
      x: {
        display: true,
        grid: { display: false },
        ticks: { color: "#7f8a83", font: { size: 11 } },
      },
      y: {
        display: true,
        suggestedMin: 0,
        suggestedMax: 100,
        grid: { color: "rgba(16,21,18,.06)" },
        ticks: {
          color: "#7f8a83",
          font: { size: 10 },
          callback: (value) => `${value}%`,
        },
      },
    },
  };

  const greetingName = (user?.name || "Student").split(" ")[0];

  return (
    <div className="student-dashboard">
      <section className="student-dashboard-header">
        <div>
          <div className="student-dashboard-eyebrow">
            Your attendance, at a glance
          </div>
          <h1>Good to see you, {greetingName}.</h1>
          <p>
            Keep your attendance healthy and stay ahead of every class this
            week.
          </p>
        </div>
        <div className="student-dashboard-header-actions">
          <button
            className="student-secondary-btn"
            onClick={() => navigate("/student/calendar")}
          >
            <CalendarDays size={16} />
            Calendar
          </button>
          <button
            className="student-primary-btn"
            onClick={() => navigate("/student/attendance")}
          >
            View attendance
            <ArrowUpRight size={16} />
          </button>
        </div>
      </section>

      {computed.isLow ? (
        <section className="student-alert">
          <div className="student-alert-icon">
            <CircleAlert size={18} />
          </div>
          <div>
            <strong>You’re below the 75% requirement.</strong>
            <p>
              You are at {computed.percentage}%. Attend your next classes
              consistently to move back toward the safe zone.
            </p>
          </div>
          <span className="student-alert-badge">
            {computed.targetGap.toFixed(1)} pts to 75%
          </span>
        </section>
      ) : (
        <section className="student-safe-strip">
          <div className="student-safe-icon">
            <Check size={17} />
          </div>
          <div>
            <strong>Attendance is on track.</strong>
            <p>
              You’re currently at {computed.percentage}% — keep the streak
              going.
            </p>
          </div>
          <span className="student-safe-badge">Above 75%</span>
        </section>
      )}

      <section className="student-stats-grid">
        <article className="student-score-card">
          <div className="student-section-label">Overall attendance</div>
          <div className="student-score-row">
            <div className="student-ring-wrap">
              <svg
                className="student-ring"
                viewBox="0 0 120 120"
                aria-label={`${computed.percentage}% attendance`}
              >
                <circle className="student-ring-track" cx="60" cy="60" r="52" />
                <circle
                  className={`student-ring-value ${computed.isLow ? "low" : ""}`}
                  cx="60"
                  cy="60"
                  r="52"
                  strokeDasharray={circumference}
                  strokeDashoffset={dashOffset}
                />
              </svg>
              <div className="student-ring-center">
                <strong>{computed.percentage}%</strong>
                <span>attendance</span>
              </div>
            </div>
            <div className="student-score-copy">
              <span className="student-score-title">Current standing</span>
              <p>
                {data.overall.present} present · {data.overall.absent} absent ·{" "}
                {data.overall.total} classes
              </p>
              <div className="student-mini-progress">
                <span style={{ width: `${ringValue}%` }} />
              </div>
              <small>
                {computed.isLow
                  ? `${computed.classesNeeded} more attended classes can help lift your percentage.`
                  : "You have cleared the minimum attendance requirement."}
              </small>
            </div>
          </div>
        </article>

        <article className="student-focus-card">
          <div className="student-section-label">At a glance</div>
          <div className="student-focus-list">
            <div className="student-focus-item">
              <span className="student-focus-icon green">
                <Target size={17} />
              </span>
              <div>
                <small>Target</small>
                <strong>75% minimum</strong>
              </div>
              <ChevronRight size={16} />
            </div>
            <div className="student-focus-item">
              <span className="student-focus-icon blue">
                <TrendingUp size={17} />
              </span>
              <div>
                <small>Last 7 days</small>
                <strong>{computed.recentRate || 0}% attended</strong>
              </div>
              <ChevronRight size={16} />
            </div>
            <div className="student-focus-item">
              <span
                className={`student-focus-icon ${computed.lowSubjects.length ? "red" : "green"}`}
              >
                <CircleAlert size={17} />
              </span>
              <div>
                <small>Needs attention</small>
                <strong>
                  {computed.lowSubjects.length
                    ? `${computed.lowSubjects.length} subject${computed.lowSubjects.length > 1 ? "s" : ""}`
                    : "Nothing right now"}
                </strong>
              </div>
              <ChevronRight size={16} />
            </div>
          </div>
        </article>
      </section>

      <section className="student-content-grid">
        <article className="student-panel student-subject-panel">
          <div className="student-panel-head">
            <div>
              <div className="student-section-label">Subject performance</div>
              <h2>Where your attendance stands</h2>
            </div>
            <button
              className="student-inline-link"
              onClick={() => navigate("/student/subjects")}
            >
              View subjects <ChevronRight size={15} />
            </button>
          </div>

          <div className="student-subject-list">
            {computed.subjects.map((subject) => (
              <button
                key={subject.subject_id || subject.subject_code}
                className="student-subject-row"
                onClick={() => navigate("/student/subjects")}
              >
                <span className="student-subject-dot" />
                <span className="student-subject-main">
                  <strong>{subject.subject_name}</strong>
                  <small>
                    {subject.subject_code} · {subject.present} /{" "}
                    {subject.total || 0} classes attended
                  </small>
                </span>
                <span className="student-subject-bar">
                  <span
                    className={subject.is_low ? "low" : ""}
                    style={{
                      width: `${clamp(Number(subject.percentage || 0), 0, 100)}%`,
                    }}
                  />
                </span>
                <strong
                  className={`student-subject-percent ${subject.is_low ? "low" : ""}`}
                >
                  {subject.percentage}%
                </strong>
              </button>
            ))}
            {!computed.subjects.length && (
              <div className="student-empty">No subjects are assigned yet.</div>
            )}
          </div>
        </article>

        <article className="student-panel student-trend-panel">
          <div className="student-panel-head">
            <div>
              <div className="student-section-label">Recent trend</div>
              <h2>Last 7 days</h2>
            </div>
            <span className="student-trend-chip">
              <span /> {computed.recentRate || 0}%
            </span>
          </div>
          <div className="student-chart-wrap">
            {computed.recent.length ? (
              <Line data={chartData} options={chartOptions} />
            ) : (
              <div className="student-empty">
                Attendance trend will appear here once classes are recorded.
              </div>
            )}
          </div>
        </article>
      </section>

      <section className="student-bottom-grid">
        <article className="student-panel student-insight-card">
          <div className="student-insight-icon">
            <Flame size={18} />
          </div>
          <div>
            <div className="student-section-label">Best performing subject</div>
            <h3>{computed.strongest?.subject_name || "No subject data"}</h3>
            <p>
              {computed.strongest
                ? `${computed.strongest.percentage}% attendance across ${computed.strongest.total} classes.`
                : "Once attendance is recorded, your strongest subject will appear here."}
            </p>
          </div>
        </article>

        <article className="student-panel student-next-card">
          <div className="student-section-label">Quick actions</div>
          <div className="student-action-row">
            <button onClick={() => navigate("/student/calendar")}>
              <CalendarDays size={17} />
              <span>Open calendar</span>
              <ChevronRight size={15} />
            </button>
            <button onClick={() => navigate("/student/attendance")}>
              <Clock3 size={17} />
              <span>Attendance history</span>
              <ChevronRight size={15} />
            </button>
            <button onClick={() => navigate("/student/subjects")}>
              <Target size={17} />
              <span>Check subjects</span>
              <ChevronRight size={15} />
            </button>
          </div>
        </article>
      </section>
    </div>
  );
}
