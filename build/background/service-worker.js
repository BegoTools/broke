import { Deduplicator } from "../analysis/deduplicator.js";
import { rankCandidates } from "../analysis/ranker.js";
import { analyzeManifest } from "../analysis/manifest-analyzer.js";
import { normalizeUrl } from "../analysis/url-normalizer.js";
import { redactLog, isSafeUrl, redactMetadata } from "../security/sanitize.js";
import { loadSettings, saveSettings, appendDebugLogs, loadDebugLogs, clearDebugLogs, saveHistory, } from "../storage/store.js";
import { annotateCandidates, applyAnnotations } from "../ai/annotate.js";
import { chatRoute } from "../ai/chat.js";
const sessions = new Map();
const popupPorts = new Set();
function getSession(tabId) {
    let s = sessions.get(tabId);
    if (!s) {
        s = { state: "idle", dedup: new Deduplicator(), debug: [] };
        sessions.set(tabId, s);
    }
    return s;
}
async function debugLog(tabId, msg, level = "info") {
    const s = getSession(tabId);
    const entry = { t: Date.now(), level, msg: redactLog(msg) };
    s.debug.push(entry);
    await appendDebugLogs([entry]);
    broadcast({ type: "DEBUG_LOGS", logs: s.debug });
}
function broadcast(msg) {
    for (const p of popupPorts) {
        try {
            p.postMessage(msg);
        }
        catch {
            popupPorts.delete(p);
        }
    }
}
async function sendState(tabId) {
    const s = getSession(tabId);
    broadcast({
        type: "STATE",
        state: s.state,
        tabId,
        pageUrl: s.pageUrl,
    });
}
async function sendCandidates(tabId) {
    const s = getSession(tabId);
    const ranked = rankCandidates(s.dedup.list());
    broadcast({ type: "CANDIDATES", candidates: ranked, full: true });
}
// Safe manifest fetch + quality/encryption analysis.
async function enrichCandidate(c) {
    if (c.manifestType === "hls" || c.manifestType === "dash") {
        try {
            const resp = await fetch(c.rawUrl, { method: "GET", credentials: "include", redirect: "follow" });
            if (resp.ok) {
                const text = await resp.text();
                if (text.length < 2_000_000) {
                    const analysis = analyzeManifest(text, c.rawUrl, c.manifestType);
                    if (analysis) {
                        c.qualities = analysis.qualities;
                        if (analysis.isEncrypted) {
                            c.isEncrypted = true;
                            c.status = "protected";
                            c.warnings.push(...analysis.warnings);
                        }
                        if (analysis.variantUrls) {
                            c.warnings.push(`Manifest exposes ${analysis.variantUrls.length} variant/segment URL(s).`);
                        }
                    }
                }
            }
            else {
                // Non-2xx often means auth/session dependency.
                c.authRequired = true;
                c.status = "auth-required";
                c.warnings.push(`Manifest request returned ${resp.status}; source may require authenticated session.`);
            }
        }
        catch (e) {
            c.authRequired = true;
            c.warnings.push(`Could not fetch manifest (CORS/session): ${String(e).slice(0, 120)}`);
        }
    }
    else if (c.container === "mp4" || c.container === "webm") {
        // Direct file: mark active if it came from a live media element.
        if (c.detectionMethod === "media-element" || c.detectionMethod === "player-instance") {
            c.status = "active";
        }
    }
    // Re-apply normalization now that we may have warnings (idempotent).
    const norm = normalizeUrl(c.rawUrl);
    c.normalizedUrl = norm.normalizedUrl ?? c.normalizedUrl;
    c.metadata = redactMetadata(c.metadata);
    return c;
}
async function handleCandidateBatch(tabId, candidates) {
    const s = getSession(tabId);
    const enriched = await Promise.all(candidates.map((c) => enrichCandidate(c).catch(() => c)));
    const { added, merged } = s.dedup.addBatch(enriched);
    if (added || merged) {
        await debugLog(tabId, `Candidates: +${added} new, ${merged} merged`);
        await sendCandidates(tabId);
        // Best-effort AI auto-annotation (non-blocking).
        void maybeAutoAnnotate(tabId);
    }
}
// Inject content script into the active tab via scripting API (activeTab).
async function startDetection(tabId) {
    const s = getSession(tabId);
    try {
        const tab = await chrome.tabs.get(tabId);
        s.pageUrl = tab.url;
        await chrome.scripting.executeScript({
            target: { tabId },
            files: ["content-script.js"],
        });
        // Tell content script to start monitoring.
        await chrome.tabs.sendMessage(tabId, { type: "CONTENT_START" });
        s.state = "monitoring";
        await debugLog(tabId, `Detection started on ${tab.url ?? "tab"}`);
        await sendState(tabId);
    }
    catch (e) {
        s.state = "error";
        await debugLog(tabId, `startDetection failed: ${String(e).slice(0, 200)}`, "error");
        await sendState(tabId);
    }
}
async function stopDetection(tabId) {
    const s = getSession(tabId);
    try {
        await chrome.tabs.sendMessage(tabId, { type: "CONTENT_STOP" });
    }
    catch {
        // tab may be closed; ignore
    }
    s.state = "stopped";
    const settings = await loadSettings();
    if (settings.historyLimit > 0) {
        await saveHistory(s.dedup.list(), settings.historyLimit);
    }
    await debugLog(tabId, "Detection stopped; results preserved.");
    await sendState(tabId);
    await sendCandidates(tabId);
}
// ---- Message routing ----
chrome.runtime.onConnect.addListener((port) => {
    if (port.name === "vsd-popup") {
        popupPorts.add(port);
        port.onMessage.addListener(async (msg) => {
            await routePopup(port, msg);
        });
        port.onDisconnect.addListener(() => {
            popupPorts.delete(port);
        });
    }
    else if (port.name === "vsd-content") {
        // content script streaming
        port.onMessage.addListener(async (msg) => {
            if (msg.type === "CANDIDATE_BATCH") {
                // Need the tabId: infer from sender.
                const tabId = port.sender?.tab?.id;
                if (typeof tabId === "number") {
                    await handleCandidateBatch(tabId, msg.candidates);
                }
            }
            else if (msg.type === "CONTENT_DEBUG") {
                const tabId = port.sender?.tab?.id;
                if (typeof tabId === "number")
                    await debugLog(tabId, msg.entry.msg, msg.entry.level);
            }
            else if (msg.type === "CONTENT_STATUS") {
                const tabId = port.sender?.tab?.id;
                if (typeof tabId === "number") {
                    getSession(tabId).state = msg.status;
                    await sendState(tabId);
                }
            }
        });
    }
});
async function routePopup(port, msg) {
    switch (msg.type) {
        case "START_DETECTION":
            await startDetection(msg.tabId);
            break;
        case "STOP_DETECTION":
            await stopDetection(-1); // stop all sessions
            for (const id of sessions.keys())
                await stopDetection(id);
            break;
        case "GET_STATE": {
            const tabId = (await lastActiveTab()) ?? -1;
            const s = getSession(tabId);
            port.postMessage({ type: "STATE", state: s.state, tabId, pageUrl: s.pageUrl });
            break;
        }
        case "GET_CANDIDATES": {
            const tabId = (await lastActiveTab()) ?? -1;
            const s = getSession(tabId);
            port.postMessage({ type: "CANDIDATES", candidates: rankCandidates(s.dedup.list()), full: true });
            break;
        }
        case "GET_DEBUG_LOGS": {
            const logs = await loadDebugLogs();
            port.postMessage({ type: "DEBUG_LOGS", logs });
            break;
        }
        case "CLEAR_DEBUG_LOGS":
            await clearDebugLogs();
            for (const s of sessions.values())
                s.debug = [];
            port.postMessage({ type: "DEBUG_LOGS", logs: [] });
            break;
        case "GET_SETTINGS": {
            const settings = await loadSettings();
            port.postMessage({ type: "SETTINGS", settings });
            break;
        }
        case "UPDATE_SETTINGS": {
            const settings = await saveSettings(msg.settings);
            port.postMessage({ type: "SETTINGS", settings });
            break;
        }
        case "DOWNLOAD_URL":
            await handleDownload(port, msg.url);
            break;
        case "OPEN_URL":
            break;
        case "AI_ANNOTATE":
            await runAnnotation(port);
            break;
        case "AI_CHAT":
            await runChat(port, msg.prompt);
            break;
    }
}
async function lastActiveTab() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    return tab && typeof tab.id === "number" ? tab.id : null;
}
async function handleDownload(port, url) {
    if (!isSafeUrl(url)) {
        port.postMessage({ type: "ERROR", message: "Refusing to download unsafe URL." });
        return;
    }
    try {
        const opts = { url, saveAs: true };
        await chrome.downloads.download(opts);
        port.postMessage({ type: "STATUS_MESSAGE", message: "Download started (browser handles authorization)." });
    }
    catch (e) {
        port.postMessage({ type: "ERROR", message: `Download unavailable: ${String(e).slice(0, 160)}` });
    }
}
async function handleOpen(port, url) {
    if (!isSafeUrl(url)) {
        port.postMessage({ type: "ERROR", message: "Refusing to open unsafe URL." });
        return;
    }
    try {
        await chrome.tabs.create({ url });
        port.postMessage({ type: "STATUS_MESSAGE", message: "Opened in new tab." });
    }
    catch (e) {
        port.postMessage({ type: "ERROR", message: `Cannot open: ${String(e).slice(0, 160)}` });
    }
}
// ---- AI helpers ----
// Best-effort auto-annotation when enabled and results changed.
async function maybeAutoAnnotate(tabId) {
    const settings = await loadSettings();
    if (!settings.aiEnabled || !settings.aiAutoAnnotate || !settings.geminiApiKey)
        return;
    try {
        const s = getSession(tabId);
        const candidates = rankCandidates(s.dedup.list());
        const annotations = await annotateCandidates(settings.geminiApiKey, settings.aiModel, candidates);
        if (annotations.length === 0)
            return;
        const enriched = applyAnnotations(candidates, annotations);
        for (const e of enriched)
            s.dedup.add(e);
        await sendCandidates(tabId);
        broadcast({ type: "AI_ANNOTATIONS", annotations });
    }
    catch {
        // never break detection flow on AI failure
    }
}
async function runAnnotation(port) {
    const settings = await loadSettings();
    if (!settings.aiEnabled || !settings.geminiApiKey) {
        port.postMessage({ type: "AI_STATUS", message: "AI is off. Add your Gemini key in Options to enable." });
        return;
    }
    const tabId = (await lastActiveTab()) ?? -1;
    const s = getSession(tabId);
    const candidates = rankCandidates(s.dedup.list());
    if (candidates.length === 0) {
        port.postMessage({ type: "AI_STATUS", message: "No links detected yet. Start detection first." });
        return;
    }
    port.postMessage({ type: "AI_STATUS", message: "Analyzing links with AI…" });
    const annotations = await annotateCandidates(settings.geminiApiKey, settings.aiModel, candidates);
    const enriched = applyAnnotations(candidates, annotations);
    // Persist annotations back into the session for future renders.
    for (const e of enriched)
        s.dedup.add(e);
    await sendCandidates(tabId);
    port.postMessage({ type: "AI_ANNOTATIONS", annotations });
}
async function runChat(port, prompt) {
    const settings = await loadSettings();
    if (!settings.aiEnabled || !settings.geminiApiKey) {
        port.postMessage({ type: "AI_CHAT_REPLY", reply: "AI is off. Add your Gemini key in Options to enable chat." });
        return;
    }
    const { intent, reply } = await chatRoute(settings.geminiApiKey, settings.aiModel, prompt);
    if (intent.kind === "tool") {
        await executeTool(port, intent);
    }
    port.postMessage({ type: "AI_CHAT_REPLY", reply: reply || "Done." });
}
async function executeTool(port, intent) {
    switch (intent.tool) {
        case "start_detection": {
            const tabId = await findTabByQuery(String(intent.args.tabQuery ?? ""));
            if (tabId === null) {
                port.postMessage({ type: "AI_STATUS", message: "No matching tab found; scanning active tab." });
                await startDetection((await lastActiveTab()) ?? -1);
            }
            else {
                await startDetection(tabId);
            }
            break;
        }
        case "stop_detection":
            for (const id of sessions.keys())
                await stopDetection(id);
            break;
        case "open_url":
            if (intent.args.url)
                await handleOpen(port, String(intent.args.url));
            break;
        case "download_url":
            if (intent.args.url)
                await handleDownload(port, String(intent.args.url));
            break;
        case "navigate": {
            const id = (await lastActiveTab()) ?? -1;
            if (id >= 0 && intent.args.url)
                await chrome.tabs.update(id, { url: String(intent.args.url) });
            break;
        }
        case "select_quality": {
            const sid = (await lastActiveTab()) ?? -1;
            const ss = getSession(sid);
            const top = rankCandidates(ss.dedup.list())[0];
            if (top) {
                const q = top.qualities.find((x) => x.label === String(intent.args.quality));
                if (q)
                    ss.selectedQuality = top.id + "|" + q.label;
            }
            break;
        }
    }
}
async function findTabByQuery(query) {
    if (!query)
        return null;
    const tabs = await chrome.tabs.query({});
    const q = query.toLowerCase();
    for (const t of tabs) {
        if (typeof t.id !== "number")
            continue;
        const hay = `${t.url ?? ""} ${t.title ?? ""}`.toLowerCase();
        if (hay.includes(q))
            return t.id;
    }
    return null;
}
// Context menu.
chrome.runtime.onInstalled.addListener(async () => {
    try {
        await chrome.contextMenus.removeAll();
        await chrome.contextMenus.create({
            id: "vsd-detect-page",
            title: "Detect video on this page",
            contexts: ["page", "video", "link"],
        });
        await chrome.contextMenus.create({
            id: "vsd-open",
            title: "Open detector",
            contexts: ["page", "video", "link"],
        });
    }
    catch {
        // ignore
    }
});
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
    if (!tab || typeof tab.id !== "number")
        return;
    if (info.menuItemId === "vsd-detect-page") {
        await startDetection(tab.id);
    }
    else if (info.menuItemId === "vsd-open") {
        await chrome.action.openPopup?.();
    }
});
// Keyboard shortcut.
chrome.commands.onCommand.addListener(async (command) => {
    if (command === "start_detection") {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab && typeof tab.id === "number")
            await startDetection(tab.id);
    }
});
//# sourceMappingURL=service-worker.js.map