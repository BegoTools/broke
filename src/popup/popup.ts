import type { MediaCandidate, MonitorState, DebugLogEntry, Settings } from "../shared/types.js";
import type { FromBackground } from "../shared/messages.js";
import { escapeHtml, isSafeUrl } from "../security/sanitize.js";
import { bestPlaybackUrl } from "../analysis/ranker.js";

// Popup UI controller.
let port: chrome.runtime.Port | null = null;
let candidates: MediaCandidate[] = [];
let debugLogs: DebugLogEntry[] = [];
let settings: Settings | null = null;
let advancedOpen = false;
let selectedQualityId = new Map<string, string>(); // candidateId -> quality label

function $(id: string): HTMLElement {
  const el = document.getElementById(id);
  if (!el) throw new Error(`missing #${id}`);
  return el;
}

function connect() {
  port = chrome.runtime.connect({ name: "vsd-popup" });
  port.onMessage.addListener((msg: FromBackground) => handleBg(msg));
  port.postMessage({ type: "GET_STATE" });
  port.postMessage({ type: "GET_CANDIDATES" });
  port.postMessage({ type: "GET_DEBUG_LOGS" });
  port.postMessage({ type: "GET_SETTINGS" });
}

function handleBg(msg: FromBackground) {
  switch (msg.type) {
    case "STATE":
      setMonitorState(msg.state, msg.pageUrl);
      break;
    case "CANDIDATES":
      candidates = msg.candidates;
      renderCards();
      break;
    case "DEBUG_LOGS":
      debugLogs = msg.logs;
      renderDebug();
      break;
    case "SETTINGS":
      settings = msg.settings;
      applySettingsToForm();
      break;
    case "STATUS_MESSAGE":
      setStatus(msg.message, false);
      break;
    case "ERROR":
      setStatus(msg.message, true);
      break;
    case "AI_ANNOTATIONS":
      applyAiAnnotations(msg.annotations);
      break;
    case "AI_CHAT_REPLY":
      appendChat("AI", msg.reply || "(done)");
      break;
    case "AI_STATUS":
      setAiStatus(msg.message);
      break;
  }
}

function setMonitorState(state: MonitorState, pageUrl?: string) {
  const badge = $("monitorBadge");
  badge.textContent = state === "monitoring" ? "Monitoring" : state.charAt(0).toUpperCase() + state.slice(1);
  badge.className = "badge badge-" + state;
  ($("startBtn") as HTMLButtonElement).disabled = state === "monitoring";
  ($("stopBtn") as HTMLButtonElement).disabled = state !== "monitoring";
  if (pageUrl) $("pageUrl").textContent = pageUrl;
  if (state === "monitoring") setStatus("Monitoring page for video activity…", false);
  if (state === "stopped") setStatus("Stopped. Results preserved for copy/open.", false);
}

function setStatus(msg: string, isError: boolean) {
  const el = $("statusMessage");
  el.textContent = msg;
  el.className = "status-msg" + (isError ? " error" : "");
}

function currentTabId(): Promise<number | null> {
  return new Promise((res) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      res(tabs[0] && typeof tabs[0].id === "number" ? tabs[0].id : null);
    });
  });
}

function renderCards() {
  const wrap = $("cards");
  (($("sourceCount") as HTMLElement)).textContent = String(candidates.length);
  wrap.innerHTML = "";
  const empty = $("emptyHint") as HTMLElement;
  empty.hidden = candidates.length > 0;

  for (const c of candidates) {
    wrap.appendChild(buildCard(c));
  }
}

function buildCard(c: MediaCandidate): HTMLElement {
  const card = document.createElement("div");
  card.className = "card";

  const top = document.createElement("div");
  top.className = "card-top";
  const title = document.createElement("div");
  title.className = "card-title";
  const qCount = c.qualities.length;
  title.textContent = qCount > 0 ? `${c.qualities[0].label} ${c.container.toUpperCase()}` : c.container.toUpperCase();
  const sub = document.createElement("div");
  sub.className = "card-sub";
  sub.textContent = `${c.detectionMethod} · ${c.status}`;
  const headLeft = document.createElement("div");
  headLeft.appendChild(title);
  headLeft.appendChild(sub);
  const conf = document.createElement("span");
  conf.className = "conf conf-" + c.confidence;
  conf.textContent = "Conf: " + c.confidence;
  top.appendChild(headLeft);
  top.appendChild(conf);
  card.appendChild(top);

  // Qualities
  if (qCount > 0) {
    const qs = document.createElement("div");
    qs.className = "qualities";
    const sorted = [...c.qualities].sort((a, b) => (b.height ?? 0) - (a.height ?? 0));
    const selLabel = selectedQualityId.get(c.id) ?? sorted[0].label;
    for (const q of sorted) {
      const chip = document.createElement("span");
      chip.className = "q-chip" + (q.label === selLabel ? " selected" : "");
      chip.textContent = q.label;
      chip.title = `${q.codecs ? "codecs: " + q.codecs : ""}${q.bandwidth ? " · " + Math.round(q.bandwidth / 1000) + "kbps" : ""}`;
      chip.onclick = () => {
        selectedQualityId.set(c.id, q.label);
        renderCards();
      };
      qs.appendChild(chip);
    }
    card.appendChild(qs);
  }

  // Actions
  const actions = document.createElement("div");
  actions.className = "card-actions";
  actions.appendChild(actionBtn("Copy Raw", () => copy(c.rawUrl)));
  if (c.normalizedUrl) actions.appendChild(actionBtn("Copy Clean", () => copy(c.normalizedUrl!)));
  actions.appendChild(actionBtn("Open", () => openUrl(bestPlaybackUrl(c))));
  actions.appendChild(actionBtn("Download", () => download(c)));
  card.appendChild(actions);

  // Advanced meta
  // AI label/summary badge
  if (c.aiLabel) {
    const badge = document.createElement("div");
    badge.className = "ai-badge";
    badge.textContent = "AI: " + c.aiLabel;
    card.appendChild(badge);
  }
  if (c.aiSummary) {
    const sum = document.createElement("div");
    sum.className = "ai-summary";
    sum.textContent = c.aiSummary;
    card.appendChild(sum);
  }

  if (settings?.showAdvanced || advancedOpen) {
    const meta = document.createElement("div");
    meta.className = "meta";
    meta.innerHTML =
      `Raw: <code>${escapeHtml(c.rawUrl)}</code>` +
      (c.normalizedUrl ? `Cleaned: <code>${escapeHtml(c.normalizedUrl)}</code>` : "") +
      `MIME: ${escapeHtml(c.mimeType || "unknown")} · Frame: ${escapeHtml(c.frameContext || "top")}`;
    card.appendChild(meta);
    if (c.warnings.length) {
      for (const w of c.warnings) {
        const wEl = document.createElement("div");
        wEl.className = "warn" + (c.status === "protected" ? " protected" : "");
        wEl.textContent = "⚠ " + w;
        card.appendChild(wEl);
      }
    }
  }
  return card;
}

function actionBtn(label: string, fn: () => void): HTMLButtonElement {
  const b = document.createElement("button");
  b.className = "btn";
  b.textContent = label;
  b.onclick = fn;
  return b;
}

async function copy(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    setStatus("Copied to clipboard.", false);
  } catch {
    setStatus("Clipboard unavailable in this context.", true);
  }
}

function openUrl(url: string) {
  if (!isSafeUrl(url)) return setStatus("Refusing to open unsafe URL.", true);
  port?.postMessage({ type: "OPEN_URL", url });
}

function download(c: MediaCandidate) {
  const url = bestPlaybackUrl(c);
  if (!isSafeUrl(url)) return setStatus("Refusing to download unsafe URL.", true);
  port?.postMessage({ type: "DOWNLOAD_URL", url });
}

function renderDebug() {
  const el = $("debugLog");
  el.textContent = debugLogs
    .slice(-200)
    .map((l) => `[${new Date(l.t).toTimeString().slice(0, 8)}] ${l.level.toUpperCase()} ${l.msg}`)
    .join("\n");
}

function applyAiAnnotations(annotations: Array<{ id: string; label: string; summary: string }>) {
  for (const a of annotations) {
    const c = candidates.find((x) => x.id === a.id);
    if (c) {
      c.aiLabel = a.label;
      c.aiSummary = a.summary;
    }
  }
  renderCards();
}

function appendChat(who: string, text: string) {
  const el = $("aiTranscript");
  const time = new Date().toTimeString().slice(0, 8);
  el.textContent = (el.textContent ? el.textContent + "\n" : "") + `[${time}] ${who}: ${text}`;
  el.scrollTop = el.scrollHeight;
}

function setAiStatus(text: string) {
  ($("aiStatus") as HTMLElement).textContent = text;
}

function applySettingsToForm() {
  if (!settings) return;
  ($("set_mode") as HTMLSelectElement).value = settings.detectionMode;
  ($("set_quality") as HTMLSelectElement).value = settings.preferredQuality;
  ($("set_autoStart") as HTMLInputElement).checked = settings.autoStartMonitoring;
  ($("set_autoPlay") as HTMLInputElement).checked = settings.autoAttemptPlayback;
  ($("set_debug") as HTMLInputElement).checked = settings.debugMode;
  ($("set_history") as HTMLSelectElement).value = String(settings.historyLimit);
}

// Wire controls
async function wire() {
  $("startBtn").onclick = async () => {
    const tabId = await currentTabId();
    if (tabId === null) return setStatus("No active tab found.", true);
    setStatus("Starting detection…", false);
    port?.postMessage({ type: "START_DETECTION", tabId });
  };
  $("stopBtn").onclick = () => port?.postMessage({ type: "STOP_DETECTION" });

  $("advancedToggle").onclick = () => {
    advancedOpen = !advancedOpen;
    ($("advancedPanel") as HTMLElement).hidden = !advancedOpen;
    $("advancedToggle").textContent = advancedOpen ? "Hide Advanced" : "Advanced Mode";
    renderCards();
  };
  $("debugTab").onclick = () => switchTab("debug");
  $("settingsTab").onclick = () => switchTab("settings");
  $("aiTab").onclick = () => switchTab("ai");
  $("aiAnnotate").onclick = () => port?.postMessage({ type: "AI_ANNOTATE" });
  $("aiSend").onclick = () => sendChat();
  loadAiKey();
  const aiSaveBtn = document.getElementById("aiSaveKey");
  if (aiSaveBtn) {
    (aiSaveBtn as HTMLButtonElement).onclick = async () => {
      const keyInput = document.getElementById("aiApiKey") as HTMLInputElement;
      const key = (keyInput?.value || "").trim();
      const patch = { geminiApiKey: key } as Partial<Settings>;
      if (key) (patch as any).aiEnabled = true;
      port?.postMessage({ type: "UPDATE_SETTINGS", settings: patch });
      try { const m = await import("../storage/store.js"); await m.saveSettings(patch); } catch {}
      const st = document.getElementById("aiKeyStatus");
      if (st) st.textContent = key ? "Key saved in this extension." : "Key cleared.";
    };
  }
  function loadAiKey() {
    import("../storage/store.js").then(async (m) => {
      const s = await m.loadSettings();
      const keyInput = document.getElementById("aiApiKey") as HTMLInputElement;
      if (keyInput) keyInput.value = s.geminiApiKey || "";
      const st = document.getElementById("aiKeyStatus");
      if (st && s.geminiApiKey) st.textContent = "Key is stored.";
    }).catch(() => {});
  }
  ($("aiPrompt") as HTMLInputElement).addEventListener("keydown", (e) => { if (e.key === "Enter") sendChat(); });
  $("clearLogs").onclick = () => port?.postMessage({ type: "CLEAR_DEBUG_LOGS" });
  $("exportLogs").onclick = () => exportLogs();

  bindSetting("set_mode", "detectionMode");
  bindSetting("set_quality", "preferredQuality");
  bindSetting("set_history", "historyLimit");
  bindCheck("set_autoStart", "autoStartMonitoring");
  bindCheck("set_autoPlay", "autoAttemptPlayback");
  bindCheck("set_debug", "debugMode");
}

function switchTab(which: "debug" | "settings" | "ai") {
  ($("debugPanel") as HTMLElement).hidden = which !== "debug";
  ($("settingsPanel") as HTMLElement).hidden = which !== "settings";
  ($("aiPanel") as HTMLElement).hidden = which !== "ai";
  ($("debugTab") as HTMLElement).classList.toggle("active", which === "debug");
  ($("settingsTab") as HTMLElement).classList.toggle("active", which === "settings");
  ($("aiTab") as HTMLElement).classList.toggle("active", which === "ai");
}

function sendChat() {
  const input = $("aiPrompt") as HTMLInputElement;
  const text = input.value.trim();
  if (!text) return;
  appendChat("You", text);
  input.value = "";
  setAiStatus("Thinking…");
  port?.postMessage({ type: "AI_CHAT", prompt: text });
}

function bindSetting(id: string, key: keyof Settings) {
  $(id).addEventListener("change", () => {
    const v = ($(id) as HTMLSelectElement).value;
    const patch: Partial<Settings> = {};
    (patch as any)[key] = key === "historyLimit" ? Number(v) : v;
    port?.postMessage({ type: "UPDATE_SETTINGS", settings: patch });
  });
}
function bindCheck(id: string, key: keyof Settings) {
  $(id).addEventListener("change", () => {
    const v = ($(id) as HTMLInputElement).checked;
    port?.postMessage({ type: "UPDATE_SETTINGS", settings: { [key]: v } as Partial<Settings> });
  });
}

function exportLogs() {
  const blob = new Blob([debugLogs.map((l) => `${new Date(l.t).toISOString()} ${l.level} ${l.msg}`).join("\n")], {
    type: "text/plain",
  });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "vsd-debug.log";
  a.click();
  URL.revokeObjectURL(a.href);
}

connect();
wire();
