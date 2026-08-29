import { describe, it, expect } from "vitest";
import { normalizeUrl, dedupeKey } from "../url-normalizer.js";

describe("url-normalizer", () => {
  it("preserves protected auth/signature params", () => {
    const r = normalizeUrl("https://x.com/v.mp4?token=abc&sig=xyz&utm_source=news");
    expect(r.normalizedUrl).toContain("token=abc");
    expect(r.normalizedUrl).toContain("sig=xyz");
  });
  it("strips only tracking params", () => {
    const r = normalizeUrl("https://x.com/v.mp4?utm_source=news&fbclid=123&ref=bar");
    expect(r.normalizedUrl).toBe("https://x.com/v.mp4");
    expect(r.removed).toEqual(expect.arrayContaining(["utm_source", "fbclid", "ref"]));
  });
  it("returns undefined when nothing changed", () => {
    const r = normalizeUrl("https://x.com/v.mp4");
    expect(r.normalizedUrl).toBeUndefined();
  });
  it("dedupeKey keeps protected params but drops tracking", () => {
    const k = dedupeKey("https://x.com/v.mp4?token=abc&utm_source=news");
    expect(k).toBe("https://x.com/v.mp4?token=abc");
  });
  it("handles invalid urls", () => {
    expect(normalizeUrl("not a url").normalizedUrl).toBeUndefined();
    expect(dedupeKey("not a url")).toBe("not a url");
  });
});
