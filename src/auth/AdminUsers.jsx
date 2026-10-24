// /admin — the admin adds dashboard users (ID + password), resets passwords and removes users.
// Passwords are shown exactly once, right after they are created or reset; the server only
// keeps a hash.
import React, { useCallback, useEffect, useState } from "react";
import logoSmall from "../assets/logo-small.png";
import { C, GLOBAL_CSS } from "../theme.js";
import { Panel } from "../ui.jsx";
import { IconLogOut, IconUsers, IconRefresh, IconX, IconCheckCircle } from "../icons.jsx";
import { useSession } from "./session.js";

const PW_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
function generatePassword(length = 10) {
  const bytes = new Uint32Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (n) => PW_ALPHABET[n % PW_ALPHABET.length]).join("");
}

const fmtDate = (iso) => (iso ? new Date(iso).toLocaleString("en-IN", { day:"2-digit", month:"short", year:"numeric", hour:"numeric", minute:"2-digit" }) : "—");

export default function AdminUsers() {
  const { session, logout, expired } = useSession();
  const [users, setUsers] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [newId, setNewId] = useState("");
  const [newPw, setNewPw] = useState("");
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState("");
  const [created, setCreated] = useState(null); // { username, password, kind: "added" | "reset" }
  const [copied, setCopied] = useState(false);

  // One place for every /api/auth/users call: handles a lost session and server errors.
  const call = useCallback(async (method, body) => {
    const res = await fetch("/api/auth/users", {
      method, cache: "no-store",
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    if (res.status === 401 || res.status === 403) { expired(); throw new Error("Signed out"); }
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.error || "Something went wrong.");
    return json;
  }, [expired]);

  const refresh = useCallback(async () => {
    try {
      const { users: list } = await call("GET");
      setUsers(list.sort((a, b) => a.username.localeCompare(b.username)));
      setLoadError("");
    } catch (e) {
      setLoadError(e.message);
    }
  }, [call]);

  useEffect(() => { refresh(); }, [refresh]);

  const showCredentials = (result, kind) => { setCreated({ ...result, kind }); setCopied(false); };

  const addUser = async (e) => {
    e.preventDefault();
    if (!newId.trim() || busy) return;
    setBusy(true); setFormError("");
    try {
      showCredentials(await call("POST", { username: newId, password: newPw || undefined }), "added");
      setNewId(""); setNewPw("");
      await refresh();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const resetUser = async (username) => {
    if (!window.confirm(`Give "${username}" a new password? Their current password will stop working.`)) return;
    setBusy(true);
    try {
      showCredentials(await call("PATCH", { username }), "reset");
      await refresh();
    } catch (err) {
      window.alert(err.message);
    } finally {
      setBusy(false);
    }
  };

  const removeUser = async (username) => {
    if (!window.confirm(`Remove "${username}"? They will no longer be able to open the dashboard.`)) return;
    setBusy(true);
    try {
      await call("DELETE", { username });
      if (created?.username === username) setCreated(null);
      await refresh();
    } catch (err) {
      window.alert(err.message);
    } finally {
      setBusy(false);
    }
  };

  const shareText = created && `Production & Casting Dashboard\nLink: ${window.location.origin}\nID: ${created.username}\nPassword: ${created.password}`;
  const copy = async () => {
    try { await navigator.clipboard.writeText(shareText); setCopied(true); } catch { setCopied(false); }
  };

  const th = { textAlign:"left", padding:"11px 14px", fontWeight:700, color:"#fff", whiteSpace:"nowrap" };
  const td = { padding:"10px 14px", borderBottom:`1px solid ${C.line}`, whiteSpace:"nowrap" };

  return (
    <div style={{ background:C.bg, minHeight:"100vh", fontFamily:"'Inter',system-ui,sans-serif", color:C.text }}>
      <style>{GLOBAL_CSS}</style>

      <header className="dash-header" style={{ padding:"14px clamp(14px,4vw,26px)" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", flexWrap:"wrap", gap:14, maxWidth:960, margin:"0 auto" }}>
          <div style={{ display:"flex", alignItems:"center", gap:12, minWidth:0 }}>
            <img src={logoSmall} alt="m.suresh" style={{ height:30, width:"auto", flex:"none" }} />
            <div style={{ minWidth:0 }}>
              <h1 style={{ margin:0, fontFamily:"'Fraunces',serif", fontWeight:700, fontSize:"clamp(16px,4.5vw,21px)", color:C.text }}>Manage users</h1>
              <div style={{ fontSize:12, color:C.mut, marginTop:2, wordBreak:"break-word" }}>Signed in as admin · {session.username}</div>
            </div>
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:9 }}>
            <a href="/" className="btn btn-ghost" style={{ textDecoration:"none" }}>← Dashboard</a>
            <button type="button" className="btn btn-icon" onClick={logout} aria-label="Log out" title="Log out">
              <IconLogOut width={16} height={16} />
            </button>
          </div>
        </div>
      </header>

      <main style={{ maxWidth:960, margin:"0 auto", padding:"20px clamp(14px,4vw,26px) 40px" }}>
        <Panel title="Add a user" hint="they sign in to the dashboard with this ID and password" style={{ marginBottom:20 }}>
          <form onSubmit={addUser} style={{ display:"flex", gap:10, flexWrap:"wrap", alignItems:"flex-start" }}>
            <input className="input" placeholder="ID (e.g. ramesh)" value={newId} autoCapitalize="none" spellCheck={false}
              onChange={(e) => setNewId(e.target.value)} style={{ paddingLeft:14, flex:"1 1 200px", minWidth:0 }} />
            <div style={{ display:"flex", gap:8, flex:"1 1 260px", minWidth:0 }}>
              <input className="input" placeholder="Password (blank = auto-generate)" value={newPw}
                onChange={(e) => setNewPw(e.target.value)} style={{ paddingLeft:14, flex:1, minWidth:0, fontFamily: newPw ? "ui-monospace,monospace" : undefined }} />
              <button type="button" className="btn btn-ghost" onClick={() => setNewPw(generatePassword())} title="Fill in a random password">
                <IconRefresh width={14} height={14} /> Generate
              </button>
            </div>
            <button type="submit" className="btn btn-primary" disabled={busy || !newId.trim()} style={{ flex:"none" }}>
              {busy ? "Saving…" : "Add user"}
            </button>
          </form>
          <div style={{ fontSize:11.5, color:C.faint, marginTop:9 }}>ID: 3–40 characters — letters, numbers, . _ - @ (not case-sensitive). Password: at least 6 characters.</div>
          {formError && <div style={{ fontSize:12.5, color:"var(--danger-dk)", marginTop:10 }}>{formError}</div>}

          {created && (
            <div className="card" style={{ marginTop:16, padding:16, border:"1px solid var(--success-dk)", background:"rgba(34,197,94,.07)" }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:12 }}>
                <div style={{ fontSize:13, fontWeight:800, color:"var(--success-dk)", display:"flex", alignItems:"center", gap:7 }}>
                  <IconCheckCircle width={16} height={16} />
                  {created.kind === "added" ? "User added" : "Password reset"} — copy these now, the password won't be shown again
                </div>
                <button type="button" className="btn btn-icon" onClick={() => setCreated(null)} aria-label="Dismiss" title="Dismiss" style={{ flex:"none" }}>
                  <IconX width={14} height={14} />
                </button>
              </div>
              <div style={{ display:"grid", gridTemplateColumns:"auto 1fr", gap:"6px 14px", fontSize:14, margin:"12px 0 14px" }}>
                <span style={{ color:C.mut }}>ID</span><b style={{ fontFamily:"ui-monospace,monospace", wordBreak:"break-all" }}>{created.username}</b>
                <span style={{ color:C.mut }}>Password</span><b style={{ fontFamily:"ui-monospace,monospace", wordBreak:"break-all" }}>{created.password}</b>
              </div>
              <button type="button" className="btn btn-primary" onClick={copy}>{copied ? "Copied ✓" : "Copy ID & password"}</button>
            </div>
          )}
        </Panel>

        <Panel title="Users" hint="everyone who can open the dashboard"
          right={users && <span style={{ fontSize:11.5, color:C.mut, background:"var(--panel-2)", border:`1px solid ${C.line}`, borderRadius:999, padding:"5px 12px" }}><b style={{ color:C.text }}>{users.length}</b> {users.length === 1 ? "user" : "users"}</span>}>
          <div style={{ fontSize:12, color:C.mut, marginBottom:12 }}>
            Admin login (<b>{session.username}</b>) is set on the server and can't be changed here.
          </div>
          {loadError && <div style={{ fontSize:12.5, color:"var(--danger-dk)", marginBottom:12 }}>{loadError}</div>}
          {users === null && !loadError && <div className="shimmer-bar" style={{ width:160 }} />}
          {users && users.length === 0 && (
            <div className="empty-state">
              <IconUsers width={30} height={30} />
              <div style={{ fontSize:13 }}>No users yet. Add one above.</div>
            </div>
          )}
          {users && users.length > 0 && (
            <div className="table-wrap">
              <div className="table-scroll">
                <table style={{ fontSize:12.5 }}>
                  <thead><tr style={{ fontSize:10.5, textTransform:"uppercase", letterSpacing:".05em" }}>
                    <th style={th}>ID</th><th style={th}>Added</th><th style={th}>Password set</th><th style={{ ...th, textAlign:"right" }}>Actions</th>
                  </tr></thead>
                  <tbody>
                    {users.map((u) => (
                      <tr key={u.username} className="hoverable">
                        <td style={{ ...td, fontWeight:700, color:"var(--primary-dk)" }}>{u.username}</td>
                        <td style={td}>{fmtDate(u.createdAt)}</td>
                        <td style={td}>{fmtDate(u.passwordSetAt)}</td>
                        <td style={{ ...td, textAlign:"right" }}>
                          <div style={{ display:"inline-flex", gap:8 }}>
                            <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => resetUser(u.username)}>Reset password</button>
                            <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => removeUser(u.username)} style={{ color:"var(--danger-dk)" }}>Remove</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </Panel>
      </main>
    </div>
  );
}
