// Classify a URL + optional MIME into a container type and manifest type.
// Conservative: only classify when there is strong evidence. Never guess.
export function classifyContainer(url, mime) {
    const u = safeUrl(url);
    const path = u ? u.pathname.toLowerCase() : url.toLowerCase();
    const q = u ? u.search.toLowerCase() : "";
    if (mime) {
        const m = mime.toLowerCase();
        if (m.includes("mpegurl") || m === "application/x-mpegurl")
            return "hls";
        if (m.includes("dash+xml") || m === "application/dash+xml")
            return "dash";
        if (m.includes("mp4") || m.includes("mpeg"))
            return "mp4";
        if (m.includes("webm"))
            return "webm";
        if (m.includes("ogg"))
            return "ogg";
        if (m.includes("quicktime"))
            return "mov";
        if (m.startsWith("audio/"))
            return "other";
        if (m.startsWith("video/")) {
            if (m.includes("mp4"))
                return "mp4";
            if (m.includes("webm"))
                return "webm";
            if (m.includes("ogg"))
                return "ogg";
            return "other";
        }
    }
    if (path.endsWith(".m3u8") || path.endsWith(".m3u") || q.includes("m3u8") || /\.m3u8($|\?)/.test(path))
        return "hls";
    if (path.endsWith(".mpd") || q.includes(".mpd") || /\.mpd($|\?)/.test(path))
        return "dash";
    if (path.endsWith(".ism") || path.endsWith(".isml") || path.includes(".ism/") || path.includes(".isml/"))
        return "smooth";
    if (path.endsWith(".mp4") || path.endsWith(".m4v") || path.endsWith(".m4a"))
        return "mp4";
    if (path.endsWith(".webm"))
        return "webm";
    if (path.endsWith(".mov"))
        return "mov";
    if (path.endsWith(".mkv"))
        return "mkv";
    if (path.endsWith(".ogv") || path.endsWith(".oga") || path.endsWith(".ogg"))
        return "ogg";
    if (path.includes("/manifest") && (path.includes("smooth") || path.includes("ss(")))
        return "smooth";
    // Heuristic query hints (weak). Only used when nothing stronger matched.
    if (q.includes("manifest") || q.includes("playlist"))
        return "hls";
    return "unknown";
}
export function classifyManifestType(container) {
    switch (container) {
        case "hls":
            return "hls";
        case "dash":
            return "dash";
        case "smooth":
            return "smooth";
        default:
            return "none";
    }
}
export function classifyKind(mime, container) {
    if (mime) {
        const m = mime.toLowerCase();
        if (m.startsWith("audio/"))
            return "audio";
        if (m.startsWith("video/"))
            return "video";
    }
    if (container && (container === "mp3" || container === "ogg")) {
        // conservative; media elements default unknown
    }
    return "unknown";
}
function safeUrl(url) {
    try {
        return new URL(url);
    }
    catch {
        return null;
    }
}
//# sourceMappingURL=url-classifier.js.map