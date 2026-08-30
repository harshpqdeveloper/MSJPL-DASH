// Minimal hand-rolled stroke icon set (Lucide-style) — avoids adding an icon library dependency.
import React from "react";

const base = {
  width: 18, height: 18, viewBox: "0 0 24 24", fill: "none",
  stroke: "currentColor", strokeWidth: 1.75, strokeLinecap: "round", strokeLinejoin: "round",
};

export const IconUpload = (p) => (
  <svg {...base} {...p}><path d="M12 15V3" /><path d="m7 8 5-5 5 5" /><path d="M3 15v4a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-4" /></svg>
);
export const IconRefresh = (p) => (
  <svg {...base} {...p}><path d="M21 12a9 9 0 0 1-15.3 6.4L3 15" /><path d="M3 12a9 9 0 0 1 15.3-6.4L21 9" /><path d="M21 3v6h-6" /><path d="M3 21v-6h6" /></svg>
);
export const IconTrendingUp = (p) => (
  <svg {...base} {...p}><path d="m3 17 6-6 4 4 8-8" /><path d="M17 7h4v4" /></svg>
);
export const IconLayers = (p) => (
  <svg {...base} {...p}><path d="m12 2 9 5-9 5-9-5 9-5Z" /><path d="m3 12 9 5 9-5" /><path d="m3 17 9 5 9-5" /></svg>
);
export const IconAlertTriangle = (p) => (
  <svg {...base} {...p}><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" /><path d="M12 9v4" /><path d="M12 17h.01" /></svg>
);
export const IconChevronDown = (p) => (
  <svg {...base} width={13} height={13} {...p}><path d="m6 9 6 6 6-6" /></svg>
);
export const IconChevronLeft = (p) => (
  <svg {...base} {...p}><path d="m15 18-6-6 6-6" /></svg>
);
export const IconCheckCircle = (p) => (
  <svg {...base} {...p}><path d="M21.8 11.1c.1.6.2 1.2.2 1.9 0 5.5-4.5 10-10 10S2 18.5 2 13 6.5 3 12 3c1.7 0 3.4.5 4.8 1.3" /><path d="m9 11 3 3L22 4" /></svg>
);
export const IconInbox = (p) => (
  <svg {...base} {...p}><path d="M22 12h-6l-2 3h-4l-2-3H2" /><path d="M5.5 5h13l3.5 7v7a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-7l3.5-7Z" /></svg>
);
export const IconSpinner = (p) => (
  <svg {...base} {...p} style={{ animation: "spin .8s linear infinite" }}><path d="M21 12a9 9 0 1 1-6.2-8.5" /></svg>
);
export const IconFileWarning = (p) => (
  <svg {...base} {...p}><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" /><path d="M14 2v6h6" /><path d="M12 12v4" /><path d="M12 20h.01" /></svg>
);
export const IconGem = (p) => (
  <svg {...base} {...p}><path d="M6 3h12l4 6-10 12L2 9Z" /><path d="M2 9h20" /><path d="m8 3 4 6 4-6" /><path d="m8.5 9 3.5 12 3.5-12" /></svg>
);
export const IconSearch = (p) => (
  <svg {...base} {...p}><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></svg>
);
export const IconBell = (p) => (
  <svg {...base} {...p}><path d="M6 8a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6" /><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" /></svg>
);
export const IconSettings = (p) => (
  <svg {...base} {...p}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9c.36.09.7.28 1 .51.4.32.66.79.7 1.3" /></svg>
);
export const IconSun = (p) => (
  <svg {...base} {...p}><circle cx="12" cy="12" r="4" /><path d="M12 2v2" /><path d="M12 20v2" /><path d="m4.9 4.9 1.4 1.4" /><path d="m17.7 17.7 1.4 1.4" /><path d="M2 12h2" /><path d="M20 12h2" /><path d="m6.3 17.7-1.4 1.4" /><path d="m19.1 4.9-1.4 1.4" /></svg>
);
export const IconMoon = (p) => (
  <svg {...base} {...p}><path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 0 0 10.5 10.5Z" /></svg>
);
export const IconMenu = (p) => (
  <svg {...base} {...p}><path d="M4 6h16" /><path d="M4 12h16" /><path d="M4 18h16" /></svg>
);
export const IconDownload = (p) => (
  <svg {...base} {...p}><path d="M12 3v13" /><path d="m7 11 5 5 5-5" /><path d="M4 20h16" /></svg>
);
export const IconGrid = (p) => (
  <svg {...base} {...p}><rect x="3" y="3" width="8" height="8" rx="2" /><rect x="13" y="3" width="8" height="8" rx="2" /><rect x="3" y="13" width="8" height="8" rx="2" /><rect x="13" y="13" width="8" height="8" rx="2" /></svg>
);
export const IconUser = (p) => (
  <svg {...base} {...p}><circle cx="12" cy="8" r="4" /><path d="M4 21c1.5-4.5 5-6 8-6s6.5 1.5 8 6" /></svg>
);
export const IconX = (p) => (
  <svg {...base} {...p}><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
);
export const IconFilter = (p) => (
  <svg {...base} {...p}><path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3Z" /></svg>
);
export const IconShieldCheck = (p) => (
  <svg {...base} {...p}><path d="M12 2 4 5v6c0 5 3.5 8.5 8 11 4.5-2.5 8-6 8-11V5Z" /><path d="m9 12 2 2 4-4" /></svg>
);
export const IconActivity = (p) => (
  <svg {...base} {...p}><path d="M22 12h-4l-3 9L9 3l-3 9H2" /></svg>
);
export const IconLock = (p) => (
  <svg {...base} {...p}><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
);
export const IconUsers = (p) => (
  <svg {...base} {...p}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>
);
export const IconGlobe = (p) => (
  <svg {...base} {...p}><circle cx="12" cy="12" r="10" /><path d="M2 12h20" /><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10Z" /></svg>
);
export const IconMousePointer = (p) => (
  <svg {...base} {...p}><path d="M4 3 20 12 13 13 10 20Z" /></svg>
);
export const IconLogOut = (p) => (
  <svg {...base} {...p}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="M16 17l5-5-5-5" /><path d="M21 12H9" /></svg>
);
export const IconCalendar = (p) => (
  <svg {...base} {...p}><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4" /><path d="M8 2v4" /><path d="M3 10h18" /></svg>
);
export const IconMonitor = (p) => (
  <svg {...base} {...p}><rect x="2" y="3" width="20" height="14" rx="2" /><path d="M8 21h8" /><path d="M12 17v4" /></svg>
);
export const IconSmartphone = (p) => (
  <svg {...base} {...p}><rect x="6" y="2" width="12" height="20" rx="2" /><path d="M11 18h2" /></svg>
);
export const IconTablet = (p) => (
  <svg {...base} {...p}><rect x="4" y="2" width="16" height="20" rx="2" /><path d="M11 18h2" /></svg>
);
