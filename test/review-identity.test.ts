// DEC-622: blind-review identity resolves in ONE place -- the evaluations
// screen (listEvaluationsForSubmission) and the evaluations export both
// call resolveReviewerIdentity so they can never disagree about anonymity.

import { describe, expect, it } from "vitest";
import { ANONYMIZED_REVIEWER_CELL, resolveReviewerIdentity } from "../src/domain/review-identity";

describe("resolveReviewerIdentity", () => {
  it("anonymized wins over names -- returns null even when both names are present", () => {
    expect(
      resolveReviewerIdentity({ anonymized: true, firstName: "Jamie", lastName: "Reviewer", email: "jamie@example.com" }),
    ).toBeNull();
  });

  it("names beat email when both first and last are present and the plan is not anonymized", () => {
    expect(
      resolveReviewerIdentity({ anonymized: false, firstName: "Jamie", lastName: "Reviewer", email: "jamie@example.com" }),
    ).toBe("Jamie Reviewer");
  });

  it("partial names (only first, only last, or neither) fall back to email", () => {
    expect(resolveReviewerIdentity({ anonymized: false, firstName: "Jamie", lastName: null, email: "jamie@example.com" })).toBe(
      "jamie@example.com",
    );
    expect(resolveReviewerIdentity({ anonymized: false, firstName: null, lastName: "Reviewer", email: "jamie@example.com" })).toBe(
      "jamie@example.com",
    );
    expect(resolveReviewerIdentity({ anonymized: false, email: "jamie@example.com" })).toBe("jamie@example.com");
  });

  it("ANONYMIZED_REVIEWER_CELL is the withheld-cell sentinel callers render instead of the null", () => {
    expect(ANONYMIZED_REVIEWER_CELL).toBe("(anonymized)");
  });
});
