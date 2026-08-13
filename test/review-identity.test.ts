// DEC-736: reviewer identity resolves in ONE place -- the evaluations
// screen (listEvaluationsForSubmission) and the evaluations export both
// call resolveReviewerIdentity so they can never disagree. Anonymization
// hides the SPEAKER from the REVIEWER, never the reviewer's identity from
// the organiser -- this resolver never withholds identity.

import { describe, expect, it } from "vitest";
import { resolveReviewerIdentity } from "../src/domain/review-identity";

describe("resolveReviewerIdentity", () => {
  it("names beat email when both first and last are present", () => {
    expect(resolveReviewerIdentity({ firstName: "Jamie", lastName: "Reviewer", email: "jamie@example.com" })).toBe(
      "Jamie Reviewer",
    );
  });

  it("partial names (only first, only last, or neither) fall back to email", () => {
    expect(resolveReviewerIdentity({ firstName: "Jamie", lastName: null, email: "jamie@example.com" })).toBe(
      "jamie@example.com",
    );
    expect(resolveReviewerIdentity({ firstName: null, lastName: "Reviewer", email: "jamie@example.com" })).toBe(
      "jamie@example.com",
    );
    expect(resolveReviewerIdentity({ email: "jamie@example.com" })).toBe("jamie@example.com");
  });

  it("never withholds identity -- there is no anonymized branch (DEC-736 supersedes DEC-622)", () => {
    // A plan being anonymized is not even representable in the row shape
    // resolveReviewerIdentity accepts -- the organiser is always told who
    // reviewed.
    expect(resolveReviewerIdentity({ firstName: "Jamie", lastName: "Reviewer", email: "jamie@example.com" })).not.toBeNull();
  });
});
