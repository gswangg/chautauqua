// DEC-699: waitlisted restores a sixth submission-status literal. This test
// locks the closed vocabulary across the server (src/domain/status.ts) and
// the SPA (app/src/pages/submissions/types.ts) so a future addition/removal
// on one side without the other is caught immediately, and so every literal
// always has a STATUS_LABELS entry (a status can't silently vanish from the
// UI by having no label).

import { describe, expect, it } from "vitest";
import { SUBMISSION_STATUSES as SERVER_STATUSES, isDecided } from "../src/domain/status";
import { SUBMISSION_STATUSES as SPA_STATUSES, STATUS_LABELS } from "../app/src/pages/submissions/types";

describe("submission status closed vocabulary (DEC-699)", () => {
  it("SPA SUBMISSION_STATUSES equals the server's canonical list", () => {
    expect(SPA_STATUSES).toEqual(SERVER_STATUSES);
  });

  it("every literal has a STATUS_LABELS entry", () => {
    for (const status of SPA_STATUSES) {
      expect(STATUS_LABELS[status]).toBeTruthy();
    }
    expect(Object.keys(STATUS_LABELS).sort()).toEqual([...SPA_STATUSES].sort());
  });

  it("includes 'waitlisted' and it is never decided", () => {
    expect(SERVER_STATUSES).toContain("waitlisted");
    expect(isDecided("waitlisted")).toBe(false);
  });
});
