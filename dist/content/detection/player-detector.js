export function scanPlayerInstances() {
    const hits = [];
    const globals = [
        { name: "hls.js", expr: "window.hls", getter: () => window.hls },
        { name: "Hls", expr: "window.Hls", getter: () => window.Hls },
        { name: "dashjs", expr: "window.dashjs", getter: () => window.dashjs },
        { name: "Dash", expr: "window.Dash", getter: () => window.Dash },
        { name: "videojs", expr: "window.videojs", getter: () => window.videojs },
        { name: "jwplayer", expr: "window.jwplayer", getter: () => window.jwplayer },
    ];
    for (const g of globals) {
        try {
            const obj = g.getter();
            if (!obj)
                continue;
            const url = extractUrlFromPlayer(g.name, obj);
            if (url) {
                hits.push({
                    url,
                    kind: "video",
                    detectionMethod: "player-instance",
                    sourceUrl: location.href,
                    frameContext: "top",
                    metadata: { player: g.name },
                });
            }
        }
        catch {
            // Reading a global may throw in some pages; ignore safely.
        }
    }
    // Look for JSON config blobs in window that mention media URLs.
    const cfg = readWindowConfig();
    if (cfg) {
        for (const url of extractUrlsFromText(cfg)) {
            hits.push({
                url,
                kind: "video",
                detectionMethod: "dom-config",
                sourceUrl: location.href,
                frameContext: "top",
                metadata: { source: "window-config" },
            });
        }
    }
    return hits;
}
function extractUrlFromPlayer(name, obj) {
    try {
        if (name === "hls.js") {
            const o = obj;
            if (o && o.url)
                return String(o.url);
            if (o && o.levels && o.levels[0] && o.levels[0].url)
                return String(o.levels[0].url);
        }
        if (name === "videojs") {
            const players = obj;
            if (players && players.players) {
                const first = Object.values(players.players)[0];
                if (first && first.currentSrc)
                    return String(first.currentSrc());
            }
        }
    }
    catch {
        return null;
    }
    return null;
}
function readWindowConfig() {
    try {
        // Only read a small, bounded set of likely config globals.
        for (const key of ["__PLAYER_CONFIG__", "playerConfig", "mediaConfig", "__NEXT_DATA__"]) {
            const v = window[key];
            if (v)
                return JSON.stringify(v).slice(0, 20000);
        }
    }
    catch {
        return null;
    }
    return null;
}
function extractUrlsFromText(text) {
    const re = /https?:\/\/[^\s"'<>]+/gi;
    const out = new Set();
    let m;
    while ((m = re.exec(text))) {
        out.add(m[0]);
    }
    // Filter to media-ish
    return Array.from(out).filter((u) => /\.(mp4|webm|m4v|m4a|mov|ogv|oga|ogg|m3u8|mpd)(\?|$)|manifest|playlist/i.test(u));
}
//# sourceMappingURL=player-detector.js.map