import { dedupeKey } from "./url-normalizer.js";
// Robust deduplication by URL identity (preserving auth/sig params).
// Two candidates with the same dedupeKey are merged, keeping the freshest
// and accumulating any new qualities/warnings.
export class Deduplicator {
    constructor() {
        this.map = new Map();
    }
    add(candidate) {
        const key = dedupeKey(candidate.rawUrl);
        const existing = this.map.get(key);
        if (!existing) {
            this.map.set(key, candidate);
            return { added: true, merged: false };
        }
        // Merge: prefer active state, higher confidence, more qualities.
        const merged = mergeCandidates(existing, candidate);
        this.map.set(key, merged);
        return { added: false, merged: true };
    }
    addBatch(candidates) {
        let added = 0;
        let merged = 0;
        for (const c of candidates) {
            const r = this.add(c);
            if (r.added)
                added++;
            else if (r.merged)
                merged++;
        }
        return { added, merged };
    }
    list() {
        return Array.from(this.map.values());
    }
    clear() {
        this.map.clear();
    }
}
function mergeCandidates(a, b) {
    const states = ["active", "pending", "inactive", "auth-required", "unsupported", "protected"];
    const confs = ["high", "medium", "low", "unknown"];
    const status = states.indexOf(b.status) <= states.indexOf(a.status) ? a.status : b.status;
    const confidence = confs.indexOf(b.confidence) <= confs.indexOf(a.confidence) ? a.confidence : b.confidence;
    const qualityKeys = new Set(a.qualities.map((q) => q.label + "|" + (q.height ?? "")));
    const qualities = [...a.qualities];
    for (const q of b.qualities) {
        const k = q.label + "|" + (q.height ?? "");
        if (!qualityKeys.has(k)) {
            qualityKeys.add(k);
            qualities.push(q);
        }
    }
    const warnings = Array.from(new Set([...a.warnings, ...b.warnings]));
    return {
        ...a,
        ...b,
        status,
        confidence,
        qualities,
        warnings,
        timestamp: Math.max(a.timestamp, b.timestamp),
    };
}
//# sourceMappingURL=deduplicator.js.map