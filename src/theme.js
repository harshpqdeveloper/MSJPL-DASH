// ---- m.suresh premium design system (visual only — no business logic here) ----
// Light-only theme by design request: no dark mode.

export const C = {
  bg: "var(--bg)",
  bgElev: "var(--bg-elev)",
  panel: "var(--panel)",
  panel2: "var(--panel-2)",
  line: "var(--line)",
  lineSoft: "var(--line-soft)",
  text: "var(--text)",
  mut: "var(--mut)",
  faint: "var(--faint)",

  primary: "var(--primary-2)",
  primaryDk: "var(--primary-dk)",
  primaryLt: "var(--primary-lt)",
  violet: "var(--primary-1)",

  gold: "var(--gold-1)",
  goldDk: "var(--gold-dk)",
  plat: "var(--silver-1)",
  steel: "var(--plat-1)",

  emerald: "var(--success)",
  emeraldDk: "var(--success-dk)",
  amber: "var(--warning)",
  rose: "var(--danger)",
  roseDk: "var(--danger-dk)",
  sky: "var(--info)",
  castBlue: "var(--info-dk)",
};

export const GRAD = "var(--grad-primary)";
export const GRAD_GOLD = "var(--grad-gold)";
export const GRAD_SILVER = "var(--grad-silver)";
export const GRAD_PLAT = "var(--grad-plat)";
export const GRAD_SUCCESS = "var(--grad-success)";
export const GRAD_DANGER = "var(--grad-danger)";
export const GRAD_BLUE = "var(--grad-blue)";
export const GRAD_PURPLE = "var(--grad-purple)";

export const SHADOW_SM = "var(--shadow-sm)";
export const SHADOW_MD = "var(--shadow-md)";
export const SHADOW_LG = "var(--shadow-lg)";

export const RADIUS = { card: "22px", btn: "14px", input: "14px", table: "18px", pill: "999px" };

export const REDUCED_MOTION =
  typeof window !== "undefined" && window.matchMedia
    ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
    : false;

export const GLOBAL_CSS = `
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Fraunces:opsz,wght@9..144,600;9..144,700&display=swap');

:root{
  --bg:#F5F7FB; --bg-elev:#EEF1FA; --panel:#FFFFFF; --panel-2:#F7F9FE;
  --line:#EBEEF6; --line-soft:#F2F4FA;
  --text:#000000; --mut:#000000; --faint:#000000;

  --primary-1:#7C3AED; --primary-2:#4F46E5; --primary-3:#3B82F6;
  --primary-dk:#4338CA; --primary-lt:#C7BEFA;

  --gold-1:#FBBF24; --gold-2:#F59E0B; --gold-dk:#92400E;
  --silver-1:#CBD5E1; --silver-2:#94A3B8;
  --plat-1:#C084FC; --plat-2:#A855F7;

  --success:#22C55E; --success-dk:#15803D;
  --danger:#EF4444; --danger-dk:#B91C1C;
  --warning:#F59E0B; --warning-dk:#B45309;
  --info:#06B6D4; --info-dk:#0E7490;
  --sky:#3B82F6;

  --sidebar-bg:#FAFBFD; --sidebar-text:#000000; --sidebar-text-dim:#000000; --sidebar-line:#EEF1F8;
  --sidebar-hover:rgba(79,70,229,.06); --sidebar-active:rgba(124,58,237,.09);

  --grad-primary:linear-gradient(135deg,var(--primary-1) 0%,var(--primary-2) 55%,var(--primary-3) 100%);
  --grad-gold:linear-gradient(135deg,var(--gold-1),var(--gold-2));
  --grad-silver:linear-gradient(135deg,var(--silver-1),var(--silver-2));
  --grad-plat:linear-gradient(135deg,var(--plat-1),var(--plat-2));
  --grad-success:linear-gradient(135deg,#4ADE80,var(--success-dk));
  --grad-danger:linear-gradient(135deg,#F87171,var(--danger-dk));
  --grad-blue:linear-gradient(135deg,var(--sky),var(--primary-2));
  --grad-purple:linear-gradient(135deg,var(--plat-2),var(--primary-1));

  --shadow-sm:0 1px 2px rgba(15,23,42,.04),0 1px 3px rgba(15,23,42,.05);
  --shadow-md:0 2px 8px rgba(15,23,42,.05),0 10px 22px -8px rgba(15,23,42,.09);
  --shadow-lg:0 16px 32px -10px rgba(15,23,42,.14),0 28px 56px -20px rgba(15,23,42,.12);
  --shadow-glow-primary:0 10px 26px -6px rgba(79,70,229,.28);
  --shadow-glow-success:0 10px 22px -6px rgba(34,197,94,.26);
  --shadow-glow-danger:0 10px 22px -6px rgba(239,68,68,.24);
  --shadow-glow-gold:0 10px 22px -6px rgba(245,158,11,.28);
  --shadow-glow-blue:0 10px 22px -6px rgba(59,130,246,.26);
  --shadow-glow-purple:0 10px 22px -6px rgba(168,85,247,.26);
}

*{box-sizing:border-box}
html,body{background:var(--bg);overflow-x:hidden;max-width:100vw}
html{-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale}
::selection{background:var(--primary-lt);color:#1E1B4B}
button,select,input{font-family:inherit}
button:focus-visible,select:focus-visible,input:focus-visible,[tabindex]:focus-visible{
  outline:2px solid var(--primary-2);outline-offset:2px;border-radius:6px}

@keyframes fadeInUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
@keyframes spin{to{transform:rotate(360deg)}}
@keyframes popIn{from{opacity:0;transform:translateY(-6px) scale(.98)}to{opacity:1;transform:translateY(0) scale(1)}}
.animate-in{animation:fadeInUp .55s cubic-bezier(.16,1,.3,1) both}
@media (prefers-reduced-motion: reduce){
  .animate-in{animation:none !important}
  *{transition-duration:.001ms !important;animation-duration:.001ms !important}
}

.grid2{display:grid;grid-template-columns:1fr 1fr;gap:20px}
@media(max-width:900px){.grid2{grid-template-columns:1fr}}
.grid-stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:18px}

/* ---- cards: soft shadow only, no hard borders ---- */
.card{position:relative;background:var(--panel);border:1px solid transparent;border-radius:${RADIUS.card};
  box-shadow:var(--shadow-sm);overflow:hidden;transition:box-shadow .22s ease, transform .22s ease}
.card-hover{transition:transform .24s cubic-bezier(.16,1,.3,1), box-shadow .24s cubic-bezier(.16,1,.3,1)}
.card-hover:hover{transform:translateY(-6px);box-shadow:var(--shadow-lg)}
.grad-top{position:absolute;top:0;left:0;right:0;height:4px;background:var(--grad, var(--grad-primary));border-radius:${RADIUS.card} ${RADIUS.card} 0 0}

.icon-badge{width:48px;height:48px;border-radius:14px;display:flex;align-items:center;justify-content:center;flex:none;
  background:var(--tint,rgba(79,70,229,.12));color:var(--accent,var(--primary-2))}
.icon-badge.round{border-radius:999px}

/* ---- buttons ---- */
.btn{display:inline-flex;align-items:center;gap:7px;border-radius:${RADIUS.btn};font-size:12.5px;
  font-weight:700;cursor:pointer;transition:transform .18s cubic-bezier(.16,1,.3,1), box-shadow .18s ease, background .18s ease, border-color .18s ease, color .18s ease;
  border:1px solid transparent;padding:9px 16px;white-space:nowrap;position:relative}
.btn:active{transform:scale(.96)}
.btn-primary{background:var(--grad-primary);color:#fff;box-shadow:var(--shadow-glow-primary)}
.btn-primary:hover{box-shadow:0 16px 34px -8px rgba(79,70,229,.42);transform:translateY(-2px) scale(1.03)}
.btn-ghost{background:var(--panel);color:var(--primary-dk);border-color:var(--line);box-shadow:var(--shadow-sm)}
.btn-ghost:hover{background:var(--panel-2);border-color:var(--primary-lt);transform:translateY(-2px) scale(1.03);box-shadow:var(--shadow-md)}
.btn-icon{width:38px;height:38px;padding:0;justify-content:center;background:var(--panel);border-color:var(--line);color:var(--mut);box-shadow:var(--shadow-sm)}
.btn-icon:hover{background:var(--panel-2);color:var(--primary-2);border-color:var(--primary-lt);transform:translateY(-2px) scale(1.05);box-shadow:var(--shadow-md)}
.btn:disabled{opacity:.5;cursor:not-allowed;transform:none;box-shadow:none}

/* ---- segmented control ---- */
.segmented{position:relative;display:inline-flex;gap:2px;padding:4px;background:var(--panel-2);
  border:1px solid var(--line);border-radius:${RADIUS.input};overflow-x:auto;max-width:100%}
.segmented-indicator{position:absolute;top:4px;bottom:4px;border-radius:10px;background:var(--grad-primary);
  box-shadow:var(--shadow-glow-primary);transition:transform .32s cubic-bezier(.16,1,.3,1), width .32s cubic-bezier(.16,1,.3,1);z-index:0}
.segmented-btn{position:relative;z-index:1;border:none;background:transparent;padding:7px 15px;font-size:12.5px;
  font-weight:600;color:var(--mut);cursor:pointer;border-radius:10px;transition:color .2s ease;white-space:nowrap;flex:none}
.segmented-btn.active{color:#fff}
.segmented-btn:hover:not(.active){color:var(--text)}

/* ---- inputs / select ---- */
.select-wrap{position:relative;display:inline-flex;align-items:center}
.select-wrap select{appearance:none;-webkit-appearance:none;background:var(--panel);color:var(--text);
  border:1px solid var(--line);border-radius:${RADIUS.input};padding:9px 32px 9px 14px;font-size:12.5px;font-weight:600;
  cursor:pointer;transition:border-color .15s ease, box-shadow .15s ease}
.select-wrap select:hover{border-color:var(--primary-lt)}
.select-wrap .chev{position:absolute;right:11px;pointer-events:none;color:var(--faint)}
.input{background:var(--panel);color:var(--text);border:1px solid var(--line);border-radius:${RADIUS.input};
  padding:9px 12px 9px 36px;font-size:13px;transition:border-color .15s ease, box-shadow .15s ease;width:100%}
.input:focus{border-color:var(--primary-2);box-shadow:0 0 0 3px rgba(79,70,229,.12)}
.input-wrap{position:relative;display:flex;align-items:center}
.input-wrap .input-icon{position:absolute;left:12px;color:var(--faint);pointer-events:none}
.input-wrap.pill .input{border-radius:999px}

/* ---- tables ---- */
.table-wrap{border-radius:${RADIUS.table};border:1px solid var(--line);overflow:hidden;background:var(--panel)}
.table-scroll{overflow:auto}
.table-wrap table{border-collapse:separate;border-spacing:0;width:100%}
.table-wrap thead th{position:sticky;top:0;background:var(--grad-primary);color:#fff;z-index:1}
.table-wrap tbody tr{transition:background .14s ease}
.table-wrap tbody tr.zebra:nth-child(even){background:var(--panel-2)}
.table-wrap tbody tr.hoverable:hover{background:rgba(79,70,229,.06)}
.table-scroll::-webkit-scrollbar{height:8px;width:8px}
.table-scroll::-webkit-scrollbar-track{background:transparent}
.table-scroll::-webkit-scrollbar-thumb{background:var(--line);border-radius:8px}
.table-scroll::-webkit-scrollbar-thumb:hover{background:var(--faint)}

.badge{display:inline-flex;align-items:center;padding:3px 10px;border-radius:${RADIUS.pill};
  font-weight:800;font-variant-numeric:tabular-nums;font-size:11.5px}
.pill-soft{display:inline-flex;align-items:center;gap:6px;padding:3px 10px;border-radius:999px;font-size:11.5px;font-weight:700}
.dot{display:inline-block;width:8px;height:8px;border-radius:999px;flex:none}

.empty-state{display:flex;flex-direction:column;align-items:center;justify-content:center;
  gap:8px;padding:34px 20px;color:var(--faint);text-align:center}

/* ---- header ---- */
.dash-header{position:sticky;top:0;z-index:30;
  backdrop-filter:blur(16px) saturate(180%);-webkit-backdrop-filter:blur(16px) saturate(180%);
  background:rgba(255,255,255,.75);border-bottom:1px solid var(--line);box-shadow:0 1px 0 rgba(15,23,42,.02)}

/* ---- sidebar: light, subtle shadow, no dark mode ---- */
.sidebar{background:var(--sidebar-bg);border-right:1px solid var(--sidebar-line);box-shadow:2px 0 12px rgba(15,23,42,.03);
  display:flex;flex-direction:column;transition:width .28s cubic-bezier(.16,1,.3,1);
  position:sticky;top:0;height:100vh;flex:none;z-index:25}
.sidebar-navitem{display:flex;align-items:center;gap:12px;padding:10px 14px;border-radius:12px;
  color:var(--sidebar-text-dim);cursor:pointer;transition:background .18s ease, color .18s ease;position:relative;
  font-size:13px;font-weight:800;white-space:nowrap;overflow:hidden}
.sidebar-navitem:hover{background:var(--sidebar-hover);color:var(--primary-dk)}
.sidebar-navitem.active{background:var(--grad-primary);color:#fff;box-shadow:var(--shadow-glow-primary)}
.sidebar-section-title{font-size:10px;letter-spacing:.09em;text-transform:uppercase;color:var(--sidebar-text-dim);
  font-weight:800;padding:0 14px;margin:18px 0 8px;white-space:nowrap;overflow:hidden}
.sidebar-collapse-btn{width:30px;height:30px;border-radius:9px;background:var(--panel);
  border:1px solid var(--sidebar-line);color:var(--sidebar-text-dim);display:flex;align-items:center;justify-content:center;
  cursor:pointer;transition:all .18s ease;flex:none}
.sidebar-collapse-btn:hover{background:var(--sidebar-hover);color:var(--primary-2)}

/* ---- popover ---- */
.popover{position:absolute;top:calc(100% + 10px);right:0;min-width:260px;background:var(--panel);
  border:1px solid var(--line);border-radius:16px;box-shadow:var(--shadow-lg);padding:14px;z-index:50;
  animation:popIn .18s cubic-bezier(.16,1,.3,1) both}

/* ---- avatar ---- */
.avatar{width:36px;height:36px;border-radius:11px;background:var(--grad-primary);color:#fff;
  display:flex;align-items:center;justify-content:center;font-weight:800;font-size:13px;flex:none;
  box-shadow:var(--shadow-glow-primary);cursor:pointer;transition:transform .18s ease}
.avatar:hover{transform:scale(1.06)}

.shimmer-bar{position:relative;overflow:hidden;height:3px;border-radius:3px;background:var(--line-soft)}
.shimmer-bar::after{content:"";position:absolute;inset:0;width:40%;border-radius:3px;
  background:var(--grad-primary);animation:shimmerMove 1.1s ease-in-out infinite}
@keyframes shimmerMove{0%{transform:translateX(-100%)}100%{transform:translateX(350%)}}

@keyframes barPulse{0%,100%{transform:scaleY(1)}50%{transform:scaleY(.5)}}
.mini-bar{transform-origin:bottom;animation:barPulse 1.6s ease-in-out infinite}

.sidebar-backdrop{display:none}
.mobile-menu-btn{display:none}
@media(max-width:767px){
  .sidebar{position:fixed;left:0;top:0;bottom:0;width:min(80vw,320px) !important;max-width:100vw;transform:translateX(0);z-index:33}
  .sidebar.collapsed{transform:translateX(-100%)}
  .sidebar-backdrop{display:block;position:fixed;inset:0;background:rgba(15,23,42,.35);z-index:32;animation:popIn .2s ease}
  .mobile-menu-btn{display:flex}

  .filter-divider{display:none}
  .select-wrap{max-width:100%}
  .select-wrap select{max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
}
@media(max-width:420px){
  .select-wrap select{max-width:120px}
}
`;
