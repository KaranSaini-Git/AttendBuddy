import React, { useEffect, useMemo, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  BookOpen,
  CalendarDays,
  ClipboardList,
  GraduationCap,
  LayoutDashboard,
  LogOut,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  UserCircle,
  X,
} from "lucide-react";

const items = [
  ["Dashboard", "/student/dashboard", LayoutDashboard],
  ["Attendance", "/student/attendance", ClipboardList],
  ["Calendar", "/student/calendar", CalendarDays],
  ["Subjects", "/student/subjects", BookOpen],
];

export default function StudentLayout() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => setMobileOpen(false), [location.pathname]);

  const title = useMemo(
    () =>
      items.find(([, path]) => location.pathname === path)?.[0] || "Dashboard",
    [location.pathname],
  );

  const renderNav = (isCollapsed) => (
    <nav className="dv-nav" style={{ marginTop: 27 }}>
      <span className="dv-nav-label">Workspace</span>
      {items.map(([name, path, Icon]) => (
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
    </nav>
  );

  const renderSidebar = (mobile = false) => {
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
              <div className="dv-brand-sub">Student workspace</div>
            </div>
          )}
        </div>
        <div className="dv-user-card">
          <div className="dv-avatar">{user?.name?.charAt(0) || "S"}</div>
          {!isCollapsed && (
            <div className="min-w-0">
              <div className="dv-user-name">{user?.name || "Student"}</div>
              <div className="dv-user-meta">{user?.user_id}</div>
            </div>
          )}
        </div>
        <div style={{ flex: 1, overflowY: "auto" }}>
          {renderNav(isCollapsed)}
        </div>
        <div className="dv-nav-bottom">
          <NavLink
            to="/student/profile"
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
      </aside>
    );
  };

  return (
    <div className="dv-shell">
      {renderSidebar()}
      {mobileOpen && (
        <div
          className="dv-mobile-backdrop"
          onClick={() => setMobileOpen(false)}
        />
      )}
      {renderSidebar(true)}

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
              <div className="dv-kicker">Student workspace</div>
              <div className="dv-page-title">{title}</div>
            </div>
          </div>
        </header>
        <main className="dv-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
