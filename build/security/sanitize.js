// Security/policy layer (PLAN.md Section 32).
//  - Treat all page-supplied strings as UNTRUSTED.
//  - Provide safe text escaping for UI rendering (no innerHTML of raw data).
//  - Redact secrets from any log/metadata before storage.
export function escapeHtml(input) {
    return input
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}
const SECRET_KEY_RE = /(authorization|auth[-_]?token|access[-_]?token|refresh[-_]?token|bearer|session[-_]?id|sessionid|cookie|set[-_]?cookie|csrf|xsrf|password|passwd|secret|api[-_]?key|apikey|private[-_]?key|x-amz-security-token|id[-_]?token|client[-_]?secret)/i;
export function looksLikeSecretKey(key) {
    return SECRET_KEY_RE.test(key);
}
// Redact values whose key looks sensitive OR whose value looks like a token.
export function redactMetadata(meta) {
    const out = {};
    for (const [k, v] of Object.entries(meta)) {
        if (looksLikeSecretKey(k)) {
            out[k] = "***redacted***";
            continue;
        }
        if (looksLikeSecretValue(v)) {
            out[k] = "***redacted***";
            continue;
        }
        out[k] = v;
    }
    return out;
}
export function redactLog(message) {
    // Strip common header-like secret patterns from arbitrary log text.
    return message
        .replace(/authorization:\s*[^\s]+/gi, "authorization: ***redacted***")
        .replace(/bearer\s+[A-Za-z0-9._-]+/gi, "bearer ***redacted***")
        .replace(/cookie:\s*[^\s]+/gi, "cookie: ***redacted***")
        .replace(/token=[A-Za-z0-9._-]+/gi, "token=***redacted***");
}
function looksLikeSecretValue(v) {
    // Long opaque base64/jwt-like tokens
    if (/^[A-Za-z0-9_-]{32,}$/.test(v))
        return true;
    if (/^eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(v))
        return true; // JWT
    return false;
}
// Validate a URL is http(s) (or blob:) before using for open/download.
export function isSafeUrl(url) {
    try {
        const u = new URL(url);
        return u.protocol === "http:" || u.protocol === "https:" || u.protocol === "blob:";
    }
    catch {
        return false;
    }
}
//# sourceMappingURL=sanitize.js.map