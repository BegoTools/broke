import { describe, it, expect } from "vitest";
import { rankCandidates, bestPlaybackUrl } from "../ranker.js";
import type { MediaCandidate } from "../../shared/types.js";

function cand(url: string, over: Partial<MediaCandidate>): MediaCandidate {
  return {
    id: "m:" + url, kind: "video", container: "mp4", manifestType: "none",
    rawUrl: url, detectionMethod: "media-element", status: "active",
    confidence: "high", qualities: [], warnings: [], metadata: {}, timestamp: 1, ...over,
  };
}

describe("ranker", () => {
  it("ranks highest resolution first", () => {
    const list = [
      cand("a.mp4", { qualities: [{ label: "480p", height: 480 }] }),
      cand("b.mp4", { qualities: [{ label: "1080p", height: 1080 }] }),
    ];
    const ranked = rankCandidates(list);
    expect(ranked[0].qualities[0].label).toBe("1080p");
  });
  it("prefers active over inactive", () => {
    const list = [
      cand("a.mp4", { status: "inactive" }),
      cand("b.mp4", { status: "active" }),
    ];
    expect(rankCandidates(list)[0].status).toBe("active");
  });
  it("bestPlaybackUrl picks highest quality url when available", () => {
    const c = cand("master.m3u8", {
      manifestType: "hls",
      qualities: [
        { label: "720p", height: 720, url: "https://x.com/720.m3u8" },
        { label: "1080p", height: 1080, url: "https://x.com/1080.m3u8" },
      ],
    });
    expect(bestPlaybackUrl(c)).toBe("https://x.com/1080.m3u8");
  });
});
