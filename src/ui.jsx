// Small reusable presentation-only primitives shared by App.jsx and Dashboard.jsx.
import React, { useState, useRef, useLayoutEffect, useEffect } from "react";
import { IconChevronDown } from "./icons.jsx";

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
