// Fire-and-forget client-side pageview tracking. Sends only a page path and referrer —
// device/browser/OS are derived server-side from the request's User-Agent header, and no
// IP address or personal data is ever collected. Called once from App.jsx on mount.
const VISITOR_KEY = "jd:analytics:visitor";
const SESSION_KEY = "jd:analytics:session";

// Guards against duplicate events from React StrictMode's double-invoked effects (dev only)
// or any accidental re-mount within the same tab session — one real event per path visited.
const trackedThisSession = new Set();

function randomId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function getOrCreate(storage, key) {
  try {
    let id = storage.getItem(key);
    if (!id) {
      id = randomId();
      storage.setItem(key, id);
    }
    return id;
  } catch {
    return randomId(); // storage unavailable (e.g. private browsing) — track this visit only
  }
}

export function trackVisit(path = window.location.pathname) {
  if (trackedThisSession.has(path)) return;
  trackedThisSession.add(path);

  let visitorId, sessionId;
  try {
    visitorId = getOrCreate(window.localStorage, VISITOR_KEY);
    sessionId = getOrCreate(window.sessionStorage, SESSION_KEY);
  } catch {
    return;
  }

  const payload = JSON.stringify({
    path, visitorId, sessionId,
    referrer: document.referrer || "",
  });

  try {
    if (navigator.sendBeacon) {
      navigator.sendBeacon("/api/analytics/track", new Blob([payload], { type: "application/json" }));
    } else {
      fetch("/api/analytics/track", { method: "POST", body: payload, headers: { "Content-Type": "application/json" }, keepalive: true }).catch(() => {});
    }
  } catch {
    // Tracking must never break the page for a real visitor.
  }
}
