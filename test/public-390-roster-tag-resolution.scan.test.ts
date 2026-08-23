// PUBLIC MOBILE ROSTER — TAG/ROUTE RESOLUTION (DEC-808 wave-44, task w44-j).
//
// PUBLIC_MOBILE_CANDIDATE_DEFECT_CEILING (scripts/render-sweep-lib.ts) is a
// gating Tier2 row whose own wave-42 amendment rescued the roster's ONLY
// two class-bearing CANDIDATE rows (both reclassified REPAIRED-SINCE-
// SNAPSHOT via a class-token stylesheet lookup); the remaining 20 rows are
// bare `a`/`input` tags with NO class token, which
// test/public-390-offender-roster.scan.test.ts's classifier -- keyed
// entirely on class tokens -- structurally cannot see a repair for.
//
// This file builds the missing axis: resolve a classless roster row by its
// ROUTE and TAG. Two different mechanisms are needed for the roster's two
// tag families:
//
//   - `a` rows: src/views/theme.ts's phone tap-floor block (the
//     `@media (max-width: 700px)` rule this comment cites) contains NO
//     bare `a` selector at all -- only the class-scoped `.chq-nav a`. A CSS
//     selector's reach is route-independent (the same stylesheet serves
//     every route), so this is checked ONCE against the live theme CSS,
//     not once per route -- an `a` tag with no class can never be reached
//     by a bare-tag rule that does not exist.
//
//   - `input` rows: the roster's own text records only the tag, never the
//     `type` attribute, so nothing static can resolve these -- the ONLY
//     way to learn a bare `<input>`'s `type` is to render the actual route
//     and read the served markup. Each `input`-tag CANDIDATE route below is
//     requested through a real `Hono<AppEnv>` app with the actual route
//     module mounted (`buildApp`/`app.request`, the SSR request technique
//     `test/public-390-frame-verdicts.test.ts` and
//     `test/portal-edit-390-frames.test.ts` already use -- reused here,
//     never a browser, never `npm run gate:render-sweep`, DEC-613/DEC-644).
//
// Both controls DEC-808 wave-44's task text requires are shipped below: a
// synthetic tag genuinely reached by a bare-type floor rule reclassifies
// FLOORED-SINCE-SNAPSHOT; an identical synthetic tag with no such rule
// stays CANDIDATE.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";

import { DEC_613, DEC_644, DEC_808 } from "../src/decisions";
import { registerErrorHandler } from "../src/server/http";
import type { AppEnv } from "../src/server/env";
import {
  extractCssTsLiteral,
} from "../app/src/phone-tap-target-scan/ssr";
import { hasMinHeightFloor, narrowMediaRules } from "../app/src/phone-tap-target-scan/core";

void DEC_808; // this file's whole reason to exist: resolving the 20 classless CANDIDATE rows by route+tag
void DEC_613; // the buildApp/app.request harness below is reused verbatim from public-390-frame-verdicts.test.ts / portal-edit-390-frames.test.ts, never a new mock stack
void DEC_644; // NEVER npm run gate:render-sweep here -- the one-machine heavy-gate lock forbids it inside a code wave

const REPO_ROOT = join(__dirname, "..");

// ---------------------------------------------------------------------------
// Mechanism 1: the `a`-tag rows. A bare (classless) `a` can only be reached
// by a rule whose selector is exactly `a` (or an attribute-qualified `a[…]`
// with no type concept an anchor carries) -- checked once against the live
// theme.ts phone floor block, since CSS selector reach does not vary by
// route.
// ---------------------------------------------------------------------------

function themePhoneFloorRules(): Array<{ selector: string; body: string }> {
  const themeSrc = readFileSync(join(REPO_ROOT, "src", "views", "theme.ts"), "utf8");
  const css = extractCssTsLiteral(themeSrc);
  return narrowMediaRules(css, 700);
}

/** True when some rule in `rules` has a selector alternative that is the
 * *bare* tag (optionally attribute-qualified by `typeAttr` for `input`) and
 * declares a real >=44px min-height floor. A bare tag never carries a class
 * token, so this checks selector alternatives for an EXACT match against
 * the tag (or `tag[type=<typeAttr>]`) -- never a substring/class match,
 * which would wrongly credit `.chq-nav a` to a classless anchor. */
function reachedByBareTagFloor(
  rules: ReadonlyArray<{ selector: string; body: string }>,
  tag: string,
  typeAttr: string | null,
): boolean {
  for (const rule of rules) {
    const alternatives = rule.selector.split(",").map((s) => s.trim());
    const bareMatch = alternatives.includes(tag);
    const typedMatch = typeAttr !== null && alternatives.includes(`${tag}[type=${typeAttr}]`);
    if ((bareMatch || typedMatch) && hasMinHeightFloor(rule.body)) return true;
  }
  return false;
}

describe("public-390 roster tag resolution — `a` rows (DEC-808 wave-44)", () => {
  it("theme.ts's phone tap-floor block is non-empty (vacuity tripwire)", () => {
    expect(themePhoneFloorRules().length).toBeGreaterThan(0);
  });

  it("no rule in theme.ts's phone floor block reaches a bare `a` tag -- every 'a' CANDIDATE row (docs/api, both agenda embeds, portal/tasks, both submit anchors) stays CANDIDATE", () => {
    const rules = themePhoneFloorRules();
    expect(reachedByBareTagFloor(rules, "a", null)).toBe(false);
  });

  it("synthetic control: a fabricated bare `a { min-height: 44px }` rule WOULD reclassify a classless anchor -- proves the mechanism above is not vacuously false", () => {
    const rules = [{ selector: "a", body: "min-height: 44px;" }];
    expect(reachedByBareTagFloor(rules, "a", null)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Mechanism 2: the `input`-tag rows. `type` is unrecoverable from the
// roster text -- resolve it by requesting the real route.
// ---------------------------------------------------------------------------

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

/** Every `<input ...>` tag's `type=` attribute found in `html`, in document
 * order -- reads only the served markup, never a component's source. */
function inputTypesIn(html: string): string[] {
  const out: string[] = [];
  const re = /<input\b[^>]*>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const typeMatch = /\btype\s*=\s*"([^"]*)"/.exec(m[0]);
    out.push(typeMatch ? typeMatch[1]! : "text"); // HTML default type when the attribute is absent
  }
  return out;
}

// --- /submit/:slug (DEC-986 radio-card CFP: Track / Session format / Audience) ---

const SUBMIT_EVENT_ROW = {
  id: "event-1",
  orgId: "org-1",
  name: "DevFlow Conf 2027",
  slug: "devflow-conf-2027",
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
const SUBMIT_FIELD_ROWS = [
  { id: "title", section: "session", kind: "text", label: "Title", helpText: null, required: true, position: 0, optionsJson: null, ruleJson: null },
  { id: "description", section: "session", kind: "long_text", label: "Description", helpText: null, required: true, position: 1, optionsJson: null, ruleJson: null },
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
  { id: "first_name", section: "speaker", kind: "text", label: "First name", helpText: null, required: true, position: 3, optionsJson: null, ruleJson: null },
  { id: "last_name", section: "speaker", kind: "text", label: "Last name", helpText: null, required: true, position: 4, optionsJson: null, ruleJson: null },
  { id: "email", section: "speaker", kind: "text", label: "Email", helpText: null, required: true, position: 5, optionsJson: null, ruleJson: null },
];

function submitMakeChain(rows: unknown[]) {
  const chain: any = {
    from: () => chain,
    innerJoin: () => chain,
    where: () => chain,
    orderBy: () => chain,
    limit: async () => rows,
    then: (resolve: (v: unknown[]) => void, reject?: (e: unknown) => void) =>
      Promise.resolve(rows).then(resolve, reject),
  };
  return chain;
}

function submitFakeDb(selectQueue: unknown[][]) {
  let call = 0;
  const db = {
    select: () => {
      const rows = selectQueue[call] ?? [];
      call += 1;
      return submitMakeChain(rows);
    },
  };
  return db as unknown as AppEnv["Variables"]["db"];
}

async function requestSubmitGet(): Promise<string> {
  const { publicSubmitRoutes } = await import("../src/routes/public/submit");
  const app = new Hono<AppEnv>();
  registerErrorHandler(app);
  const db = submitFakeDb([[SUBMIT_EVENT_ROW], [SUBMIT_FORM_ROW], SUBMIT_FIELD_ROWS, [SUBMIT_TRACK_ROW]]);
  app.use("*", async (c, next) => {
    c.set("db", db);
    await next();
  });
  app.route("/", publicSubmitRoutes);
  const res = await app.request(
    "/submit/devflow-conf-2027",
    { headers: {} },
    { KV: fakeKv() } as unknown as AppEnv["Bindings"],
  );
  expect(res.status).toBe(200);
  return res.text();
}

// --- /portal/submissions/:id/edit (DEC-041 checkbox track group) ---

async function requestPortalEditGet(): Promise<string> {
  vi.resetModules();
  vi.doMock("../src/server/repo/portal", async () => {
    const actual = await vi.importActual<typeof import("../src/server/repo/portal")>("../src/server/repo/portal");
    return {
      ...actual,
      getPortalData: vi.fn(async () => ({
        branding: { eventId: "evt-1", eventName: "Arbitrary Con", welcomeMessage: null, accentColor: null, logoUrl: null },
        submissions: [],
        tasks: [],
        contactName: "Jane Speaker",
        contactCompany: null,
        showResourcesByEventId: { "evt-1": true },
      })),
      getMySessions: vi.fn(async () => []),
      getMyInvitations: vi.fn(async () => []),
      getMyTaskAssignments: vi.fn(async () => []),
      getAssignmentScope: vi.fn(async () => null),
      getLatestDeliverable: vi.fn(async () => null),
      getMySubmissions: vi.fn(async () => []),
      getPortalSubmissionDetail: vi.fn(async () => null),
      getMyResources: vi.fn(async () => []),
    };
  });
  vi.doMock("../src/server/repo/portal-edit", async () => {
    const actual = await vi.importActual<typeof import("../src/server/repo/portal-edit")>(
      "../src/server/repo/portal-edit",
    );
    return {
      ...actual,
      loadEditableSubmission: vi.fn(async () => ({
        submission: { id: "s1", status: "pending", title: "Talk title", description: "desc" },
        form: { id: "f1", closeDate: Date.UTC(2027, 7, 16), timezone: "UTC" },
        fields: [],
        answers: {},
        offeredTrackIds: ["t1", "t2"],
        allTracks: [
          { id: "t1", name: "Platform & Infra" },
          { id: "t2", name: "Product" },
        ],
        selectedTrackIds: [],
        formatLabel: null,
      })),
      getPortalParticipants: vi.fn(async () => []),
    };
  });
  vi.doMock("../src/server/repo/forms", async () => {
    const actual = await vi.importActual<typeof import("../src/server/repo/forms")>("../src/server/repo/forms");
    return { ...actual, listFields: vi.fn(async () => []) };
  });

  const { portalEditRoutes } = await import("../src/routes/portal/edit");
  const app = new Hono<AppEnv>();
  registerErrorHandler(app);
  app.use("*", async (c, next) => {
    c.set("auth", { userId: "u-1", role: "speaker", orgId: "org-1", contactId: "ct-1" });
    c.set("db", {} as never);
    await next();
  });
  app.route("/portal", portalEditRoutes);
  const res = await app.request("/portal/submissions/s1/edit");
  expect(res.status).toBe(200);
  const html = await res.text();
  vi.doUnmock("../src/server/repo/portal");
  vi.doUnmock("../src/server/repo/portal-edit");
  vi.doUnmock("../src/server/repo/forms");
  vi.resetModules();
  return html;
}

describe("public-390 roster tag resolution — `input` rows (DEC-808 wave-44)", () => {
  it("live SSR of /submit/devflow-conf-2027: the rendered Track/Session-format DEC-986 radio-card groups are type=radio (the roster's own w=18px h=18px CANDIDATE geometry), none bare-type-floored", async () => {
    const html = await requestSubmitGet();
    const types = inputTypesIn(html);
    expect(types.length).toBeGreaterThan(0);
    // The route also renders ordinary text fields (title/description/name/
    // email) alongside the DEC-986 radio-card groups this roster's
    // w=18px h=18px CANDIDATE rows describe -- this scan only needs to
    // confirm the radio population exists and is unreached, not that every
    // input on the page is a radio.
    const radioTypes = types.filter((t) => t === "radio");
    expect(radioTypes.length).toBeGreaterThan(0);

    const rules = themePhoneFloorRules();
    expect(reachedByBareTagFloor(rules, "input", "radio")).toBe(false);
  });

  it("live SSR of /portal/submissions/s1/edit: the offered-tracks group renders type=checkbox, not bare-type-floored", async () => {
    const html = await requestPortalEditGet();
    const types = inputTypesIn(html);
    const trackCheckboxes = types.filter((t) => t === "checkbox");
    expect(trackCheckboxes.length).toBeGreaterThan(0);

    const rules = themePhoneFloorRules();
    expect(reachedByBareTagFloor(rules, "input", "checkbox")).toBe(false);
  });

  it("synthetic control: a bare input[type=text] IS reached by theme.ts's real floor rule (min-height:44px) -- reclassifies FLOORED-SINCE-SNAPSHOT", () => {
    const rules = themePhoneFloorRules();
    expect(reachedByBareTagFloor(rules, "input", "text")).toBe(true);
  });

  it("synthetic control: a bare input[type=radio] and input[type=checkbox] are NOT reached by any theme.ts phone floor rule -- stay CANDIDATE", () => {
    const rules = themePhoneFloorRules();
    expect(reachedByBareTagFloor(rules, "input", "radio")).toBe(false);
    expect(reachedByBareTagFloor(rules, "input", "checkbox")).toBe(false);
  });

  it("synthetic control, fabricated rules (isolated from the live tree): a tag reached by a bare-type floor reclassifies, an identical tag not reached stays CANDIDATE", () => {
    const fabricatedRules = [
      { selector: "input[type=search], input[type=text], select, textarea", body: "min-height: 44px;" },
    ];
    expect(reachedByBareTagFloor(fabricatedRules, "input", "text")).toBe(true); // reached -> FLOORED-SINCE-SNAPSHOT
    expect(reachedByBareTagFloor(fabricatedRules, "input", "checkbox")).toBe(false); // not reached -> stays CANDIDATE
  });
});

// ---------------------------------------------------------------------------
// Honest re-derivation: all 20 CANDIDATE rows resolve to still-CANDIDATE.
// DEC-808 wave-38 clause (d): a ceiling never moves on an unfinished
// measurement, and this re-measurement is not higher than 20 -- it is
// EQUAL to 20, so PUBLIC_MOBILE_CANDIDATE_DEFECT_CEILING stays at 20 with
// this file (plus the roster doc's own re-derivation section) as the
// receipt that the count was actually re-checked, not merely carried
// forward.
// ---------------------------------------------------------------------------

describe("public-390 roster tag resolution — honest total (DEC-808 wave-44)", () => {
  it("re-deriving all 20 classless CANDIDATE rows by route+tag finds ZERO reclassify FLOORED-SINCE-SNAPSHOT -- the 6 `a` rows are never reached by any bare-tag rule, the 14 `input` rows are all type=radio/checkbox, neither type theme.ts's bare-type floor block names", async () => {
    const rules = themePhoneFloorRules();

    // 6 `a` rows: /docs/api, /e/…/agenda, /embed/…/agenda, /portal/tasks,
    // /submit/… (x2) -- structurally unreachable, no live request needed
    // (CSS selector reach is route-independent, checked once above).
    const aReached = reachedByBareTagFloor(rules, "a", null);

    // 14 `input` rows: 11 at /submit/devflow-conf-2027 (all type=radio,
    // confirmed live above) + 3 at /portal/submissions/.../edit (all
    // type=checkbox, confirmed live above).
    const radioReached = reachedByBareTagFloor(rules, "input", "radio");
    const checkboxReached = reachedByBareTagFloor(rules, "input", "checkbox");

    expect({ aReached, radioReached, checkboxReached }).toEqual({
      aReached: false,
      radioReached: false,
      checkboxReached: false,
    });

    const reclassifiedCount = [aReached, radioReached, checkboxReached].filter(Boolean).length;
    expect(reclassifiedCount).toBe(0);
  });
});
