import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import AnalyticsRoute from "./analytics/AnalyticsRoute.jsx";
import AuthGate from "./auth/AuthGate.jsx";
import AdminUsers from "./auth/AdminUsers.jsx";

// No router library for three destinations — a plain pathname check, in keeping with this
// project's preference for hand-rolled solutions over new dependencies.
const path = window.location.pathname.replace(/\/+$/, "");
const isAnalytics = path.startsWith("/analytics");
const isAdmin = path.startsWith("/admin");

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    {isAnalytics ? <AnalyticsRoute />
      : isAdmin ? <AuthGate adminOnly><AdminUsers /></AuthGate>
      : <AuthGate><App /></AuthGate>}
  </React.StrictMode>
);
