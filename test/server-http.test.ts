import { describe, expect, it } from "vitest";
import { ApiError, errorEnvelope } from "../src/server/http";

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
