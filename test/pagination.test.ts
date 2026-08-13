import { describe, expect, it } from "vitest";
import { MAX_PAGE, clampPage, clampPerPage, listPerPage } from "../src/lib/pagination";

describe("clampPage (DEC-013: 1-based)", () => {
  it("defaults to 1 for missing/invalid input", () => {
    expect(clampPage(undefined)).toBe(1);
    expect(clampPage(null)).toBe(1);
    expect(clampPage("abc")).toBe(1);
    expect(clampPage("1.5")).toBe(1);
  });

  it("floors below 1 to 1", () => {
    expect(clampPage("0")).toBe(1);
    expect(clampPage("-3")).toBe(1);
  });

  it("passes through valid integers", () => {
    expect(clampPage("3")).toBe(3);
    expect(clampPage(7)).toBe(7);
  });

  it("clamps to MAX_PAGE instead of overflowing", () => {
    expect(clampPage("20000")).toBe(MAX_PAGE);
    expect(clampPage(MAX_PAGE + 1)).toBe(MAX_PAGE);
    expect(clampPage(MAX_PAGE)).toBe(MAX_PAGE);
  });
});

// DEC-013 wave 54 amendment: `(clampPage(x)-1)*clampPerPage(y)` must always
// be a safe integer that can reach `.offset()` without 500ing, for ANY page
// input -- test the invariant across a table of hostile inputs, not just one
// example.
describe("clampPage x clampPerPage offset invariant (DEC-013 wave 54)", () => {
  const HOSTILE_PAGES = ["1e21", "99999999999999999999", "1e400", "Infinity", "-0", "2.5", "abc", ""];

  it.each(HOSTILE_PAGES)("keeps the offset a safe integer for page=%s", (raw) => {
    const offset = (clampPage(raw) - 1) * clampPerPage("50");
    expect(Number.isSafeInteger(offset)).toBe(true);
  });

  it("also holds when perPage is hostile alongside a hostile page", () => {
    for (const p of HOSTILE_PAGES) {
      for (const pp of HOSTILE_PAGES) {
        const offset = (clampPage(p) - 1) * clampPerPage(pp);
        expect(Number.isSafeInteger(offset)).toBe(true);
      }
    }
  });

  it("leaves valid pages untouched by the new upper clamp", () => {
    expect(clampPage("1")).toBe(1);
    expect(clampPage("42")).toBe(42);
    expect(clampPage(9999)).toBe(9999);
  });
});

describe("clampPerPage (DEC-013: default 50, server-clamped max 200)", () => {
  it("defaults to 50 for missing/invalid input", () => {
    expect(clampPerPage(undefined)).toBe(50);
    expect(clampPerPage("abc")).toBe(50);
    expect(clampPerPage("0")).toBe(50);
    expect(clampPerPage("-10")).toBe(50);
  });

  it("clamps values above 200 down to 200", () => {
    expect(clampPerPage("5000")).toBe(200);
    expect(clampPerPage(201)).toBe(200);
  });

  it("passes through valid in-range integers", () => {
    expect(clampPerPage("25")).toBe(25);
    expect(clampPerPage(200)).toBe(200);
  });
});

describe("listPerPage (DEC-465: unpaginated-list default of MAX_PER_PAGE)", () => {
  it("resolves absent input to 200", () => {
    expect(listPerPage(undefined)).toBe(200);
    expect(listPerPage(null)).toBe(200);
    expect(listPerPage("")).toBe(200);
  });

  it("resolves invalid input to 200 (not clampPerPage's 50)", () => {
    expect(listPerPage("abc")).toBe(200);
    expect(listPerPage("0")).toBe(200);
    expect(listPerPage("-1")).toBe(200);
  });

  it("clamps huge/overflow values down to 200", () => {
    expect(listPerPage("1e308")).toBe(200);
    expect(listPerPage("5000")).toBe(200);
  });

  it("passes through valid in-range integers unchanged", () => {
    expect(listPerPage("25")).toBe(25);
  });
});
