import React, { useState, useEffect, useCallback, useMemo } from "react";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";
import logoSmall from "../assets/logo-small.png";
import { C, GLOBAL_CSS, REDUCED_MOTION } from "../theme.js";
import { Segmented, StatCard, Panel, TT, CH } from "../ui.jsx";
import {
  IconUsers, IconGlobe, IconMousePointer, IconTrendingUp, IconLogOut,
  IconRefresh, IconInbox, IconAlertTriangle, IconMonitor, IconSmartphone, IconTablet,
} from "../icons.jsx";

const fmt = (n) => Math.round(n || 0).toLocaleString("en-IN");
const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);

const RANGE_OPTIONS = [
  { key: "today", label: "Today" },
  { key: "yesterday", label: "Yesterday" },
  { key: "7d", label: "Last 7 Days" },
  { key: "30d", label: "Last 30 Days" },
  { key: "90d", label: "Last 90 Days" },
  { key: "custom", label: "Custom" },
];

function pctChange(curr, prev) {
  if (prev === null || prev === undefined) return null;
  if (prev === 0) return curr > 0 ? Infinity : null;
  return ((curr - prev) / prev) * 100;
}

function ChangeBadge({ value }) {
  if (value === null || value === undefined) {
    return <span style={{ fontSize: 11.5, color: C.faint, fontWeight: 700 }}>—</span>;
  }
  if (!Number.isFinite(value)) {
    return <span className="pill-soft" style={{ background: "rgba(34,197,94,.13)", color: "var(--success-dk)" }}>New</span>;
  }
  const up = value >= 0;
  return (
    <span className="pill-soft" style={{ background: up ? "rgba(34,197,94,.13)" : "rgba(239,68,68,.13)", color: up ? "var(--success-dk)" : "var(--danger-dk)" }}>
      {up ? "▲" : "▼"} {Math.abs(value).toFixed(1)}%
    </span>
  );
}

function formatBucketLabel(iso, granularity) {
  const d = new Date(iso);
  if (granularity === "hour") return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", timeZone: "UTC" });
  return d.toLocaleDateString([], { day: "2-digit", month: "short", timeZone: "UTC" });
}

function EmptyState({ label }) {
  return (
    <div className="empty-state">
      <IconInbox width={28} height={28} />
      <div style={{ fontSize: 12.5 }}>{label}</div>
    </div>
  );
}

// `capitalize` is only for rows whose raw value is lowercase (device type, traffic source).
// Browser/OS names already come pre-capitalized from lib/analyticsUA.js (e.g. "iOS",
// "macOS") — capitalizing those again would mangle them into "IOS"/"MacOS".
function BreakdownPanel({ title, hint, rows, delay, deviceIcons, capitalize }) {
  const total = rows.reduce((s, r) => s + r.n, 0);
  return (
    <Panel title={title} hint={hint} delay={delay}>
      {total === 0 ? <EmptyState label="No data for this range yet." /> : (
        <div>
          {rows.map((r) => (
            <div key={r.name} style={{ marginBottom: 11 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4, alignItems: "center" }}>
                <span style={{ fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
                  {deviceIcons && deviceIcons[r.name]}
                  {capitalize ? cap(r.name) : r.name}
                </span>
                <span style={{ color: C.text, fontVariantNumeric: "tabular-nums", fontWeight: 800 }}>
                  {fmt(r.n)} · {((r.n / total) * 100).toFixed(0)}%
                </span>
              </div>
              <div style={{ height: 8, background: C.panel2, borderRadius: 5, overflow: "hidden" }}>
                <div style={{ width: `${(100 * r.n) / total}%`, height: "100%", background: "var(--grad-primary)", borderRadius: 5, transition: "width .5s cubic-bezier(.16,1,.3,1)" }} />
              </div>
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}

function StatSkeleton() {
  return (
    <div className="card" style={{ padding: "20px 22px", height: 132 }}>
      <div className="shimmer-bar" style={{ width: "50%", marginBottom: 24 }} />
      <div className="shimmer-bar" style={{ width: "70%", marginBottom: 10 }} />
      <div className="shimmer-bar" style={{ width: "40%" }} />
    </div>
  );
}

const DEVICE_ICONS = {
  desktop: <IconMonitor width={13} height={13} />,
  mobile: <IconSmartphone width={13} height={13} />,
  tablet: <IconTablet width={13} height={13} />,
};

export default function AnalyticsDashboard({ onLoggedOut }) {
  const [range, setRange] = useState("7d");
  const [customDraft, setCustomDraft] = useState({ from: "", to: "" });
  const [appliedCustom, setAppliedCustom] = useState(null);
  const [customError, setCustomError] = useState("");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchSummary = useCallback(async () => {
    if (range === "custom" && !appliedCustom) return;
    setLoading(true);
    setError("");
    const params = new URLSearchParams({ range });
    if (range === "custom" && appliedCustom) {
      params.set("from", appliedCustom.from);
      params.set("to", appliedCustom.to);
    }
    try {
      const res = await fetch(`/api/analytics/summary?${params.toString()}`, { cache: "no-store" });
      if (res.status === 401) { onLoggedOut(); return; }
      const json = await res.json();
      if (!res.ok) { setError(json.error || "Could not load analytics data."); return; }
      setData(json);
    } catch {
      setError("Could not reach the server.");
    } finally {
      setLoading(false);
    }
  }, [range, appliedCustom, onLoggedOut]);

  useEffect(() => { fetchSummary(); }, [fetchSummary]);

  const applyCustomRange = () => {
    if (!customDraft.from || !customDraft.to) { setCustomError("Pick both dates."); return; }
    if (customDraft.from > customDraft.to) { setCustomError("Start date must be before end date."); return; }
    setCustomError("");
    setAppliedCustom({ ...customDraft });
  };

  const logout = async () => {
    try { await fetch("/api/analytics/logout", { method: "POST" }); } catch { /* ignore */ }
    onLoggedOut();
  };

  const chartData = useMemo(() => {
    if (!data) return [];
    return data.trend.map((r) => ({ ...r, label: formatBucketLabel(r.bucket, data.bucket ?? "day") }));
  }, [data]);

  const activeRangeOption = RANGE_OPTIONS.find((o) => o.key === range);
  const isEmpty = data && data.rangeVisits === 0;

  return (
    <div style={{ background: C.bg, minHeight: "100vh", fontFamily: "'Inter',system-ui,sans-serif", color: C.text }}>
      <style>{GLOBAL_CSS}</style>

      <header className="dash-header" style={{ padding: "14px clamp(14px,4vw,26px)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <img src={logoSmall} alt="m.suresh" style={{ height: 28, width: "auto" }} />
            <h1 style={{ margin: 0, fontFamily: "'Fraunces',serif", fontWeight: 700, fontSize: "clamp(16px,4.5vw,20px)", color: C.text }}>
              Visitor Analytics
            </h1>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
            <a href="/" className="btn btn-ghost" style={{ textDecoration: "none" }}>Back to dashboard</a>
            <button type="button" className="btn btn-icon" onClick={fetchSummary} disabled={loading} aria-label="Refresh" title="Refresh">
              <IconRefresh width={16} height={16} style={loading ? { animation: "spin .8s linear infinite" } : undefined} />
            </button>
            <button type="button" className="btn btn-icon" onClick={logout} aria-label="Log out" title="Log out">
              <IconLogOut width={16} height={16} />
            </button>
          </div>
        </div>
      </header>

      <div style={{ padding: "22px clamp(14px,4vw,26px) 44px", maxWidth: 1400, margin: "0 auto" }}>
        {/* ---------- Range selector ---------- */}
        <div className="card animate-in" style={{ padding: "14px clamp(12px,4vw,18px)", marginBottom: 20, borderRadius: 18, display: "flex", flexWrap: "wrap", alignItems: "center", gap: 14 }}>
          <Segmented options={RANGE_OPTIONS} value={activeRangeOption} onChange={(o) => setRange(o.key)} getKey={(o) => o.key} getLabel={(o) => o.label} />
          {range === "custom" && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <input type="date" className="input" style={{ paddingLeft: 12, width: "auto" }}
                value={customDraft.from} onChange={(e) => setCustomDraft((d) => ({ ...d, from: e.target.value }))} />
              <span style={{ color: C.faint, fontSize: 12 }}>to</span>
              <input type="date" className="input" style={{ paddingLeft: 12, width: "auto" }}
                value={customDraft.to} onChange={(e) => setCustomDraft((d) => ({ ...d, to: e.target.value }))} />
              <button type="button" className="btn btn-ghost" onClick={applyCustomRange}>Apply</button>
              {customError && <span style={{ fontSize: 11.5, color: "var(--danger-dk)" }}>{customError}</span>}
            </div>
          )}
          {data && (
            <span style={{ marginLeft: "auto", fontSize: 11.5, color: C.mut, background: "var(--panel-2)", border: `1px solid ${C.line}`, borderRadius: 999, padding: "5px 12px" }}>
              <span style={{ display: "inline-block", width: 7, height: 7, borderRadius: 999, background: "var(--success)", marginRight: 6, animation: "barPulse 1.6s ease-in-out infinite" }} />
              {fmt(data.activeNow)} active in the last 5 minutes
            </span>
          )}
        </div>

        {error && (
          <div className="card animate-in" style={{ padding: "16px 20px", marginBottom: 20, display: "flex", alignItems: "center", gap: 12, borderRadius: 16 }}>
            <IconAlertTriangle width={20} height={20} style={{ color: "var(--danger-dk)", flex: "none" }} />
            <div style={{ fontSize: 13, color: C.text, flex: 1 }}>{error}</div>
            <button type="button" className="btn btn-ghost" onClick={fetchSummary}>Try again</button>
          </div>
        )}

        {/* ---------- KPI cards ---------- */}
        <div className="grid-stats" style={{ marginBottom: 20 }}>
          {!data && loading ? (
            Array.from({ length: 6 }).map((_, i) => <StatSkeleton key={i} />)
          ) : data ? (
            <>
              <StatCard label="Total Visitors" rawValue={data.totalVisitors} format={fmt} sub="All-time"
                icon={<IconUsers width={20} height={20} />} accent={CH.primary} tint="rgba(79,70,229,.13)" grad="var(--grad-primary)" />
              <StatCard label="Visitors Today" rawValue={data.visitorsToday} format={fmt}
                sub={<ChangeBadge value={pctChange(data.visitorsToday, data.visitorsPrevDay)} />}
                icon={<IconTrendingUp width={20} height={20} />} accent={CH.blue} tint="rgba(59,130,246,.13)" grad="var(--grad-blue)" />
              <StatCard label="Visitors — Last 7 Days" rawValue={data.visitors7d} format={fmt}
                sub={<ChangeBadge value={pctChange(data.visitors7d, data.visitorsPrev7d)} />}
                icon={<IconTrendingUp width={20} height={20} />} accent={CH.violet} tint="rgba(124,58,237,.13)" grad="var(--grad-purple)" />
              <StatCard label="Visitors — Last 30 Days" rawValue={data.visitors30d} format={fmt}
                sub={<ChangeBadge value={pctChange(data.visitors30d, data.visitorsPrev30d)} />}
                icon={<IconTrendingUp width={20} height={20} />} accent={CH.steel} tint="rgba(168,85,247,.13)" grad="var(--grad-plat)" />
              <StatCard label="Total Visits" rawValue={data.totalVisits} format={fmt} sub="All-time pageviews"
                icon={<IconMousePointer width={20} height={20} />} accent={CH.gold} tint="rgba(245,158,11,.14)" grad="var(--grad-gold)" />
              <StatCard label="Unique Visitors" rawValue={data.rangeVisitors} format={fmt}
                sub={<ChangeBadge value={pctChange(data.rangeVisitors, data.prevRangeVisitors)} />}
                icon={<IconGlobe width={20} height={20} />} accent={CH.emerald} tint="rgba(34,197,94,.13)" grad="var(--grad-success)" />
            </>
          ) : null}
        </div>

        {/* ---------- Trend chart ---------- */}
        <Panel title="Visitor trend" hint={`${activeRangeOption.label} · grouped by ${data?.bucket === "hour" ? "hour" : "day"}`} style={{ marginBottom: 20 }} delay={80}>
          {!data ? (
            <div className="shimmer-bar" style={{ height: 260 }} />
          ) : isEmpty ? (
            <EmptyState label="No visits recorded in this range yet." />
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={chartData} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="jdVisitorsFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={CH.primary} stopOpacity={0.35} />
                    <stop offset="95%" stopColor={CH.primary} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={CH.line} vertical={false} />
                <XAxis dataKey="label" tick={{ fill: CH.faint, fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fill: CH.faint, fontSize: 11 }} axisLine={false} tickLine={false} width={34} />
                <Tooltip content={<TT unit="" />} />
                <Area type="monotone" dataKey="visitors" name="Visitors" stroke={CH.primary} fill="url(#jdVisitorsFill)" strokeWidth={2} isAnimationActive={!REDUCED_MOTION} />
                <Area type="monotone" dataKey="visits" name="Visits" stroke={CH.steel} fill="none" strokeWidth={1.5} strokeDasharray="4 3" isAnimationActive={!REDUCED_MOTION} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </Panel>

        {/* ---------- Breakdown panels ---------- */}
        {data && (
          <div className="grid-stats" style={{ marginBottom: 20, gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))" }}>
            <BreakdownPanel title="Device" hint="visits by device type" rows={data.devices} delay={120} deviceIcons={DEVICE_ICONS} capitalize />
            <BreakdownPanel title="Browser" hint="visits by browser" rows={data.browsers} delay={140} />
            <BreakdownPanel title="Operating system" hint="visits by OS" rows={data.os} delay={160} />
            <BreakdownPanel title="Traffic sources" hint="visits by referrer type" rows={data.sources} delay={180} capitalize />
          </div>
        )}

        {/* ---------- Top pages ---------- */}
        <Panel title="Top pages" hint="most visited pages in range" delay={200}>
          {!data ? (
            <div className="shimmer-bar" style={{ height: 160 }} />
          ) : data.topPages.length === 0 ? (
            <EmptyState label="No page visits recorded in this range yet." />
          ) : (
            <div className="table-wrap">
              <div className="table-scroll" style={{ maxHeight: 360 }}>
                <table style={{ fontSize: 12.5 }}>
                  <thead><tr style={{ fontSize: 10.5, textTransform: "uppercase", letterSpacing: ".05em" }}>
                    <th style={{ textAlign: "left", padding: "11px 14px", fontWeight: 700, color: "#fff" }}>Page</th>
                    <th style={{ textAlign: "right", padding: "11px 14px", fontWeight: 700, color: "#fff" }}>Visits</th>
                    <th style={{ textAlign: "right", padding: "11px 14px", fontWeight: 700, color: "#fff" }}>Unique visitors</th>
                  </tr></thead>
                  <tbody>
                    {data.topPages.map((p) => (
                      <tr key={p.path} className="hoverable zebra">
                        <td style={{ padding: "9px 14px", borderBottom: `1px solid ${C.line}`, color: C.text, fontWeight: 600 }}>{p.path}</td>
                        <td style={{ textAlign: "right", padding: "9px 14px", borderBottom: `1px solid ${C.line}`, fontVariantNumeric: "tabular-nums", fontWeight: 700 }}>{fmt(p.visits)}</td>
                        <td style={{ textAlign: "right", padding: "9px 14px", borderBottom: `1px solid ${C.line}`, fontVariantNumeric: "tabular-nums", fontWeight: 700 }}>{fmt(p.visitors)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}
