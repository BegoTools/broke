import { saveSettings, loadSettings } from "./src/storage/store.ts";

const data = {};
globalThis.chrome = {
  storage: {
    local: {
      get: (k) => { const keys = Array.isArray(k) ? k : [k]; const o = {}; for (const x of keys) if (x in data) o[x] = data[x]; return Promise.resolve(o); },
      set: (obj) => { Object.assign(data, obj); return Promise.resolve(); },
    },
  },
};

// Simulate the popup Save button: save key + enable AI.
await saveSettings({ geminiApiKey: "AIza-REALKEY-999", aiEnabled: true });
const loaded = await loadSettings();
console.log("PERSISTED KEY:", loaded.geminiApiKey);
console.log("AI ENABLED:", loaded.aiEnabled);
console.log("RESULT:", loaded.geminiApiKey === "AIza-REALKEY-999" && loaded.aiEnabled === true ? "SUCCESS" : "FAILED");
