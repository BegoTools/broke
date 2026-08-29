import { describe, it, expect } from "vitest";
import { localRoute, type ChatIntent } from "../chat.js";

describe("chat router", () => {
  it("routes Arabic start command to start_detection with tabQuery", () => {
    const r = localRoute("خش افحص على 123") as ChatIntent;
    expect(r.kind).toBe("tool");
    expect(r.tool).toBe("start_detection");
    expect(String(r.args.tabQuery)).toContain("123");
  });
  it("routes English start command", () => {
    const r = localRoute("start detection on youtube") as ChatIntent;
    expect(r.kind).toBe("tool");
    expect(r.tool).toBe("start_detection");
    expect(String(r.args.tabQuery)).toContain("youtube");
  });
  it("routes stop command", () => {
    const r = localRoute("وقف الفحص") as ChatIntent;
    expect(r.tool).toBe("stop_detection");
  });
  it("returns null for free-form question", () => {
    expect(localRoute("what is this link for?")).toBeNull();
  });
});
