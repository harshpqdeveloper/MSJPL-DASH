// Hidden analytics entry point: a small, easy-to-miss icon in the dashboard footer.
// Three clicks within TRIPLE_CLICK_WINDOW_MS navigate to /analytics; anything slower resets
// the counter. Single/double clicks are silent — nothing disruptive for normal visitors.
import React, { useRef, useState, useCallback } from "react";
import { IconActivity } from "../icons.jsx";

const TRIPLE_CLICK_WINDOW_MS = 900;

function useTripleClick(onTriple, windowMs = TRIPLE_CLICK_WINDOW_MS) {
  const clicksRef = useRef([]);
  const resetTimerRef = useRef(null);
  const [pulseCount, setPulseCount] = useState(0);

  const handleClick = useCallback(() => {
    const now = Date.now();
    const recent = clicksRef.current.filter((t) => now - t < windowMs);
    recent.push(now);
    clicksRef.current = recent;
    setPulseCount(recent.length);

    clearTimeout(resetTimerRef.current);
    resetTimerRef.current = setTimeout(() => {
      clicksRef.current = [];
      setPulseCount(0);
    }, windowMs);

    if (recent.length >= 3) {
      clicksRef.current = [];
      clearTimeout(resetTimerRef.current);
      setPulseCount(0);
      onTriple();
    }
  }, [onTriple, windowMs]);

  return { handleClick, pulseCount };
}

export default function FooterTrigger() {
  const { handleClick, pulseCount } = useTripleClick(() => {
    window.location.assign("/analytics");
  });

  return (
    <span style={{ position: "relative", display: "inline-flex" }}>
      <button
        type="button"
        onClick={handleClick}
        aria-label="Site info"
        title=" "
        style={{
          display: "flex", alignItems: "center", justifyContent: "center",
          width: 26, height: 26, padding: 0, border: "none", borderRadius: 999,
          background: "transparent", color: "var(--faint)", opacity: 0.45,
          cursor: "pointer", transition: "opacity .18s ease, background .18s ease",
        }}
        onMouseEnter={(e) => { e.currentTarget.style.opacity = "0.8"; }}
        onMouseLeave={(e) => { e.currentTarget.style.opacity = "0.45"; }}
      >
        <IconActivity width={13} height={13} />
      </button>
      {pulseCount > 0 && (
        <span style={{
          position: "absolute", top: -9, left: "50%", transform: "translateX(-50%)",
          display: "flex", gap: 3, pointerEvents: "none",
        }}>
          {Array.from({ length: pulseCount }).map((_, i) => (
            <span key={i} className="dot" style={{ background: "var(--primary-2)", animation: "popIn .18s cubic-bezier(.16,1,.3,1) both" }} />
          ))}
        </span>
      )}
    </span>
  );
}
