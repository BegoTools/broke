"use strict";
(() => {
  // src/content/detection/html5-detector.ts
  function scanMediaElements(doc = document) {
    const hits = [];
    const elements = Array.from(doc.querySelectorAll("video, audio"));
    for (const el of elements) {
      const kind = el.tagName === "VIDEO" ? "video" : el.tagName === "AUDIO" ? "audio" : "unknown";
      if (el.currentSrc) {
        hits.push(buildHit(el.currentSrc, kind, "media-element", el, doc));
      }
      const sources = Array.from(el.querySelectorAll("source"));
      for (const s of sources) {
        const src = s.getAttribute("src") || "";
        if (src) {
          const abs = toAbsolute(src, doc);
          if (abs) hits.push(buildHit(abs, kind, "source-element", el, doc, s.getAttribute("type") || void 0));
        }
      }
      const srcAttr = el.getAttribute("src");
      if (srcAttr && /^blob:/i.test(srcAttr)) {
        hits.push(buildHit(srcAttr, kind, "media-element", el, doc, el.getAttribute("type") || void 0));
      }
    }
    return hits;
  }
  function buildHit(url, kind, method, el, doc, mimeType) {
    const meta = {
      tagName: el.tagName,
      readyState: String(el.readyState),
      networkState: String(el.networkState),
      currentTime: el.currentTime ? el.currentTime.toFixed(1) : "0"
    };
    const v = el;
    if (typeof v.videoWidth === "number") {
      if (v.videoWidth) meta.width = String(v.videoWidth);
      if (v.videoHeight) meta.height = String(v.videoHeight);
    }
    if (el.duration && isFinite(el.duration)) meta.duration = el.duration.toFixed(1);
    if (el.paused !== void 0) meta.paused = String(el.paused);
    const pageUrl = doc.location?.href;
    return {
      url,
      kind,
      detectionMethod: method,
      mimeType,
      sourceUrl: pageUrl,
      frameContext: doc === document ? "top" : pageUrl,
      metadata: meta
    };
  }
  function toAbsolute(url, doc) {
    try {
      return new URL(url, doc.baseURI).toString();
    } catch {
      return url;
    }
  }

  // src/content/detection/resource-detector.ts
  function scanResourceTiming() {
    const hits = [];
    let entries = [];
    try {
      entries = performance.getEntriesByType(
        "resource"
      );
    } catch {
      return hits;
    }
    for (const e of entries) {
      const url = e.name;
      if (!looksLikeMedia(url)) continue;
      hits.push({
        url,
        kind: "unknown",
        detectionMethod: "network-resource",
        sourceUrl: location.href,
        frameContext: "top",
        metadata: {
          initiatorType: e.initiatorType || "unknown",
          transferSize: e.transferSize ? String(e.transferSize) : "0"
        }
      });
    }
    return hits;
  }
  function looksLikeMedia(url) {
    const u = url.toLowerCase();
    return u.includes(".m3u8") || u.includes(".mpd") || u.includes(".mp4") || u.includes(".webm") || u.includes(".m4v") || u.includes(".m4a") || u.includes(".mov") || u.includes(".ogg") || u.includes(".ogv") || u.includes(".ism") || u.includes("manifest") || u.includes("playlist") || /\.(mp4|webm|m4v|m4a|mov|ogv|oga|ogg|m3u8|mpd)(\?|$)/.test(u);
  }

  // src/content/detection/player-detector.ts
  function scanPlayerInstances() {
    const hits = [];
    const globals = [
      { name: "hls.js", expr: "window.hls", getter: () => window.hls },
      { name: "Hls", expr: "window.Hls", getter: () => window.Hls },
      { name: "dashjs", expr: "window.dashjs", getter: () => window.dashjs },
      { name: "Dash", expr: "window.Dash", getter: () => window.Dash },
      { name: "videojs", expr: "window.videojs", getter: () => window.videojs },
      { name: "jwplayer", expr: "window.jwplayer", getter: () => window.jwplayer }
    ];
    for (const g of globals) {
      try {
        const obj = g.getter();
        if (!obj) continue;
        const url = extractUrlFromPlayer(g.name, obj);
        if (url) {
          hits.push({
            url,
            kind: "video",
            detectionMethod: "player-instance",
            sourceUrl: location.href,
            frameContext: "top",
            metadata: { player: g.name }
          });
        }
      } catch {
      }
    }
    const cfg = readWindowConfig();
    if (cfg) {
      for (const url of extractUrlsFromText(cfg)) {
        hits.push({
          url,
          kind: "video",
          detectionMethod: "dom-config",
          sourceUrl: location.href,
          frameContext: "top",
          metadata: { source: "window-config" }
        });
      }
    }
    return hits;
  }
  function extractUrlFromPlayer(name, obj) {
    try {
      if (name === "hls.js") {
        const o = obj;
        if (o && o.url) return String(o.url);
        if (o && o.levels && o.levels[0] && o.levels[0].url) return String(o.levels[0].url);
      }
      if (name === "videojs") {
        const players = obj;
        if (players && players.players) {
          const first = Object.values(players.players)[0];
          if (first && first.currentSrc) return String(first.currentSrc());
        }
      }
    } catch {
      return null;
    }
    return null;
  }
  function readWindowConfig() {
    try {
      for (const key of ["__PLAYER_CONFIG__", "playerConfig", "mediaConfig", "__NEXT_DATA__"]) {
        const v = window[key];
        if (v) return JSON.stringify(v).slice(0, 2e4);
      }
    } catch {
      return null;
    }
    return null;
  }
  function extractUrlsFromText(text) {
    const re = /https?:\/\/[^\s"'<>]+/gi;
    const out = /* @__PURE__ */ new Set();
    let m;
    while (m = re.exec(text)) {
      out.add(m[0]);
    }
    return Array.from(out).filter(
      (u) => /\.(mp4|webm|m4v|m4a|mov|ogv|oga|ogg|m3u8|mpd)(\?|$)|manifest|playlist/i.test(u)
    );
  }

  // src/analysis/url-classifier.ts
  function classifyContainer(url, mime) {
    const u = safeUrl(url);
    const path = u ? u.pathname.toLowerCase() : url.toLowerCase();
    const q = u ? u.search.toLowerCase() : "";
    if (mime) {
      const m = mime.toLowerCase();
      if (m.includes("mpegurl") || m === "application/x-mpegurl") return "hls";
      if (m.includes("dash+xml") || m === "application/dash+xml") return "dash";
      if (m.includes("mp4") || m.includes("mpeg")) return "mp4";
      if (m.includes("webm")) return "webm";
      if (m.includes("ogg")) return "ogg";
      if (m.includes("quicktime")) return "mov";
      if (m.startsWith("audio/")) return "other";
      if (m.startsWith("video/")) {
        if (m.includes("mp4")) return "mp4";
        if (m.includes("webm")) return "webm";
        if (m.includes("ogg")) return "ogg";
        return "other";
      }
    }
    if (path.endsWith(".m3u8") || path.endsWith(".m3u") || q.includes("m3u8") || /\.m3u8($|\?)/.test(path))
      return "hls";
    if (path.endsWith(".mpd") || q.includes(".mpd") || /\.mpd($|\?)/.test(path))
      return "dash";
    if (path.endsWith(".ism") || path.endsWith(".isml") || path.includes(".ism/") || path.includes(".isml/"))
      return "smooth";
    if (path.endsWith(".mp4") || path.endsWith(".m4v") || path.endsWith(".m4a")) return "mp4";
    if (path.endsWith(".webm")) return "webm";
    if (path.endsWith(".mov")) return "mov";
    if (path.endsWith(".mkv")) return "mkv";
    if (path.endsWith(".ogv") || path.endsWith(".oga") || path.endsWith(".ogg")) return "ogg";
    if (path.includes("/manifest") && (path.includes("smooth") || path.includes("ss(")))
      return "smooth";
    if (q.includes("manifest") || q.includes("playlist")) return "hls";
    return "unknown";
  }
  function classifyManifestType(container) {
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
  function classifyKind(mime, container) {
    if (mime) {
      const m = mime.toLowerCase();
      if (m.startsWith("audio/")) return "audio";
      if (m.startsWith("video/")) return "video";
    }
    if (container && (container === "mp3" || container === "ogg")) {
    }
    return "unknown";
  }
  function safeUrl(url) {
    try {
      return new URL(url);
    } catch {
      return null;
    }
  }

  // src/analysis/url-normalizer.ts
  var PROTECTED_PARAM_KEYS = /* @__PURE__ */ new Set([
    "token",
    "tokens",
    "auth",
    "auth_token",
    "authorization",
    "authorization_token",
    "signature",
    "sig",
    "sign",
    "s",
    "exp",
    "expires",
    "expiry",
    "expiration",
    "session",
    "sessionid",
    "sid",
    "access_token",
    "id_token",
    "policy",
    "key",
    "hmac",
    "hmacsha256",
    "ts",
    "t",
    "nonce",
    "st",
    "cdntoken",
    "token_",
    "accesskey",
    "ak",
    "sk",
    "hash",
    "verify",
    "captcha",
    "otp",
    "code",
    "state",
    "client_id",
    "client_secret",
    "apikey",
    "api_key",
    "appkey",
    "x-amz-security-token",
    "x-amz-signature",
    "x-amz-date",
    "x-goog-signature",
    "x-goog-date"
  ]);
  function isProtectedKey(key) {
    const k = key.toLowerCase();
    if (PROTECTED_PARAM_KEYS.has(k)) return true;
    return k.includes("token") || k.includes("signature") || k.includes("sign") || k.includes("auth") || k.includes("session") || k.includes("secret") || k.includes("expir") || k.includes("hmac") || k.includes("credential");
  }
  function normalizeUrl(rawUrl) {
    let url;
    try {
      url = new URL(rawUrl);
    } catch {
      return { normalizedUrl: void 0, removed: [], preservedProtected: [] };
    }
    const removed = [];
    const preservedProtected = [];
    for (const key of Array.from(url.searchParams.keys())) {
      if (isProtectedKey(key)) {
        preservedProtected.push(key);
        continue;
      }
    }
    const STRIP = [
      "utm_source",
      "utm_medium",
      "utm_campaign",
      "utm_term",
      "utm_content",
      "fbclid",
      "gclid",
      "mc_cid",
      "mc_eid",
      "ref",
      "ref_src",
      "feature",
      "spm",
      "from",
      "app",
      "_",
      "t",
      "cachebust",
      "cb"
    ];
    for (const key of STRIP) {
      if (url.searchParams.has(key)) {
        url.searchParams.delete(key);
        removed.push(key);
      }
    }
    if (url.search === "?") url.search = "";
    const normalized = url.toString();
    return {
      normalizedUrl: normalized === rawUrl ? void 0 : normalized,
      removed,
      preservedProtected
    };
  }

  // src/security/sanitize.ts
  var SECRET_KEY_RE = /(authorization|auth[-_]?token|access[-_]?token|refresh[-_]?token|bearer|session[-_]?id|sessionid|cookie|set[-_]?cookie|csrf|xsrf|password|passwd|secret|api[-_]?key|apikey|private[-_]?key|x-amz-security-token|id[-_]?token|client[-_]?secret)/i;
  function looksLikeSecretKey(key) {
    return SECRET_KEY_RE.test(key);
  }
  function redactMetadata(meta) {
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
  function looksLikeSecretValue(v) {
    if (/^[A-Za-z0-9_-]{32,}$/.test(v)) return true;
    if (/^eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(v)) return true;
    return false;
  }

  // src/content/content-script.ts
  var monitoring = false;
  var port = null;
  var observers = [];
  var interval = null;
  function log(msg, level = "info") {
    const entry = { t: Date.now(), level, msg };
    try {
      (port ?? chrome.runtime.connect({ name: "vsd-content" })).postMessage({
        type: "CONTENT_DEBUG",
        entry
      });
    } catch {
    }
  }
  function makeCandidate(hit) {
    const container = classifyContainer(hit.url, hit.mimeType);
    const manifestType = classifyManifestType(container);
    const kind = hit.kind !== "unknown" ? hit.kind : classifyKind(hit.mimeType, container);
    const norm = normalizeUrl(hit.url);
    const baseConfidence = hit.detectionMethod === "media-element" || hit.detectionMethod === "player-instance" ? "high" : hit.detectionMethod === "source-element" ? "medium" : "low";
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
      timestamp: Date.now()
    };
    candidate.id = `${candidate.detectionMethod}:${candidate.rawUrl}`;
    return candidate;
  }
  function collectAll() {
    const hits = [];
    try {
      hits.push(...scanMediaElements(document));
    } catch (e) {
      log(`media-element scan error: ${String(e)}`, "warn");
    }
    try {
      hits.push(...scanResourceTiming());
    } catch (e) {
      log(`resource scan error: ${String(e)}`, "warn");
    }
    try {
      hits.push(...scanPlayerInstances());
    } catch (e) {
      log(`player scan error: ${String(e)}`, "warn");
    }
    return hits;
  }
  function buildCandidates() {
    const hits = collectAll();
    return hits.map(makeCandidate);
  }
  function postCandidates(candidates) {
    if (candidates.length === 0) return;
    try {
      (port ?? chrome.runtime.connect({ name: "vsd-content" })).postMessage({
        type: "CANDIDATE_BATCH",
        candidates
      });
    } catch (e) {
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
  function startMonitoring() {
    if (monitoring) return;
    monitoring = true;
    log("Monitoring started");
    const obs = new MutationObserver((mutations) => {
      let changed = false;
      for (const m of mutations) {
        if (m.addedNodes.length) changed = true;
      }
      if (changed) runOnce();
    });
    obs.observe(document.documentElement, { childList: true, subtree: true });
    observers.push(obs);
    interval = window.setInterval(runOnce, 3e3);
    runOnce();
  }
  function stopMonitoring() {
    if (!monitoring) return;
    monitoring = false;
    log("Monitoring stopped");
    for (const o of observers) o.disconnect();
    observers = [];
    if (interval !== null) {
      clearInterval(interval);
      interval = null;
    }
  }
  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (!msg || typeof msg !== "object") return;
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
})();
