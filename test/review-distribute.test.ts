// DEC-786: pure distribution -- fairness, idempotence, recusal exclusion,
// fewer reviewers than reviewsPerSubmission.
import { describe, expect, it } from "vitest";
import { distributeAssignments } from "../src/domain/review-distribute";

describe("distributeAssignments", () => {
  it("spreads assignments evenly across reviewers, one per submission", () => {
    const result = distributeAssignments({
      submissionIds: ["s1", "s2", "s3", "s4"],
      reviewerUserIds: ["u1", "u2"],
      reviewsPerSubmission: 1,
      existing: [],
      recused: [],
    });
    expect(result).toEqual([
      { userId: "u1", submissionId: "s1" },
      { userId: "u2", submissionId: "s2" },
      { userId: "u1", submissionId: "s3" },
      { userId: "u2", submissionId: "s4" },
    ]);
  });

  it("fills up to reviewsPerSubmission distinct reviewers per submission", () => {
    const result = distributeAssignments({
      submissionIds: ["s1", "s2"],
      reviewerUserIds: ["u1", "u2", "u3"],
      reviewsPerSubmission: 2,
      existing: [],
      recused: [],
    });
    // s1: u1 (count 0), u2 (count 0, tiebreak u2<u3) -> u1,u2
    // s2: counts now u1=1,u2=1,u3=0 -> u3 first, then tie u1/u2 -> u1
    expect(result).toEqual([
      { userId: "u1", submissionId: "s1" },
      { userId: "u2", submissionId: "s1" },
      { userId: "u3", submissionId: "s2" },
      { userId: "u1", submissionId: "s2" },
    ]);
  });

  it("respects existing assignments as a starting load and never repeats them", () => {
    const result = distributeAssignments({
      submissionIds: ["s1", "s2"],
      reviewerUserIds: ["u1", "u2"],
      reviewsPerSubmission: 1,
      existing: [{ userId: "u1", submissionId: "s1" }],
      recused: [],
    });
    // s1 already covered by u1 -- skipped entirely.
    // s2: u1 has count 1, u2 has count 0 -> u2 picked.
    expect(result).toEqual([{ userId: "u2", submissionId: "s2" }]);
  });

  it("is idempotent: feeding its own output back in as existing proposes nothing new", () => {
    const input = {
      submissionIds: ["s1", "s2", "s3"],
      reviewerUserIds: ["u1", "u2"],
      reviewsPerSubmission: 1,
      existing: [] as { userId: string; submissionId: string }[],
      recused: [] as { userId: string; submissionId: string }[],
    };
    const first = distributeAssignments(input);
    const second = distributeAssignments({ ...input, existing: [...input.existing, ...first] });
    expect(second).toEqual([]);
  });

  it("skips recused pairs entirely, choosing the next-fewest eligible reviewer", () => {
    const result = distributeAssignments({
      submissionIds: ["s1"],
      reviewerUserIds: ["u1", "u2"],
      reviewsPerSubmission: 1,
      existing: [],
      recused: [{ userId: "u1", submissionId: "s1" }],
    });
    expect(result).toEqual([{ userId: "u2", submissionId: "s1" }]);
  });

  it("stops at the number of eligible reviewers when fewer than reviewsPerSubmission are available", () => {
    const result = distributeAssignments({
      submissionIds: ["s1"],
      reviewerUserIds: ["u1", "u2"],
      reviewsPerSubmission: 5,
      existing: [],
      recused: [],
    });
    expect(result).toEqual([
      { userId: "u1", submissionId: "s1" },
      { userId: "u2", submissionId: "s1" },
    ]);
  });

  it("stops entirely when every reviewer is recused for a submission", () => {
    const result = distributeAssignments({
      submissionIds: ["s1"],
      reviewerUserIds: ["u1", "u2"],
      reviewsPerSubmission: 2,
      existing: [],
      recused: [
        { userId: "u1", submissionId: "s1" },
        { userId: "u2", submissionId: "s1" },
      ],
    });
    expect(result).toEqual([]);
  });

  it("ties break on ascending userId", () => {
    const result = distributeAssignments({
      submissionIds: ["s1"],
      reviewerUserIds: ["u3", "u1", "u2"],
      reviewsPerSubmission: 1,
      existing: [],
      recused: [],
    });
    expect(result).toEqual([{ userId: "u1", submissionId: "s1" }]);
  });
});
