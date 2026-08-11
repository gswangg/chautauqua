import { describe, expect, it } from "vitest";
import { ApiError, errorEnvelope, parseBoundedIdArray } from "../src/server/http";

describe("ApiError / errorEnvelope", () => {
  it("maps codes to the DEC-013 status codes", () => {
    expect(new ApiError("unauthorized", "x").status).toBe(401);
    expect(new ApiError("forbidden", "x").status).toBe(403);
    expect(new ApiError("not_found", "x").status).toBe(404);
    expect(new ApiError("invalid", "x").status).toBe(400);
    expect(new ApiError("conflict", "x").status).toBe(409);
    expect(new ApiError("internal", "x").status).toBe(500);
  });

  it("builds the { error: { code, message } } envelope", () => {
    const err = new ApiError("not_found", "Submission not found");
    expect(errorEnvelope(err)).toEqual({
      error: { code: "not_found", message: "Submission not found" },
    });
  });

  it("includes fields when supplied (validation errors)", () => {
    const err = new ApiError("invalid", "Bad input", { email: "Required" });
    expect(errorEnvelope(err)).toEqual({
      error: { code: "invalid", message: "Bad input", fields: { email: "Required" } },
    });
  });
});

// DEC-182
describe("parseBoundedIdArray", () => {
  it("returns the array unchanged when it's a valid list of ids", () => {
    expect(parseBoundedIdArray(["a", "b", "c"], "ids")).toEqual(["a", "b", "c"]);
  });

  it("throws invalid when value is not an array", () => {
    let err: unknown;
    try {
      parseBoundedIdArray("not-an-array", "ids");
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).code).toBe("invalid");
    expect((err as ApiError).fields).toEqual({ ids: "Required" });
  });

  it("throws invalid when the array is empty", () => {
    expect(() => parseBoundedIdArray([], "ids")).toThrow(ApiError);
  });

  it("throws invalid, no silent filtering, when any element is not a string", () => {
    let err: unknown;
    try {
      parseBoundedIdArray(["a", 123, "c"], "ids");
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).code).toBe("invalid");
  });

  it("throws invalid when an element has length 0", () => {
    expect(() => parseBoundedIdArray([""], "ids")).toThrow(ApiError);
  });

  it("throws invalid when an element exceeds 64 chars", () => {
    expect(() => parseBoundedIdArray(["x".repeat(65)], "ids")).toThrow(ApiError);
  });

  it("allows an element at exactly 64 chars", () => {
    expect(parseBoundedIdArray(["x".repeat(64)], "ids")).toEqual(["x".repeat(64)]);
  });

  it("throws invalid when the array exceeds the default max of 1000", () => {
    const ids = Array.from({ length: 1001 }, (_, i) => `id-${i}`);
    expect(() => parseBoundedIdArray(ids, "ids")).toThrow(ApiError);
  });

  it("allows exactly the default max of 1000", () => {
    const ids = Array.from({ length: 1000 }, (_, i) => `id-${i}`);
    expect(parseBoundedIdArray(ids, "ids")).toHaveLength(1000);
  });

  it("respects a custom maxCount", () => {
    expect(() => parseBoundedIdArray(["a", "b", "c"], "ids", { maxCount: 2 })).toThrow(ApiError);
    expect(parseBoundedIdArray(["a", "b"], "ids", { maxCount: 2 })).toEqual(["a", "b"]);
  });
});
