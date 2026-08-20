// Session-only persistence for the dashboard's UI state (filters, sidebar, active section).
//
// Uses sessionStorage (not localStorage) so restored state is scoped to a single
// browser tab/session and disappears automatically when the tab or browser closes.
// The workbook data itself is not persisted here — it's always loaded fresh from the
// server's excel/ folder on startup (see App.jsx), so this only needs to remember the
// small, frequently-changing UI state a user builds up while browsing.

const UI_KEY = "jd:session:v1:ui";
const SKIP_INTRO_KEY = "jd:session:v1:skip-intro";

function safeParse(json) {
  try {
    return JSON.parse(json);
  } catch {
    return null;
  }
}

/** Returns the saved dashboard UI state (filters, search, sidebar, active section), or null. */
export function loadUiSession() {
  let raw;
  try {
    raw = sessionStorage.getItem(UI_KEY);
  } catch {
    return null;
  }
  if (!raw) return null;
  const parsed = safeParse(raw);
  return parsed && typeof parsed === "object" ? parsed : null;
}

/** Persists dashboard UI state so it is restored alongside the workbook after a refresh. */
export function saveUiSession(state) {
  try {
    sessionStorage.setItem(UI_KEY, JSON.stringify(state));
  } catch (e) {
    console.warn("Dashboard UI state could not be saved.", e);
  }
}

/** Marks the next page load (this tab only) to skip the intro animation — set right before a manual reload. */
export function markIntroSkip() {
  try {
    sessionStorage.setItem(SKIP_INTRO_KEY, "1");
  } catch {
    // sessionStorage unavailable — the intro will just play again, which is harmless
  }
}

/** Reads and clears the skip-intro flag. True only for the one page load right after markIntroSkip(). */
export function consumeIntroSkip() {
  try {
    const skip = sessionStorage.getItem(SKIP_INTRO_KEY) === "1";
    if (skip) sessionStorage.removeItem(SKIP_INTRO_KEY);
    return skip;
  } catch {
    return false;
  }
}
