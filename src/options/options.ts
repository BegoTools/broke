import type { Settings } from "../shared/types.js";
import { DEFAULT_SETTINGS } from "../shared/types.js";
import { saveSettings } from "../storage/store.js";

function $(id: string): HTMLElement {
  const el = document.getElementById(id);
  if (!el) throw new Error("missing #" + id);
  return el;
}

function load() {
  chrome.storage.local.get("vsd.settings", (r) => {
    const s: Settings = { ...DEFAULT_SETTINGS, ...(r["vsd.settings"] || {}) };
    bind(s);
  });
}

function readAll(): Partial<Settings> {
  const sel = (id: string) => ($(id) as HTMLSelectElement).value;
  const chk = (id: string) => ($(id) as HTMLInputElement).checked;
  return {
    detectionMode: sel("detectionMode") as Settings["detectionMode"],
    preferredQuality: sel("preferredQuality") as Settings["preferredQuality"],
    autoStartMonitoring: chk("autoStartMonitoring"),
    autoAttemptPlayback: chk("autoAttemptPlayback"),
    showAdvanced: chk("showAdvanced"),
    debugMode: chk("debugMode"),
    historyLimit: Number(sel("historyLimit")),
    notifications: chk("notifications"),
    geminiApiKey: ($("geminiApiKey") as HTMLInputElement).value,
    aiEnabled: chk("aiEnabled"),
    aiModel: sel("aiModel"),
    aiAutoAnnotate: chk("aiAutoAnnotate"),
  };
}

function saveAll() {
  saveSettings(readAll()).then(() => {
    ($("saved") as HTMLElement).textContent = "Saved ✓";
  });
}

function bind(s: Settings) {
  ($("detectionMode") as HTMLSelectElement).value = s.detectionMode;
  ($("preferredQuality") as HTMLSelectElement).value = s.preferredQuality;
  ($("autoStartMonitoring") as HTMLInputElement).checked = s.autoStartMonitoring;
  ($("autoAttemptPlayback") as HTMLInputElement).checked = s.autoAttemptPlayback;
  ($("showAdvanced") as HTMLInputElement).checked = s.showAdvanced;
  ($("debugMode") as HTMLInputElement).checked = s.debugMode;
  ($("historyLimit") as HTMLSelectElement).value = String(s.historyLimit);
  ($("notifications") as HTMLInputElement).checked = s.notifications;

  ($("geminiApiKey") as HTMLInputElement).value = s.geminiApiKey;
  ($("aiEnabled") as HTMLInputElement).checked = s.aiEnabled;
  ($("aiModel") as HTMLSelectElement).value = s.aiModel;
  ($("aiAutoAnnotate") as HTMLInputElement).checked = s.aiAutoAnnotate;

  // Explicit Save button (primary action).
  $("saveBtn").addEventListener("click", saveAll);

  // Also auto-save on change for convenience.
  const markSaved = () => (($("saved") as HTMLElement).textContent = "Saved ✓");
  const bindSelect = (id: string, key: keyof Settings) => {
    $(id).addEventListener("change", () => {
      const v = ($(id) as HTMLSelectElement).value;
      saveSettings({ [key]: key === "historyLimit" ? Number(v) : v } as Partial<Settings>).then(markSaved);
    });
  };
  bindSelect("detectionMode", "detectionMode");
  bindSelect("preferredQuality", "preferredQuality");
  bindSelect("historyLimit", "historyLimit");
  bindSelect("aiModel", "aiModel");

  const bindCheck = (id: string, key: keyof Settings) => {
    $(id).addEventListener("change", () => {
      const v = ($(id) as HTMLInputElement).checked;
      saveSettings({ [key]: v } as Partial<Settings>).then(markSaved);
    });
  };
  ["autoStartMonitoring", "autoAttemptPlayback", "showAdvanced", "debugMode", "notifications",
   "aiEnabled", "aiAutoAnnotate"].forEach((id) => bindCheck(id, id as keyof Settings));

  ($("geminiApiKey") as HTMLInputElement).addEventListener("change", () => {
    saveSettings({ geminiApiKey: ($("geminiApiKey") as HTMLInputElement).value } as Partial<Settings>).then(markSaved);
  });
}

load();
