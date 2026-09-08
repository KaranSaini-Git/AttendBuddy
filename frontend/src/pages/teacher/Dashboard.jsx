import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "@/services/api";
import { useToast } from "@/context/ToastContext";
import Spinner from "@/components/ui/Spinner";
import Table from "@/components/ui/Table";
import EmptyState from "@/components/ui/EmptyState";
import {
  AlertTriangle,
  ArrowUpRight,
  BarChart3,
  CalendarDays,
  ClipboardCheck,
  UserCheck,
  UserX,
  Users,
} from "lucide-react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  Tooltip,
  Legend,
  Filler,
} from "chart.js";
import { Doughnut, Line, Bar } from "react-chartjs-2";
import "./Dashboard.css";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  Tooltip,
  Legend,
  Filler,
);

const green = "#176b3a";
const greenSoft = "rgba(23,107,58,.12)";
const mutedRed = "#b65f50";
const mutedGold = "#b28c38";
const ink = "#101512";
const grid = "rgba(16,21,18,.07)";

const chartBase = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      labels: {
        color: "#59655e",
        usePointStyle: true,
        boxWidth: 8,
        font: { family: "DM Sans", size: 11 },
      },
    },
  },
};

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const { showToast } = useToast();

  useEffect(() => {
    const fetchDashboard = async () => {
      try {
        const response = await api.get("/teacher/dashboard");
        setData(response.data);
      } catch (error) {
        showToast("Failed to load dashboard data", "error");
      } finally {
        setLoading(false);
      }
    };
    fetchDashboard();
  }, [showToast]);

  if (loading) {
    return (
      <div className="dv-dashboard-loading">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!data) {
    return (
      <EmptyState
        title="No Data Available"
        description="Dashboard could not be loaded."
      />
    );
  }

  const {
    stats,
    recent_attendance,
    subject_stats,
    attendance_trend,
    below_75_students,
  } = data;
  const average = Number(stats?.average_attendance || 0);
  const present = Number(stats?.present_today || 0);
  const absent = Number(stats?.absent_today || 0);
  const totalToday = present + absent;

  const doughnutData = {
    labels: ["Present", "Absent"],
    datasets: [
      {
        data: [present, absent],
        backgroundColor: [green, mutedRed],
        borderWidth: 0,
        hoverOffset: 4,
      },
    ],
  };

  const lineData = {
    labels: attendance_trend?.map((item) => item.date) || [],
    datasets: [
      {
        label: "Attendance %",
        data: attendance_trend?.map((item) => item.percentage) || [],
        borderColor: green,
        backgroundColor: greenSoft,
        fill: true,
        tension: 0.35,
        pointRadius: 2.5,
        pointHoverRadius: 4,
        pointBackgroundColor: green,
        pointBorderWidth: 0,
      },
    ],
  };

  const barData = {
    labels: subject_stats?.map((item) => item.subject_name) || [],
    datasets: [
      {
        label: "Average attendance",
        data: subject_stats?.map((item) => item.average_percentage) || [],
        backgroundColor: green,
        borderRadius: 7,
        maxBarThickness: 34,
      },
    ],
  };

  return (
    <div className="dv-dashboard-page">
      <section className="dv-hero">
        <div>
          <div className="dv-hero-eyebrow">TEACHER OVERVIEW</div>
          <h1>Attendance at a glance.</h1>
          <p>
            Monitor today's classes, identify attendance risks, and stay on top
            of every section.
          </p>
        </div>
        <Link to="/teacher/attendance/mark" className="dv-hero-action">
          <ClipboardCheck size={17} />
          Mark attendance
          <ArrowUpRight size={16} />
        </Link>
      </section>

      <section className="dv-metric-grid">
        <Metric
          icon={Users}
          label="Total students"
          value={stats?.total_students || 0}
        />
        <Metric
          icon={CalendarDays}
          label="Classes today"
          value={stats?.classes_today || 0}
        />
        <Metric
          icon={UserCheck}
          label="Present today"
          value={present}
          tone="positive"
        />
        <Metric
          icon={UserX}
          label="Absent today"
          value={absent}
          tone="negative"
        />
        <Metric
          icon={BarChart3}
          label="Average attendance"
          value={`${average}%`}
        />
        <Metric
          icon={AlertTriangle}
          label="Below 75%"
          value={stats?.below_75_count || 0}
          tone="warning"
        />
      </section>

      <section className="dv-primary-grid">
        <article className="dv-panel dv-pulse-panel">
          <div className="dv-panel-head">
            <div>
              <div className="dv-section-label">TODAY</div>
              <h2>Attendance pulse</h2>
            </div>
            <span className="dv-panel-note">
              {totalToday
                ? `${Math.round((present / totalToday) * 100)}% present`
                : "No records yet"}
            </span>
          </div>
          <div className="dv-pulse-content">
            <div className="dv-donut-wrap">
              <Doughnut
                data={doughnutData}
                options={{
                  ...chartBase,
                  cutout: "74%",
                  plugins: { ...chartBase.plugins, legend: { display: false } },
                }}
              />
              <div className="dv-donut-center">
                <strong>{present}</strong>
                <span>present</span>
              </div>
            </div>
            <div className="dv-pulse-legend">
              <div>
                <span className="dv-dot present" /> <span>Present</span>
                <strong>{present}</strong>
              </div>
              <div>
                <span className="dv-dot absent" /> <span>Absent</span>
                <strong>{absent}</strong>
              </div>
              <div className="dv-pulse-total">
                <span>Total marked</span>
                <strong>{totalToday}</strong>
              </div>
            </div>
          </div>
        </article>

        <article className="dv-panel">
          <div className="dv-panel-head">
            <div>
              <div className="dv-section-label">TREND</div>
              <h2>Last 30 days</h2>
            </div>
            <span className="dv-panel-note">Attendance %</span>
          </div>
          <div className="dv-chart-large">
            <Line
              data={lineData}
              options={{
                ...chartBase,
                scales: {
                  x: {
                    grid: { color: grid },
                    ticks: {
                      color: "#8a948d",
                      maxTicksLimit: 6,
                      font: { family: "DM Sans", size: 9 },
                    },
                  },
                  y: {
                    beginAtZero: true,
                    suggestedMax: 100,
                    grid: { color: grid },
                    ticks: {
                      color: "#8a948d",
                      font: { family: "DM Sans", size: 9 },
                    },
                  },
                },
              }}
            />
          </div>
        </article>
      </section>

      <section className="dv-secondary-grid">
        <article className="dv-panel">
          <div className="dv-panel-head">
            <div>
              <div className="dv-section-label">PERFORMANCE</div>
              <h2>Subject-wise attendance</h2>
            </div>
          </div>
          <div className="dv-chart-bar">
            <Bar
              data={barData}
              options={{
                ...chartBase,
                scales: {
                  x: {
                    grid: { display: false },
                    ticks: {
                      color: "#59655e",
                      font: { family: "DM Sans", size: 10 },
                    },
                  },
                  y: {
                    beginAtZero: true,
                    suggestedMax: 100,
                    grid: { color: grid },
                    ticks: {
                      color: "#8a948d",
                      font: { family: "DM Sans", size: 9 },
                    },
                  },
                },
              }}
            />
          </div>
        </article>

        <article className="dv-panel">
          <div className="dv-panel-head">
            <div>
              <div className="dv-section-label">ATTENTION</div>
              <h2>Students below 75%</h2>
            </div>
            <span className="dv-risk-badge">
              {below_75_students?.length || 0} at risk
            </span>
          </div>
          <div className="dv-table-wrap">
            <Table
              columns={[
                { key: "name", label: "Name" },
                { key: "subject", label: "Subject" },
                {
                  key: "percentage",
                  label: "Attendance",
                  render: (val) => (
                    <span className="dv-risk-value">{val}%</span>
                  ),
                },
              ]}
              data={below_75_students || []}
              emptyMessage="No students below 75%."
            />
          </div>
        </article>
      </section>

      <article className="dv-panel">
        <div className="dv-panel-head">
          <div>
            <div className="dv-section-label">ACTIVITY</div>
            <h2>Recent attendance</h2>
          </div>
          <Link className="dv-text-link" to="/teacher/attendance/history">
            View history <ArrowUpRight size={14} />
          </Link>
        </div>
        <div className="dv-table-wrap">
          <Table
            columns={[
              { key: "date", label: "Date" },
              { key: "section", label: "Section" },
              { key: "subject", label: "Subject" },
              { key: "present", label: "Present" },
              { key: "absent", label: "Absent" },
            ]}
            data={recent_attendance || []}
            emptyMessage="No recent attendance records."
          />
        </div>
      </article>
    </div>
  );
}

function Metric({ icon: Icon, label, value, tone = "neutral" }) {
  return (
    <article className="dv-metric">
      <div className={`dv-metric-icon ${tone}`}>
        <Icon size={17} />
      </div>
      <div className="min-w-0">
        <div className="dv-metric-label">{label}</div>
        <div className="dv-metric-value">{value}</div>
      </div>
    </article>
  );
}
