// Small reusable presentation-only primitives shared by App.jsx, Dashboard.jsx, and the
// analytics page (src/analytics/).
import React, { useState, useRef, useLayoutEffect, useEffect } from "react";
import { IconChevronDown } from "./icons.jsx";
import { C, SHADOW_MD, REDUCED_MOTION } from "./theme.js";

// Concrete hex for Recharts (SVG fill/stroke attributes don't reliably resolve CSS custom
// properties) — DOM styling elsewhere uses the CSS-var C object from theme.js.
export const CH = { primary:"#4F46E5", violet:"#7C3AED", blue:"#3B82F6", gold:"#F59E0B", steel:"#A855F7", plat:"#94A3B8",
  emerald:"#22C55E", emeraldDk:"#15803D", amber:"#F59E0B", rose:"#EF4444", roseDk:"#B91C1C",
  mut:"#000000", faint:"#000000", line:"#EBEEF6" };

// Generic Recharts tooltip — dot + name + value per series, styled to match the card system.
export const TT = ({ active, payload, label, unit }) => {
  if (!active || !payload || !payload.length) return null;
  return (
    <div style={{ background:"var(--panel)", border:`1px solid ${CH.line}`, borderRadius:12,
      padding:"10px 13px", fontSize:12, color:"var(--text)", boxShadow:SHADOW_MD }}>
      <div style={{ color:"var(--mut)", marginBottom:5, fontWeight:700 }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ display:"flex", alignItems:"center", gap:6, padding:"1px 0" }}>
          <span className="dot" style={{ background:p.color||CH.primary }} />{p.name}: <b style={{ fontVariantNumeric:"tabular-nums" }}>{typeof p.value === "number" ? Math.round(p.value).toLocaleString("en-IN") : p.value}{unit === undefined ? " pcs" : unit}</b>
        </div>
      ))}
    </div>
  );
};

// Purely-visual count-up animation (numeric value in, animated numeric value out).
export function useCountUp(target, duration = 650) {
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

// Tiny CSS-only bar sparkline — fed only with real, already-derived per-period totals.
export function MiniBars({ data, color }) {
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

export function StatCard({ label, rawValue, format, unit, sub, accent, tint, grad, icon, sparkline, delay = 0 }) {
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

export function Panel({ title, hint, right, children, style, delay = 0, innerRef }) {
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

// Sliding-indicator segmented control — presentational replacement for plain filter chips.
export function Segmented({ options, value, onChange, getLabel = (o) => o, getKey = (o) => o }) {
  const containerRef = useRef(null);
  const btnRefs = useRef({});
  const [indicator, setIndicator] = useState({ left: 0, width: 0, ready: false });

  useLayoutEffect(() => {
    const el = btnRefs.current[getKey(value)];
    const cont = containerRef.current;
    if (el && cont) {
      setIndicator({ left: el.offsetLeft, width: el.offsetWidth, ready: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, options.length]);

  return (
    <div ref={containerRef} className="segmented">
      {indicator.ready && (
        <div className="segmented-indicator" style={{ transform: `translateX(${indicator.left}px)`, width: indicator.width }} />
      )}
      {options.map((o) => {
        const key = getKey(o);
        const active = key === getKey(value);
        return (
          <button key={key} type="button" ref={(el) => { btnRefs.current[key] = el; }}
            className={`segmented-btn${active ? " active" : ""}`} onClick={() => onChange(o)}>
            {getLabel(o)}
          </button>
        );
      })}
    </div>
  );
}

// Click-outside-to-close popover anchor. Renders a trigger button + conditional panel.
export function PopoverButton({ icon, label, badge, panelWidth = 300, align = "right", children, panelTitle }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const onEsc = (e) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onEsc);
    return () => { document.removeEventListener("mousedown", onDown); document.removeEventListener("keydown", onEsc); };
  }, [open]);

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button type="button" className="btn btn-icon" aria-label={label} aria-expanded={open} onClick={() => setOpen((v) => !v)}
        style={{ position: "relative" }}>
        {icon}
        {badge ? (
          <span style={{
            position: "absolute", top: -4, right: -4, minWidth: 16, height: 16, borderRadius: 999,
            background: "var(--grad-danger)", color: "#fff", fontSize: 9.5, fontWeight: 800,
            display: "flex", alignItems: "center", justifyContent: "center", padding: "0 3px",
            boxShadow: "var(--shadow-glow-danger)",
          }}>{badge}</span>
        ) : null}
      </button>
      {open && (
        <div className="popover" style={{ width: `min(${panelWidth}px, calc(100vw - 32px))`, [align]: 0, left: align === "left" ? 0 : "auto" }}>
          {panelTitle && (
            <div style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: ".06em", color: "var(--mut)", marginBottom: 10 }}>
              {panelTitle}
            </div>
          )}
          {children}
        </div>
      )}
    </div>
  );
}

export { IconChevronDown };
