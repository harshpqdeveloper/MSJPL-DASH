// Shows the sign-in page until the server confirms a session, then renders its children.
// The real protection is server-side (every /api/excel/* call checks the session cookie);
// this only decides which screen to show.
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { C, GLOBAL_CSS } from "../theme.js";
import LoginPage from "./LoginPage.jsx";
import { SessionContext } from "./session.js";

export default function AuthGate({ children, adminOnly = false }) {
  const [session, setSession] = useState(undefined); // undefined = checking, null = signed out
  const [notice, setNotice] = useState("");

  useEffect(() => {
    fetch("/api/auth/session", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => setSession(j.authenticated ? { username: j.username, isAdmin: j.isAdmin } : null))
      .catch(() => setSession(null));
  }, []);

  const logout = useCallback(async () => {
    try { await fetch("/api/auth/logout", { method: "POST" }); } catch { /* signed out locally anyway */ }
    setNotice("");
    setSession(null);
  }, []);

  const expired = useCallback(() => {
    setNotice("Your session has ended. Please sign in again.");
    setSession(null);
  }, []);

  const ctx = useMemo(() => ({ session, logout, expired }), [session, logout, expired]);

  if (session === undefined) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: C.bg }}>
        <style>{GLOBAL_CSS}</style>
        <div className="shimmer-bar" style={{ width: 160 }} />
      </div>
    );
  }

  if (!session) {
    return (
      <LoginPage
        title={adminOnly ? "Admin sign-in" : "Sign in"}
        note={adminOnly ? "Manage who can open the dashboard. Sign in with the admin ID and password." : undefined}
        error={notice}
        onSuccess={(s) => { setNotice(""); setSession(s); }}
      />
    );
  }

  if (adminOnly && !session.isAdmin) {
    return (
      <LoginPage
        title="Admin sign-in"
        note={`You are signed in as ${session.username}, which is not an admin. Sign in with the admin ID to manage users.`}
        onSuccess={(s) => setSession(s)}
      />
    );
  }

  return <SessionContext.Provider value={ctx}>{children}</SessionContext.Provider>;
}
