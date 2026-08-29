import { scanMediaElements } from "./detection/html5-detector.js";
import { scanResourceTiming } from "./detection/resource-detector.js";
import { scanPlayerInstances } from "./detection/player-detector.js";
import { classifyContainer, classifyManifestType, classifyKind } from "../analysis/url-classifier.js";
import { normalizeUrl } from "../analysis/url-normalizer.js";
import { redactMetadata } from "../security/sanitize.js";
// Content-script controller: runs detectors, builds candidates, monitors.
// Communicates with background via chrome.runtime ports/messages.
let monitoring = false;
let port = null;
let observers = [];
let interval = null;
function log(msg, level = "info") {
    const entry = { t: Date.now(), level, msg };
    try {
        (port ?? chrome.runtime.connect({ name: "vsd-content" })).postMessage({
            type: "CONTENT_DEBUG",
            entry,
        });
    }
    catch {
        // ignore
    }
}
function makeCandidate(hit) {
    const container = classifyContainer(hit.url, hit.mimeType);
    const manifestType = classifyManifestType(container);
    const kind = hit.kind !== "unknown" ? hit.kind : classifyKind(hit.mimeType, container);
    const norm = normalizeUrl(hit.url);
    const baseConfidence = hit.detectionMethod === "media-element" || hit.detectionMethod === "player-instance"
        ? "high"
        : hit.detectionMethod === "source-element"
            ? "medium"
            : "low";
    const candidate = {
        id: "",
        kind,
        container,
        manifestType,
        rawUrl: hit.url,
        normalizedUrl: norm.normalizedUrl,
        sourceUrl: hit.sourceUrl,
        frameContext: hit.frameContext,
        detectionMethod: hit.detectionMethod,
        status: "pending",
        confidence: baseConfidence,
        qualities: [],
        mimeType: hit.mimeType,
        warnings: [],
        metadata: redactMetadata(hit.metadata),
        timestamp: Date.now(),
    };
    candidate.id = `${candidate.detectionMethod}:${candidate.rawUrl}`;
    return candidate;
}
function collectAll() {
    const hits = [];
    try {
        hits.push(...scanMediaElements(document));
    }
    catch (e) {
        log(`media-element scan error: ${String(e)}`, "warn");
    }
    try {
        hits.push(...scanResourceTiming());
    }
    catch (e) {
        log(`resource scan error: ${String(e)}`, "warn");
    }
    try {
        hits.push(...scanPlayerInstances());
    }
    catch (e) {
        log(`player scan error: ${String(e)}`, "warn");
    }
    return hits;
}
function buildCandidates() {
    const hits = collectAll();
    return hits.map(makeCandidate);
}
function postCandidates(candidates) {
    if (candidates.length === 0)
        return;
    try {
        (port ?? chrome.runtime.connect({ name: "vsd-content" })).postMessage({
            type: "CANDIDATE_BATCH",
            candidates,
        });
    }
    catch (e) {
        log(`postCandidates error: ${String(e)}`, "error");
    }
}
function runOnce() {
    const c = buildCandidates();
    const real = c.filter((x) => x.container !== "unknown" || x.detectionMethod !== "network-resource");
    postCandidates(c);
    if (real.length > 0) {
        log(`Detected ${real.length} candidate(s)`);
    }
}
// Continuous monitoring via observers + lightweight interval.
function startMonitoring() {
    if (monitoring)
        return;
    monitoring = true;
    log("Monitoring started");
    // Observe DOM mutations for dynamically inserted players/elements.
    const obs = new MutationObserver((mutations) => {
        let changed = false;
        for (const m of mutations) {
            if (m.addedNodes.length)
                changed = true;
        }
        if (changed)
            runOnce();
    });
    obs.observe(document.documentElement, { childList: true, subtree: true });
    observers.push(obs);
    // Some SPA players appear after interaction; periodic low-cost sweep.
    interval = window.setInterval(runOnce, 3000);
    runOnce();
}
function stopMonitoring() {
    if (!monitoring)
        return;
    monitoring = false;
    log("Monitoring stopped");
    for (const o of observers)
        o.disconnect();
    observers = [];
    if (interval !== null) {
        clearInterval(interval);
        interval = null;
    }
}
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (!msg || typeof msg !== "object")
        return;
    switch (msg.type) {
        case "CONTENT_START":
            port = chrome.runtime.connect({ name: "vsd-content" });
            startMonitoring();
            sendResponse({ ok: true });
            return true;
        case "CONTENT_STOP":
            stopMonitoring();
            sendResponse({ ok: true });
            return true;
        case "CONTENT_SCAN_NOW":
            runOnce();
            sendResponse({ ok: true });
            return true;
        default:
            return false;
    }
});
//# sourceMappingURL=content-script.js.map