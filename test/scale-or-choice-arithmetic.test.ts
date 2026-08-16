// DEC-241/DEC-422 (amendment, wave 2, Scale-or-Choice v12 ruling) arithmetic
// pins for task w2-c: the v12 ruling states the contract in prose --
// "shares 60/40 not 50/33 with a Choice present", a Choice pick "never
// reaches computeWeightedScore", "the distribution renders in the
// criterion's DECLARED option order (never alphabetical, never by count)".
// Verified at wave-2 planning that the domain already implements this; this
// file pins it so a refactor cannot silently regress it, since three
// concurrent SPA branches are building against exactly this contract.

import { describe, expect, it } from "vitest";
import {
  criterionWeightShares,
  aggregateSubmission,
  aggregateDropdownCriterion,
  dropdownDistribution,
  type DropdownCriterionDef,
} from "../src/domain/evaluation";
import { ratingCriteria } from "../src/routes/review/shared";

describe("DEC-676/DEC-241 (amendment, wave 2): criterionWeightShares excludes Choice criteria", () => {
  it("[rating w3, rating w2, dropdown] -> {60, 40}, no entry for the dropdown", () => {
    const shares = criterionWeightShares([
      { id: "r1", weight: 3 },
      { id: "r2", weight: 2 },
      { id: "d1" }, // dropdown: no weight field at all
    ]);
    expect(shares).toEqual({ r1: 60, r2: 40 });
    expect(shares.d1).toBeUndefined();
    // the ruling's own contrast: NOT the naive equal-split 50/33
    expect(shares.r1).not.toBe(50);
  });
});

describe("DEC-212/DEC-241 (amendment, wave 2): a Choice criterion never reaches the numeric mean", () => {
  const criteria = [
    { id: "relevance", label: "Relevance", kind: "rating" as const, weight: 1 },
    { id: "depth", label: "Depth", kind: "rating" as const, weight: 1 },
    { id: "format", label: "Format", kind: "dropdown" as const, options: ["Talk", "Panel"] },
  ];

  it("aggregateSubmission's average is computed from the rating criteria alone -- mirrors rankPlanResults, which filters through ratingCriteria() before ever calling aggregateSubmission/computeWeightedScore", () => {
    const rating = ratingCriteria(criteria);
    expect(rating.map((c) => c.id)).toEqual(["relevance", "depth"]);

    const evals = [
      { scores: { relevance: 4, depth: 2 } },
      { scores: { relevance: 2, depth: 4 } },
    ];
    const agg = aggregateSubmission(evals, rating);
    // equal weights -> plain mean over the two rating criteria per eval,
    // then averaged across evals: (4+2)/2=3, (2+4)/2=3 -> 3
    expect(agg.average).toBe(3);
    expect(agg.perCriterion).toEqual({ relevance: 3, depth: 3 });
    // the dropdown criterion contributes no perCriterion entry at all
    expect(agg.perCriterion.format).toBeUndefined();
  });
});

describe("DEC-241 (amendment, wave 2): dropdownDistribution returns declared order, not Object.keys order", () => {
  const criterion: DropdownCriterionDef = {
    id: "d1",
    label: "Rating band",
    kind: "dropdown",
    options: ["5", "3", "1"],
  };

  it("declared order survives even though the option labels are integer-like strings that Object.keys would hoist/reorder", () => {
    const counts: Record<string, number> = { "1": 2, "3": 1, "5": 4 };
    // Falsifiability control: demonstrate the hazard this function exists
    // to avoid -- plain JS key order does NOT match the declared order.
    expect(Object.keys(counts)).toEqual(["1", "3", "5"]);

    const dist = dropdownDistribution(criterion, counts);
    expect(dist).toEqual([
      { option: "5", count: 4 },
      { option: "3", count: 1 },
      { option: "1", count: 2 },
    ]);
    // and NOT the Object.keys order
    expect(dist.map((d) => d.option)).not.toEqual(Object.keys(counts));
  });

  it("an option absent from counts gets 0, still in declared order", () => {
    const dist = dropdownDistribution(criterion, { "5": 2 });
    expect(dist).toEqual([
      { option: "5", count: 2 },
      { option: "3", count: 0 },
      { option: "1", count: 0 },
    ]);
  });
});

describe("DEC-241 (amendment, wave 2): aggregateDropdownCriterion breaks a modal tie by declared option order", () => {
  it("two options tied at the max count -- the FIRST tied option in declared order wins, not the last, not the highest-count-then-alphabetical", () => {
    const criterion: DropdownCriterionDef = {
      id: "d1",
      label: "Format",
      kind: "dropdown",
      options: ["Panel", "Talk", "Workshop"],
    };
    // Talk and Panel tie at 2 each; Panel is declared first.
    const evals = [
      { scores: { d1: "Talk" } },
      { scores: { d1: "Talk" } },
      { scores: { d1: "Panel" } },
      { scores: { d1: "Panel" } },
      { scores: { d1: "Workshop" } },
    ];
    const { modal, counts } = aggregateDropdownCriterion(evals, criterion);
    expect(counts).toEqual({ Panel: 2, Talk: 2, Workshop: 1 });
    expect(modal).toBe("Panel");
  });
});
