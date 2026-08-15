// DEC-340 amendment (wave 18): a present-but-unrecognised onboarding-grid
// filter token must fail loudly (400) rather than silently degrading to
// "no filter" -- mirroring files.ts's "Unknown kind" refusal and the
// submissions list's DEC-843 closed-set refusal. Absent/empty params still
// mean "no filter" (unchanged).

import { describe, expect, it } from "vitest";
import { parseOnboardingGridQuery } from "../src/routes/tasks";
import { ApiError } from "../src/server/http";

describe("parseOnboardingGridQuery (DEC-340 amendment)", () => {
  it("a valid status token still narrows and parses cleanly", () => {
    const result = parseOnboardingGridQuery({ status: "pending" }, 1_000);
    expect(result.status).toBe("pending");
  });

  it("absent params return the unfiltered grid (status/taskId/inviteStatus null, overdueOnly false)", () => {
    const result = parseOnboardingGridQuery({}, 1_000);
    expect(result).toMatchObject({
      status: null,
      taskId: null,
      inviteStatus: null,
      overdueOnly: false,
    });
  });

  it("throws a 400 naming BOTH an unrecognised status and an unrecognised inviteStatus token", () => {
    let caught: unknown;
    try {
      parseOnboardingGridQuery({ status: "bogus", inviteStatus: "nope" }, 1_000);
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(ApiError);
    const err = caught as ApiError;
    expect(err.code).toBe("invalid");
    expect(err.fields).toMatchObject({
      status: expect.any(String),
      inviteStatus: expect.any(String),
    });
  });

  it("overdueOnly accepts exactly '1'|'true'|'0'|'false' and rejects anything else", () => {
    expect(parseOnboardingGridQuery({ overdueOnly: "1" }, 1_000).overdueOnly).toBe(true);
    expect(parseOnboardingGridQuery({ overdueOnly: "true" }, 1_000).overdueOnly).toBe(true);
    expect(parseOnboardingGridQuery({ overdueOnly: "0" }, 1_000).overdueOnly).toBe(false);
    expect(parseOnboardingGridQuery({ overdueOnly: "false" }, 1_000).overdueOnly).toBe(false);

    let caught: unknown;
    try {
      parseOnboardingGridQuery({ overdueOnly: "yes" }, 1_000);
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(ApiError);
    expect((caught as ApiError).fields).toMatchObject({ overdueOnly: expect.any(String) });
  });
});
