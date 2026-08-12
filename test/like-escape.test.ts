import { describe, expect, it } from "vitest";
import { likeContains } from "../src/server/repo/like";

describe("likeContains (DEC-506: ONE home for SQL LIKE escaping)", () => {
  it("wraps a plain term in %...% without case-folding", () => {
    expect(likeContains("Priya")).toBe("%Priya%");
  });

  it("escapes a literal %", () => {
    expect(likeContains("100%")).toBe("%100\\%%");
  });

  it("escapes a literal _", () => {
    expect(likeContains("a_b")).toBe("%a\\_b%");
  });

  it("escapes a literal backslash", () => {
    expect(likeContains("a\\b")).toBe("%a\\\\b%");
  });

  it("escapes a mixed string containing all three metacharacters", () => {
    expect(likeContains("50%_off\\now")).toBe("%50\\%\\_off\\\\now%");
  });

  it("leaves a non-ASCII accented term unfolded (never lowercases/uppercases)", () => {
    expect(likeContains("Renée")).toBe("%Renée%");
    expect(likeContains("ÉCOLE")).toBe("%ÉCOLE%");
  });
});
