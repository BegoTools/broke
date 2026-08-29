// Message protocol between popup <-> background <-> content script.
import type {
  MediaCandidate,
  MonitorState,
  DebugLogEntry,
  Settings,
} from "./types.js";

export type FromPopup =
  | { type: "START_DETECTION"; tabId: number }
  | { type: "STOP_DETECTION" }
  | { type: "GET_STATE" }
  | { type: "GET_CANDIDATES" }
  | { type: "GET_DEBUG_LOGS" }
  | { type: "CLEAR_DEBUG_LOGS" }
  | { type: "GET_SETTINGS" }
  | { type: "UPDATE_SETTINGS"; settings: Partial<Settings> }
  | { type: "DOWNLOAD_URL"; url: string; filename?: string }
  | { type: "OPEN_URL"; url: string }
  | { type: "AI_ANNOTATE" }
  | { type: "AI_CHAT"; prompt: string };

export type FromBackground =
  | { type: "STATE"; state: MonitorState; tabId?: number; pageUrl?: string }
  | { type: "CANDIDATES"; candidates: MediaCandidate[]; full: boolean }
  | { type: "DEBUG_LOGS"; logs: DebugLogEntry[] }
  | { type: "SETTINGS"; settings: Settings }
  | { type: "STATUS_MESSAGE"; message: string }
  | { type: "ERROR"; message: string }
  | { type: "AI_ANNOTATIONS"; annotations: Array<{ id: string; label: string; summary: string }> }
  | { type: "AI_CHAT_REPLY"; reply: string; toolCalls?: Array<{ name: string; args: Record<string, unknown> }> }
  | { type: "AI_STATUS"; message: string };

// Content script -> background (streamed detection results).
export type FromContent =
  | { type: "CANDIDATE_BATCH"; candidates: MediaCandidate[] }
  | { type: "CONTENT_DEBUG"; entry: DebugLogEntry }
  | { type: "CONTENT_STATUS"; status: MonitorState; message?: string };

