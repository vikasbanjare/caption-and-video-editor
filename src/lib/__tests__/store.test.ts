import { describe, it, expect } from "vitest";
import { smpte, timeAgo, uid } from "../store";

describe("smpte", () => {
  it("formats HH:MM:SS:FF at 30fps", () => {
    expect(smpte(0)).toBe("00:00:00:00");
    expect(smpte(1.5)).toBe("00:00:01:15");
    expect(smpte(3661.5)).toBe("01:01:01:15");
  });
  it("respects a custom fps and clamps negatives", () => {
    expect(smpte(0.5, 24)).toBe("00:00:00:12");
    expect(smpte(-5)).toBe("00:00:00:00");
  });
});

describe("timeAgo", () => {
  it("buckets by magnitude", () => {
    const now = 1_000_000_000_000;
    expect(timeAgo(now - 10_000, now)).toBe("just now");
    expect(timeAgo(now - 5 * 60_000, now)).toBe("5m ago");
    expect(timeAgo(now - 3 * 3_600_000, now)).toBe("3h ago");
    expect(timeAgo(now - 2 * 86_400_000, now)).toBe("2d ago");
  });
});

describe("uid", () => {
  it("is unique and prefixed", () => {
    const a = uid("p");
    const b = uid("p");
    expect(a.startsWith("p")).toBe(true);
    expect(a).not.toBe(b);
  });
});
