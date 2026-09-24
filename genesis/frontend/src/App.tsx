import { lazy, Suspense } from "react";
import { NavLink, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { ConnectionBanner } from "./components/ConnectionBanner";
import { Icon, type IconName } from "./components/Icon";
import { Loading } from "./components/ui";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { ChatPage } from "./pages/ChatPage";

const DashboardPage = lazy(() => import("./pages/DashboardPage"));
const MemoriesPage = lazy(() => import("./pages/MemoriesPage"));
const KnowledgePage = lazy(() => import("./pages/KnowledgePage"));
const JournalPage = lazy(() => import("./pages/JournalPage"));
const ProfilePage = lazy(() => import("./pages/ProfilePage"));
const SettingsPage = lazy(() => import("./pages/SettingsPage"));

const NAV: { to: string; label: string; icon: IconName; end?: boolean }[] = [
  { to: "/chat", label: "Chat", icon: "chat" },
  { to: "/dashboard", label: "Dashboard", icon: "dashboard" },
  { to: "/memories", label: "Memories", icon: "memory" },
  { to: "/knowledge", label: "Knowledge", icon: "knowledge" },
  { to: "/journal", label: "Journal", icon: "journal" },
  { to: "/profile", label: "Profile", icon: "profile" },
  { to: "/settings", label: "Settings", icon: "settings" },
];

export function App() {
  const location = useLocation();
  // Reset the error boundary when moving between sections (but not between chat conversations).
  const section = location.pathname.split("/")[1] || "chat";
  return (
    <div className="app">
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <nav className="nav" aria-label="Main">
        <div className="brand" aria-hidden="true">
          <span className="brand-orb" />
          <span className="brand-name">Genesis</span>
        </div>
        <ul className="nav-list">
          {NAV.map((n) => (
            <li key={n.to}>
              <NavLink to={n.to} end={n.end} className={({ isActive }) => (isActive ? "nav-link active" : "nav-link")}>
                <Icon name={n.icon} size={20} />
                <span className="nav-label">{n.label}</span>
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
      <div className="main-col">
        <ConnectionBanner />
        <main id="main" className="main" tabIndex={-1}>
          <ErrorBoundary key={section}>
            <Suspense fallback={<div className="page"><Loading /></div>}>
              <Routes>
                <Route path="/" element={<Navigate to="/chat" replace />} />
                <Route path="/chat/:id?" element={<ChatPage />} />
                <Route path="/dashboard" element={<DashboardPage />} />
                <Route path="/memories" element={<MemoriesPage />} />
                <Route path="/knowledge" element={<KnowledgePage />} />
                <Route path="/journal" element={<JournalPage />} />
                <Route path="/profile" element={<ProfilePage />} />
                <Route path="/settings" element={<SettingsPage />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </Suspense>
          </ErrorBoundary>
        </main>
      </div>
    </div>
  );
}
