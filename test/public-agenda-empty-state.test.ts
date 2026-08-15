// DEC-919 (wave 51 amendment, task w51-c): the public agenda's day grid and
// the /schedule surface get the same fresh/filtered empty-state split every
// other public list surface already has (PublicEmptyState,
// src/routes/public/empty-state.tsx) -- render-only unit-test style,
// matching test/public-agenda-breaks.test.ts (no db, plain function calls
// returning JSX-as-string).

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { AgendaContent, ScheduleContent } from "../src/routes/public/agenda";
import type { PublicAgendaItem, PublicEvent } from "../src/server/repo/public";

const EVENT: PublicEvent = {
  id: "e1",
  orgId: "org1",
  name: "Event",
  slug: "ev",
  startDate: "2026-08-10",
  endDate: "2026-08-11",
  location: null,
  timezone: "UTC",
  recordPrefix: "SES",
  brandingJson: null,
};

function item(overrides: Partial<PublicAgendaItem>): PublicAgendaItem {
  return {
    submissionId: "sub",
    ref: "SES-1",
    title: "Talk",
    description: null,
    day: "2026-08-10",
    startMin: 540,
    endMin: 600,
    roomId: "room-a",
    roomName: "Alpha Hall",
    roomPosition: 0,
    icsSequence: 0,
    tracks: [],
    speakers: [],
    format: null,
    ...overrides,
  };
}

describe("AgendaContent day-grid empty state (DEC-919 amendment)", () => {
  it("renders the FRESH block when the day genuinely has no published sessions and no facet is active", () => {
    const html = String(
      AgendaContent({ event: EVENT, items: [], total: 0, activeDay: "2026-08-10", allDays: ["2026-08-10"] }),
    );
    expect(html).toContain("chq-pub-empty-block chq-pub-empty-block-fresh");
    expect(html).not.toContain("chq-pub-empty-block-filtered");
    // fresh: no escape link, an attendee cannot act.
    expect(html).not.toContain("chq-pub-empty-escape");
  });

  it("renders the FILTERED block with a search reason and an escape link dropping only ?q=", () => {
    const html = String(
      AgendaContent({
        event: EVENT,
        items: [],
        total: 0,
        activeDay: "2026-08-10",
        allDays: ["2026-08-10"],
        q: "zzz-no-match",
        highlightTrackId: "trk-a",
      }),
    );
    expect(html).toContain("chq-pub-empty-block chq-pub-empty-block-filtered");
    expect(html).toContain("Filtered by search for &quot;zzz-no-match&quot;.");
    expect(html).toContain("chq-pub-empty-escape");
    // The escape drops q, but keeps day and trackId.
    const match = html.match(/class="chq-pub-accent-link chq-pub-empty-escape" href="([^"]*)"/);
    expect(match).not.toBeNull();
    const href = (match![1] ?? "").replace(/&amp;/g, "&");
    expect(href).not.toContain("q=");
    expect(href).toContain("day=2026-08-10");
    expect(href).toContain("trackId=trk-a");
    expect(html).toContain(">Clear the search<");
  });

  it("renders the FILTERED block for a track-only facet, dropping only trackId", () => {
    const html = String(
      AgendaContent({
        event: EVENT,
        items: [],
        total: 0,
        activeDay: "2026-08-10",
        allDays: ["2026-08-10"],
        highlightTrackId: "trk-a",
      }),
    );
    expect(html).toContain("chq-pub-empty-block chq-pub-empty-block-filtered");
    const match = html.match(/class="chq-pub-accent-link chq-pub-empty-escape" href="([^"]*)"/);
    expect(match).not.toBeNull();
    const href = (match![1] ?? "").replace(/&amp;/g, "&");
    expect(href).not.toContain("trackId=");
    expect(href).toContain("day=2026-08-10");
    expect(html).toContain(">Show every track<");
  });

  it("stays FRESH (no schedule at all) when there is no activeDay, even if a stray q is present", () => {
    const html = String(AgendaContent({ event: EVENT, items: [], total: 0, activeDay: null, allDays: [], q: "anything" }));
    expect(html).toContain("chq-pub-empty-block-fresh");
    expect(html).not.toContain("chq-pub-empty-block-filtered");
  });

  it("renders no empty block at all once the day has matching sessions", () => {
    const items = [item({})];
    const html = String(AgendaContent({ event: EVENT, items, total: 1, activeDay: "2026-08-10", allDays: ["2026-08-10"] }));
    expect(html).not.toContain("chq-pub-empty-block");
  });
});

describe("ScheduleContent empty state (DEC-919 amendment)", () => {
  it("renders the FRESH block (a picks list has no server-side facet to clear) when nothing is scheduled", () => {
    const html = String(ScheduleContent({ event: EVENT, items: [], total: 0 }));
    expect(html).toContain("chq-pub-empty-block chq-pub-empty-block-fresh");
    expect(html).not.toContain("chq-pub-empty-block-filtered");
  });

  it("the script-revealed #chq-schedule-empty element carries the same block anatomy as the SSR empty state", () => {
    const items = [item({})];
    const html = String(ScheduleContent({ event: EVENT, items, total: 1 }));
    expect(html).toContain('id="chq-schedule-empty" class="chq-pub-empty-block chq-pub-empty-block-fresh" hidden');
    expect(html).toContain('class="chq-pub-empty-what"');
  });
});

// Task w51-c requirement 5: DERIVE the population rather than hand-list it --
// scan every .tsx under src/routes/public for a bare zero-row <p> whose
// literal text starts with "No " or "Nothing " outside PublicEmptyState
// itself. Keeps a vacuous-scan tripwire and an existence-checked exemption
// row for programme.tsx (a printable document has no filter chrome).
describe("public zero-row copy scan (derives its own population)", () => {
  const publicDir = join(__dirname, "../src/routes/public");

  function collectTsxFiles(dir: string): string[] {
    const out: string[] = [];
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        out.push(...collectTsxFiles(full));
      } else if (entry.name.endsWith(".tsx")) {
        out.push(full);
      }
    }
    return out;
  }

  const EXEMPT_BASENAMES = new Set(["programme.tsx", "empty-state.tsx"]);

  it("finds at least one .tsx file (tripwire against a vacuous scan)", () => {
    const files = collectTsxFiles(publicDir);
    expect(files.length).toBeGreaterThan (5);
  });

  it("programme.tsx exists (the exemption row is checked, not assumed)", () => {
    const files = collectTsxFiles(publicDir).map((f) => f.split("/").pop());
    expect(files).toContain("programme.tsx");
  });

  it("no bare <p> zero-row sentence survives outside the exempted files", () => {
    const files = collectTsxFiles(publicDir);
    const offenders: { file: string; line: string }[] = [];
    const bareParagraph = /<p[^>]*>\s*\{?\s*["'`](No |Nothing )/;
    for (const file of files) {
      const basename = file.split("/").pop()!;
      if (EXEMPT_BASENAMES.has(basename)) continue;
      const src = readFileSync(file, "utf8");
      const lines = src.split("\n");
      for (const line of lines) {
        if (bareParagraph.test(line)) {
          offenders.push({ file: basename, line: line.trim() });
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});
