// DEC-900 amendment (wave 60): src/domain/clock.ts is the single owner of
// minutes-from-midnight clock formatting, in exactly two named grammars.
import { describe, expect, it } from "vitest";
import { clockHHMM, clockHMM } from "../src/domain/clock";

describe("clockHHMM (zero-padded 24h)", () => {
  it("formats morning, noon, and afternoon times as zero-padded 24-hour HH:MM", () => {
    expect(clockHHMM(540)).toBe("09:00");
    expect(clockHHMM(720)).toBe("12:00");
    expect(clockHHMM(1080)).toBe("18:00");
  });

  it("handles the boundary values 0 and 1440", () => {
    expect(clockHHMM(0)).toBe("00:00");
    expect(clockHHMM(1440)).toBe("24:00");
  });

  it("throws on a non-integer minute", () => {
    expect(() => clockHHMM(9.5)).toThrow();
    expect(() => clockHHMM(NaN)).toThrow();
  });

  it("throws outside 0..1440", () => {
    expect(() => clockHHMM(-1)).toThrow();
    expect(() => clockHHMM(1441)).toThrow();
  });
});

describe("clockHMM (unpadded 24h)", () => {
  it("formats the gutter rail as unpadded 24-hour H:MM, never zero-padded", () => {
    expect(clockHMM(540)).toBe("9:00");
    expect(clockHMM(570)).toBe("9:30");
    expect(clockHMM(600)).toBe("10:00");
    expect(clockHMM(720)).toBe("12:00");
    expect(clockHMM(1080)).toBe("18:00");
  });

  it("handles the boundary values 0 and 1440", () => {
    expect(clockHMM(0)).toBe("0:00");
    expect(clockHMM(1440)).toBe("24:00");
  });

  it("throws on a non-integer minute", () => {
    expect(() => clockHMM(9.5)).toThrow();
    expect(() => clockHMM(NaN)).toThrow();
  });

  it("throws outside 0..1440", () => {
    expect(() => clockHMM(-1)).toThrow();
    expect(() => clockHMM(1441)).toThrow();
  });
});
