// Network/resource visibility in MV3: we CANNOT read request bodies via
// webRequest. We use Resource Timing entries which expose resource URLs the
// page loaded. This is browser-visible and safe.
export function scanResourceTiming() {
    const hits = [];
    let entries = [];
    try {
        entries = performance.getEntriesByType("resource");
    }
    catch {
        return hits;
    }
    for (const e of entries) {
        const url = e.name;
        if (!looksLikeMedia(url))
            continue;
        hits.push({
            url,
            kind: "unknown",
            detectionMethod: "network-resource",
            sourceUrl: location.href,
            frameContext: "top",
            metadata: {
                initiatorType: e.initiatorType || "unknown",
                transferSize: e.transferSize ? String(e.transferSize) : "0",
            },
        });
    }
    return hits;
}
function looksLikeMedia(url) {
    const u = url.toLowerCase();
    return (u.includes(".m3u8") ||
        u.includes(".mpd") ||
        u.includes(".mp4") ||
        u.includes(".webm") ||
        u.includes(".m4v") ||
        u.includes(".m4a") ||
        u.includes(".mov") ||
        u.includes(".ogg") ||
        u.includes(".ogv") ||
        u.includes(".ism") ||
        u.includes("manifest") ||
        u.includes("playlist") ||
        /\.(mp4|webm|m4v|m4a|mov|ogv|oga|ogg|m3u8|mpd)(\?|$)/.test(u));
}
//# sourceMappingURL=resource-detector.js.map