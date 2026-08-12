// DEC-538: saved view config validation must accept exactly the canonical
// submission status and sort-order vocabularies, not a hand-copied subset
// that silently drifts (as happened when DEC-341 added the 'worklist' sort
// to SORT_ORDERS at submissions/query.ts without updating the local copy
// that used to live in views.ts). This test derives its cases from the
// canonical exports so a future vocabulary addition is caught automatically
// instead of requiring a third hand-maintained list here.

import { describe, expect, it } from "vitest";
import { isValidSavedViewConfig } from "../src/server/repo/views";
import { SUBMISSION_STATUSES } from "../src/domain/status";
import { SORT_ORDERS } from "../src/server/repo/submissions/query";

function baseConfig(overrides: Partial<{ sort: string; status: string[] }>) {
  return {
    q: "",
    status: [],
    trackId: null,
    sort: "newest",
    columns: [],
    ...overrides,
  };
}

describe("isValidSavedViewConfig vocabulary", () => {
  for (const sort of SORT_ORDERS) {
    it(`accepts canonical sort order '${sort}'`, () => {
      expect(isValidSavedViewConfig(baseConfig({ sort }))).toBe(true);
    });
  }

  for (const status of SUBMISSION_STATUSES) {
    it(`accepts canonical submission status '${status}'`, () => {
      expect(isValidSavedViewConfig(baseConfig({ status: [status] }))).toBe(true);
    });
  }

  it("rejects a bogus sort value", () => {
    expect(isValidSavedViewConfig(baseConfig({ sort: "definitely-not-a-sort" }))).toBe(false);
  });

  it("rejects a bogus status value", () => {
    expect(isValidSavedViewConfig(baseConfig({ status: ["definitely-not-a-status"] }))).toBe(false);
  });
});
