// Intelligent ranking of candidates (PLAN.md Section 16).
// Uses only signals that are actually established; never pretends to know more.
const CONF_RANK = {
    high: 3,
    medium: 2,
    low: 1,
    unknown: 0,
};
const STATUS_RANK = {
    active: 5,
    pending: 3,
    "auth-required": 2,
    inactive: 1,
    unsupported: 1,
    protected: 0,
};
export function rankCandidates(candidates) {
    return [...candidates].sort((a, b) => score(b) - score(a));
}
function score(c) {
    let s = 0;
    // Validity/availability
    if (c.container !== "unknown")
        s += 3;
    else
        s += 1;
    // Is video content
    if (c.kind === "video")
        s += 2;
    else if (c.kind === "audio")
        s += 1;
    // Resolution / quality (highest height wins)
    const maxH = Math.max(0, ...c.qualities.map((q) => q.height ?? 0));
    if (maxH >= 1080)
        s += 4;
    else if (maxH >= 720)
        s += 3;
    else if (maxH >= 480)
        s += 2;
    else if (c.qualities.length > 0)
        s += 1;
    // Playback compatibility: manifest types & browser-native containers rank high
    if (c.manifestType === "hls" || c.manifestType === "dash")
        s += 2; // standard, supports qualities
    if (c.container === "mp4" || c.container === "webm")
        s += 2;
    // Directness: media files more direct than manifests
    if (c.manifestType === "none" && c.container !== "unknown")
        s += 1;
    // Active state
    s += STATUS_RANK[c.status] ?? 0;
    // Auth dependency is a slight negative (session-bound)
    if (c.authRequired)
        s -= 1;
    // Detection confidence
    s += CONF_RANK[c.confidence] ?? 0;
    return s;
}
// Best legitimate playback representation for a candidate.
export function bestPlaybackUrl(c) {
    if (c.qualities.length > 0) {
        const sorted = [...c.qualities].sort((a, b) => (b.height ?? 0) - (a.height ?? 0));
        return sorted[0].url ?? c.rawUrl;
    }
    return c.normalizedUrl ?? c.rawUrl;
}
//# sourceMappingURL=ranker.js.map