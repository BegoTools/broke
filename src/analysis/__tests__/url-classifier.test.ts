import { describe, it, expect } from "vitest";
import { classifyContainer, classifyManifestType, classifyKind } from "../url-classifier.js";

describe("url-classifier", () => {
  it("classifies common containers from extension", () => {
    expect(classifyContainer("https://x.com/v/abc.mp4")).toBe("mp4");
    expect(classifyContainer("https://x.com/v/abc.webm")).toBe("webm");
    expect(classifyContainer("https://x.com/v/abc.mov")).toBe("mov");
  });
  it("classifies HLS and DASH from path", () => {
    expect(classifyContainer("https://x.com/master.m3u8")).toBe("hls");
    expect(classifyContainer("https://x.com/stream.mpd")).toBe("dash");
  });
  it("classifies from query hint", () => {
    expect(classifyContainer("https://x.com/play?m3u8=1")).toBe("hls");
  });
  it("classifies from MIME", () => {
    expect(classifyContainer("https://x.com/foo", "application/vnd.apple.mpegurl")).toBe("hls");
    expect(classifyContainer("https://x.com/foo", "application/dash+xml")).toBe("dash");
    expect(classifyContainer("https://x.com/foo", "video/mp4")).toBe("mp4");
  });
  it("returns unknown when no evidence", () => {
    expect(classifyContainer("https://x.com/page?x=1")).toBe("unknown");
  });
  it("maps manifest types", () => {
    expect(classifyManifestType("hls")).toBe("hls");
    expect(classifyManifestType("dash")).toBe("dash");
    expect(classifyManifestType("mp4")).toBe("none");
  });
  it("classifies kind from mime", () => {
    expect(classifyKind("video/mp4")).toBe("video");
    expect(classifyKind("audio/mpeg")).toBe("audio");
  });
});
