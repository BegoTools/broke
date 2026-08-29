// Conservative URL normalization.
// RULES (per PLAN.md Section 8):
//  - Preserve the raw URL always.
//  - Only produce a normalized URL when there is strong technical justification.
//  - NEVER remove security-related parameters (auth/sig/exp/token/session/etc.).
//  - Never claim a cleaned URL is valid unless it was actually parsed.

// Parameters that must ALWAYS be preserved (removing them can break auth/CDN).
const PROTECTED_PARAM_KEYS = new Set([
  "token", "tokens", "auth", "auth_token", "authorization", "authorization_token",
  "signature", "sig", "sign", "s", "exp", "expires", "expiry", "expiration",
  "session", "sessionid", "sid", "access_token", "id_token", "policy", "key",
  "hmac", "hmacsha256", "ts", "t", "nonce", "st", "cdntoken", "token_", "accesskey",
  "ak", "sk", "hash", "verify", "captcha", "otp", "code", "state", "client_id",
  "client_secret", "apikey", "api_key", "appkey", "x-amz-security-token",
  "x-amz-signature", "x-amz-date", "x-goog-signature", "x-goog-date",
]);

function isProtectedKey(key: string): boolean {
  const k = key.toLowerCase();
  if (PROTECTED_PARAM_KEYS.has(k)) return true;
  // fuzzy match for names containing protected words
  return (
    k.includes("token") ||
    k.includes("signature") ||
    k.includes("sign") ||
    k.includes("auth") ||
    k.includes("session") ||
    k.includes("secret") ||
    k.includes("expir") ||
    k.includes("hmac") ||
    k.includes("credential")
  );
}

export interface NormalizeResult {
  normalizedUrl?: string;
  removed: string[]; // names of params removed (for transparency)
  preservedProtected: string[]; // names of protected params kept (audit)
}

// Produce a normalized URL by removing only tracking/non-semantic params
// that are clearly safe to drop. Protected params are never removed.
export function normalizeUrl(rawUrl: string): NormalizeResult {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return { normalizedUrl: undefined, removed: [], preservedProtected: [] };
  }

  const removed: string[] = [];
  const preservedProtected: string[] = [];

  for (const key of Array.from(url.searchParams.keys())) {
    if (isProtectedKey(key)) {
      preservedProtected.push(key);
      continue;
    }
  }

  // Only strip a small, well-known set of pure tracking params.
  const STRIP = [
    "utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content",
    "fbclid", "gclid", "mc_cid", "mc_eid", "ref", "ref_src", "feature",
    "spm", "from", "app", "_", "t", "cachebust", "cb",
  ];
  for (const key of STRIP) {
    if (url.searchParams.has(key)) {
      url.searchParams.delete(key);
      removed.push(key);
    }
  }

  // Collapse empty query string.
  if (url.search === "?") url.search = "";

  const normalized = url.toString();
  return {
    normalizedUrl: normalized === rawUrl ? undefined : normalized,
    removed,
    preservedProtected,
  };
}

// Build a stable dedupe key. Differs from raw url comparison: we strip ONLY
// ephemeral/non-semantic tracking params (same set as normalize), but KEEP
// all protected params. This prevents dozens of identical auth'd results.
export function dedupeKey(rawUrl: string): string {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return rawUrl;
  }
  const STRIP = [
    "utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content",
    "fbclid", "gclid", "mc_cid", "mc_eid", "ref", "ref_src", "feature",
    "spm", "from", "app", "_", "t", "cachebust", "cb",
  ];
  for (const key of STRIP) url.searchParams.delete(key);
  if (url.search === "?") url.search = "";
  return url.toString();
}
