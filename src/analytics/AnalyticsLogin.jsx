// Admin sign-in for /analytics — modeled on the centered-card look used by App.jsx's
// not-found/error screens, so it feels like part of the same product.
import React, { useState } from "react";
import logo from "../assets/logo.png";
import { C, GLOBAL_CSS } from "../theme.js";
import { IconLock } from "../icons.jsx";

export default function AnalyticsLogin({ onSuccess }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!email || !password || loading) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/analytics/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (res.ok) { onSuccess(); return; }
      const body = await res.json().catch(() => ({}));
      setError(body.error || "Could not sign in.");
    } catch {
      setError("Could not reach the server.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: "100vh", position: "relative", overflow: "hidden",
      background: `radial-gradient(1100px 520px at 12% -10%, rgba(124,58,237,.16), transparent 60%),
                   radial-gradient(900px 480px at 105% 10%, rgba(37,99,235,.14), transparent 55%),
                   ${C.bg}`,
      display: "flex", alignItems: "center", justifyContent: "center", padding: 24,
      fontFamily: "'Inter',system-ui,sans-serif", color: C.text,
    }}>
      <style>{GLOBAL_CSS}</style>
      <div className="animate-in" style={{ width: "100%", maxWidth: 380 }}>
        <div style={{ textAlign: "center", marginBottom: 22 }}>
          <img src={logo} alt="m.suresh" style={{ width: 200, maxWidth: "70%", height: "auto" }} />
        </div>
        <div className="card" style={{ padding: "34px 28px", background: C.panel, borderRadius: 20 }}>
          <div style={{
            width: 52, height: 52, borderRadius: 15, margin: "0 auto 18px",
            background: "rgba(79,70,229,.12)", color: "var(--primary-2)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <IconLock width={22} height={22} />
          </div>
          <h1 style={{ margin: "0 0 6px", fontFamily: "'Fraunces',serif", fontWeight: 700, fontSize: 21, textAlign: "center", color: C.text }}>
            Analytics sign-in
          </h1>
          <p style={{ margin: "0 0 22px", fontSize: 12.5, color: C.faint, textAlign: "center", lineHeight: 1.6 }}>
            Private visitor analytics. Sign in with the admin email and password.
          </p>
          <form onSubmit={submit}>
            <input
              type="email" className="input" placeholder="Admin email" autoFocus autoComplete="username"
              value={email} onChange={(e) => setEmail(e.target.value)}
              style={{ paddingLeft: 14, marginBottom: 10 }}
            />
            <input
              type="password" className="input" placeholder="Admin password" autoComplete="current-password"
              value={password} onChange={(e) => setPassword(e.target.value)}
              style={{ paddingLeft: 14, marginBottom: 14 }}
            />
            {error && <div style={{ fontSize: 12, color: "var(--danger-dk)", marginBottom: 14, textAlign: "center" }}>{error}</div>}
            <button type="submit" className="btn btn-primary" disabled={loading || !email || !password}
              style={{ width: "100%", justifyContent: "center", padding: "11px 16px" }}>
              {loading ? "Signing in…" : "Sign in"}
            </button>
          </form>
        </div>
        <div style={{ marginTop: 18, textAlign: "center" }}>
          <a href="/" style={{ fontSize: 11.5, color: C.faint, fontWeight: 600, textDecoration: "none" }}>← Back to the dashboard</a>
        </div>
      </div>
    </div>
  );
}
