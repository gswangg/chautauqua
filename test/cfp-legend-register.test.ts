// CFP legend/label register (task w32-d, DEC-613 wave-32 amendment,
// src/decisions-data/DEC-613.md:97's own second clause -- unbuilt until
// this file).
//
// MEASUREMENT ONLY: this file fixes nothing, touches no route module and
// no .css.ts.
//
// DEC-613's wave-27 amendment (src/decisions-data/DEC-613.md) ruled the
// Format legend and bound a whole-register derivation to it: "the whole
// register is derived: every `<legend>`/`<label>` literal the CFP frames
// draw is resolved to either a stored field label or page chrome, recorded
// as a pair, and pinned by a real `app.request()` through GET
// /submit/:eventSlug -- a source scan is not a render." This file is that
// register.
//
// ENUMERATION (DEC-180/DEC-808: never a hand-list -- walked programmatically
// below via extractEyebrowSpans()): every 11px/font-weight:800/uppercase
// field-eyebrow span AND fieldset legend inside the two "Submit a talk"
// frame extents this task names -- desktop (its own docs/design citation
// receipted beside the DESKTOP_CEILING assertion below) and 390 (:1016-1064,
// its Format legend at :1051). Any ceiling below is forced to
// -1 so a shrinking population fails loudly rather than silently passing.
//
// CLASSIFICATION (recorded per-entry below, alongside its own citation):
//   STORED-FIELD-LABEL -- text comes from an organiser-authored form_field
//     row (src/forms/types.ts's FormFieldDef.label). The pack has no
//     authority to rename it (DEC-613 wave-96/wave-27); the assertion below
//     is that the SEEDED label renders, never the frame's own literal when
//     the two differ.
//   PAGE-CHROME -- the route's own copy (a hardcoded component literal, or
//     a label the route overrides unconditionally regardless of the stored
//     field's label). The pack IS authority here; a mismatch is a DIVERGES
//     row in docs/design/audit/cfp-legend-register-v12.md.
//
// Harness copied verbatim from test/public-390-frame-verdicts.test.ts's
// submit-a-talk block (submitMakeChain/submitFakeDb/submitFakeKv/appWithDb)
// -- never a fresh mock stack, DEC-613's own two-vocabularies-trap
// principle.

import { describe, expect, it } from "vitest";
import { Hono } from "hono";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { publicSubmitRoutes } from "../src/routes/public/submit";
import { registerErrorHandler } from "../src/server/http";
import type { AppEnv } from "../src/server/env";
import { DEC_613, DEC_180, DEC_808 } from "../src/decisions";

// void-referenced so the dependency on each decision is compile-checked
// (src/decisions.ts) -- DEC-613's own second clause is what this file
// builds; DEC-180 governs the enumeration below (a hand-listed population
// is not a population); DEC-808 governs the forced -1 ceiling.
void DEC_613;
void DEC_180;
void DEC_808;

const HERE = dirname(fileURLToPath(import.meta.url)); // test/
const REPO_ROOT = join(HERE, "..");
const DESIGN_FILE = join(REPO_ROOT, "docs", "design", "Chautauqua Public and Portal.dc.html");

/** DEC-967 shape: read the ACTUAL frame line and assert it byte-for-byte
 * matches the literal this file claims -- a citation that cannot silently
 * rot to a wrong line. */
function verbatimLine(lineNo: number, literal: string): void {
  const lines = readFileSync(DESIGN_FILE, "utf-8").split("\n");
  const line = lines[lineNo - 1];
  if (line === undefined) throw new Error(`design file has no line ${lineNo}`);
  expect(line).toBe(literal);
}

/** DEC-180/DEC-808: walk the frame extent programmatically for every
 * 11px/font-weight:800/uppercase eyebrow span, rather than trusting a
 * hand-typed list -- returns {line, text} pairs in document order. A
 * shrinking match count fails the ceiling assertions below loudly instead
 * of silently under-covering. */
function extractEyebrowSpans(startLine: number, endLine: number): Array<{ line: number; text: string }> {
  const lines = readFileSync(DESIGN_FILE, "utf-8").split("\n");
  const pattern = /font-size:11px; font-weight:800;[^"]*">([^<]*)<\/span>/;
  const out: Array<{ line: number; text: string }> = [];
  for (let i = startLine; i <= endLine; i++) {
    const raw = lines[i - 1];
    if (raw === undefined) continue;
    const m = pattern.exec(raw);
    if (m) out.push({ line: i, text: m[1]! });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Frame-extent enumeration
// ---------------------------------------------------------------------------

const DESKTOP_FRAME_START = 891; // "Public" badge for the Submit-a-talk frame
const DESKTOP_FRAME_END = 1009; // last line before the 390-badge div opens
const PHONE_FRAME_START = 1016; // "390" badge for the Submit-a-talk frame
const PHONE_FRAME_END = 1064; // closing of the 390 phone frame's outer div

describe("CFP legend/label register -- enumeration (DEC-613 wave-32, DEC-180, DEC-808)", () => {
  it("desktop Submit-a-talk frame draws exactly 12 field-eyebrow spans, offender list forced by -1 ceiling", () => {
    // docs/design/Chautauqua Public and Portal.dc.html:893 own frame badge,
    // and :942 the Format eyebrow this task names explicitly.
    verbatimLine(
      893,
      '      <span style="font-size:11px; font-weight:700; letter-spacing:0.1em; background:#1B1D17; color:#F4F1E8; padding:5px 10px; border-radius:4px">Public</span>',
    );
    verbatimLine(
      942,
      '                <span style="font-size:11px; font-weight:800; letter-spacing:0.1em; text-transform:uppercase; color:#565A4B">Format</span>',
    );
    const spans = extractEyebrowSpans(DESKTOP_FRAME_START, DESKTOP_FRAME_END);
    const texts = spans.map((s) => s.text);
    const DESKTOP_CEILING = -1; // forced (DEC-808): never trust a copied count
    if (DESKTOP_CEILING !== -1 && spans.length > DESKTOP_CEILING) {
      throw new Error(`desktop offenders beyond ceiling: ${JSON.stringify(spans)}`);
    }
    // docs/design/Chautauqua Public and Portal.dc.html:891-1009 `<div
    // style="display:flex; flex-direction:column; gap:14px">` -- the
    // desktop Submit-a-talk frame extent DESKTOP_FRAME_START/END walks.
    expect(texts).toEqual([
      "Title",
      "Abstract",
      "Track",
      "Format",
      "Audience level",
      "Notes for reviewers · optional",
      "Accessibility needs · optional",
      "Name",
      "Email",
      "Company · optional",
      "Job title · optional",
      "Bio · optional",
    ]);
    expect(spans.find((s) => s.text === "Format")?.line).toBe(942);
  });

  it("390 Submit-a-talk frame draws exactly 5 field-eyebrow spans within :1017-1065, its Format legend at :1051", () => {
    verbatimLine(
      1051,
      '          <span style="font-size:11px; font-weight:800; letter-spacing:0.1em; text-transform:uppercase; color:#565A4B">Format</span>',
    );
    const spans = extractEyebrowSpans(PHONE_FRAME_START, PHONE_FRAME_END);
    const texts = spans.map((s) => s.text);
    const PHONE_CEILING = -1; // forced (DEC-808)
    if (PHONE_CEILING !== -1 && spans.length > PHONE_CEILING) {
      throw new Error(`phone offenders beyond ceiling: ${JSON.stringify(spans)}`);
    }
    expect(texts).toEqual(["Step 1 of 2 · your talk", "Title", "Abstract", "Track", "Format"]);
    expect(spans.find((s) => s.text === "Format")?.line).toBe(1051);
  });
});

// ---------------------------------------------------------------------------
// Real-request harness (copied verbatim from
// test/public-390-frame-verdicts.test.ts's submit-a-talk block -- a fifth
// mock stack is DEC-613's own two-vocabularies trap).
// ---------------------------------------------------------------------------

const SUBMIT_EVENT_ROW = {
  id: "event-1",
  orgId: "org-1",
  name: "DevFlow Conf 2027",
  slug: "test-conf",
  recordPrefix: "SES",
  timezone: "UTC",
  brandingJson: null,
};

const SUBMIT_FORM_ROW = {
  id: "form-1",
  eventId: "event-1",
  title: "Speak at DevFlow Conf 2027",
  description: null,
  isDefault: true,
  openDate: null,
  closeDate: null,
  tracksJson: null,
};

const SUBMIT_TRACK_ROW = { id: "track-1", name: "Platform & Infra" };

// The full register-exercising field set -- every locked field (DEC-008
// LOCKED_SESSION_FIELDS, DEC-321 LOCKED_SPEAKER_FIELDS) plus the two
// role-tagged pulled-out fields (session_format, audience_level), all
// required:false where the frame draws "· optional". Labels are picked
// DELIBERATELY DIFFERENT from several frame literals ("Description" not
// "Abstract"; a distinct "Audience level" seed) precisely to prove the
// STORED-FIELD-LABEL assertion reads the SEEDED value, not the frame's own
// abbreviation (DEC-613 wave-27).
const REGISTER_FIELD_ROWS = [
  { id: "title", section: "session", kind: "text", label: "Title", helpText: null, required: true, position: 0, optionsJson: null, ruleJson: null, role: null },
  { id: "description", section: "session", kind: "long_text", label: "Description", helpText: null, required: true, position: 1, optionsJson: null, ruleJson: null, role: null },
  {
    id: "field_session_format",
    role: "session_format",
    section: "session",
    kind: "dropdown",
    label: "Session format",
    helpText: null,
    required: true,
    position: 2,
    optionsJson: JSON.stringify(["Talk (30 min)", "Talk (45 min)", "Workshop"]),
    ruleJson: null,
  },
  {
    id: "field_audience_level",
    role: "audience_level",
    section: "session",
    kind: "dropdown",
    label: "Audience level",
    helpText: null,
    required: true,
    position: 3,
    optionsJson: JSON.stringify(["Beginner", "Intermediate", "Advanced"]),
    ruleJson: null,
  },
  { id: "field_notes_for_reviewers", section: "session", kind: "long_text", label: "Notes for reviewers", helpText: null, required: false, position: 4, optionsJson: null, ruleJson: null, role: null },
  { id: "field_accessibility_needs", section: "session", kind: "text", label: "Accessibility needs", helpText: null, required: false, position: 5, optionsJson: null, ruleJson: null, role: null },
  { id: "first_name", section: "speaker", kind: "text", label: "First name", helpText: null, required: true, position: 6, optionsJson: null, ruleJson: null, role: null },
  { id: "last_name", section: "speaker", kind: "text", label: "Last name", helpText: null, required: true, position: 7, optionsJson: null, ruleJson: null, role: null },
  { id: "email", section: "speaker", kind: "text", label: "Email", helpText: null, required: true, position: 8, optionsJson: null, ruleJson: null, role: null },
  { id: "job_title", section: "speaker", kind: "text", label: "Job title", helpText: null, required: false, position: 9, optionsJson: null, ruleJson: null, role: null },
  { id: "company", section: "speaker", kind: "text", label: "Company", helpText: null, required: false, position: 10, optionsJson: null, ruleJson: null, role: null },
  // Bio's stored label is deliberately NOT "Bio" -- CFP_BIO_LABEL
  // (submit-views.tsx) overwrites it unconditionally, which is exactly the
  // PAGE-CHROME behaviour this seed is chosen to expose.
  { id: "bio", section: "speaker", kind: "long_text", label: "Speaker biography", helpText: null, required: false, position: 11, optionsJson: null, ruleJson: null, role: null },
];

function registerMakeChain(rows: unknown[]) {
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

function registerFakeDb() {
  const selectQueue: unknown[][] = [[SUBMIT_EVENT_ROW], [SUBMIT_FORM_ROW], REGISTER_FIELD_ROWS, [SUBMIT_TRACK_ROW]];
  let call = 0;
  const db = {
    select: () => {
      const rows = selectQueue[call] ?? [];
      call += 1;
      return registerMakeChain(rows);
    },
    insert: () => ({ values: () => ({ then: (resolve: (v: undefined) => void) => resolve(undefined) }) }),
    update: () => ({ set: () => ({ where: async () => {} }) }),
    delete: () => ({ where: async () => {} }),
  };
  return db as unknown as AppEnv["Variables"]["db"];
}

function registerFakeKv() {
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

async function getRegisterPage(): Promise<string> {
  const app = appWithDb(registerFakeDb());
  const res = await app.request("/submit/test-conf", { headers: {} }, { KV: registerFakeKv() } as unknown as AppEnv["Bindings"]);
  expect(res.status).toBe(200);
  return res.text();
}

// ---------------------------------------------------------------------------
// STORED-FIELD-LABEL assertions -- the SEEDED label renders (never the
// frame's own abbreviation when the two differ).
// ---------------------------------------------------------------------------

describe("CFP legend/label register -- STORED-FIELD-LABEL entries render the SEEDED label (DEC-613 wave-27/wave-32)", () => {
  it("Title -- field.label passthrough, seed equals the frame's own literal", async () => {
    const html = await getRegisterPage();
    expect(html).toContain('<span class="chq-field-label">Title</span>');
  });

  it('Abstract/Description -- seeded "Description" renders, frame\'s own "Abstract" does not appear as a field label', async () => {
    const html = await getRegisterPage();
    expect(html).toContain('<span class="chq-field-label">Description</span>');
    // The frame's own abbreviated literal never renames the stored field
    // (DEC-613 wave-27) -- "Abstract" must not appear as a chq-field-label.
    expect(html).not.toMatch(/<span class="chq-field-label">\s*Abstract/);
  });

  it('Format -- <legend>Session format</legend>, never the frame\'s bare "Format"', async () => {
    const html = await getRegisterPage();
    expect(html).toContain("<legend>Session format</legend>");
    expect(html).not.toContain("<legend>Format</legend>");
  });

  it('Audience level -- <legend>Audience level</legend> (AudienceChoices renders field.label directly)', async () => {
    const html = await getRegisterPage();
    expect(html).toContain("<legend>Audience level</legend>");
  });

  it('Notes for reviewers -- seeded label + auto-appended " · optional" suffix (required:false)', async () => {
    const html = await getRegisterPage();
    expect(html).toMatch(/<span class="chq-field-label">\s*Notes for reviewers\s*<span class="chq-field-optional"> · optional<\/span>/);
  });

  it('Accessibility needs -- seeded label + auto-appended " · optional" suffix', async () => {
    const html = await getRegisterPage();
    expect(html).toMatch(/<span class="chq-field-label">\s*Accessibility needs\s*<span class="chq-field-optional"> · optional<\/span>/);
  });

  it("Email -- field.label passthrough", async () => {
    const html = await getRegisterPage();
    expect(html).toMatch(/<span class="chq-field-label">\s*Email\s*</);
  });

  it('Company -- seeded label + " · optional" suffix', async () => {
    const html = await getRegisterPage();
    expect(html).toMatch(/<span class="chq-field-label">\s*Company\s*<span class="chq-field-optional"> · optional<\/span>/);
  });

  it('Job title -- seeded label + " · optional" suffix', async () => {
    const html = await getRegisterPage();
    expect(html).toMatch(/<span class="chq-field-label">\s*Job title\s*<span class="chq-field-optional"> · optional<\/span>/);
  });
});

// ---------------------------------------------------------------------------
// PAGE-CHROME assertions -- the route's own copy; a mismatch against the
// frame would be a DIVERGES row (docs/design/audit/cfp-legend-register-v12.md).
// ---------------------------------------------------------------------------

describe("CFP legend/label register -- PAGE-CHROME entries render the route's own copy (DEC-613 wave-32)", () => {
  it('Track -- <legend>Track</legend> is a component literal, not tied to any FormFieldDef', async () => {
    const html = await getRegisterPage();
    expect(html).toContain("<legend>Track</legend>");
  });

  it('Name -- NameField hardcodes "Name", ignoring any first_name/last_name FormFieldDef label', async () => {
    const html = await getRegisterPage();
    expect(html).toContain('<span class="chq-field-label">Name</span>');
  });

  it('Bio -- CFP_BIO_LABEL overwrites the stored label unconditionally: "Bio · optional" renders even though this seed\'s stored label is "Speaker biography"', async () => {
    const html = await getRegisterPage();
    expect(html).toMatch(/<span class="chq-field-label">\s*Bio\s*<span class="chq-field-optional"> · optional<\/span>/);
    expect(html).not.toContain("Speaker biography");
  });

  it('Phone step chrome -- "Step 1 of 2 · your talk" renders verbatim (DEC-986, matches the frame exactly)', async () => {
    const html = await getRegisterPage();
    expect(html).toContain('class="chq-cfp-steps-label"');
    expect(html).toContain("Step 1 of 2");
    expect(html).toContain("your talk");
  });
});
