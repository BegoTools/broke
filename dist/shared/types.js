// Core domain types shared across content scripts, background, and popup.
// All data coming from the page is treated as UNTRUSTED input.
export const DEFAULT_SETTINGS = {
    detectionMode: "auto",
    preferredQuality: "highest",
    autoStartMonitoring: false,
    autoAttemptPlayback: true,
    showAdvanced: false,
    debugMode: false,
    historyLimit: 10,
    downloadFolderSet: false,
    notifications: false,
    privacyPolicyAck: false,
    geminiApiKey: "",
    aiEnabled: false,
    aiModel: "gemini-2.5-flash",
    aiAutoAnnotate: true,
};
//# sourceMappingURL=types.js.map