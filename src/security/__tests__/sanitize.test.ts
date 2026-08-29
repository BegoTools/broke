import { describe, it, expect } from "vitest";
import { escapeHtml, redactMetadata, looksLikeSecretKey, isSafeUrl } from "../sanitize.js";

describe("sanitize", () => {
  it("escapes HTML to prevent injection", () => {
    expect(escapeHtml('<img src=x onerror=alert(1)>')).toBe('&lt;img src=x onerror=alert(1)&gt;');
  });
  it("redacts secret-like metadata keys", () => {
    const out = redactMetadata({ "auth-token": "abc", title: "lecture" });
    expect(out["auth-token"]).toBe("***redacted***");
    expect(out["title"]).toBe("lecture");
  });
  it("redacts JWT-style values", () => {
    const jwt = "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkifQ.SflKxwRJSMeKKF2QT4f";
    const out = redactMetadata({ val: jwt });
    expect(out["val"]).toBe("***redacted***");
  });
  it("flags secret keys", () => {
    expect(looksLikeSecretKey("authorization")).toBe(true);
    expect(looksLikeSecretKey("title")).toBe(false);
  });
  it("only allows http(s)/blob urls", () => {
    expect(isSafeUrl("https://x.com/a.mp4")).toBe(true);
    expect(isSafeUrl("javascript:alert(1)")).toBe(false);
    expect(isSafeUrl("blob:https://x.com/abc")).toBe(true);
  });
});
