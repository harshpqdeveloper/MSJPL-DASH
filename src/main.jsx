import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import AnalyticsRoute from "./analytics/AnalyticsRoute.jsx";

// No router library for two destinations — a plain pathname check, in keeping with this
// project's preference for hand-rolled solutions over new dependencies.
const isAnalytics = window.location.pathname.replace(/\/+$/, "").startsWith("/analytics");

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    {isAnalytics ? <AnalyticsRoute /> : <App />}
  </React.StrictMode>
);
