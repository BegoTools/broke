import { describe, it, expect } from "vitest";
import { analyzeManifest } from "../manifest-analyzer.js";

const HLS_VARIANT = `#EXTM3U
#EXT-X-STREAM-INF:BANDWIDTH=2000000,RESOLUTION=1280x720,CODECS="avc1.64001f"
720p/playlist.m3u8
#EXT-X-STREAM-INF:BANDWIDTH=5000000,RESOLUTION=1920x1080,CODECS="avc1.640028"
1080p/playlist.m3u8
`;

const HLS_ENCRYPTED = `#EXTM3U
#EXT-X-KEY:METHOD=AES-128,URI="https://x.com/key"
#EXT-X-STREAM-INF:BANDWIDTH=2000000,RESOLUTION=1280x720
720p/playlist.m3u8
`;

const DASH = `<?xml version="1.0"?>
<MPD>
  <Period>
    <AdaptationSet>
      <Representation id="1" height="720" bandwidth="2000000" codecs="avc1.64001f"><BaseURL>720.mp4</BaseURL></Representation>
      <Representation id="2" height="1080" bandwidth="5000000" codecs="avc1.640028"><BaseURL>1080.mp4</BaseURL></Representation>
    </AdaptationSet>
  </Period>
</MPD>
`;

const DASH_PROTECTED = `<MPD><ContentProtection schemeIdUri="urn:uuid:edef8ba9-79d6-4ace-a3c8-27dcd51d21ed"/></MPD>`;

describe("manifest-analyzer HLS", () => {
  it("extracts variant qualities", () => {
    const a = analyzeManifest(HLS_VARIANT, "https://x.com/master.m3u8", "hls")!;
    expect(a.manifestType).toBe("hls");
    expect(a.qualities.map((q) => q.label).sort()).toEqual(["1080p", "720p"]);
    expect(a.isEncrypted).toBe(false);
  });
  it("detects encryption and does NOT decrypt", () => {
    const a = analyzeManifest(HLS_ENCRYPTED, "https://x.com/master.m3u8", "hls")!;
    expect(a.isEncrypted).toBe(true);
    expect(a.warnings.some((w) => /EXT-X-KEY/i.test(w))).toBe(true);
  });
});

describe("manifest-analyzer DASH", () => {
  it("extracts representations", () => {
    const a = analyzeManifest(DASH, "https://x.com/stream.mpd", "dash")!;
    expect(a.manifestType).toBe("dash");
    expect(a.qualities.map((q) => q.height).sort((a,b)=>a-b)).toEqual([720, 1080]);
  });
  it("detects ContentProtection and reports (no decrypt)", () => {
    const a = analyzeManifest(DASH_PROTECTED, "https://x.com/stream.mpd", "dash")!;
    expect(a.isEncrypted).toBe(true);
  });
});

describe("manifest-analyzer safety", () => {
  it("returns null for empty input", () => {
    expect(analyzeManifest("", "https://x.com/x", "hls")).toBeNull();
  });
});
