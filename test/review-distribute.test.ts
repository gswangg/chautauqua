// DEC-786/DEC-824: pure distribution -- fairness, idempotence, recusal
// exclusion, cap-per-reviewer, and an honest shortfall for whatever this
// run could not meet.
// Amendment (wave 52): coverage/eligibility must resolve scope the way
// every other reader does (resolveAssignments, src/domain/evaluation.ts) --
// a broad ('All submissions') or track-scoped reviewer already covers what
// their scope reaches, and a track-scoped reviewer is never eligible for a
// submission outside their tracks.
import { describe, expect, it } from "vitest";
import { distributeAssignments } from "../src/domain/review-distribute";

// Test helper: every reviewer/submission below carries no track scope
// unless a test says otherwise, so pre-existing behavior (flat pool, no
// track restriction) is unaffected by the amendment's scope plumbing.
function broadReviewers(userIds: string[]) {
  return userIds.map((userId) => ({ userId, broad: true, trackIds: [] as string[] }));
}
function plainSubmissions(ids: string[]) {
  return ids.map((id) => ({ id, trackIds: [] as string[] }));
}

describe("distributeAssignments", () => {
  it("spreads assignments evenly across reviewers, one per submission", () => {
    const result = distributeAssignments({
      submissions: plainSubmissions(["s1", "s2", "s3", "s4"]),
      reviewers: broadReviewers(["u1", "u2"]),
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
      submissions: plainSubmissions(["s1", "s2"]),
      reviewers: broadReviewers(["u1", "u2", "u3"]),
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
      submissions: plainSubmissions(["s1", "s2"]),
      reviewers: broadReviewers(["u1", "u2"]),
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
      submissions: plainSubmissions(["s1", "s2", "s3"]),
      reviewers: broadReviewers(["u1", "u2"]),
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
      submissions: plainSubmissions(["s1", "s2", "s3"]),
      reviewers: broadReviewers(["u1", "u2"]),
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
      submissions: plainSubmissions(["s1"]),
      reviewers: broadReviewers(["u1", "u2"]),
      reviewsPerSubmission: 1,
      existing: [],
      recused: [{ userId: "u1", submissionId: "s1" }],
      capPerReviewer: null,
    });
    expect(result.created).toEqual([{ userId: "u2", submissionId: "s1" }]);
  });

  it("stops at the number of eligible reviewers when fewer than reviewsPerSubmission are available", () => {
    const result = distributeAssignments({
      submissions: plainSubmissions(["s1"]),
      reviewers: broadReviewers(["u1", "u2"]),
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
      submissions: plainSubmissions(["s1"]),
      reviewers: broadReviewers(["u1", "u2"]),
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
      submissions: plainSubmissions(["s1"]),
      reviewers: broadReviewers(["u3", "u1", "u2"]),
      reviewsPerSubmission: 1,
      existing: [],
      recused: [],
      capPerReviewer: null,
    });
    expect(result.created).toEqual([{ userId: "u1", submissionId: "s1" }]);
  });

  it("skips a reviewer at the cap exactly like a recused one", () => {
    const result = distributeAssignments({
      submissions: plainSubmissions(["s1", "s2"]),
      reviewers: broadReviewers(["u1", "u2"]),
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
      submissions: plainSubmissions(["s1", "s2"]),
      reviewers: broadReviewers(["u1", "u2"]),
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

  // --- Amendment (wave 52): scope-aware coverage/eligibility --------------

  it("an all-null ('All submissions') reviewer already covering a submission proposes nothing for it, with an empty shortfall", () => {
    // The caller (plans-distribute.ts) resolves `existing` from
    // resolveAssignments -- a broad reviewer already covers every submission
    // BEFORE this run, so distribute has nothing to add and no shortfall.
    const result = distributeAssignments({
      submissions: plainSubmissions(["s1", "s2"]),
      reviewers: broadReviewers(["u1"]),
      reviewsPerSubmission: 1,
      existing: [
        { userId: "u1", submissionId: "s1" },
        { userId: "u1", submissionId: "s2" },
      ],
      recused: [],
      capPerReviewer: null,
    });
    expect(result.created).toEqual([]);
    expect(result.shortfall).toEqual([]);
  });

  it("a track-scoped reviewer never receives an out-of-track talk", () => {
    const result = distributeAssignments({
      submissions: [
        { id: "s1", trackIds: ["trackA"] },
        { id: "s2", trackIds: ["trackB"] },
      ],
      reviewers: [{ userId: "u1", broad: false, trackIds: ["trackA"] }],
      reviewsPerSubmission: 1,
      existing: [],
      recused: [],
      capPerReviewer: null,
    });
    expect(result.created).toEqual([{ userId: "u1", submissionId: "s1" }]);
    expect(result.shortfall).toEqual([{ submissionId: "s2", missing: 1, reason: "no_eligible_reviewer" }]);
  });

  it("a talk whose only free reviewers are wrong-track reports no_eligible_reviewer, not cap_reached", () => {
    const result = distributeAssignments({
      submissions: [{ id: "s1", trackIds: ["trackA"] }],
      reviewers: [
        { userId: "u1", broad: false, trackIds: ["trackB"] },
        { userId: "u2", broad: false, trackIds: ["trackC"] },
      ],
      reviewsPerSubmission: 1,
      existing: [],
      recused: [],
      capPerReviewer: null,
    });
    expect(result.created).toEqual([]);
    expect(result.shortfall).toEqual([{ submissionId: "s1", missing: 1, reason: "no_eligible_reviewer" }]);
  });

  it("a broad reviewer fills the gap a track-scoped reviewer's coverage leaves short", () => {
    // u1 is track-scoped to trackA and already covers s1 via that scope
    // (resolved by the caller into `existing`); u2 is broad and not yet
    // covering s1, so reviewsPerSubmission=2 pulls u2 in as a genuine new
    // explicit assignment.
    const result = distributeAssignments({
      submissions: [{ id: "s1", trackIds: ["trackA"] }],
      reviewers: [
        { userId: "u1", broad: false, trackIds: ["trackA"] },
        { userId: "u2", broad: true, trackIds: [] },
      ],
      reviewsPerSubmission: 2,
      existing: [{ userId: "u1", submissionId: "s1" }],
      recused: [],
      capPerReviewer: null,
    });
    expect(result.created).toEqual([{ userId: "u2", submissionId: "s1" }]);
    expect(result.shortfall).toEqual([]);
  });

  it("a wrong-track reviewer is never chosen even when a broad reviewer is also eligible", () => {
    const result = distributeAssignments({
      submissions: [{ id: "s1", trackIds: ["trackA"] }],
      reviewers: [
        { userId: "u1", broad: false, trackIds: ["trackB"] },
        { userId: "u2", broad: true, trackIds: [] },
      ],
      reviewsPerSubmission: 1,
      existing: [],
      recused: [],
      capPerReviewer: null,
    });
    expect(result.created).toEqual([{ userId: "u2", submissionId: "s1" }]);
    expect(result.shortfall).toEqual([]);
  });
});
