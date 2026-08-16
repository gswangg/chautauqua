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

  // DEC-370 (wave-62 amendment) collapsed the former sequential `const
  // totalRows = await ...` declarations into destructured Promise.all waves
  // (`const [totalRows, contactRows, overdueCountRows] = await
  // Promise.all([...])`), so these blocks can no longer be sliced from a
  // `const <name>` anchor. Each query is instead isolated by its OWN
  // terminal clause and read back to the `.select(` that opens it — which
  // keeps every assertion below scoped to exactly one query rather than to
  // a whole wave (a wave-wide slice would pass if ANY sibling drove from
  // participant, which is not what DEC-829 requires).
  function queryBlockEndingAt(marker: string): string {
    const end = src.indexOf(marker);
    expect(end, `driving-relation scan anchor not found: ${marker}`).toBeGreaterThan(-1);
    expect(src.indexOf(marker, end + 1), `driving-relation scan anchor is not unique: ${marker}`).toBe(-1);
    const start = src.lastIndexOf(".select(", end);
    expect(start).toBeGreaterThan(-1);
    return src.slice(start, end + marker.length);
  }

  it("drives totalRows/contactRows/speakersCountRows from schema.participant, joined to schema.submission and schema.contact", () => {
    // Three `.from(schema.participant)` call sites: totalRows, contactRows,
    // speakersCountRows. (The unrelated participation/roster queries further
    // down the file already open `.from(schema.participant)` too, so this
    // just asserts the relation exists at least 3 times and that every one
    // of those is immediately joined to submission and contact.)
    const fromParticipantBlocks = src.split(".from(schema.participant)").length - 1;
    expect(fromParticipantBlocks).toBeGreaterThanOrEqual(3);

    // totalRows: the wave-2 COUNT, the only query whose where clause is
    // `whereExpr` alone with nothing chained after it.
    const totalRowsBlock = queryBlockEndingAt(".where(whereExpr),");
    expect(totalRowsBlock).toContain(".from(schema.participant)");
    expect(totalRowsBlock).toContain("schema.submission.id");
    expect(totalRowsBlock).toContain("schema.contact.id");

    // contactRows: the only grouped page SELECT.
    const contactRowsBlock = queryBlockEndingAt(".groupBy(schema.contact.id)");
    expect(contactRowsBlock).toContain(".from(schema.participant)");
    expect(contactRowsBlock).toContain("schema.submission.id");
    expect(contactRowsBlock).toContain("schema.contact.id");

    // speakersCountRows: the only query gated by the bare roster predicate
    // (the participation query below ANDs it inside `and(inArray(...), ...)`).
    const speakersBlock = queryBlockEndingAt(".where(rosterParticipantConditions(eventId))");
    expect(speakersBlock).toContain(".from(schema.participant)");
    expect(speakersBlock).toContain("schema.submission.id");
    expect(speakersBlock).toContain("schema.contact.id");
  });
});
