// Core domain types shared across content scripts, background, and popup.
// All data coming from the page is treated as UNTRUSTED input.

export type MediaKind = "video" | "audio" | "unknown";

export type ContainerType =
  | "mp4"
  | "webm"
  | "mov"
  | "m4v"
  | "mkv"
  | "ogg"
  | "hls"
  | "dash"
  | "smooth"
  | "other"
  | "unknown";

export type ManifestType = "hls" | "dash" | "smooth" | "none" | "unknown";

export type DetectionMethod =
  | "media-element"
  | "source-element"
  | "network-resource"
  | "player-instance"
  | "dom-config"
  | "iframe"
  | "unknown";

export type CandidateStatus =
  | "active"
  | "inactive"
  | "pending"
  | "protected"
  | "auth-required"
  | "unsupported";

export type Confidence = "high" | "medium" | "low" | "unknown";

export interface QualityVariant {
  label: string; // e.g. "1080p"
  height?: number; // vertical resolution if known
  bandwidth?: number; // bitrate bps if known
  codecs?: string;
  url?: string; // absolute URL for this variant when available
}

export interface MediaCandidate {
  id: string; // stable dedupe key
  kind: MediaKind;
  container: ContainerType;
  manifestType: ManifestType;
  rawUrl: string;
  normalizedUrl?: string;
  sourceUrl?: string; // page/frame URL where detected
  frameContext?: string; // "top" | frame url
  detectionMethod: DetectionMethod;
  status: CandidateStatus;
  confidence: Confidence;
  qualities: QualityVariant[];
  mimeType?: string;
  isEncrypted?: boolean; // DRM/encrypted signaling detected
  authRequired?: boolean; // suspected session/signature dependent
  warnings: string[];
  metadata: Record<string, string>; // safely exposed request/page metadata only
  timestamp: number;
  aiLabel?: string;
  aiSummary?: string;
}

export type MonitorState = "idle" | "monitoring" | "stopped" | "error";

export interface DebugLogEntry {
  t: number;
  level: "info" | "warn" | "error";
  msg: string;
}

export interface Settings {
  detectionMode: "auto" | "manual";
  preferredQuality: "highest" | "lowest" | "ask";
  autoStartMonitoring: boolean;
  autoAttemptPlayback: boolean;
  showAdvanced: boolean;
  debugMode: boolean;
  historyLimit: number; // 0 = off
  downloadFolderSet: boolean;
  notifications: boolean;
  privacyPolicyAck: boolean;
  geminiApiKey: string;
  aiEnabled: boolean;
  aiModel: string;
  aiAutoAnnotate: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
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

// Candidate sorting / ranking signals (computed, never fabricated).
export type RankSignal =
  | "validity"
  | "isVideo"
  | "resolution"
  | "compatibility"
  | "directness"
  | "active"
  | "noAuth"
  | "isManifest"
  | "confidence";

