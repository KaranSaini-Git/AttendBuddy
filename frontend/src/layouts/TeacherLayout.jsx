import React, { useEffect, useMemo, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  BarChart3,
  BookOpen,
  Calendar,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  Download,
  GraduationCap,
  History,
  Layers3,
  LayoutDashboard,
  LogOut,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  UserCircle,
  Users,
  X,
} from "lucide-react";

const groups = [
  {
    label: "Workspace",
    items: [
      ["Dashboard", "/teacher/dashboard", LayoutDashboard],
      ["Mark attendance", "/teacher/attendance/mark", ClipboardCheck],
      ["Attendance history", "/teacher/attendance/history", History],
      ["Reports", "/teacher/reports", BarChart3],
    ],
  },
  {
    label: "Manage",
    items: [
      ["Students", "/teacher/students", Users],
      ["Sections", "/teacher/sections", Layers3],
      ["Subjects", "/teacher/subjects", BookOpen],
      ["Assignments", "/teacher/assignments", Calendar],
      ["My schedule", "/teacher/schedule", Clock3],
    ],
  },
  { label: "Tools", items: [["Export", "/teacher/export", Download]] },
];

export default function TeacherLayout() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => setMobileOpen(false), [location.pathname]);

  const title = useMemo(
    () =>
      groups
        .flatMap((g) => g.items)
        .find(([, path]) => location.pathname === path)?.[0] || "Dashboard",
    [location.pathname],
  );

  const renderNav = (isCollapsed) => (
    <nav className="dv-nav">
      {groups.map((group) => (
        <div className="dv-nav-group" key={group.label}>
          {!isCollapsed && <span className="dv-nav-label">{group.label}</span>}
          {group.items.map(([name, path, Icon]) => (
            <NavLink
              key={path}
              to={path}
              title={isCollapsed ? name : undefined}
              className={({ isActive }) =>
                `dv-nav-item ${isActive ? "active" : ""} ${isCollapsed ? "collapsed" : ""}`
              }
            >
              <Icon size={18} strokeWidth={1.9} />
              {!isCollapsed && <span>{name}</span>}
            </NavLink>
          ))}
        </div>
      ))}
    </nav>
  );

  const userCard = (isCollapsed) => (
    <div className="dv-user-card">
      <div className="dv-avatar">{user?.name?.charAt(0) || "T"}</div>
      {!isCollapsed && (
        <div className="min-w-0">
          <div className="dv-user-name">{user?.name || "Teacher"}</div>
          <div className="dv-user-meta">{user?.email || user?.user_id}</div>
        </div>
      )}
    </div>
  );

  const bottom = (isCollapsed) => (
    <div className="dv-nav-bottom">
      <NavLink
        to="/teacher/profile"
        className={`dv-profile-link ${isCollapsed ? "justify-center" : ""}`}
        title={isCollapsed ? "Profile" : undefined}
      >
        <UserCircle size={18} strokeWidth={1.9} />
        {!isCollapsed && "Profile"}
      </NavLink>
      <button
        onClick={logout}
        className={`dv-logout ${isCollapsed ? "justify-center" : ""}`}
        title={isCollapsed ? "Logout" : undefined}
      >
        <LogOut size={18} strokeWidth={1.9} />
        {!isCollapsed && "Logout"}
      </button>
    </div>
  );

  const Sidebar = ({ mobile = false }) => {
    const isCollapsed = mobile ? false : collapsed;
    return (
      <aside
        className={
          mobile
            ? `dv-sidebar-mobile ${mobileOpen ? "open" : ""}`
            : `dv-sidebar ${collapsed ? "dv-sidebar-collapsed" : ""}`
        }
      >
        {mobile && (
          <div
            className="dv-sidebar-pad"
            style={{ display: "flex", justifyContent: "flex-end" }}
          >
            <button
              className="dv-toggle"
              onClick={() => setMobileOpen(false)}
              aria-label="Close navigation"
            >
              <X size={18} />
            </button>
          </div>
        )}
        <div className="dv-brand">
          <div className="dv-brand-mark">
            <GraduationCap size={20} />
          </div>
          {!isCollapsed && (
            <div>
              <div className="dv-brand-name">AttendBuddy</div>
              <div className="dv-brand-sub">Teacher workspace</div>
            </div>
          )}
        </div>
        {userCard(isCollapsed)}
        <div style={{ flex: 1, overflowY: "auto", paddingBottom: 8 }}>
          {renderNav(isCollapsed)}
        </div>
        {bottom(isCollapsed)}
      </aside>
    );
  };

  return (
    <div className="dv-shell">
      <Sidebar />
      {mobileOpen && (
        <div
          className="dv-mobile-backdrop"
          onClick={() => setMobileOpen(false)}
        />
      )}
      <Sidebar mobile />

      <div className={`dv-main ${collapsed ? "dv-main-collapsed" : ""}`}>
        <header className="dv-topbar">
          <div className="dv-topbar-left">
            <button
              className="dv-toggle dv-mobile-only"
              onClick={() => setMobileOpen(true)}
              aria-label="Open navigation"
            >
              <Menu size={18} />
            </button>
            <button
              className="dv-toggle"
              onClick={() => setCollapsed((value) => !value)}
              aria-label="Toggle sidebar"
            >
              {collapsed ? (
                <PanelLeftOpen size={18} />
              ) : (
                <PanelLeftClose size={18} />
              )}
            </button>
            <div>
              <div className="dv-kicker">Teacher workspace</div>
              <div className="dv-page-title">{title}</div>
            </div>
          </div>
          <div className="hidden sm:flex dv-online">
            <CheckCircle2 size={13} />
            System online
          </div>
        </header>
        <main className="dv-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
