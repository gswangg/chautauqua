// DEC-613 (wave 27 amendment): docs/design/Chautauqua Public and
// Portal.dc.html:1051 draws the bare legend "Format" while FormatChoices
// renders <legend>{field.label}</legend> over a stored label of "Session
// format". The identical question was already settled one control to the
// right (cfp.css.ts's DEC-613 wave-96 "Draft"/"Save draft" ruling): a
// frame's abbreviated legend never renames stored data, the stored label
// ships at every width, and a one-row fix would leave the next abbreviation
// to be re-litigated (DEC-180) -- so this suite derives the WHOLE register.
//
// Harness: copied verbatim from test/portal-page-headings.test.ts's
// vi.mock/buildApp shape and test/submit-cfp-frame-copy.test.ts's fakeDb/
// appWithDb/FIELD_ROWS shape for GET /submit/:eventSlug -- a source scan is
// not a render (DEC-613 wave-26/wave-24 amendments: copy an existing
// harness, never mint a fifth mock stack). FIELD_ROWS below is byte-for-byte
// the same array test/submit-cfp-frame-copy.test.ts uses, per this task's
// brief, so the two fixtures cannot drift apart.
//
// See docs/design/audit/cfp-stored-label-register-v12.md for the full
// derivation (every <legend>/<label> literal caption drawn in the CFP
// frames of Chautauqua Public and Portal.dc.html, resolved to STORED,
// CHROME, or CONFLICT) that this suite's REGISTER mirrors and pins.

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { Hono } from "hono";
import { publicSubmitRoutes } from "../src/routes/public/submit";
import { registerErrorHandler } from "../src/server/http";
import type { AppEnv } from "../src/server/env";
import { DEC_998 } from "../src/decisions";

void DEC_998; // the Format-legend in-body citation below pairs with this file's header-block scope citation into the same frame

const HERE = dirname(fileURLToPath(import.meta.url));
const DESIGN_FILE = join(HERE, "..", "docs", "design", "Chautauqua Public and Portal.dc.html");

/** DEC-967 shape: read the ACTUAL line, assert it byte-for-byte matches the
 * literal this file claims (copied from
 * app/src/pages/agenda/PhoneAgenda.clash390.render.test.tsx's verbatimLine). */
function verbatimLine(lineNo: number, literal: string): void {
  const lines = readFileSync(DESIGN_FILE, "utf-8").split("\n");
  const line = lines[lineNo - 1];
  if (line === undefined) throw new Error(`design file has no line ${lineNo}`);
  expect(line).toBe(literal);
}

const EVENT_ROW = {
  id: "event-1",
  orgId: "org-1",
  name: "Test Conf",
  slug: "test-conf",
  recordPrefix: "SES",
  timezone: "UTC",
  brandingJson: null,
};

const FORM_ROW = {
  id: "form-1",
  eventId: "event-1",
  title: "Speak at Test Conf",
  description: null,
  isDefault: true,
  openDate: null,
  closeDate: null,
  tracksJson: null,
};

const TRACK_ROWS = [
  { id: "track-1", name: "Main Track" },
  { id: "track-2", name: "Second Track" },
];

// Byte-for-byte the same fixture test/submit-cfp-frame-copy.test.ts's
// FIELD_ROWS uses (mirrored, not imported -- that file is owned by a
// different branch this task must not edit).
const FIELD_ROWS = [
  { id: "title", section: "session", kind: "text", label: "Title", helpText: null, required: true, position: 0, optionsJson: null, ruleJson: null },
  { id: "description", section: "session", kind: "long_text", label: "Description", helpText: "Old help text", required: true, position: 1, optionsJson: null, ruleJson: null },
  {
    id: "field_session_format",
    role: "session_format",
    section: "session",
    kind: "dropdown",
    label: "Session format",
    helpText: "5 options",
    required: true,
    position: 2,
    optionsJson: JSON.stringify(["Talk (30 min)", "Talk (45 min)", "Workshop"]),
    ruleJson: null,
  },
  { id: "first_name", section: "speaker", kind: "text", label: "First name", helpText: null, required: true, position: 3, optionsJson: null, ruleJson: null },
  { id: "last_name", section: "speaker", kind: "text", label: "Last name", helpText: null, required: true, position: 4, optionsJson: null, ruleJson: null },
  { id: "email", section: "speaker", kind: "text", label: "Email", helpText: null, required: true, position: 5, optionsJson: null, ruleJson: null },
  { id: "bio", section: "speaker", kind: "long_text", label: "Speaker bio", helpText: "Old bio help", required: false, position: 6, optionsJson: null, ruleJson: null },
  { id: "field_notes_for_reviewers", section: "session", kind: "long_text", label: "Notes for reviewers", helpText: null, required: false, position: 7, optionsJson: null, ruleJson: null },
  { id: "field_accessibility_needs", section: "session", kind: "text", label: "Accessibility needs", helpText: null, required: false, position: 8, optionsJson: null, ruleJson: null },
];

function makeChain(rows: unknown[]) {
  const chain: any = {
    from: () => chain,
    innerJoin: () => chain,
    where: () => chain,
    orderBy: () => chain,
    limit: async () => rows,
    then: (resolve: (v: unknown[]) => void, reject?: (e: unknown) => void) => Promise.resolve(rows).then(resolve, reject),
  };
  return chain;
}

function fakeDb(selectQueue: unknown[][]) {
  let call = 0;
  const db = {
    select: () => {
      const rows = selectQueue[call] ?? [];
      call += 1;
      return makeChain(rows);
    },
    insert: () => ({ values: () => ({ then: (resolve: (v: undefined) => void) => resolve(undefined) }) }),
    update: () => ({ set: () => ({ where: async () => {} }) }),
    delete: () => ({ where: async () => {} }),
  };
  return db as unknown as AppEnv["Variables"]["db"];
}

function fakeKv() {
  const store = new Map<string, string>();
  return {
    async get(key: string) {
      return store.has(key) ? store.get(key)! : null;
    },
    async put(key: string, value: string) {
      store.set(key, value);
    },
    async delete(key: string) {
      store.delete(key);
    },
  };
}

function appWithDb(db: AppEnv["Variables"]["db"]) {
  const app = new Hono<AppEnv>();
  registerErrorHandler(app);
  app.use("*", async (c, next) => {
    c.set("db", db);
    await next();
  });
  app.route("/", publicSubmitRoutes);
  return app;
}

async function getSubmitPage() {
  const db = fakeDb([[EVENT_ROW], [FORM_ROW], FIELD_ROWS, TRACK_ROWS]);
  const app = appWithDb(db);
  const res = await app.request("/submit/test-conf", { headers: {} }, { KV: fakeKv() } as unknown as AppEnv["Bindings"]);
  expect(res.status).toBe(200);
  return res.text();
}

type Verdict = "stored" | "chrome" | "conflict";

interface RegisterRow {
  /** The literal caption text drawn as the field's legend/label position in the frame. */
  frameCaption: string;
  /** What resolves the position: a stored form_field row, or page chrome. */
  verdict: Verdict;
  /** The stored form_field.label this position resolves to, if any. */
  storedLabel?: string;
  /** True when FIELD_ROWS above actually seeds this field, so the render below can pin it. */
  fixtureCovered: boolean;
}

// The derived register (docs/design/audit/cfp-stored-label-register-v12.md
// carries the full derivation prose per row). DEC-180: this is the WHOLE
// population of <legend>/<label> literal captions the CFP frames draw
// across Chautauqua Public and Portal.dc.html's three "Submit a talk"
// frames (desktop :894, phone 390 :1014, rejected-on-submit :1211) -- not a
// hand-picked subset.
const REGISTER: RegisterRow[] = [
  { frameCaption: "Title", verdict: "stored", storedLabel: "Title", fixtureCovered: true },
  { frameCaption: "Abstract", verdict: "stored", storedLabel: "Description", fixtureCovered: true },
  { frameCaption: "Track", verdict: "chrome", fixtureCovered: true },
  { frameCaption: "Format", verdict: "stored", storedLabel: "Session format", fixtureCovered: true },
  { frameCaption: "Audience level", verdict: "stored", storedLabel: "Audience level", fixtureCovered: false },
  { frameCaption: "Name", verdict: "chrome", fixtureCovered: true },
  { frameCaption: "Email", verdict: "stored", storedLabel: "Email", fixtureCovered: true },
  { frameCaption: "Company · optional", verdict: "stored", storedLabel: "Company", fixtureCovered: false },
  { frameCaption: "Job title · optional", verdict: "stored", storedLabel: "Job title", fixtureCovered: false },
  { frameCaption: "Bio · optional", verdict: "conflict", storedLabel: "Speaker bio", fixtureCovered: true },
  { frameCaption: "Notes for reviewers · optional", verdict: "stored", storedLabel: "Notes for reviewers", fixtureCovered: true },
  { frameCaption: "Accessibility needs · optional", verdict: "stored", storedLabel: "Accessibility needs", fixtureCovered: true },
];

describe("CFP stored-label register — vacuity tripwire", () => {
  it("derives a non-empty register", () => {
    expect(REGISTER.length).toBeGreaterThan(0);
  });

  it("contains the Format/Session format row that motivated this amendment", () => {
    // In-body receipt (DEC-998 wave-17, task w17-c): docs/design/Chautauqua Public and Portal.dc.html:1051 draws `          <span style="font-size:11px; font-weight:800; letter-spacing:0.1em; text-transform:uppercase; color:#565A4B">Format</span>`, checked byte-for-byte by verbatimLine() immediately below.
    verbatimLine(
      1051,
      '          <span style="font-size:11px; font-weight:800; letter-spacing:0.1em; text-transform:uppercase; color:#565A4B">Format</span>',
    );
    const row = REGISTER.find((r) => r.frameCaption === "Format");
    expect(row).toBeDefined();
    expect(row!.verdict).toBe("stored");
    expect(row!.storedLabel).toBe("Session format");
  });
});

describe("GET /submit/:eventSlug — stored labels ship, frame abbreviations don't (DEC-613 wave-27)", () => {
  const storedFixtureRows = REGISTER.filter((r) => r.verdict === "stored" && r.fixtureCovered && r.storedLabel);

  it("has at least one fixture-covered stored row to assert (register is not vacuous under this fixture)", () => {
    expect(storedFixtureRows.length).toBeGreaterThan(0);
  });

  it.each(storedFixtureRows.map((r) => [r.frameCaption, r.storedLabel!] as const))(
    "ships the stored label %2$s at the position the frame abbreviates to %1$s, and never the abbreviation as a legend",
    async (frameCaption, storedLabel) => {
      const body = await getSubmitPage();
      expect(body).toContain(storedLabel);
      // The frame's short form must never appear as a <legend>...</legend>
      // (FormatChoices/AudienceChoices) contents -- only as a literal
      // <legend>FULL STORED LABEL</legend> or chq-field-label span.
      const abbreviatedLegend = new RegExp(`<legend>${frameCaption.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}</legend>`);
      expect(body).not.toMatch(abbreviatedLegend);
    },
  );

  it("renders the Format group's legend as the stored label, not the frame's bare 'Format'", async () => {
    // docs/design/Chautauqua Public and Portal.dc.html:1051 `<span style="font-size:11px; font-weight:800; letter-spacing:0.1em; text-transform:uppercase; color:#565A4B">Format</span>` -- in-body receipt pairing with this file's header-block scope citation (DEC-998).
    const body = await getSubmitPage();
    expect(body).toContain("<legend>Session format</legend>");
    expect(body).not.toContain("<legend>Format</legend>");
  });

  it("renders the Description field's label as the stored label, not the frame's 'Abstract'", async () => {
    const body = await getSubmitPage();
    expect(body).toContain(">Description<");
    expect(body).not.toContain(">Abstract<");
  });

  it("CHROME row: Track's legend is page vocabulary, not a stored field (trackIds carries no FormFieldDef)", async () => {
    const body = await getSubmitPage();
    expect(body).toContain("<legend>Track</legend>");
  });

  it("CONFLICT row (flagged, not fixed by this task -- product byte unchanged): Bio ships the frame's chrome label, not the stored 'Speaker bio', via CFP_BIO_LABEL's display-only override", async () => {
    const body = await getSubmitPage();
    expect(body).toContain(">Bio<");
    expect(body).not.toContain(">Speaker bio<");
    const bioRow = REGISTER.find((r) => r.frameCaption === "Bio · optional");
    expect(bioRow!.verdict).toBe("conflict");
  });
});
