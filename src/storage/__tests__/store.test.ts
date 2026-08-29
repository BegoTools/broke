import { describe, it, expect, beforeEach } from "vitest";
import { saveSettings, loadSettings } from "../store.js";

function makeStorage() {
  const data: Record<string, any> = {};
  (globalThis as any).chrome = {
    storage: {
      local: {
        get: (k: string | string[]) => {
          const keys = Array.isArray(k) ? k : [k];
          const out: any = {};
          for (const key of keys) if (key in data) out[key] = data[key];
          return Promise.resolve(out);
        },
        set: (obj: Record<string, any>) => {
          Object.assign(data, obj);
          return Promise.resolve();
        },
      },
    },
  };
  return data;
}

describe("store settings", () => {
  beforeEach(() => {
    makeStorage();
  });

  it("saves and loads a patch", async () => {
    const saved = await saveSettings({ geminiApiKey: "AIza-test-123", aiEnabled: true });
    expect(saved.geminiApiKey).toBe("AIza-test-123");
    const loaded = await loadSettings();
    expect(loaded.geminiApiKey).toBe("AIza-test-123");
    expect(loaded.aiEnabled).toBe(true);
  });

  it("merges with defaults", async () => {
    await saveSettings({ historyLimit: 25 });
    const loaded = await loadSettings();
    expect(loaded.historyLimit).toBe(25);
    expect(loaded.aiAutoAnnotate).toBe(true);
  });
});
