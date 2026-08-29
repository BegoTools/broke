import { describe, it, expect } from "vitest";
import { parseAnnotations, buildAnnotationPrompt } from "../annotate.js";
import type { MediaCandidate } from "../../shared/types.js";

function cand(id: string, url: string): MediaCandidate {
  return {
    id, kind: "video", container: "hls", manifestType: "hls", rawUrl: url,
    detectionMethod: "network-resource", status: "pending", confidence: "medium",
    qualities: [], warnings: [], metadata: {}, timestamp: 1,
  };
}

describe("annotate parsing", () => {
  it("parses JSON array with labels", () => {
    const text = '[{"id":"m:1","label":"player","summary":"Main HLS playlist."},{"id":"m:2","label":"download","summary":"Direct file."}]';
    const a = parseAnnotations(text);
    expect(a.length).toBe(2);
    expect(a[0].label).toBe("player");
    expect(a[1].label).toBe("download");
  });
  it("tolerates code fences + prose", () => {
    const text = 'Sure:\n```json\n[{"id":"m:1","label":"thumbnail","summary":"Poster image."}]\n```';
    const a = parseAnnotations(text);
    expect(a.length).toBe(1);
    expect(a[0].label).toBe("thumbnail");
  });
  it("returns empty on malformed", () => {
    expect(parseAnnotations("no json here")).toEqual([]);
  });
  it("builds prompt with masked urls (no secrets)", () => {
    const p = buildAnnotationPrompt([cand("m:1", "https://x.com/a.m3u8?token=secret")]);
    expect(p).toContain("token=***");
    expect(p).not.toContain("secret");
    expect(p).toContain("m:1");
  });
});
