// DEC-829 wave-29 TIER-0 amendment: the onboarding grid's total COUNT, page
// SELECT, and speakers COUNT must be driven by the event's own
// participant/submission rows (scoped by submission.eventId), never by the
// org-wide `contact` table with a correlated EXISTS -- that shape is what
// docs/verification-log.md:3750-3759 measured as O(org contact directory)
// instead of O(event roster). A cheap repo-level scan (source-text
// assertion, per the task's stated acceptable form) rather than a live-DB
// benchmark, since no D1 test harness exists in stage 1
// (test/onboarding-grid-pagination.test.ts's header explains why).

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const src = readFileSync(new URL("../src/server/repo/tasks/grid.ts", import.meta.url), "utf8");

describe("getOnboardingGrid driving relation (DEC-829 wave-29)", () => {
  it("never opens a query with `.from(schema.contact)` -- contact is joined by id only", () => {
    expect(src).not.toMatch(/\.from\(schema\.contact\)/);
  });

  it("drives totalRows/contactRows/speakersCountRows from schema.participant, joined to schema.submission and schema.contact", () => {
    // Three `.from(schema.participant)` call sites: totalRows, contactRows,
    // speakersCountRows. (The unrelated participation/roster queries further
    // down the file already open `.from(schema.participant)` too, so this
    // just asserts the relation exists at least 3 times and that every one
    // of those is immediately joined to submission and contact.)
    const fromParticipantBlocks = src.split(".from(schema.participant)").length - 1;
    expect(fromParticipantBlocks).toBeGreaterThanOrEqual(3);

    const totalRowsBlock = src.slice(src.indexOf("const totalRows"), src.indexOf("const total ="));
    expect(totalRowsBlock).toContain(".from(schema.participant)");
    expect(totalRowsBlock).toContain("schema.submission.id");
    expect(totalRowsBlock).toContain("schema.contact.id");

    const contactRowsBlock = src.slice(src.indexOf("const contactRows"), src.indexOf("const rowsByContact"));
    expect(contactRowsBlock).toContain(".from(schema.participant)");
    expect(contactRowsBlock).toContain("schema.submission.id");
    expect(contactRowsBlock).toContain("schema.contact.id");

    const speakersBlock = src.slice(src.indexOf("const speakersCountRows"), src.indexOf("const speakersCount ="));
    expect(speakersBlock).toContain(".from(schema.participant)");
    expect(speakersBlock).toContain("schema.submission.id");
    expect(speakersBlock).toContain("schema.contact.id");
  });
});
