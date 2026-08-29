import type { MediaCandidate, Confidence } from "../shared/types.js";
import type { RawHit } from "./detection/html5-detector.js";
import { scanMediaElements } from "./detection/html5-detector.js";
import { scanResourceTiming } from "./detection/resource-detector.js";
import { scanPlayerInstances } from "./detection/player-detector.js";
import { classifyContainer, classifyManifestType, classifyKind } from "../analysis/url-classifier.js";
import { normalizeUrl } from "../analysis/url-normalizer.js";
import { redactMetadata } from "../security/sanitize.js";
import type { DebugLogEntry } from "../shared/types.js";

// Content-script controller: runs detectors, builds candidates, monitors.
// Communicates with background via chrome.runtime ports/messages.

let monitoring = false;
let port: chrome.runtime.Port | null = null;
let observers: MutationObserver[] = [];
let interval: number | null = null;

function log(msg: string, level: DebugLogEntry["level"] = "info") {
  const entry: DebugLogEntry = { t: Date.now(), level, msg };
  try {
    (port ?? chrome.runtime.connect({ name: "vsd-content" })).postMessage({
      type: "CONTENT_DEBUG",
      entry,
    });
  } catch {
    // ignore
  }
}

function makeCandidate(hit: RawHit): MediaCandidate {
  const container = classifyContainer(hit.url, hit.mimeType);
  const manifestType = classifyManifestType(container);
  const kind = hit.kind !== "unknown" ? hit.kind : classifyKind(hit.mimeType, container);
  const norm = normalizeUrl(hit.url);
  const baseConfidence: Confidence =
    hit.detectionMethod === "media-element" || hit.detectionMethod === "player-instance"
      ? "high"
      : hit.detectionMethod === "source-element"
      ? "medium"
      : "low";

  const candidate: MediaCandidate = {
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

function collectAll(): RawHit[] {
  const hits: RawHit[] = [];
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

function buildCandidates(): MediaCandidate[] {
  const hits = collectAll();
  return hits.map(makeCandidate);
}

function postCandidates(candidates: MediaCandidate[]) {
  if (candidates.length === 0) return;
  try {
    (port ?? chrome.runtime.connect({ name: "vsd-content" })).postMessage({
      type: "CANDIDATE_BATCH",
      candidates,
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

// Continuous monitoring via observers + lightweight interval.
function startMonitoring() {
  if (monitoring) return;
  monitoring = true;
  log("Monitoring started");

  // Observe DOM mutations for dynamically inserted players/elements.
  const obs = new MutationObserver((mutations) => {
    let changed = false;
    for (const m of mutations) {
      if (m.addedNodes.length) changed = true;
    }
    if (changed) runOnce();
  });
  obs.observe(document.documentElement, { childList: true, subtree: true });
  observers.push(obs);

  // Some SPA players appear after interaction; periodic low-cost sweep.
  interval = window.setInterval(runOnce, 3000);
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
  switch ((msg as any).type) {
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

// Expose a tiny safe API for the page's own inspection if needed (no exec).
export {}; // marks as module
