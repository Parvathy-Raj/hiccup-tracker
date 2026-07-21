import { useEffect, useState } from "react";
import { Layout } from "./components/Layout";
import { api } from "./api";
import { Dashboard } from "./pages/Dashboard";
import { SubmitHiccup } from "./pages/SubmitHiccup";
import { HiccupList } from "./pages/HiccupList";
import { HiccupDetail } from "./pages/HiccupDetail";
import { MonthlySummary } from "./pages/MonthlySummary";
import { AdminSettings } from "./pages/AdminSettings";
import { UserSettings } from "./pages/UserSettings";
import { Login } from "./pages/Login";
import "./main.css";

const DEFAULT_PAGE = "dashboard";

export default function App() {
  const initialRoute = readRoute();
  const [page, setPage] = useState(initialRoute.page);
  const [detailId, setDetailId] = useState(initialRoute.detailId);
  const [lookups, setLookups] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);

  const refreshLookups = () => {
    api.lookups().then((data) => {
      setLookups(data);
      setCurrentUser((existing) => {
        const savedUserId = Number(localStorage.getItem("hiccup_user_id"));
        const user = data.users.find((item) => item.id === existing?.id && item.is_active !== false) || data.users.find((item) => item.id === savedUserId && item.is_active !== false) || null;
        if (!user) localStorage.removeItem("hiccup_user_id");
        return user;
      });
    });
  };

  useEffect(() => { refreshLookups(); }, []);

  useEffect(() => {
    const syncRoute = () => {
      const route = readRoute();
      setPage(route.page);
      setDetailId(route.detailId);
    };
    if (!window.location.hash) {
      window.history.replaceState(null, "", `#${DEFAULT_PAGE}`);
    } else {
      syncRoute();
    }
    window.addEventListener("hashchange", syncRoute);
    return () => window.removeEventListener("hashchange", syncRoute);
  }, []);

  if (!lookups) return <div className="content">Loading Hiccup Tracker...</div>;
  if (!currentUser) {
    return <Login onLogin={(user) => { localStorage.setItem("hiccup_user_id", String(user.id)); setCurrentUser(user); }} />;
  }

  const activePage = page === "admin" && currentUser.role !== "Admin" ? "settings" : page;

  function navigate(next, nextDetailId = null) {
    const hash = next === "detail" && nextDetailId ? `#detail/${nextDetailId}` : `#${next}`;
    if (window.location.hash === hash) {
      setPage(next);
      setDetailId(nextDetailId);
      return;
    }
    window.location.hash = hash;
  }

  function openDetail(id) {
    navigate("detail", id);
  }

  return (
    <Layout
      page={activePage}
      setPage={(next) => navigate(next)}
      currentUser={currentUser}
      onLogout={() => { localStorage.removeItem("hiccup_user_id"); setCurrentUser(null); navigate(DEFAULT_PAGE); }}
    >
      {activePage === "dashboard" && <Dashboard />}
      {activePage === "submit" && <SubmitHiccup lookups={lookups} currentUser={currentUser} openDetail={openDetail} />}
      {activePage === "list" && <HiccupList lookups={lookups} currentUser={currentUser} openDetail={openDetail} />}
      {activePage === "detail" && detailId && <HiccupDetail id={detailId} lookups={lookups} currentUser={currentUser} back={() => navigate("list")} />}
      {activePage === "summary" && <MonthlySummary />}
      {activePage === "admin" && currentUser.role === "Admin" && <AdminSettings lookups={lookups} currentUser={currentUser} refreshLookups={refreshLookups} />}
      {activePage === "settings" && <UserSettings currentUser={currentUser} refreshLookups={refreshLookups} />}
    </Layout>
  );
}

function readRoute() {
  const value = window.location.hash.replace(/^#/, "");
  const [page, detailId] = value.split("/");
  if (page === "detail" && detailId) return { page, detailId };
  if (["dashboard", "submit", "list", "summary", "admin", "settings"].includes(page)) return { page, detailId: null };
  return { page: DEFAULT_PAGE, detailId: null };
}
