// DEC-660: one merge-field vocabulary. Each surface subset must (a) be a
// subset of the full MERGE_FIELDS whitelist, so a chip can never render a
// placeholder renderTemplate would reject as MergeFieldError, and (b) equal
// exactly the keys the corresponding server path puts into its vars object,
// so a chip can never offer a field that surface's send path doesn't
// actually supply, and a new merge field can't land server-side without the
// UI question ("does compose/bulk-email supply this?") being answered.
import { describe, expect, it } from "vitest";
import {
  BULK_EMAIL_MERGE_FIELDS,
  COMPOSE_MERGE_FIELDS,
  MERGE_FIELDS,
} from "../src/mail/render";
import { buildMergeVars } from "../src/domain/compose";

function isSubset(subset: readonly string[], superset: readonly string[]): boolean {
  return subset.every((f) => superset.includes(f));
}

describe("merge-field vocabulary (DEC-660)", () => {
  it("COMPOSE_MERGE_FIELDS is a subset of MERGE_FIELDS", () => {
    expect(isSubset(COMPOSE_MERGE_FIELDS, MERGE_FIELDS)).toBe(true);
  });

  it("BULK_EMAIL_MERGE_FIELDS is a subset of MERGE_FIELDS", () => {
    expect(isSubset(BULK_EMAIL_MERGE_FIELDS, MERGE_FIELDS)).toBe(true);
  });

  it("COMPOSE_MERGE_FIELDS equals exactly the keys src/domain/compose.ts's buildMergeVars puts into vars", () => {
    const vars = buildMergeVars({
      speakerName: "Ada Lovelace",
      talkTitle: "On Engines",
      eventName: "Analytical Conf",
      portalLink: "https://example.com/portal",
      feedbackComments: ["Great talk"],
    });
    expect(new Set(COMPOSE_MERGE_FIELDS)).toEqual(new Set(Object.keys(vars)));
  });

  it("BULK_EMAIL_MERGE_FIELDS equals exactly the keys src/routes/api/contacts/bulk-email.ts's renderBulkEmailTargets puts into vars", () => {
    // Mirrors renderBulkEmailTargets's target.vars literal verbatim
    // (src/routes/api/contacts/bulk-email.ts): speaker_name, event_name,
    // portal_link — contact-scoped, no talk_title/feedback (those require a
    // submission, which bulk email doesn't have).
    const bulkEmailVarsKeys = ["speaker_name", "event_name", "portal_link"];
    expect(new Set(BULK_EMAIL_MERGE_FIELDS)).toEqual(new Set(bulkEmailVarsKeys));
  });

  it("COMPOSE_MERGE_FIELDS and BULK_EMAIL_MERGE_FIELDS have no duplicate entries", () => {
    expect(new Set(COMPOSE_MERGE_FIELDS).size).toBe(COMPOSE_MERGE_FIELDS.length);
    expect(new Set(BULK_EMAIL_MERGE_FIELDS).size).toBe(BULK_EMAIL_MERGE_FIELDS.length);
  });
});
