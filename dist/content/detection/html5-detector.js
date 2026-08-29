export function scanMediaElements(doc = document) {
    const hits = [];
    const elements = Array.from(doc.querySelectorAll("video, audio"));
    for (const el of elements) {
        const kind = el.tagName === "VIDEO" ? "video" : el.tagName === "AUDIO" ? "audio" : "unknown";
        // currentSrc is the most reliable active source.
        if (el.currentSrc) {
            hits.push(buildHit(el.currentSrc, kind, "media-element", el, doc));
        }
        // <source> children.
        const sources = Array.from(el.querySelectorAll("source"));
        for (const s of sources) {
            const src = s.getAttribute("src") || "";
            if (src) {
                const abs = toAbsolute(src, doc);
                if (abs)
                    hits.push(buildHit(abs, kind, "source-element", el, doc, s.getAttribute("type") || undefined));
            }
        }
        // blob: objects
        const srcAttr = el.getAttribute("src");
        if (srcAttr && /^blob:/i.test(srcAttr)) {
            hits.push(buildHit(srcAttr, kind, "media-element", el, doc, el.getAttribute("type") || undefined));
        }
    }
    return hits;
}
function buildHit(url, kind, method, el, doc, mimeType) {
    const meta = {
        tagName: el.tagName,
        readyState: String(el.readyState),
        networkState: String(el.networkState),
        currentTime: el.currentTime ? el.currentTime.toFixed(1) : "0",
    };
    const v = el;
    if (typeof v.videoWidth === "number") {
        if (v.videoWidth)
            meta.width = String(v.videoWidth);
        if (v.videoHeight)
            meta.height = String(v.videoHeight);
    }
    if (el.duration && isFinite(el.duration))
        meta.duration = el.duration.toFixed(1);
    if (el.paused !== undefined)
        meta.paused = String(el.paused);
    const pageUrl = doc.location?.href;
    return {
        url,
        kind,
        detectionMethod: method,
        mimeType,
        sourceUrl: pageUrl,
        frameContext: doc === document ? "top" : pageUrl,
        metadata: meta,
    };
}
function toAbsolute(url, doc) {
    try {
        return new URL(url, doc.baseURI).toString();
    }
    catch {
        return url;
    }
}
//# sourceMappingURL=html5-detector.js.map