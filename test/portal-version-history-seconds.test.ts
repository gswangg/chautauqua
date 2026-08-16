// DEC-158 (wave 78): the portal's VersionHistory renders one task
// assignment's own file-version chain -- SUCCESSIVE STATES OF ONE OBJECT --
// so two uploads landing in the same minute must still render as
// distinguishable rows. This closes the SSR half of the population
// (formatEventDateTimeWithSeconds, src/lib/event-time.ts) alongside the
// SPA's VersionList.render.test.tsx.

import { describe, expect, it } from "vitest";
import { VersionHistory } from "../src/routes/portal/tasks/views";

describe("VersionHistory (DEC-605/DEC-158)", () => {
  it("renders distinct meta strings for two versions uploaded 30 seconds apart in the same minute", async () => {
    const t1 = Date.UTC(2027, 2, 1, 12, 0, 0);
    const t2 = t1 + 30_000;
    const el = VersionHistory({
      assignmentId: "a1",
      versions: [
        { id: "v1", version: 1, filename: "handout-v1.pdf", uploadedAt: t1, isCurrent: false },
        { id: "v2", version: 2, filename: "handout-v2.pdf", uploadedAt: t2, isCurrent: true },
      ],
      timezone: "UTC",
    });
    const html = await el.toString();

    const rowMatches = [...html.matchAll(/<span class="chq-portal-detail">([^<]+)<\/span>/g)].map((m) => m[1]);
    expect(rowMatches).toHaveLength(2);
    expect(rowMatches[0]).not.toEqual(rowMatches[1]);
    // Second-level precision must actually be present, not merely different
    // by chance -- both rows carry seconds.
    expect(rowMatches[0]).toContain("12:00:00");
    expect(rowMatches[1]).toContain("12:00:30");
  });
});
