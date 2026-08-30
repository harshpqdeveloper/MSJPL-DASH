// Tiny hand-rolled User-Agent / referrer classification — avoids adding a UA-parsing
// dependency for what's only ever a coarse device/browser/OS bucket, in the same spirit
// as this project's hand-rolled icon set (src/icons.jsx).

export function parseUserAgent(ua) {
  const s = String(ua || "");

  let os = "Other";
  if (/windows/i.test(s)) os = "Windows";
  else if (/android/i.test(s)) os = "Android";
  else if (/iphone|ipad|ipod/i.test(s)) os = "iOS";
  else if (/mac os x|macintosh/i.test(s)) os = "macOS";
  else if (/linux/i.test(s)) os = "Linux";

  let browser = "Other";
  if (/edg\//i.test(s)) browser = "Edge";
  else if (/opr\/|opera/i.test(s)) browser = "Other";
  else if (/chrome\//i.test(s) && !/chromium/i.test(s)) browser = "Chrome";
  else if (/firefox\//i.test(s)) browser = "Firefox";
  else if (/safari\//i.test(s) && /version\//i.test(s)) browser = "Safari";

  let deviceType = "desktop";
  if (/ipad|tablet|(android(?!.*mobile))/i.test(s)) deviceType = "tablet";
  else if (/mobi|iphone|ipod/i.test(s)) deviceType = "mobile";

  return { deviceType, browser, os };
}

const SEARCH_HOSTS = ["google.", "bing.com", "yahoo.com", "duckduckgo.com", "baidu.com", "yandex."];
const SOCIAL_HOSTS = [
  "facebook.com", "fb.com", "instagram.com", "twitter.com", "x.com", "linkedin.com",
  "pinterest.com", "reddit.com", "whatsapp.com", "t.co", "tiktok.com",
];

// referrerUrl is the raw `document.referrer` sent by the client (may be empty/same-origin).
// Returns only a bare hostname (never the full URL/query string) plus a coarse bucket.
export function classifyReferrer(referrerUrl, ownOrigin) {
  if (!referrerUrl) return { referrerHost: null, trafficSource: "direct" };
  let host;
  try {
    const u = new URL(referrerUrl);
    if (ownOrigin && u.origin === ownOrigin) return { referrerHost: null, trafficSource: "direct" };
    host = u.hostname.toLowerCase();
  } catch {
    return { referrerHost: null, trafficSource: "direct" };
  }
  if (SEARCH_HOSTS.some((h) => host.includes(h))) return { referrerHost: host, trafficSource: "search" };
  if (SOCIAL_HOSTS.some((h) => host.includes(h))) return { referrerHost: host, trafficSource: "social" };
  return { referrerHost: host, trafficSource: "referral" };
}
