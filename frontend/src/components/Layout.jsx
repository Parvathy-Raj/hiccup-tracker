import { BarChart3, FileText, ListChecks, LogOut, Settings, SquarePen } from "lucide-react";
import kineticsLogo from "../assets/kinetics-logo.png";

const nav = [
  ["dashboard", "Dashboard", BarChart3],
  ["submit", "Submit Hiccup", SquarePen],
  ["list", "Hiccup List", ListChecks],
  ["summary", "Monthly Summary", FileText],
  ["admin", "Admin Settings", Settings],
  ["settings", "User Settings", Settings],
];

export function Layout({ page, setPage, currentUser, onLogout, children }) {
  const visibleNav = nav.filter(([id]) => canAccess(id, currentUser.role));

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand-block">
          <div className="kinetics-logo" aria-label="Kinetics logo">
            <img src={kineticsLogo} alt="Kinetics Group" />
          </div>
          <div className="brand-subtitle">Hiccup Tracker</div>
        </div>
        <nav className="nav">
          {visibleNav.map(([id, label, Icon]) => (
            <button key={id} className={page === id ? "active" : ""} onClick={() => setPage(id)}>
              <Icon size={17} /> {label}
            </button>
          ))}
        </nav>
        <div className="user-panel">
          <div className="user-avatar">{initials(currentUser.name)}</div>
          <div className="user-meta">
            <strong>{currentUser.name}</strong>
            <span>{currentUser.role}</span>
            <small>{currentUser.department?.name || "All departments"}</small>
          </div>
          <button className="logout-btn" onClick={onLogout} title="Logout">
            <LogOut size={16} />
          </button>
        </div>
      </aside>
      <main className="content">{children}</main>
    </div>
  );
}

function canAccess(page, role) {
  if (page === "admin") return role === "Admin";
  if (page === "settings") return role !== "Admin";
  return true;
}

function initials(name) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}
