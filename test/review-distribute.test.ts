// DEC-786/DEC-824: pure distribution -- fairness, idempotence, recusal
// exclusion, cap-per-reviewer, and an honest shortfall for whatever this
// run could not meet.
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
      capPerReviewer: null,
    });
    expect(result.created).toEqual([
      { userId: "u1", submissionId: "s1" },
      { userId: "u2", submissionId: "s2" },
      { userId: "u1", submissionId: "s3" },
      { userId: "u2", submissionId: "s4" },
    ]);
    expect(result.shortfall).toEqual([]);
  });

  it("fills up to reviewsPerSubmission distinct reviewers per submission", () => {
    const result = distributeAssignments({
      submissionIds: ["s1", "s2"],
      reviewerUserIds: ["u1", "u2", "u3"],
      reviewsPerSubmission: 2,
      existing: [],
      recused: [],
      capPerReviewer: null,
    });
    // s1: u1 (count 0), u2 (count 0, tiebreak u2<u3) -> u1,u2
    // s2: counts now u1=1,u2=1,u3=0 -> u3 first, then tie u1/u2 -> u1
    expect(result.created).toEqual([
      { userId: "u1", submissionId: "s1" },
      { userId: "u2", submissionId: "s1" },
      { userId: "u3", submissionId: "s2" },
      { userId: "u1", submissionId: "s2" },
    ]);
    expect(result.shortfall).toEqual([]);
  });

  it("respects existing assignments as a starting load and never repeats them", () => {
    const result = distributeAssignments({
      submissionIds: ["s1", "s2"],
      reviewerUserIds: ["u1", "u2"],
      reviewsPerSubmission: 1,
      existing: [{ userId: "u1", submissionId: "s1" }],
      recused: [],
      capPerReviewer: null,
    });
    // s1 already covered by u1 -- skipped entirely.
    // s2: u1 has count 1, u2 has count 0 -> u2 picked.
    expect(result.created).toEqual([{ userId: "u2", submissionId: "s2" }]);
    expect(result.shortfall).toEqual([]);
  });

  it("is idempotent: feeding its own output back in as existing proposes nothing new", () => {
    const input = {
      submissionIds: ["s1", "s2", "s3"],
      reviewerUserIds: ["u1", "u2"],
      reviewsPerSubmission: 1,
      existing: [] as { userId: string; submissionId: string }[],
      recused: [] as { userId: string; submissionId: string }[],
      capPerReviewer: null,
    };
    const first = distributeAssignments(input);
    const second = distributeAssignments({ ...input, existing: [...input.existing, ...first.created] });
    expect(second.created).toEqual([]);
    expect(second.shortfall).toEqual([]);
  });

  it("is idempotent under a cap too: folding created into existing proposes nothing new", () => {
    const input = {
      submissionIds: ["s1", "s2", "s3"],
      reviewerUserIds: ["u1", "u2"],
      reviewsPerSubmission: 1,
      existing: [] as { userId: string; submissionId: string }[],
      recused: [] as { userId: string; submissionId: string }[],
      capPerReviewer: 1,
    };
    const first = distributeAssignments(input);
    const second = distributeAssignments({ ...input, existing: [...input.existing, ...first.created] });
    expect(second.created).toEqual([]);
    // The cap still leaves s3 unmet on both runs (2 reviewers, cap 1 each,
    // 3 submissions) -- an honest re-run reports the same shortfall again,
    // it does not silently drop it.
    expect(second.shortfall).toEqual(first.shortfall);
  });

  it("skips recused pairs entirely, choosing the next-fewest eligible reviewer", () => {
    const result = distributeAssignments({
      submissionIds: ["s1"],
      reviewerUserIds: ["u1", "u2"],
      reviewsPerSubmission: 1,
      existing: [],
      recused: [{ userId: "u1", submissionId: "s1" }],
      capPerReviewer: null,
    });
    expect(result.created).toEqual([{ userId: "u2", submissionId: "s1" }]);
  });

  it("stops at the number of eligible reviewers when fewer than reviewsPerSubmission are available", () => {
    const result = distributeAssignments({
      submissionIds: ["s1"],
      reviewerUserIds: ["u1", "u2"],
      reviewsPerSubmission: 5,
      existing: [],
      recused: [],
      capPerReviewer: null,
    });
    expect(result.created).toEqual([
      { userId: "u1", submissionId: "s1" },
      { userId: "u2", submissionId: "s1" },
    ]);
    expect(result.shortfall).toEqual([{ submissionId: "s1", missing: 3, reason: "no_eligible_reviewer" }]);
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
      capPerReviewer: null,
    });
    expect(result.created).toEqual([]);
    expect(result.shortfall).toEqual([{ submissionId: "s1", missing: 2, reason: "no_eligible_reviewer" }]);
  });

  it("ties break on ascending userId", () => {
    const result = distributeAssignments({
      submissionIds: ["s1"],
      reviewerUserIds: ["u3", "u1", "u2"],
      reviewsPerSubmission: 1,
      existing: [],
      recused: [],
      capPerReviewer: null,
    });
    expect(result.created).toEqual([{ userId: "u1", submissionId: "s1" }]);
  });

  it("skips a reviewer at the cap exactly like a recused one", () => {
    const result = distributeAssignments({
      submissionIds: ["s1", "s2"],
      reviewerUserIds: ["u1", "u2"],
      reviewsPerSubmission: 1,
      existing: [{ userId: "u1", submissionId: "s0" }],
      recused: [],
      capPerReviewer: 1,
    });
    // u1 already has 1 assignment (the cap) -- s1/s2 both go to u2, and
    // once u2 also hits the cap, the remaining submission is a shortfall.
    expect(result.created).toEqual([{ userId: "u2", submissionId: "s1" }]);
    expect(result.shortfall).toEqual([{ submissionId: "s2", missing: 1, reason: "cap_reached" }]);
  });

  it("reports cap_reached vs no_eligible_reviewer distinctly", () => {
    const result = distributeAssignments({
      submissionIds: ["s1", "s2"],
      reviewerUserIds: ["u1", "u2"],
      reviewsPerSubmission: 1,
      existing: [],
      recused: [{ userId: "u1", submissionId: "s1" }, { userId: "u2", submissionId: "s1" }],
      capPerReviewer: 0,
    });
    // s1: both recused -- no_eligible_reviewer regardless of the cap.
    // s2: both reviewers exist but are already at the cap (0) -- cap_reached.
    expect(result.created).toEqual([]);
    expect(result.shortfall).toEqual([
      { submissionId: "s1", missing: 1, reason: "no_eligible_reviewer" },
      { submissionId: "s2", missing: 1, reason: "cap_reached" },
    ]);
  });
});
