import { DEFAULT_SETTINGS } from "../shared/types.js";
import { saveSettings } from "../storage/store.js";
function $(id) {
    const el = document.getElementById(id);
    if (!el)
        throw new Error("missing #" + id);
    return el;
}
function load() {
    chrome.storage.local.get("vsd.settings", (r) => {
        const s = { ...DEFAULT_SETTINGS, ...(r["vsd.settings"] || {}) };
        bind(s);
    });
}
function readAll() {
    const sel = (id) => $(id).value;
    const chk = (id) => $(id).checked;
    return {
        detectionMode: sel("detectionMode"),
        preferredQuality: sel("preferredQuality"),
        autoStartMonitoring: chk("autoStartMonitoring"),
        autoAttemptPlayback: chk("autoAttemptPlayback"),
        showAdvanced: chk("showAdvanced"),
        debugMode: chk("debugMode"),
        historyLimit: Number(sel("historyLimit")),
        notifications: chk("notifications"),
        geminiApiKey: $("geminiApiKey").value,
        aiEnabled: chk("aiEnabled"),
        aiModel: sel("aiModel"),
        aiAutoAnnotate: chk("aiAutoAnnotate"),
    };
}
function saveAll() {
    saveSettings(readAll()).then(() => {
        $("saved").textContent = "Saved ✓";
    });
}
function bind(s) {
    $("detectionMode").value = s.detectionMode;
    $("preferredQuality").value = s.preferredQuality;
    $("autoStartMonitoring").checked = s.autoStartMonitoring;
    $("autoAttemptPlayback").checked = s.autoAttemptPlayback;
    $("showAdvanced").checked = s.showAdvanced;
    $("debugMode").checked = s.debugMode;
    $("historyLimit").value = String(s.historyLimit);
    $("notifications").checked = s.notifications;
    $("geminiApiKey").value = s.geminiApiKey;
    $("aiEnabled").checked = s.aiEnabled;
    $("aiModel").value = s.aiModel;
    $("aiAutoAnnotate").checked = s.aiAutoAnnotate;
    // Explicit Save button (primary action).
    $("saveBtn").addEventListener("click", saveAll);
    // Also auto-save on change for convenience.
    const markSaved = () => ($("saved").textContent = "Saved ✓");
    const bindSelect = (id, key) => {
        $(id).addEventListener("change", () => {
            const v = $(id).value;
            saveSettings({ [key]: key === "historyLimit" ? Number(v) : v }).then(markSaved);
        });
    };
    bindSelect("detectionMode", "detectionMode");
    bindSelect("preferredQuality", "preferredQuality");
    bindSelect("historyLimit", "historyLimit");
    bindSelect("aiModel", "aiModel");
    const bindCheck = (id, key) => {
        $(id).addEventListener("change", () => {
            const v = $(id).checked;
            saveSettings({ [key]: v }).then(markSaved);
        });
    };
    ["autoStartMonitoring", "autoAttemptPlayback", "showAdvanced", "debugMode", "notifications",
        "aiEnabled", "aiAutoAnnotate"].forEach((id) => bindCheck(id, id));
    $("geminiApiKey").addEventListener("change", () => {
        saveSettings({ geminiApiKey: $("geminiApiKey").value }).then(markSaved);
    });
}
load();
//# sourceMappingURL=options.js.map