// DEC-736: reviewer identity resolves in ONE place -- the evaluations
// screen (listEvaluationsForSubmission) and the evaluations export both
// call resolveReviewerIdentity so they can never disagree. Anonymization
// hides the SPEAKER from the REVIEWER, never the reviewer's identity from
// the organiser -- this resolver never withholds identity.
//
// ## Amendment (wave 5, sha ee8ceffa): a mononym reviewer (only firstName
// OR only lastName present -- DEC-986's single public Name control never
// rejects such a name) is a PERSON, not a missing name (DEC-757). This
// resolver now delegates to personNameOrEmail and reads the mononym rather
// than falling through to email.

import { describe, expect, it } from "vitest";
import { resolveReviewerIdentity } from "../src/domain/review-identity";

describe("resolveReviewerIdentity", () => {
  it("names beat email when both first and last are present", () => {
    expect(resolveReviewerIdentity({ firstName: "Jamie", lastName: "Reviewer", email: "jamie@example.com" })).toBe(
      "Jamie Reviewer",
    );
  });

  it("a mononym (only first or only last) reads as the name, not the email (DEC-757 wave-5 amendment)", () => {
    expect(resolveReviewerIdentity({ firstName: "Prince", lastName: null, email: "prince@example.com" })).toBe(
      "Prince",
    );
    expect(resolveReviewerIdentity({ firstName: null, lastName: "Prince", email: "prince@example.com" })).toBe(
      "Prince",
    );
  });

  it("no name at all falls back to email", () => {
    expect(resolveReviewerIdentity({ email: "jamie@example.com" })).toBe("jamie@example.com");
  });

  it("never withholds identity -- there is no anonymized branch (DEC-736 supersedes DEC-622)", () => {
    // A plan being anonymized is not even representable in the row shape
    // resolveReviewerIdentity accepts -- the organiser is always told who
    // reviewed.
    expect(resolveReviewerIdentity({ firstName: "Jamie", lastName: "Reviewer", email: "jamie@example.com" })).not.toBeNull();
  });
});
