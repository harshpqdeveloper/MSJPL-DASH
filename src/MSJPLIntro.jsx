import React, { useEffect, useRef, useState } from "react";
import logo from "./assets/logo.png";
import { REDUCED_MOTION } from "./theme.js";

// Premium full-screen startup animation shown while the dashboard's data is
// loading in the background. Purely presentational — owns no data-loading
// logic itself. The parent tells it when data is `ready`; it waits for both
// `ready` and its own minimum on-screen duration before playing its exit
// transition and calling `onFinish`, at which point the parent should stop
// rendering it (it never reappears on its own).
const ENTER_MS = 900;
const EXIT_MS = 620;
const DEFAULT_MIN_MS = 2200;

const PARTICLES = [
  { left: "12%", top: "20%", size: 10, shape: "circle", color: "rgba(124,58,237,.28)", delay: "0s", dur: "5.2s" },
  { left: "85%", top: "16%", size: 8, shape: "diamond", color: "rgba(37,99,235,.24)", delay: ".4s", dur: "6s" },
  { left: "20%", top: "78%", size: 7, shape: "diamond", color: "rgba(245,158,11,.22)", delay: ".8s", dur: "5.6s" },
  { left: "90%", top: "72%", size: 11, shape: "circle", color: "rgba(124,58,237,.2)", delay: "1.1s", dur: "6.4s" },
  { left: "6%", top: "50%", size: 6, shape: "circle", color: "rgba(37,99,235,.22)", delay: ".2s", dur: "5s" },
  { left: "94%", top: "45%", size: 7, shape: "diamond", color: "rgba(124,58,237,.22)", delay: "1.4s", dur: "5.8s" },
  { left: "35%", top: "10%", size: 5, shape: "circle", color: "rgba(245,158,11,.18)", delay: ".6s", dur: "6.2s" },
  { left: "68%", top: "88%", size: 6, shape: "diamond", color: "rgba(37,99,235,.2)", delay: "1s", dur: "5.4s" },
];

export default function MSJPLIntro({ ready, minDuration = DEFAULT_MIN_MS, onFinish }) {
  const [exiting, setExiting] = useState(false);
  const startRef = useRef(Date.now());
  const finishedRef = useRef(false);
  const effectiveMin = REDUCED_MOTION ? 0 : minDuration;

  useEffect(() => {
    if (finishedRef.current || !ready) return;
    const elapsed = Date.now() - startRef.current;
    const wait = Math.max(0, effectiveMin - elapsed);
    const t = setTimeout(() => setExiting(true), wait);
    return () => clearTimeout(t);
  }, [ready, effectiveMin]);

  useEffect(() => {
    if (!exiting) return;
    const t = setTimeout(() => {
      finishedRef.current = true;
      onFinish?.();
    }, REDUCED_MOTION ? 0 : EXIT_MS);
    return () => clearTimeout(t);
  }, [exiting, onFinish]);

  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prevOverflow; };
  }, []);

  return (
    <div className={`msjpl-intro${exiting ? " msjpl-intro--exit" : ""}`} role="presentation" aria-hidden="true">
      <style>{INTRO_CSS}</style>
      <div className="msjpl-intro__particles">
        {PARTICLES.map((p, i) => (
          <span
            key={i}
            className={`msjpl-intro__particle msjpl-intro__particle--${p.shape}`}
            style={{
              left: p.left, top: p.top, width: p.size, height: p.size,
              background: p.color, animationDelay: p.delay, animationDuration: p.dur,
            }}
          />
        ))}
      </div>
      <div className="msjpl-intro__brand">
        <img src={logo} alt="m.suresh" className="msjpl-intro__logo" />
        <span className="msjpl-intro__shimmer" />
      </div>
    </div>
  );
}

const INTRO_CSS = `
.msjpl-intro{
  position:fixed;inset:0;z-index:9999;overflow:hidden;
  display:flex;align-items:center;justify-content:center;
  background:
    radial-gradient(1200px 620px at 14% -12%, rgba(124,58,237,.20), transparent 60%),
    radial-gradient(1000px 560px at 106% 18%, rgba(37,99,235,.18), transparent 55%),
    var(--bg,#F5F7FB);
  opacity:1;transition:opacity ${EXIT_MS}ms cubic-bezier(.4,0,.2,1);
  will-change:opacity;
}
.msjpl-intro--exit{opacity:0;pointer-events:none}

.msjpl-intro__particles{position:absolute;inset:0;pointer-events:none}
.msjpl-intro__particle{
  position:absolute;border-radius:999px;
  animation-name:msjplFloat;animation-timing-function:ease-in-out;animation-iteration-count:infinite;
  will-change:transform;
}
.msjpl-intro__particle--diamond{border-radius:3px;transform:rotate(45deg)}

.msjpl-intro__brand{
  position:relative;display:flex;align-items:center;justify-content:center;
  animation:msjplBrandIn ${ENTER_MS}ms cubic-bezier(.16,1,.3,1) both;
  will-change:transform,opacity,filter;
  transition:transform ${EXIT_MS}ms cubic-bezier(.4,0,.2,1), opacity ${EXIT_MS}ms cubic-bezier(.4,0,.2,1);
}
.msjpl-intro--exit .msjpl-intro__brand{opacity:0;transform:scale(1.05)}

.msjpl-intro__logo{
  position:relative;width:min(230px,58vw);height:auto;display:block;
}

.msjpl-intro__shimmer{
  position:absolute;top:-10%;left:-40%;width:60%;height:120%;
  background:linear-gradient(115deg, transparent 30%, rgba(255,255,255,.75) 48%, rgba(255,255,255,.95) 50%, rgba(255,255,255,.75) 52%, transparent 70%);
  mix-blend-mode:overlay;transform:translateX(-40%);opacity:0;
  animation:msjplShimmer 900ms ease-out ${ENTER_MS - 150}ms 1 both;
  pointer-events:none;
}

@keyframes msjplBrandIn{
  from{opacity:0;filter:blur(14px);transform:scale(.75) translateY(16px)}
  to{opacity:1;filter:blur(0);transform:scale(1) translateY(0)}
}
@keyframes msjplShimmer{
  0%{opacity:0;transform:translateX(-40%)}
  15%{opacity:1}
  85%{opacity:1}
  100%{opacity:0;transform:translateX(220%)}
}
@keyframes msjplFloat{
  0%,100%{transform:translateY(0) scale(1)}
  50%{transform:translateY(-12px) scale(1.08)}
}
.msjpl-intro__particle--diamond{animation-name:msjplFloatDiamond}
@keyframes msjplFloatDiamond{
  0%,100%{transform:translateY(0) rotate(45deg)}
  50%{transform:translateY(-12px) rotate(45deg)}
}

@media (max-width:480px){
  .msjpl-intro__logo{width:min(170px,60vw)}
}

@media (prefers-reduced-motion: reduce){
  .msjpl-intro__brand{animation:none;opacity:1;filter:none;transform:none}
  .msjpl-intro__shimmer{animation:none;opacity:0}
  .msjpl-intro__particle{animation:none}
  .msjpl-intro{transition:none}
}
`;
