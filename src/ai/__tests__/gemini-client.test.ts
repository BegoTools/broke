import { describe, it, expect } from "vitest";
import { maskSecretParams } from "../gemini-client.js";

describe("gemini-client masking", () => {
  it("masks token/sig/session values", () => {
    const u = maskSecretParams("https://x.com/v.mp4?token=abc123&sig=xyz&session=zzz");
    expect(u).not.toContain("abc123");
    expect(u).not.toContain("xyz");
    expect(u).toContain("token=***");
    expect(u).toContain("sig=***");
    expect(u).toContain("session=***");
  });
  it("keeps non-secret params", () => {
    const u = maskSecretParams("https://x.com/v.mp4?quality=720&token=abc");
    expect(u).toContain("quality=720");
    expect(u).toContain("token=***");
  });
  it("leaves clean urls unchanged", () => {
    expect(maskSecretParams("https://x.com/v.mp4")).toBe("https://x.com/v.mp4");
  });
  it("handles invalid url", () => {
    expect(maskSecretParams("not a url")).toBe("not a url");
  });
});
