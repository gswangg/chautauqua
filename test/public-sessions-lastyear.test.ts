// Public sessions "Last year" aside (DEC-745, v12 mobile campaign wave-107
// amendment; task v12m-w3-y). Claims the last unowned/undeviated desktop
// frame in the whole design pack:
//
// docs/design/Chautauqua Public and Portal.dc.html:1167
// `Public sessions · nothing published`
//
// test/desktop-frames-portal.test.ts (branch v12m-w5-c) filed this frame as
// an UNCLAIMED divergence rather than a claim: "the frame draws a 300px
// <aside> sidebar headed 'Last year' ... No such feature exists anywhere in
// the tree." This file builds that feature and is the one that claims the
// frame -- test/desktop-frames-public.test.ts (v12m-w3-s) explicitly leaves
// :1167 out of its own scope for exactly this reason (single-owner per
// file, checked before writing this header).
//
// Two receipt layers, mirroring test/desktop-frames-portal.test.ts's idiom
// for the citation half and test/public-sessions-anatomy.test.ts's idiom
// (`String(SessionsContent(...))`) for the render half:
//   1. citation: a strict `docs/design/...html:1167` line reference with a
//      backtick literal copied verbatim from the frame, resolved against
//      the pack itself (not re-derived) so a re-cut fails loudly.
//   2. render: getPriorPublicEvent is exercised against a real in-memory
//      SQLite database (the test/api-views.test.ts sqlite-proxy pattern) so
//      "no prior event" / "prior event, zero visible sessions" / "prior
//      event, published sessions" are actual query outcomes, not asserted
//      branches of a stub; SessionsContent is then exercised directly (the
//      public-sessions-anatomy.test.ts convention) to check what each
//      outcome renders, plus the 390 phone stack in the CSS source.
//
// DIVERGENCE NAMED, not force-fit (per this task's own instruction): the
// frame's reason sentence is `Sessions appear here once the committee has
// finished reviewing. The call for papers closed on 16 August.` -- naming a
// CFP close DATE. This app has no per-event "CFP closed on <date>" headline
// on this branch of the empty state: a day label derived from a stored
// instant is a timezone bomb (DEC-522), and DESIGN-RULINGS §B7 rule 2 only
// earns a reason sentence when it is actionable, which a bare close date
// is not for a visitor with no CFP form to act on. The existing sentence
// ("Sessions appear here once the schedule is published.") stays; only the
// aside is built.

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { DatabaseSync } from "node:sqlite";
import { drizzle } from "drizzle-orm/sqlite-proxy";
import * as schema from "../src/db/schema";
import type { Db } from "../src/server/context";
import { getPriorPublicEvent } from "../src/server/repo/public/event";
import { SessionsContent } from "../src/routes/public/sessions";
import type { PublicEvent, PublicSession } from "../src/server/repo/public";

const HERE = dirname(fileURLToPath(import.meta.url)); // test/
const REPO_ROOT = join(HERE, "..");
const DESIGN_FILE = join(REPO_ROOT, "docs", "design", "Chautauqua Public and Portal.dc.html");
const FRAME_LINES = readFileSync(DESIGN_FILE, "utf-8").split("\n");

function frameLine(n: number): string {
  const line = FRAME_LINES[n - 1];
  if (line === undefined) throw new Error(`docs/design/Chautauqua Public and Portal.dc.html has no line ${n}`);
  return line;
}

const RAIL_CSS = readFileSync(join(REPO_ROOT, "src", "routes", "public", "css", "rail.css.ts"), "utf-8");

// ---------------------------------------------------------------------------
// citation
// ---------------------------------------------------------------------------

describe("desktop frame claim: Public sessions · nothing published (v12m-w3-y)", () => {
  it("docs/design/Chautauqua Public and Portal.dc.html:1167 draws the fresh-empty sessions frame this aside answers", () => {
    // docs/design/Chautauqua Public and Portal.dc.html:1167
    // `Public sessions · nothing published`
    expect(frameLine(1167)).toContain("Public sessions · nothing published");
  });

  it("docs/design/Chautauqua Public and Portal.dc.html:1193's rule-heading is 'Last year', built verbatim in rail.css.ts/sessions.tsx", () => {
    // docs/design/Chautauqua Public and Portal.dc.html:1193
    // `<span style="font-family:'Familjen Grotesk', sans-serif; font-size:11px; font-weight:700; letter-spacing:0.12em; text-transform:uppercase">Last year</span>`
    expect(frameLine(1193)).toContain(">Last year<");
    expect(RAIL_CSS).toContain(".chq-pub-lastyear-heading");
  });
});

// ---------------------------------------------------------------------------
// getPriorPublicEvent (real in-memory SQLite, sqlite-proxy pattern)
// ---------------------------------------------------------------------------

const DDL = `
create table event (
  id text primary key,
  org_id text,
  name text,
  slug text,
  start_date text,
  end_date text,
  location text,
  timezone text,
  record_prefix text,
  branding_json text,
  created_at integer,
  updated_at integer
);
create table submission (
  id text primary key,
  event_id text,
  form_id text,
  seq integer,
  title text,
  description text,
  track_id text,
  additional_track_ids_json text,
  status text,
  content_status text,
  accepted_at integer,
  ics_sequence integer,
  external_ref text,
  created_at integer,
  updated_at integer
);
create table participant (
  id text primary key,
  submission_id text,
  contact_id text,
  visible integer,
  invite_status text
);
create table schedule_slot (
  id text primary key,
  submission_id text,
  day text
);
create table contact (
  id text primary key,
  org_id text
);
`;

function makeTestDb(): Db {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec(DDL);
  const db = drizzle(
    async (sqlText, params, method) => {
      const stmt = sqlite.prepare(sqlText);
      stmt.setReturnArrays(true);
      if (method === "run") {
        stmt.run(...params);
        return { rows: [] };
      }
      const rows = stmt.all(...params) as unknown[];
      return { rows };
    },
    { schema },
  );
  return db as unknown as Db;
}

const NOW = new Date();

function insertEvent(
  db: Db,
  row: { id: string; orgId: string; name: string; slug: string; startDate: string; endDate: string },
) {
  return db.insert(schema.event).values({
    id: row.id,
    orgId: row.orgId,
    name: row.name,
    slug: row.slug,
    startDate: row.startDate,
    endDate: row.endDate,
    timezone: "UTC",
    createdAt: NOW,
    updatedAt: NOW,
  });
}

function insertPublishedSession(db: Db, id: string, eventId: string) {
  return db.insert(schema.submission).values({
    id,
    eventId,
    seq: 1,
    title: `Session ${id}`,
    status: "accepted",
    contentStatus: "approved",
    createdAt: NOW,
    updatedAt: NOW,
  });
}

const THIS_EVENT = { id: "e-2027", orgId: "org-1", name: "DevFlow Conf 2027", slug: "devflow-2027", startDate: "2027-05-12", endDate: "2027-05-14" };

describe("getPriorPublicEvent (DEC-745)", () => {
  it("returns null when the org has no prior event at all", async () => {
    const db = makeTestDb();
    await insertEvent(db, THIS_EVENT);
    const result = await getPriorPublicEvent(db, { ...THIS_EVENT, location: null, timezone: "UTC", recordPrefix: "SES", brandingJson: null });
    expect(result).toBeNull();
  });

  it("returns null when the prior event exists but has zero publicly-visible sessions", async () => {
    const db = makeTestDb();
    await insertEvent(db, THIS_EVENT);
    await insertEvent(db, { id: "e-2026", orgId: "org-1", name: "DevFlow Conf 2026", slug: "devflow-2026", startDate: "2026-05-13", endDate: "2026-05-15" });
    // A pending (not-yet-accepted) submission never counts as a visible session.
    await db.insert(schema.submission).values({ id: "sub-pending", eventId: "e-2026", seq: 1, title: "Pending", status: "pending", contentStatus: "pending", createdAt: NOW, updatedAt: NOW });

    const result = await getPriorPublicEvent(db, { ...THIS_EVENT, location: null, timezone: "UTC", recordPrefix: "SES", brandingJson: null });
    expect(result).toBeNull();
  });

  it("returns the prior event and its visible session count when sessions are published", async () => {
    const db = makeTestDb();
    await insertEvent(db, THIS_EVENT);
    await insertEvent(db, { id: "e-2026", orgId: "org-1", name: "DevFlow Conf 2026", slug: "devflow-2026", startDate: "2026-05-13", endDate: "2026-05-15" });
    await insertPublishedSession(db, "sub-1", "e-2026");
    await insertPublishedSession(db, "sub-2", "e-2026");

    const result = await getPriorPublicEvent(db, { ...THIS_EVENT, location: null, timezone: "UTC", recordPrefix: "SES", brandingJson: null });
    expect(result).not.toBeNull();
    expect(result?.event.slug).toBe("devflow-2026");
    expect(result?.sessionCount).toBe(2);
  });

  it("never crosses org boundaries -- a different org's published prior event is invisible", async () => {
    const db = makeTestDb();
    await insertEvent(db, THIS_EVENT);
    await insertEvent(db, { id: "e-other-org", orgId: "org-2", name: "Other Org Conf", slug: "other-conf", startDate: "2026-01-01", endDate: "2026-01-02" });
    await insertPublishedSession(db, "sub-1", "e-other-org");

    const result = await getPriorPublicEvent(db, { ...THIS_EVENT, location: null, timezone: "UTC", recordPrefix: "SES", brandingJson: null });
    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// SessionsContent render (mirrors test/public-sessions-anatomy.test.ts)
// ---------------------------------------------------------------------------

const EVENT: PublicEvent = {
  id: "e1",
  orgId: "org1",
  name: "DevFlow Conf",
  slug: "devflow",
  startDate: "2026-08-10",
  endDate: "2026-08-12",
  location: null,
  timezone: "UTC",
  recordPrefix: "SES",
  brandingJson: null,
};

const PRIOR_EVENT: PublicEvent = { ...EVENT, id: "e0", slug: "devflow-2026-prior", name: "DevFlow Conf 2026" };

function render(overrides: Partial<Parameters<typeof SessionsContent>[0]> = {}): string {
  const items = (overrides.items ?? []) as PublicSession[];
  return String(
    SessionsContent({
      event: EVENT,
      tracks: [],
      activeTrackId: null,
      q: null,
      items,
      total: items.length,
      page: 1,
      ...overrides,
    }),
  );
}

describe("SessionsContent fresh-empty branch: 'Last year' aside (DEC-745)", () => {
  it("renders the aside naming the prior event and its session count when lastYear is supplied", () => {
    const html = render({ lastYear: { event: PRIOR_EVENT, sessionCount: 48 } });
    expect(html).toContain('class="chq-pub-sessions-fresh-layout"');
    expect(html).toContain('class="chq-pub-lastyear-rail"');
    expect(html).toContain("Last year");
    expect(html).toContain("DevFlow Conf 2026");
    expect(html).toContain("48 sessions");
    expect(html).toContain("Sessions ›");
    expect(html).toContain(`/e/${PRIOR_EVENT.slug}/sessions`);
  });

  it("renders no aside when lastYear is null (no prior event, or a prior event with nothing visible)", () => {
    const html = render({ lastYear: null });
    expect(html).toContain("The programme is not out yet");
    expect(html).not.toContain('class="chq-pub-lastyear-rail"');
  });

  it("renders no aside when lastYear is omitted entirely (the default, populated branches)", () => {
    const html = render({ items: [], total: 0 });
    expect(html).not.toContain('class="chq-pub-lastyear-rail"');
  });

  it("never renders the aside on /embed even when lastYear is supplied (DEC-672: chromeless is closed both ways)", () => {
    const html = render({ lastYear: { event: PRIOR_EVENT, sessionCount: 48 }, embed: true });
    expect(html).not.toContain('class="chq-pub-lastyear-rail"');
  });
});

// ---------------------------------------------------------------------------
// 390 phone stack (DEC-385 single terminal @media (max-width: 700px) block)
// ---------------------------------------------------------------------------

describe("phone stack for the 'Last year' aside (DEC-385 single terminal block)", () => {
  it("collapses .chq-pub-sessions-fresh-layout to one column and floors the Sessions-› link at 44px inside the sheet's ONE terminal ≤700px block", () => {
    const terminalStart = RAIL_CSS.lastIndexOf("@media (max-width: 700px)");
    expect(terminalStart).toBeGreaterThan(-1);
    const terminalBlock = RAIL_CSS.slice(terminalStart);
    expect(terminalBlock).toContain(".chq-pub-sessions-fresh-layout { grid-template-columns: 1fr; gap: 20px; }");
    expect(terminalBlock).toContain(".chq-pub-lastyear-link {");
    expect(terminalBlock).toContain("min-height: 44px;");
    // Exactly one ≤700px block in the file (DEC-385 terminal-block discipline).
    const mediaOccurrences = RAIL_CSS.split("@media (max-width: 700px)").length - 1;
    expect(mediaOccurrences).toBe(1);
  });
});
