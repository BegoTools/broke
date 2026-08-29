import type { Settings, DebugLogEntry, MediaCandidate } from "../shared/types.js";
import { DEFAULT_SETTINGS } from "../shared/types.js";

// Local-first storage (PLAN.md Section 25). No backend, no remote calls.
// Settings + debug logs persisted; history capped & privacy-friendly.

const SETTINGS_KEY = "vsd.settings";
const DEBUG_KEY = "vsd.debug";
const HISTORY_KEY = "vsd.history";

export async function loadSettings(): Promise<Settings> {
  const r = await chrome.storage.local.get(SETTINGS_KEY);
  const stored = (r[SETTINGS_KEY] as Partial<Settings>) || {};
  return { ...DEFAULT_SETTINGS, ...stored };
}

export async function saveSettings(patch: Partial<Settings>): Promise<Settings> {
  const current = await loadSettings();
  const next = { ...current, ...patch };
  await chrome.storage.local.set({ [SETTINGS_KEY]: next });
  return next;
}

export async function appendDebugLogs(entries: DebugLogEntry[]): Promise<void> {
  if (entries.length === 0) return;
  const r = await chrome.storage.local.get(DEBUG_KEY);
  const logs: DebugLogEntry[] = (r[DEBUG_KEY] as DebugLogEntry[]) || [];
  logs.push(...entries);
  // Cap log size to keep memory local & bounded.
  const trimmed = logs.slice(-500);
  await chrome.storage.local.set({ [DEBUG_KEY]: trimmed });
}

export async function loadDebugLogs(): Promise<DebugLogEntry[]> {
  const r = await chrome.storage.local.get(DEBUG_KEY);
  return (r[DEBUG_KEY] as DebugLogEntry[]) || [];
}

export async function clearDebugLogs(): Promise<void> {
  await chrome.storage.local.set({ [DEBUG_KEY]: [] });
}

export async function saveHistory(
  candidates: MediaCandidate[],
  limit: number
): Promise<void> {
  if (limit <= 0) {
    await chrome.storage.local.set({ [HISTORY_KEY]: [] });
    return;
  }
  const r = await chrome.storage.local.get(HISTORY_KEY);
  const history: MediaCandidate[][] = (r[HISTORY_KEY] as MediaCandidate[][]) || [];
  history.push(candidates);
  const trimmed = history.slice(-limit);
  await chrome.storage.local.set({ [HISTORY_KEY]: trimmed });
}
