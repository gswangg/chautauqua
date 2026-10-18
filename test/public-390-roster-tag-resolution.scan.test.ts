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

import { DEC_613, DEC_644, DEC_808, DEC_996 } from "../src/decisions";
import { registerErrorHandler } from "../src/server/http";
import type { AppEnv } from "../src/server/env";
import {
  extractCssTsLiteral,
} from "../app/src/phone-tap-target-scan/ssr";
import {
  classlessTagSites,
  hasExemptionForToken,
  hasMinHeightFloor,
  narrowMediaRules,
  selectorMentionsToken,
  stripTsxComments,
  topLevelRulesWithExemption,
} from "../app/src/phone-tap-target-scan/core";
import {
  classlessSitesIn,
  FLOORED_BY_ANCESTOR_ROWS,
  PORTAL_ROUTES_ROOT,
  PUBLIC_ROUTES_ROOT,
  tokenFlooredOrExempt,
} from "../app/src/phone-tap-target-scan/public-390-ancestor-floor";

void DEC_808; // this file's whole reason to exist: resolving the 20 classless CANDIDATE rows by route+tag
void DEC_613; // the buildApp/app.request harness below is reused verbatim from public-390-frame-verdicts.test.ts / portal-edit-390-frames.test.ts, never a new mock stack
void DEC_644; // NEVER npm run gate:render-sweep here -- the one-machine heavy-gate lock forbids it inside a code wave
void DEC_996; // the ancestor axis below reuses w39-e's classlessTagSites walk verbatim (DEC-613), never a second copy

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
      getPortalHome: vi.fn(async () => ({ views: [], placements: new Map() })),
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
      getAllSubmissionParticipants: vi.fn(async () => []),
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

// ---------------------------------------------------------------------------
// DEC-808 wave-50 amendment (task w50-b): the ANCESTOR axis.
//
// Mechanisms 1/2 above check only whether a BARE tag/type selector (`a`,
// `input[type=radio]`, ...) reaches a classless roster row -- and correctly
// find none, because this codebase's floor idiom never writes a bare-tag
// phone rule. But native `<label>` click-delegation makes a wrapping
// `<label class="chq-cfp-option">` (or a wrapping `<a>`'s ancestor block,
// for the SSR list-row idiom DEC-393 wave-142 established) the REAL hit box
// for a classless child -- a floor scoped to the ANCESTOR's class token
// reaches the classless child even though no rule ever names the child's
// bare tag. w44-j never checked this axis at all; w39-e (DEC-996 wave-39,
// test/public-390-request-verdicts-classless-roster.scan.test.ts) already
// built and graded it for 15 of these exact sites, restricted to
// src/routes/public/**, and this section reuses that same walk
// (classlessTagSites, DEC-613: imported, never re-derived) rather than a
// second copy.
//
// Two shapes below:
//   (a) still-classless in the current tree: classlessTagSites finds the
//       tag with an empty own-class-attribute and reports its nearest
//       ancestor's chq- token(s) -- checked here for a live floor or a
//       `tap-floor-exempt:` receipt (any flavour: composition for the
//       input rows, inline-in-prose for some `a` rows).
//   (b) drifted OUT of the classless population since the wave-30 snapshot
//       (the roster's frozen text has no token, but the tree today shows
//       the SAME anchor now carrying its own chq- class -- the identical
//       drift w39-e's second describe block already documented for two
//       submit-views.tsx anchors): pinned directly by source substring,
//       then checked the same way for a receipt on that OWN token.
//
// `FLOORED_BY_ANCESTOR_ROWS` is this file's single exported verdict set,
// keyed `${route}|${tag}` -- test/public-390-offender-roster.scan.test.ts
// imports it to subtract exactly these rows from its CANDIDATE count under
// a new EXEMPT-BY-COMPOSITION label (never touching the existing
// REPAIRED-SINCE-SNAPSHOT clause, which is a different mechanism keyed on
// the row's OWN class token).
// The derivation itself (walk + floor/receipt predicate + the resolved
// route+tag set) lives in ONE non-test module,
// app/src/phone-tap-target-scan/public-390-ancestor-floor.ts (DEC-613), so
// this file and test/public-390-offender-roster.scan.test.ts both import
// the SAME `FLOORED_BY_ANCESTOR_ROWS` rather than each re-deriving it (or,
// worse, one importing the other's `.test.ts` module).
const SSR_HAS_CLASS_ATTR_RE = /\bclass(?:Name)?\s*=/;
const SSR_CLASS_ATTR_RE_LOCAL = /\bclass(?:Name)?\s*=\s*(\{[^}]*\}|"[^"]*")/;

describe("public-390 roster tag resolution — ancestor axis, `input` rows (DEC-808 wave-50, task w50-b)", () => {
  it("submit-views.tsx's three chq-cfp-option input sites (track/format/pill radios) are classless with ancestor token chq-cfp-option, and that token carries a live >=44px floor AND a composition receipt in cfp.css.ts", () => {
    const sites = classlessSitesIn(join(PUBLIC_ROUTES_ROOT, "submit-views.tsx"), ["input"]);
    expect(sites.length).toBeGreaterThan(0);
    const cfpOptionSites = sites.filter((s) => s.tokens.includes("chq-cfp-option"));
    expect(cfpOptionSites.length).toBe(3);
    expect(tokenFlooredOrExempt("chq-cfp-option")).toBe(true);
    const cfpCss = extractCssTsLiteral(readFileSync(join(PUBLIC_ROUTES_ROOT, "cfp.css.ts"), "utf-8"));
    expect(hasExemptionForToken(cfpCss, "chq-cfp-option")).toBe(true);
  });

  it("portal/edit.tsx's offered-track checkbox site is classless with ancestor token chq-cfp-option, and that token carries a live >=44px floor AND a composition receipt in portal.css.ts", () => {
    const sites = classlessSitesIn(join(PORTAL_ROUTES_ROOT, "edit.tsx"), ["input"]);
    const cfpOptionSites = sites.filter((s) => s.tokens.includes("chq-cfp-option"));
    expect(cfpOptionSites.length).toBeGreaterThan(0);
    expect(tokenFlooredOrExempt("chq-cfp-option")).toBe(true);
    const portalCss = extractCssTsLiteral(readFileSync(join(PORTAL_ROUTES_ROOT, "portal.css.ts"), "utf-8"));
    expect(hasExemptionForToken(portalCss, "chq-cfp-option")).toBe(true);
  });
});

describe("public-390 roster tag resolution — ancestor axis, `a` rows (DEC-808 wave-50, task w50-b)", () => {
  it("agenda-grid.tsx / agenda-rail.tsx / sessions.tsx's classless anchor sites resolve to chq-pub-agenda-block-title / chq-pub-rail-day-row, both live-floored (>=44px) in rail.css.ts's terminal phone block -- covers the /e/…/agenda and /embed/…/agenda CANDIDATE rows regardless of which component rendered them", () => {
    const files = [
      join(PUBLIC_ROUTES_ROOT, "agenda-grid.tsx"),
      join(PUBLIC_ROUTES_ROOT, "agenda-rail.tsx"),
      join(PUBLIC_ROUTES_ROOT, "sessions.tsx"),
    ];
    const sites = files.flatMap((f) => classlessSitesIn(f, ["a"]));
    expect(sites.length).toBeGreaterThan(0);
    const ancestorTokens = new Set(sites.flatMap((s) => s.tokens));
    for (const expected of ["chq-pub-agenda-block-title", "chq-pub-rail-day-row"]) {
      expect(ancestorTokens.has(expected), `expected ${expected} among ${[...ancestorTokens].join(", ")}`).toBe(true);
    }
    for (const token of ancestorTokens) {
      expect(tokenFlooredOrExempt(token), `${token} is neither floored nor exempt`).toBe(true);
    }
  });

  it("submit-views.tsx's classless anchor sites resolve to chq-cfp-links / chq-cfp-confirm-actions, both live-floored or receipted in cfp.css.ts -- covers the /submit/devflow-conf-2027 CANDIDATE `a` rows regardless of which branch rendered them", () => {
    const sites = classlessSitesIn(join(PUBLIC_ROUTES_ROOT, "submit-views.tsx"), ["a"]);
    expect(sites.length).toBeGreaterThan(0);
    const ancestorTokens = new Set(sites.flatMap((s) => s.tokens));
    for (const expected of ["chq-cfp-links", "chq-cfp-confirm-actions"]) {
      expect(ancestorTokens.has(expected), `expected ${expected} among ${[...ancestorTokens].join(", ")}`).toBe(true);
    }
    for (const token of ancestorTokens) {
      expect(tokenFlooredOrExempt(token), `${token} is neither floored nor exempt`).toBe(true);
    }
  });

  it("docs.tsx's '/login' reference anchor has DRIFTED out of the classless population since the wave-30 snapshot -- it now carries its own class token chq-docs-auth-link (DEVIATIONS.md §10, rung 3), which carries a live tap-floor-exempt receipt in tools.css.ts", () => {
    const src = readFileSync(join(REPO_ROOT, "src", "routes", "docs.tsx"), "utf-8");
    // Negative control: the classless walk over this file finds NO classless
    // `a` sites at all -- proving the absence of a classless '/login' anchor
    // here isn't a walk failure, the anchor genuinely carries a class now
    // (docs.tsx's only other anchor, chq-wordmark, is already EXEMPT in the
    // roster and also carries its own class).
    const classless = classlessTagSites(stripTsxComments(src), ["a"], SSR_HAS_CLASS_ATTR_RE, SSR_CLASS_ATTR_RE_LOCAL);
    expect(classless).toEqual([]);
    expect(src).toContain('<a class="chq-docs-auth-link" href="/login">');
    expect(tokenFlooredOrExempt("chq-docs-auth-link")).toBe(true);
    const toolsCss = extractCssTsLiteral(readFileSync(join(REPO_ROOT, "src", "routes", "tools.css.ts"), "utf-8"));
    expect(hasExemptionForToken(toolsCss, "chq-docs-auth-link")).toBe(true);
  });

  it("portal/tasks/views.tsx's completed-file-request download link has DRIFTED out of the classless population since the wave-30 snapshot -- it now carries its own class token chq-portal-file-link (DEC-393 wave-38 amendment), which carries a live tap-floor-exempt receipt in portal.css.ts", () => {
    const src = readFileSync(join(REPO_ROOT, "src", "routes", "portal", "tasks", "views.tsx"), "utf-8");
    expect(src).toContain('<a class="chq-portal-file-link" href={`/portal/tasks/${t.id}/file`}>');
    expect(tokenFlooredOrExempt("chq-portal-file-link")).toBe(true);
    const portalCss = extractCssTsLiteral(readFileSync(join(PORTAL_ROUTES_ROOT, "portal.css.ts"), "utf-8"));
    expect(hasExemptionForToken(portalCss, "chq-portal-file-link")).toBe(true);
  });

  it("synthetic control: tokenFlooredOrExempt is true for a token with a fabricated live floor rule OR a fabricated exemption receipt, false for a token with neither", () => {
    const flooredCss = `.chq-w50b-floored { min-height: 44px; }`;
    const exemptRaw = `/* tap-floor-exempt: composition -- synthetic */\n.chq-w50b-exempt {}`;
    const neitherCss = `.chq-w50b-neither { color: red; }`;
    // Direct predicate checks (isolated fixtures), mirroring this file's
    // other synthetic controls -- not routed through the module-level
    // ANCESTOR_* arrays, which read the real tree.
    const floorRules = [...topLevelRulesWithExemption(flooredCss)];
    expect(floorRules.some((r) => selectorMentionsToken(r.selector, "chq-w50b-floored") && hasMinHeightFloor(r.body))).toBe(true);
    expect(hasExemptionForToken(exemptRaw, "chq-w50b-exempt")).toBe(true);
    const neitherRules = [...topLevelRulesWithExemption(neitherCss)];
    expect(neitherRules.some((r) => selectorMentionsToken(r.selector, "chq-w50b-neither") && hasMinHeightFloor(r.body))).toBe(false);
    expect(hasExemptionForToken(neitherCss, "chq-w50b-neither")).toBe(false);
  });

  it("FLOORED_BY_ANCESTOR_ROWS (the derivation's single exported output, app/src/phone-tap-target-scan/public-390-ancestor-floor.ts) names exactly the 7 route+tag pairs the describe blocks above proved, covering all 20 CANDIDATE rows (6 `a` + 14 `input`) and none from the roster's already-EXEMPT/REPAIRED-SINCE-SNAPSHOT rows", () => {
    expect([...FLOORED_BY_ANCESTOR_ROWS].sort()).toEqual(
      [
        "/docs/api|a",
        "/e/devflow-conf-2027/agenda|a",
        "/embed/devflow-conf-2027/agenda|a",
        "/portal/tasks|a",
        "/submit/devflow-conf-2027|a",
        "/submit/devflow-conf-2027|input",
        "/portal/submissions/seed_submission_0001/edit|input",
      ].sort(),
    );
  });
});
