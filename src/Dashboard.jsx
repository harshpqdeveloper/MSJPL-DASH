import React, { useState, useMemo, useEffect, useRef } from "react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Cell, PieChart, Pie, Tooltip, CartesianGrid, LabelList } from "recharts";
import logoSmall from "./assets/logo-small.png";
import { C, GRAD_BLUE, GRAD_PURPLE, GRAD_GOLD, GRAD_SILVER, GRAD_PLAT, SHADOW_MD, GLOBAL_CSS, REDUCED_MOTION } from "./theme.js";
import { Segmented, PopoverButton } from "./ui.jsx";
import {
  IconRefresh, IconChevronDown, IconInbox, IconSettings,
  IconMenu, IconChevronLeft, IconGrid, IconUser, IconGem,
  IconLayers, IconTrendingUp, IconShieldCheck,
} from "./icons.jsx";
import { loadUiSession, saveUiSession } from "./sessionPersistence.js";

const FUNNEL = ["New Order","Model Pending","Wax","PWBGD","JTRI","PTRI","Filing","Finding Balance","Single Pre Polish","Setting","MSHDS","Polish","Rodium","PQC","Third Party QC","Sampling","Job Work","GSI","FG","Adi Nath","Others"];
const METALS = ["Gold","Silver","Platinum","Other"];
// Literal hex (not CSS-var strings) — these feed both plain style backgrounds and
// hex+alpha-suffix tints (e.g. `${METALC[x]}1f`), which only work with real hex values.
const METALC = { Gold:"#B45309", Silver:"#000000", Platinum:"#6B21A8", Other:"#64748B" };
const fmt = (n) => Math.round(n).toLocaleString("en-IN");
const fmt2 = (n) => n.toLocaleString("en-IN", { minimumFractionDigits:2, maximumFractionDigits:2 });

// Concrete hex for Recharts (SVG fill/stroke attributes don't reliably resolve CSS custom
// properties) — DOM styling elsewhere uses the CSS-var C object from theme.js.
const CH = { primary:"#4F46E5", violet:"#7C3AED", blue:"#3B82F6", gold:"#F59E0B", steel:"#A855F7", plat:"#94A3B8",
  emerald:"#22C55E", emeraldDk:"#15803D", amber:"#F59E0B", rose:"#EF4444", roseDk:"#B91C1C",
  mut:"#000000", faint:"#000000", line:"#EBEEF6" };
const CATC = [CH.primary, CH.gold, CH.steel, CH.emerald, CH.plat, CH.violet];

const TT = ({ active, payload, label, unit }) => {
  if (!active || !payload || !payload.length) return null;
  return (
    <div style={{ background:"var(--panel)", border:`1px solid ${CH.line}`, borderRadius:12,
      padding:"10px 13px", fontSize:12, color:"var(--text)", boxShadow:SHADOW_MD }}>
      <div style={{ color:"var(--mut)", marginBottom:5, fontWeight:700 }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ display:"flex", alignItems:"center", gap:6, padding:"1px 0" }}>
          <span className="dot" style={{ background:p.color||CH.primary }} />{p.name}: <b style={{ fontVariantNumeric:"tabular-nums" }}>{fmt(p.value)}{unit||" pcs"}</b>
        </div>
      ))}
    </div>
  );
};

// Permanent data label for the "Balance by party" bars — inside the bar (right-aligned,
// white) when the bar is wide enough for the text, otherwise just past the bar's end
// (left-aligned, dark) so the value is always visible without hovering.
const PartyBarLabel = (props) => {
  const { x, y, width, height, value } = props;
  const text = `${fmt(value)} pcs`;
  const estTextWidth = text.length * 6.3 + 10;
  const inside = width >= estTextWidth + 10;
  return (
    <text
      x={inside ? x + width - 6 : x + width + 6}
      y={y + height / 2}
      dy={4}
      fontSize={11}
      fontWeight={700}
      style={{ fontVariantNumeric: "tabular-nums" }}
      textAnchor={inside ? "end" : "start"}
      fill={inside ? "#fff" : CH.mut}
    >
      {text}
    </text>
  );
};

// ---- purely-visual count-up animation (numeric value in, animated numeric value out) ----
function useCountUp(target, duration = 650) {
  const [val, setVal] = useState(target);
  const prevRef = useRef(target);
  useEffect(() => {
    const from = prevRef.current;
    const to = target;
    if (from === to) return undefined;
    if (REDUCED_MOTION) { setVal(to); prevRef.current = to; return undefined; }
    let raf; const start = performance.now();
    const tick = (now) => {
      const p = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setVal(from + (to - from) * eased);
      if (p < 1) raf = requestAnimationFrame(tick); else prevRef.current = to;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return val;
}

// Tiny CSS-only bar sparkline — fed only with real, already-derived per-month totals
// (never a fabricated trend number: this file has no prior-period data to compare against).
function MiniBars({ data, color }) {
  const max = Math.max(...data, 1);
  if (data.length === 0) return null;
  return (
    <div style={{ display:"flex", alignItems:"flex-end", gap:3, width:64, height:28, flex:"none" }}>
      {data.map((v, i) => (
        <div key={i} className="mini-bar" style={{ flex:1, height:`${Math.max(10, (v / max) * 100)}%`, background:color, borderRadius:2,
          opacity:.55 + 0.45 * (i + 1) / data.length, animationDelay:`${i * 140}ms` }} />
      ))}
    </div>
  );
}

function StatCard({ label, rawValue, format, unit, sub, accent, tint, grad, icon, sparkline, delay = 0 }) {
  const animated = useCountUp(rawValue);
  return (
    <div className="card card-hover animate-in" style={{ padding:"clamp(16px,4vw,20px) clamp(16px,4vw,22px)", animationDelay:`${delay}ms`, "--grad": grad }}>
      <div className="grad-top" />
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:16 }}>
        <div style={{ fontSize:11, letterSpacing:".07em", textTransform:"uppercase", fontWeight:800, color:"var(--mut)" }}>{label}</div>
        <div className="icon-badge" style={{ "--tint": tint, "--accent": accent }}>{icon}</div>
      </div>
      <div style={{ display:"flex", alignItems:"flex-end", justifyContent:"space-between", gap:10 }}>
        <div>
          <div style={{ display:"flex", alignItems:"baseline", gap:6 }}>
            <span style={{ fontFamily:"'Fraunces',serif", fontSize:"clamp(26px,7vw,34px)", fontWeight:700, lineHeight:1, letterSpacing:"-.01em", color:"var(--text)", fontVariantNumeric:"tabular-nums" }}>
              {format(animated)}
            </span>
            {unit && <span style={{ fontSize:12.5, fontWeight:700, color:"var(--mut)" }}>{unit}</span>}
          </div>
          {sub && <div style={{ fontSize:11.5, marginTop:9, fontWeight:600, color:"var(--mut)" }}>{sub}</div>}
        </div>
        {sparkline && sparkline.length > 1 && <MiniBars data={sparkline} color={accent} />}
      </div>
    </div>
  );
}

function MetalCard({ name, grams, accent, tint, grad, sparkline, delay = 0 }) {
  const animated = useCountUp(grams);
  return (
    <div className="card card-hover animate-in" style={{ flex:1, minWidth:210, maxWidth:"100%", padding:"clamp(14px,4vw,18px) clamp(16px,4vw,20px)", animationDelay:`${delay}ms`, "--grad": grad }}>
      <div className="grad-top" />
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:14 }}>
        <div style={{ display:"flex", alignItems:"center", gap:11 }}>
          <div className="icon-badge round" style={{ "--tint": tint, "--accent": accent }}><IconGem width={19} height={19} /></div>
          <div style={{ fontSize:11.5, letterSpacing:".05em", textTransform:"uppercase", fontWeight:800, color:"var(--mut)" }}>{name}</div>
        </div>
        {sparkline && sparkline.length > 1 && <MiniBars data={sparkline} color={accent} />}
      </div>
      <div style={{ display:"flex", alignItems:"baseline", gap:5 }}>
        <span style={{ fontFamily:"'Fraunces',serif", fontSize:29, fontWeight:700, lineHeight:1, color:"var(--text)", fontVariantNumeric:"tabular-nums" }}>{fmt2(animated)}</span>
        <span style={{ fontSize:12.5, fontWeight:700, color:"var(--mut)" }}>g</span>
      </div>
      <div style={{ fontSize:12, marginTop:8, fontWeight:600, color:"var(--mut)" }}>{(grams/1000).toFixed(2)} kg to cast</div>
    </div>
  );
}

function Panel({ title, hint, right, children, style, delay = 0, innerRef }) {
  return (
    <div ref={innerRef} className="card animate-in" style={{ padding:"clamp(14px,4vw,20px)", animationDelay:`${delay}ms`, ...style }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16, flexWrap:"wrap", gap:10 }}>
        <div>
          <h3 style={{ margin:0, fontSize:13, fontWeight:800, letterSpacing:".04em", color:"var(--primary-dk)", textTransform:"uppercase" }}>{title}</h3>
          {hint && <div style={{ fontSize:11, color:C.faint, marginTop:3 }}>{hint}</div>}
        </div>
        {right}
      </div>
      {children}
    </div>
  );
}

const NAV_SECTIONS = [
  { key: "overview", label: "Overview" },
  { key: "casting", label: "Casting Plan" },
  { key: "funnel", label: "Production Funnel" },
  { key: "partymix", label: "Party & Mix" },
];

export default function Dashboard({ rows: ROWS, meta, fileName, onRefresh }) {
  // Restored once per mount (e.g. after a page refresh); filters/sidebar state persists
  // independently of which Excel file is currently loaded.
  const [savedUi] = useState(() => loadUiSession() || {});

  const [party, setParty] = useState(savedUi.party ?? "All");
  const [cat, setCat] = useState(savedUi.cat ?? "All");
  const [metal, setMetal] = useState(savedUi.metal ?? "All");

  const metalOf = (r) => (METALS.includes(r.mt) ? r.mt : "Other");

  const monthsOrder = useMemo(() => {
    const seen = {}; ROWS.forEach((r) => { seen[r.mb] = r.ms; });
    return Object.keys(seen).sort((a, b) => seen[a] - seen[b]);
  }, [ROWS]);

  const partyList = useMemo(() => {
    const m = {}; ROWS.forEach((r) => (m[r.p] = (m[r.p] || 0) + r.bq));
    return ["All", ...Object.entries(m).sort((a, b) => b[1] - a[1]).map((e) => e[0])];
  }, [ROWS]);
  const catList = useMemo(() => ["All", ...Array.from(new Set(ROWS.map((r) => r.cat)))], [ROWS]);
  const metalChips = useMemo(() => ["All", ...METALS.filter((me) => ROWS.some((r) => metalOf(r) === me))], [ROWS]);

  const rows = useMemo(() => ROWS.filter((r) =>
    (party === "All" || r.p === party) && (cat === "All" || r.cat === cat) && (metal === "All" || metalOf(r) === metal)
  ), [ROWS, party, cat, metal]);

  const k = useMemo(() => {
    const oq = rows.reduce((s, r) => s + r.oq, 0), bq = rows.reduce((s, r) => s + r.bq, 0);
    const eq = rows.reduce((s, r) => s + r.eq, 0);
    const fq = rows.reduce((s, r) => s + r.fq, 0);
    const cp = rows.reduce((s, r) => s + r.cp, 0), cw = rows.reduce((s, r) => s + r.cw, 0);
    return { oq, eq, bq, fq, cp, cw, lines: rows.length };
  }, [rows]);

  // Casting weight split by metal (grams) — respects current filters
  const castWtByMetal = useMemo(() => {
    const m = { Gold:0, Silver:0, Platinum:0, Other:0 };
    rows.forEach((r) => { m[metalOf(r)] += r.cw; });
    return m;
  }, [rows]);

  const casting = useMemo(() => {
    const map = {};
    rows.forEach((r) => { const mk = r.mb, me = metalOf(r);
      map[mk] = map[mk] || {}; map[mk][me] = map[mk][me] || { bal:0, cp:0, cw:0 };
      map[mk][me].bal += r.bq; map[mk][me].cp += r.cp; map[mk][me].cw += r.cw; });
    return monthsOrder.filter((m) => map[m]).map((m) => {
      const mets = METALS.filter((me) => map[m][me] && (map[m][me].bal || map[m][me].cp));
      const tot = mets.reduce((a, me) => ({ bal:a.bal+map[m][me].bal, cp:a.cp+map[m][me].cp, cw:a.cw+map[m][me].cw }), { bal:0, cp:0, cw:0 });
      return { month:m, rows:mets.map((me) => ({ metal:me, ...map[m][me] })), total:tot };
    });
  }, [rows, monthsOrder]);
  const castGrand = useMemo(() => casting.reduce((a, m) => ({ bal:a.bal+m.total.bal, cp:a.cp+m.total.cp, cw:a.cw+m.total.cw }), { bal:0, cp:0, cw:0 }), [casting]);

  const byMetal = useMemo(() => { const m = {};
    rows.forEach((r) => { const me = metalOf(r); m[me] = m[me] || { bal:0, cp:0, cw:0 }; m[me].bal += r.bq; m[me].cp += r.cp; m[me].cw += r.cw; });
    return METALS.filter((me) => m[me]).map((me) => ({ name:me, ...m[me], fill:METALC[me] })); }, [rows]);

  const phase = useMemo(() => { const m = {}; rows.forEach((r) => { if (FUNNEL.includes(r.ph)) m[r.ph] = (m[r.ph] || 0) + r.bq; });
    return FUNNEL.filter((p) => m[p] > 0).map((p) => ({ name:p, qty:m[p] })); }, [rows]);
  const maxPhase = Math.max(...phase.map((p) => p.qty), 1);
  const phaseTotal = useMemo(() => phase.reduce((s, p) => s + p.qty, 0), [phase]);
  const bottleneck = phase.filter((p) => p.name !== "New Order").reduce((a, b) => (b.qty > (a?.qty || 0) ? b : a), null);

  // Grouped by Party (col A) — this file has no separate "Customer" column (only
  // "Party" and "Sub Customer"), so r.c is always blank and would collapse every
  // row into a single bucket.
  const byParty = useMemo(() => { const base = ROWS.filter((r) => (cat === "All" || r.cat === cat) && (metal === "All" || metalOf(r) === metal));
    const m = {}; base.forEach((r) => { m[r.p] = (m[r.p] || 0) + r.bq; });
    return Object.entries(m).map(([name, bq]) => ({ name, bq })).sort((a, b) => b.bq - a.bq); }, [ROWS, cat, metal]);
  const byPartyTotal = useMemo(() => byParty.reduce((s, c) => s + c.bq, 0), [byParty]);

  const byCat = useMemo(() => { const m = {}; rows.forEach((r) => (m[r.cat] = (m[r.cat] || 0) + r.bq));
    return Object.entries(m).map(([name, qty]) => ({ name, qty })).sort((a, b) => b.qty - a.qty); }, [rows]);
  const byCatTotal = useMemo(() => byCat.reduce((s, c) => s + c.qty, 0), [byCat]);

  // Real per-month distribution, used only for the KPI-card sparklines below — every value
  // here is a plain re-aggregation of `rows`, not a projection or fabricated trend.
  const monthlyTotals = useMemo(() => {
    const m = {};
    rows.forEach((r) => {
      m[r.mb] = m[r.mb] || { bq:0, cp:0 };
      m[r.mb].bq += r.bq; m[r.mb].cp += r.cp;
    });
    return monthsOrder.filter((mo) => m[mo]).map((mo) => m[mo]);
  }, [rows, monthsOrder]);
  const metalMonthly = (metalName) => casting.map((m) => (m.rows.find((x) => x.metal === metalName) || { cw: 0 }).cw);

  // ---- UI-only state below: sidebar, in-page search/export. No business data is altered. ----
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() =>
    typeof savedUi.sidebarCollapsed === "boolean" ? savedUi.sidebarCollapsed : (typeof window !== "undefined" && window.innerWidth < 768)
  );
  const [activeSection, setActiveSection] = useState(savedUi.activeSection ?? "overview");
  const sectionRefs = { overview: useRef(null), casting: useRef(null), funnel: useRef(null), partymix: useRef(null) };

  // Persist filter/UI state on every change so a refresh restores it exactly.
  useEffect(() => {
    saveUiSession({ party, cat, metal, sidebarCollapsed, activeSection });
  }, [party, cat, metal, sidebarCollapsed, activeSection]);

  const goToSection = (key) => {
    setActiveSection(key);
    sectionRefs[key]?.current?.scrollIntoView({ behavior: REDUCED_MOTION ? "auto" : "smooth", block: "start" });
    if (window.innerWidth < 768) setSidebarCollapsed(true);
  };

  // On restore after a refresh, jump straight to whichever section was active before —
  // keeps the sidebar highlight and the visible content in sync. Runs once on mount only.
  useEffect(() => {
    if (savedUi.activeSection && savedUi.activeSection !== "overview") {
      sectionRefs[savedUi.activeSection]?.current?.scrollIntoView({ behavior: "auto", block: "start" });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const num = { textAlign:"right", fontVariantNumeric:"tabular-nums" };

  return (
    <div style={{ background:C.bg, minHeight:"100vh", display:"flex", fontFamily:"'Inter',system-ui,sans-serif", color:C.text }}>
      <style>{GLOBAL_CSS}</style>

      {!sidebarCollapsed && <div className="sidebar-backdrop" onClick={() => setSidebarCollapsed(true)} />}

      {/* ---------- Sidebar: real in-page navigation + data actions, not fabricated links ---------- */}
      <aside className={`sidebar${sidebarCollapsed ? " collapsed" : ""}`} style={{ width: sidebarCollapsed ? 78 : 246 }}>
        <div style={{ display:"flex", alignItems:"center", gap:10, padding:"18px 16px", borderBottom:"1px solid var(--sidebar-line)" }}>
          <img src={logoSmall} alt="m.suresh" style={{ height:30, width:"auto", flex:"none" }} />
          <button type="button" className="sidebar-collapse-btn" style={{ marginLeft:"auto" }}
            onClick={() => setSidebarCollapsed((v) => !v)} aria-label="Toggle sidebar">
            <IconChevronLeft width={15} height={15} style={{ transform: sidebarCollapsed ? "rotate(180deg)" : "none", transition:"transform .25s ease" }} />
          </button>
        </div>

        <div style={{ flex:1, overflowY:"auto", overflowX:"hidden", padding:"0 10px" }}>
          {!sidebarCollapsed && <div className="sidebar-section-title">Navigate</div>}
          {NAV_SECTIONS.map((s) => (
            <div key={s.key} className={`sidebar-navitem${activeSection === s.key ? " active" : ""}`}
              onClick={() => goToSection(s.key)} title={sidebarCollapsed ? s.label : undefined}>
              <IconGrid width={16} height={16} style={{ flex:"none" }} />
              {!sidebarCollapsed && <span>{s.label}</span>}
            </div>
          ))}

          {!sidebarCollapsed && <div className="sidebar-section-title">Data</div>}
          <div style={{ padding: sidebarCollapsed ? "0" : "0 14px" }}>
            {!sidebarCollapsed && (
              <div style={{ fontSize:11.5, color:"var(--sidebar-text-dim)", fontWeight:700, marginBottom:10, lineHeight:1.5, wordBreak:"break-word" }}>
                {fileName || "No file"}
              </div>
            )}
            <button type="button" onClick={onRefresh} className="sidebar-navitem" style={{ width:"100%", justifyContent: sidebarCollapsed ? "center" : "flex-start", border:"none", background:"transparent" }}
              title={sidebarCollapsed ? "Re-check the excel folder now" : undefined}>
              <IconRefresh width={16} height={16} style={{ flex:"none" }} />
              {!sidebarCollapsed && <span>Refresh data</span>}
            </button>
          </div>
        </div>

        <div style={{ padding:14, borderTop:"1px solid var(--sidebar-line)", display:"flex", alignItems:"center", gap:9 }}>
          <IconShieldCheck width={16} height={16} style={{ color:"var(--sidebar-text-dim)", flex:"none" }} />
          {!sidebarCollapsed && <span style={{ fontSize:10.5, color:"var(--sidebar-text-dim)", fontWeight:700, lineHeight:1.4 }}>Auto-loaded from the project's excel folder.</span>}
        </div>
      </aside>

      {/* ---------- Main column ---------- */}
      <div style={{ flex:1, minWidth:0, display:"flex", flexDirection:"column" }}>
        <header className="dash-header" style={{ padding:"14px clamp(14px,4vw,26px)" }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", flexWrap:"wrap", gap:14 }}>
            <div style={{ display:"flex", alignItems:"center", gap:12, minWidth:0, maxWidth:"100%" }}>
              <button type="button" className="btn btn-icon mobile-menu-btn" onClick={() => setSidebarCollapsed((v) => !v)} aria-label="Menu">
                <IconMenu width={16} height={16} />
              </button>
              <div style={{ minWidth:0, maxWidth:"100%" }}>
                <h1 style={{ margin:0, fontFamily:"'Fraunces',serif", fontWeight:700, fontSize:"clamp(16px,4.5vw,21px)", color:C.text, letterSpacing:"-.01em", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>
                  Production &amp; Casting Dashboard
                </h1>
                <div style={{ fontSize:12, color:C.mut, marginTop:2, wordBreak:"break-word" }}>
                  {fileName ? `File: ${fileName}` : "Full pipeline + monthly casting by quantity"}
                  {meta.asOf && <span style={{ marginLeft:9, color:"var(--primary-dk)", fontWeight:700 }}>· Data as of {meta.asOf}</span>}
                </div>
              </div>
            </div>

            <div style={{ display:"flex", alignItems:"center", gap:9, flexWrap:"wrap" }}>
              <PopoverButton icon={<IconSettings width={16} height={16} />} label="File details" panelTitle="File details">
                {[["Sheet", meta.sheetName], ["Header row", meta.headerRow], ["Order lines", fmt(ROWS.length)], ["Snapshot date", meta.asOf || "—"]].map(([k2, v]) => (
                  <div key={k2} style={{ display:"flex", justifyContent:"space-between", fontSize:12.5, padding:"5px 0", borderBottom:"1px solid var(--line-soft)" }}>
                    <span style={{ color:"var(--mut)" }}>{k2}</span><span style={{ fontWeight:700, color:"var(--text)" }}>{v}</span>
                  </div>
                ))}
                {meta.missing.length > 0 && (
                  <div style={{ fontSize:11.5, color:"var(--warning-dk)", marginTop:9, lineHeight:1.5 }}>Missing columns: {meta.missing.join(", ")}</div>
                )}
              </PopoverButton>

              <PopoverButton icon={<IconUser width={16} height={16} />} label="Session" panelTitle="Local session">
                <div style={{ fontSize:12.5, color:"var(--mut)", lineHeight:1.6 }}>
                  The Excel file is read from this server's excel folder and parsed entirely in your browser tab. Nothing leaves your local network, and no login is required.
                </div>
              </PopoverButton>
            </div>
          </div>
        </header>

        <div style={{ padding:"22px clamp(14px,4vw,26px) 44px", maxWidth:"100%" }}>
          {/* ---------- Filters ---------- */}
          <div className="card animate-in" style={{ padding:"14px clamp(12px,4vw,18px)", marginBottom:20, borderRadius:18, display:"flex", flexWrap:"wrap", alignItems:"center", gap:16 }}>
            <div style={{ display:"flex", alignItems:"center", gap:9, minWidth:0, maxWidth:"100%" }}>
              <span style={{ fontSize:11, color:C.mut, fontWeight:800, textTransform:"uppercase", letterSpacing:".05em", flex:"none" }}>Party</span>
              <div className="select-wrap" style={{ minWidth:0, maxWidth:"100%" }}>
                <select value={party} onChange={(e) => setParty(e.target.value)}>
                  {partyList.map((p) => (<option key={p} value={p}>{p === "All" ? "All parties" : p}</option>))}
                </select>
                <IconChevronDown className="chev" />
              </div>
            </div>
            <div className="filter-divider" style={{ width:1, alignSelf:"stretch", background:C.lineSoft }} />
            <Segmented options={metalChips} value={metal} onChange={setMetal} getLabel={(m) => (m === "All" ? "All metals" : m)} />
            <div className="filter-divider" style={{ width:1, alignSelf:"stretch", background:C.lineSoft }} />
            <Segmented options={catList} value={cat} onChange={setCat} />
            <span style={{ marginLeft:"auto", fontSize:11.5, color:C.mut, background:"var(--panel-2)", border:`1px solid ${C.line}`, borderRadius:999, padding:"5px 12px", fontVariantNumeric:"tabular-nums" }}>
              Showing {fmt(k.lines)} of {fmt(ROWS.length)} lines
            </span>
          </div>

          {/* ---------- Overview ---------- */}
          <div ref={sectionRefs.overview}>
            <div className="grid-stats" style={{ marginBottom:20 }}>
              <StatCard label="Export Quantity" rawValue={k.bq} format={fmt} unit="pcs" sub={`${fmt(k.lines)} lines · ${fmt(k.fq)} on floor`}
                icon={<IconTrendingUp width={20} height={20} />} accent={CH.blue} tint="rgba(59,130,246,.13)" grad={GRAD_BLUE}
                sparkline={monthlyTotals.map((m) => m.bq)} delay={0} />
              <StatCard label="Casting Pcs" rawValue={k.cp} format={fmt} unit="pcs" sub="in wax → casting"
                icon={<IconLayers width={20} height={20} />} accent={CH.violet} tint="rgba(124,58,237,.13)" grad={GRAD_PURPLE}
                sparkline={monthlyTotals.map((m) => m.cp)} delay={40} />
            </div>

            <Panel title="Casting weight by quantity" hint="pure weight to cast (g / kg) · metal from Karat" style={{ marginBottom:20 }} delay={100}>
              <div style={{ display:"flex", gap:14, flexWrap:"wrap" }}>
                <MetalCard name="Gold" grams={castWtByMetal.Gold} accent={CH.gold} tint="rgba(245,158,11,.14)" grad={GRAD_GOLD} sparkline={metalMonthly("Gold")} delay={0} />
                <MetalCard name="Silver" grams={castWtByMetal.Silver} accent="#64748B" tint="rgba(148,163,184,.18)" grad={GRAD_SILVER} sparkline={metalMonthly("Silver")} delay={30} />
                <MetalCard name="Platinum" grams={castWtByMetal.Platinum} accent={CH.steel} tint="rgba(168,85,247,.13)" grad={GRAD_PLAT} sparkline={metalMonthly("Platinum")} delay={60} />
              </div>
            </Panel>
          </div>

          {/* ---------- Casting plan ---------- */}
          <div ref={sectionRefs.casting}>
            <Panel title="Casting plan — month × metal" hint="Balance Qty · Casting pcs · Casting weight (g)" style={{ marginBottom:20 }} delay={140}>
              <div className="table-wrap">
                <div className="table-scroll" style={{ maxHeight:420 }}>
                  <table style={{ fontSize:12.5 }}>
                    <thead><tr style={{ fontSize:10.5, textTransform:"uppercase", letterSpacing:".05em" }}>
                      <th style={{ textAlign:"left", padding:"11px 14px", fontWeight:700, color:"#fff" }}>Month</th>
                      <th style={{ textAlign:"left", padding:"11px 14px", fontWeight:700, color:"#fff" }}>Metal</th>
                      <th style={{ ...num, padding:"11px 14px", fontWeight:700, color:"#fff" }}>Balance qty</th>
                      <th style={{ ...num, padding:"11px 14px", fontWeight:700, color:"#fff" }}>Casting pcs</th>
                      <th style={{ ...num, padding:"11px 14px", fontWeight:700, color:"#fff" }}>Casting wt (g)</th>
                    </tr></thead>
                    <tbody>
                      {casting.map((m) => (
                        <React.Fragment key={m.month}>
                          {m.rows.map((r, i) => (
                            <tr key={r.metal} className="hoverable">
                              {i === 0 && <td rowSpan={m.rows.length + 1} style={{ padding:"9px 14px", borderBottom:`1px solid ${C.line}`, verticalAlign:"top", fontWeight:800, color:"var(--primary-dk)" }}>{m.month}</td>}
                              <td style={{ padding:"8px 14px", borderBottom:`1px solid ${C.line}`, color:C.text }}>
                                <span className="pill-soft" style={{ background:`${METALC[r.metal]}1f`, color:METALC[r.metal] }}>
                                  <span className="dot" style={{ background:METALC[r.metal] }} />{r.metal}
                                </span>
                              </td>
                              <td style={{ ...num, padding:"8px 14px", borderBottom:`1px solid ${C.line}`, fontWeight:700, color:C.text }}>{fmt(r.bal)}</td>
                              <td style={{ ...num, padding:"8px 14px", borderBottom:`1px solid ${C.line}`, color:C.castBlue, fontWeight:700 }}>{fmt(r.cp)}</td>
                              <td style={{ ...num, padding:"8px 14px", borderBottom:`1px solid ${C.line}`, color:C.goldDk, fontWeight:700 }}>{fmt2(r.cw)}</td>
                            </tr>
                          ))}
                          <tr style={{ background:"rgba(34,197,94,.08)" }}>
                            <td style={{ padding:"9px 14px", borderBottom:`1px solid ${C.line}`, color:"var(--success-dk)", fontWeight:800 }}>Total</td>
                            <td style={{ ...num, padding:"9px 14px", borderBottom:`1px solid ${C.line}`, color:"var(--success-dk)", fontWeight:800 }}>{fmt(m.total.bal)}</td>
                            <td style={{ ...num, padding:"9px 14px", borderBottom:`1px solid ${C.line}`, color:"var(--success-dk)", fontWeight:800 }}>{fmt(m.total.cp)}</td>
                            <td style={{ ...num, padding:"9px 14px", borderBottom:`1px solid ${C.line}`, color:"var(--success-dk)", fontWeight:800 }}>{fmt2(m.total.cw)}</td>
                          </tr>
                        </React.Fragment>
                      ))}
                      <tr style={{ background:"rgba(79,70,229,.1)" }}>
                        <td colSpan={2} style={{ padding:"13px 14px", color:"var(--primary-dk)", fontWeight:800, letterSpacing:".03em", fontSize:13 }}>GRAND TOTAL</td>
                        <td style={{ ...num, padding:"13px 14px", color:"var(--primary-dk)", fontWeight:800, fontSize:13.5 }}>{fmt(castGrand.bal)}</td>
                        <td style={{ ...num, padding:"13px 14px", color:"var(--primary-dk)", fontWeight:800, fontSize:13.5 }}>{fmt(castGrand.cp)}</td>
                        <td style={{ ...num, padding:"13px 14px", color:"var(--primary-dk)", fontWeight:800, fontSize:13.5 }}>{fmt2(castGrand.cw)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
              <div style={{ fontSize:11, color:C.faint, marginTop:12 }}>
                Casting pcs = cols AE:AM (AN). Casting weight = unit weight (Z) × AN (AO). Month = production delivery date.
                Metal derived from Karat (col S): contains G → Gold, P → Platinum, S → Silver.
              </div>
            </Panel>

            <Panel title="Balance quantity" hint="balance · casting pcs · casting weight" style={{ marginBottom:20 }} delay={180}>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))", gap:24 }}>
                {[["Balance qty","bal",(v)=>fmt(v)],["Casting pcs","cp",(v)=>fmt(v)],["Casting weight (g)","cw",(v)=>fmt2(v)]].map(([lab, key, f]) => {
                  const total = byMetal.reduce((s, x) => s + x[key], 0);
                  const denom = total || 1;
                  return (<div key={key}>
                    <div style={{ fontSize:11, color:C.mut, textTransform:"uppercase", letterSpacing:".05em", marginBottom:11, fontWeight:800 }}>{lab}</div>
                    {byMetal.map((m) => (<div key={m.name} style={{ marginBottom:11 }}>
                      <div style={{ display:"flex", justifyContent:"space-between", fontSize:12, marginBottom:4, alignItems:"center" }}>
                        <span style={{ fontWeight:600, display:"flex", alignItems:"center", gap:6 }}><span className="dot" style={{ background:m.fill }} /> {m.name}</span>
                        <span style={{ color:C.text, fontVariantNumeric:"tabular-nums", fontWeight:800 }}>{f(m[key])}</span>
                      </div>
                      <div style={{ height:8, background:C.panel2, borderRadius:5, overflow:"hidden" }}>
                        <div style={{ width:`${100 * m[key] / denom}%`, height:"100%", background:"var(--grad-primary)", borderRadius:5, transition:"width .5s cubic-bezier(.16,1,.3,1)" }} />
                      </div></div>))}
                    <div style={{ display:"flex", justifyContent:"space-between", fontSize:12.5, alignItems:"center", marginTop:13, paddingTop:11, borderTop:`1px solid ${C.line}` }}>
                      <span style={{ fontWeight:800, textTransform:"uppercase", letterSpacing:".05em", color:"var(--primary-dk)" }}>Total</span>
                      <span style={{ color:"var(--primary-dk)", fontVariantNumeric:"tabular-nums", fontWeight:800 }}>{f(total)}</span>
                    </div>
                  </div>);
                })}
              </div>
            </Panel>
          </div>

          {/* ---------- Funnel ---------- */}
          <div ref={sectionRefs.funnel}>
            <Panel title="Production funnel" hint="balance pcs by stage, in process order" style={{ marginBottom:20 }} delay={220}
              right={
                <span style={{ fontSize:11.5, color:C.mut, background:"var(--panel-2)", border:`1px solid ${C.line}`, borderRadius:999, padding:"5px 12px", fontVariantNumeric:"tabular-nums" }}>
                  Total: <b style={{ color:C.text, fontWeight:800 }}>{fmt(phaseTotal)}</b> pcs
                </span>
              }
            >
              <div style={{ display:"flex", flexDirection:"column", gap:9 }}>
                {phase.map((p) => { const isB = bottleneck && p.name === bottleneck.name; const isStart = p.name === "New Order";
                  return (<div key={p.name}>
                    <div style={{ display:"flex", justifyContent:"space-between", fontSize:12, marginBottom:4 }}>
                      <span style={{ color:isB ? "var(--danger-dk)" : C.text, display:"flex", alignItems:"center", gap:6, fontWeight:isB?700:400 }}>
                        {p.name}
                        {isB && <span className="badge" style={{ background:"rgba(239,68,68,.13)", color:"var(--danger-dk)", fontSize:9.5, letterSpacing:".06em" }}>◆ BOTTLENECK</span>}
                      </span>
                      <span style={{ color:C.text, fontVariantNumeric:"tabular-nums", fontWeight:700 }}>{fmt(p.qty)}</span>
                    </div>
                    <div style={{ height:9, background:C.panel2, borderRadius:5, overflow:"hidden" }}>
                      <div style={{ width:`${100 * p.qty / maxPhase}%`, height:"100%", borderRadius:5, transition:"width .5s cubic-bezier(.16,1,.3,1)",
                        background:isB ? "var(--grad-danger)" : (isStart ? "var(--primary-lt)" : "var(--grad-primary)") }} />
                    </div></div>);
                })}
                {phase.length === 0 && (
                  <div className="empty-state">
                    <IconInbox width={30} height={30} />
                    <div style={{ fontSize:13 }}>Nothing in the active pipeline for this selection.</div>
                  </div>
                )}
              </div>
            </Panel>
          </div>

          {/* ---------- Party & mix ---------- */}
          <div ref={sectionRefs.partymix} className="grid2" style={{ marginBottom:20 }}>
            <Panel title="Balance by party" hint="all parties by balance qty" delay={260}
              right={
                <span style={{ fontSize:11.5, color:C.mut, background:"var(--panel-2)", border:`1px solid ${C.line}`, borderRadius:999, padding:"5px 12px", fontVariantNumeric:"tabular-nums" }}>
                  Total: <b style={{ color:C.text, fontWeight:800 }}>{fmt(byPartyTotal)}</b> pcs
                </span>
              }
            >
              <ResponsiveContainer width="100%" height={Math.max(280, byParty.length * 28)}>
                <BarChart data={byParty} layout="vertical" margin={{ top:4, right:56, left:8, bottom:0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={CH.line} horizontal={false} />
                  <XAxis type="number" tick={{ fill:CH.faint, fontSize:11 }} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="name" tick={{ fill:CH.mut, fontSize:11 }} axisLine={false} tickLine={false} width={104} />
                  <Tooltip content={<TT />} cursor={{ fill:"rgba(79,70,229,.06)" }} />
                  <Bar dataKey="bq" name="Balance" fill={CH.primary} radius={[4,4,4,4]} isAnimationActive={!REDUCED_MOTION}>
                    <LabelList dataKey="bq" content={PartyBarLabel} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </Panel>
            <Panel title="Product mix" hint="balance pcs by category" delay={280}
              right={
                <span style={{ fontSize:11.5, color:C.mut, background:"var(--panel-2)", border:`1px solid ${C.line}`, borderRadius:999, padding:"5px 12px", fontVariantNumeric:"tabular-nums" }}>
                  Total: <b style={{ color:C.text, fontWeight:800 }}>{fmt(byCatTotal)}</b> pcs
                </span>
              }
            >
              <div style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap" }}>
                <div style={{ flex:"0 0 220px" }}>
                  <ResponsiveContainer width={220} height={230}>
                    <PieChart>
                      <Pie data={byCat} dataKey="qty" nameKey="name" cx="50%" cy="50%" innerRadius={52} outerRadius={88} paddingAngle={3} stroke="none" isAnimationActive={false}>
                        {byCat.map((e, i) => <Cell key={i} fill={CATC[i % CATC.length]} />)}
                      </Pie>
                      <Tooltip content={<TT />} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div style={{ flex:1, minWidth:150 }}>
                  {byCat.map((e, i) => (
                    <div key={e.name} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", fontSize:12, padding:"5px 0", borderBottom:`1px solid ${C.lineSoft}` }}>
                      <span style={{ fontWeight:600, display:"flex", alignItems:"center", gap:6 }}><span className="dot" style={{ background:CATC[i % CATC.length] }} /> {e.name}</span>
                      <span style={{ color:C.text, fontVariantNumeric:"tabular-nums", fontWeight:800 }}>{fmt(e.qty)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </Panel>
          </div>

          <div style={{ marginTop:20, fontSize:11, color:C.faint, lineHeight:1.6 }}>
            Sheet <b style={{ color:C.mut }}>{meta.sheetName}</b> · header row {meta.headerRow} · {fmt(ROWS.length)} order lines
            {meta.asOf && <> · snapshot date <b style={{ color:C.mut }}>{meta.asOf}</b> (derived as delivery date − BalDelvDays)</>}.
            Export Quantity = Bal Qty (col Z). Metal is derived from the Karat code (col S): a value containing G → Gold, P → Platinum, S → Silver.
            Casting pcs = cols AE:AM (AN); casting weight = unit weight (Z) × AN (AO).
            {meta.missing.length > 0 && <span style={{ color:"var(--warning-dk)", fontWeight:600 }}> · Missing columns: {meta.missing.join(", ")}.</span>}
          </div>
        </div>
      </div>
    </div>
  );
}
