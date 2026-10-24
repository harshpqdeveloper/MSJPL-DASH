// Sign-in screen shown before the dashboard (and before /admin). Same centered-card look as
// the /analytics sign-in.
import React, { useState } from "react";
import logo from "../assets/logo.png";
import { C, GLOBAL_CSS } from "../theme.js";
import { IconLock } from "../icons.jsx";

export default function LoginPage({ onSuccess, title = "Sign in", note, error: outsideError = "" }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!username || !password || loading) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const body = await res.json().catch(() => ({}));
      if (res.ok) { onSuccess({ username: body.username, isAdmin: body.isAdmin }); return; }
      setError(body.error || "Could not sign in.");
    } catch {
      setError("Could not reach the server.");
    } finally {
      setLoading(false);
    }
  };

  const shownError = error || outsideError;

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
            {title}
          </h1>
          <p style={{ margin: "0 0 22px", fontSize: 12.5, color: C.faint, textAlign: "center", lineHeight: 1.6 }}>
            {note || "Production & Casting Dashboard. Sign in with the ID and password you were given."}
          </p>
          <form onSubmit={submit}>
            <input
              type="text" className="input" placeholder="ID" autoFocus autoComplete="username"
              autoCapitalize="none" spellCheck={false}
              value={username} onChange={(e) => setUsername(e.target.value)}
              style={{ paddingLeft: 14, marginBottom: 10 }}
            />
            <input
              type="password" className="input" placeholder="Password" autoComplete="current-password"
              value={password} onChange={(e) => setPassword(e.target.value)}
              style={{ paddingLeft: 14, marginBottom: 14 }}
            />
            {shownError && <div style={{ fontSize: 12, color: "var(--danger-dk)", marginBottom: 14, textAlign: "center" }}>{shownError}</div>}
            <button type="submit" className="btn btn-primary" disabled={loading || !username || !password}
              style={{ width: "100%", justifyContent: "center", padding: "11px 16px" }}>
              {loading ? "Signing in…" : "Sign in"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
