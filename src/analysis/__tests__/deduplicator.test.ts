import { describe, it, expect } from "vitest";
import { Deduplicator } from "../deduplicator.js";
import type { MediaCandidate } from "../../shared/types.js";

function cand(url: string, extra: Partial<MediaCandidate> = {}): MediaCandidate {
  return {
    id: "m:" + url,
    kind: "video",
    container: "mp4",
    manifestType: "none",
    rawUrl: url,
    detectionMethod: "media-element",
    status: "active",
    confidence: "high",
    qualities: [],
    warnings: [],
    metadata: {},
    timestamp: 1,
    ...extra,
  };
}

describe("deduplicator", () => {
  it("adds distinct urls", () => {
    const d = new Deduplicator();
    const r = d.addBatch([cand("https://x.com/a.mp4"), cand("https://x.com/b.mp4")]);
    expect(r.added).toBe(2);
    expect(d.list().length).toBe(2);
  });
  it("merges duplicate urls (tracking variants)", () => {
    const d = new Deduplicator();
    d.add(cand("https://x.com/a.mp4"));
    const r = d.add(cand("https://x.com/a.mp4?utm_source=x"));
    expect(r.merged).toBe(true);
    expect(d.list().length).toBe(1);
  });
  it("accumulates qualities on merge", () => {
    const d = new Deduplicator();
    d.add(cand("https://x.com/m.m3u8", { qualities: [{ label: "1080p", height: 1080 }] }));
    d.add(cand("https://x.com/m.m3u8", { qualities: [{ label: "720p", height: 720 }] }));
    const list = d.list();
    expect(list[0].qualities.length).toBe(2);
  });
  it("clears", () => {
    const d = new Deduplicator();
    d.add(cand("https://x.com/a.mp4"));
    d.clear();
    expect(d.list().length).toBe(0);
  });
});
