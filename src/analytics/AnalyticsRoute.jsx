// Top-level /analytics route: checks the admin session, then renders the login form or
// the dashboard. Auth is enforced server-side (GET /api/analytics/session, and every
// data call requires the same cookie) — this check is only about which UI to show.
import React, { useEffect, useState } from "react";
import { C, GLOBAL_CSS } from "../theme.js";
import AnalyticsLogin from "./AnalyticsLogin.jsx";
import AnalyticsDashboard from "./AnalyticsDashboard.jsx";

export default function AnalyticsRoute() {
  const [status, setStatus] = useState("checking"); // checking | anon | authed

  const checkSession = async () => {
    try {
      const res = await fetch("/api/analytics/session", { cache: "no-store" });
      const json = await res.json();
      setStatus(json.authenticated ? "authed" : "anon");
    } catch {
      setStatus("anon");
    }
  };

  useEffect(() => { checkSession(); }, []);

  if (status === "checking") {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: C.bg }}>
        <style>{GLOBAL_CSS}</style>
        <div className="shimmer-bar" style={{ width: 160 }} />
      </div>
    );
  }

  if (status === "anon") return <AnalyticsLogin onSuccess={() => setStatus("authed")} />;
  return <AnalyticsDashboard onLoggedOut={() => setStatus("anon")} />;
}
