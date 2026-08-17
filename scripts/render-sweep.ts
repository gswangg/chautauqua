// DEC-144/DEC-139 browser render-sweep gate: boots a migrated + seeded
// `wrangler dev` on a free local port (same boot/seed sequence CI's
// walkthrough/perf-smoke jobs use — see .github/workflows/ci.yml and
// package.json's "seed"/"db:migrate" scripts), launches Playwright
// chromium (`npx playwright install chromium` must have been run once —
// see README "Dev: render-sweep gate"), logs in once per persona via the
// real /login form using the seeded credentials (docs/fixtures/sample-data.json,
// same fixture scripts/seed.ts and scripts/perf-smoke.ts read), then visits
// every app/src/routeManifest.ts entry and asserts:
//   - the navigation response status is 200
//   - the rendered #root (admin SPA routes) or body (SSR portal/public
//     routes) text is non-empty
//   - zero collected console 'error' + pageerror events (no allowlist)
//
// DEC-253: a second pass then re-visits MOBILE_ROUTE_MANIFEST (the no-login
// public/embed/submit surfaces + /login + /portal) at a 390x844 viewport and
// asserts zero page-level horizontal overflow
// (document.scrollingElement.scrollWidth <= window.innerWidth + 1px slack)
// and that every primary nav/filter/submit control on the page measures
// >= 40px tall (tap-target size) — see scripts/render-sweep-lib.ts's
// evaluateMobileRoute for the pass criteria and test/render-sweep-lib.test.ts
// for its unit tests.
//
// Prints a per-route PASS/FAIL table and exits non-zero on any failure.
// Not run as part of `npm test` (needs a booted server) — run explicitly
// via `npm run gate:render-sweep`.
//
// Scripts/ tooling (not src/ pure-core, DEC-002), so node: imports and the
// playwright/child_process dependency are fine here. Pure evaluation/
// formatting helpers live in scripts/render-sweep-lib.ts for unit testing;
// see test/render-sweep-lib.test.ts.

import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { readFileSync } from "node:fs";
import { createServer } from "node:net";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { chromium, type Browser, type BrowserContext, type ConsoleMessage, type Page } from "playwright";

import { EVENT_SLUG, ROUTE_MANIFEST, type RouteManifestEntry } from "../app/src/routeManifest";
import {
  ADMIN_MOBILE_PASS_BLOCKING,
  allFontFloorPassed,
  allInteractionStatesPassed,
  allMobilePassed,
  allPassed,
  allTypeRolePassed,
  evaluateDeadlineNearestWeights,
  evaluateFontFloor,
  evaluateInteractionState,
  evaluateMobileRoute,
  evaluateRoute,
  evaluateTypeRoleResult,
  filterKnownClipExceptions,
  FONT_FLOOR_BLOCKING,
  fontFloorErrorResult,
  formatFontFloorSummary,
  formatFontFloorTable,
  formatInteractionStateTable,
  formatMobileResultsTable,
  formatMobileSummary,
  formatResultsTable,
  formatSummary,
  formatTypeRoleTable,
  INTERACTION_STATE_BLOCKING,
  interactionStateErrorResult,
  interactionStateSummaryLine,
  mobileErrorResult,
  OVERVIEW_TYPE_ROLES,
  PAGE_EVALUATE_KEEPNAMES_SHIM,
  routeErrorResult,
  selectClipOffenders,
  TYPE_ROLE_BLOCKING,
  typeRoleSummaryLine,
  type ClipCandidate,
  type FontFloorResult,
  type InteractionStateEntry,
  type InteractionStateResult,
  type MobileRouteEntry,
  type MobileRouteResult,
  type RouteResult,
  type TypeRoleResult,
} from "./render-sweep-lib";
import {
  allContrastPassed,
  CONTRAST_BLOCKING,
  CONTRAST_MIN_RATIO,
  CONTRAST_MIN_RATIO_LARGE,
  contrastErrorResult,
  evaluateContrast,
  formatContrastSummary,
  formatContrastTable,
  NAMED_CONTRAST_SELECTOR,
  type ContrastResult,
} from "./render-sweep-contrast";
import { ensureDevVars } from "./ensure-dev-vars";

// DEC-253: the no-login/portal mobile-bar surfaces (390x844). Seed literals
// mirror app/src/routeManifest.ts (same "devflow-conf-2027" event,
// seed_submission_0001/seed_contact_0001 — the seed's index-0 accepted +
// content-approved + visible submission/contact, DEC-108 — so the session
// and speaker detail drill-ins resolve against `npm run seed` data).
export const MOBILE_EVENT_SLUG = "devflow-conf-2027";
const MOBILE_SESSION_ID = "seed_submission_0001";
const MOBILE_SPEAKER_ID = "seed_contact_0001";
const MOBILE_TASK_ASSIGNMENT_ID = "seed_task_assignment_0001";
// Same seed ids as app/src/routeManifest.ts's ROUTE_MANIFEST "DEC-985"
// entries (test/render-sweep-manifest-parity.test.ts's derived assertion
// requires every public ROUTE_MANIFEST row to have a mobile counterpart).
const MOBILE_EMBED_ID = "seed_embed_0001";

export const MOBILE_ROUTE_MANIFEST: readonly MobileRouteEntry[] = [
  // DEC-582 mandate: the anonymous event hub at / must be render-swept too.
  { path: "/", role: "public" },
  { path: `/submit/${MOBILE_EVENT_SLUG}`, role: "public" },
  { path: `/e/${MOBILE_EVENT_SLUG}/sessions`, role: "public" },
  { path: `/e/${MOBILE_EVENT_SLUG}/speakers`, role: "public" },
  { path: `/e/${MOBILE_EVENT_SLUG}/agenda`, role: "public" },
  { path: `/e/${MOBILE_EVENT_SLUG}/schedule`, role: "public" },
  { path: `/e/${MOBILE_EVENT_SLUG}/gallery`, role: "public" },
  // DEC-503 amendment (w69-e): the printable programme is the one public
  // surface a producer prints — render-sweep-manifest-parity.test.ts derives
  // this row from ROUTE_MANIFEST's public entries, so it must never regress.
  { path: `/e/${MOBILE_EVENT_SLUG}/programme`, role: "public" },
  { path: `/e/${MOBILE_EVENT_SLUG}/sessions/${MOBILE_SESSION_ID}`, role: "public" },
  { path: `/e/${MOBILE_EVENT_SLUG}/speakers/${MOBILE_SPEAKER_ID}`, role: "public" },
  { path: `/embed/${MOBILE_EVENT_SLUG}/sessions`, role: "public" },
  { path: `/embed/${MOBILE_EVENT_SLUG}/agenda`, role: "public" },
  { path: `/embed/${MOBILE_EVENT_SLUG}/speakers`, role: "public" },
  { path: `/embed/${MOBILE_EVENT_SLUG}/schedule`, role: "public" },
  { path: `/embed/${MOBILE_EVENT_SLUG}/gallery`, role: "public" },
  { path: "/login", role: "public" },
  // DEC-014 amendment (wave 25) parity: the password-reset request form is a
  // public no-login page reached from /login, so the phone pass visits it for
  // the same reason it visits /login. Its /reset/:token sibling is single-use
  // and therefore not sweepable (see test/audit-claims.test.ts).
  { path: "/forgot", role: "public" },
  { path: "/docs/api", role: "public" },
  // DEC-382 (wave-3 amendment) parity: the public docs site is a phone
  // surface in its own right -- the design pack carries a "phone article"
  // frame, and the ruling states that on phone figures go edge-to-edge with
  // the caption inset. So the 390x844 pass visits the index and one real
  // article, matching ROUTE_MANIFEST's two /docs rows.
  { path: "/docs", role: "public" },
  { path: "/docs/start-here", role: "public" },
  // w45-a: /dev/mailbox and /dev/mailbox/:id removed from here — they were
  // declared role: "public" but guardDevMailbox actually requires role
  // 'organizer' and redirects anonymous visitors to /login, so an anonymous
  // mobile-pass visit was vacuously grading the sign-in card. ROUTE_MANIFEST's
  // two /dev/mailbox rows are now role: "organizer" and ADMIN_MOBILE_ROUTE_MANIFEST
  // derives its rows from ROUTE_MANIFEST's organizer+reviewer entries, so
  // they're covered there instead once an organizer mobile counterpart
  // exists — see render-sweep-manifest-parity.test.ts's public-row parity
  // check, which no longer expects a mobile counterpart for these two paths.
  // DEC-785 parity (w69-e): the saved-embed public route — same
  // deterministic seed id as ROUTE_MANIFEST's /embed/e/seed_embed_0001 row
  // (the enabled "AI track sessions" embed, scripts/seed.ts).
  { path: `/embed/e/${MOBILE_EMBED_ID}`, role: "public" },
  { path: "/portal", role: "speaker" },
  // DEC-411: widen the mobile pass from the single /portal route to the
  // whole phone product — the same speaker portal surfaces already in
  // app/src/routeManifest.ts (110-127), same deterministic seed ids.
  { path: `/portal/submissions/${MOBILE_SESSION_ID}`, role: "speaker" },
  { path: `/portal/submissions/${MOBILE_SESSION_ID}/edit`, role: "speaker" },
  { path: "/portal/profile", role: "speaker" },
  { path: "/portal/tasks", role: "speaker" },
  { path: `/portal/tasks/${MOBILE_TASK_ASSIGNMENT_ID}/form`, role: "speaker" },
  { path: "/account/password", role: "speaker" },
] as const;

/** Selector list for "primary nav/filter/submit controls" (DEC-253): surface
 * nav, search/track-filter forms, submit/save-draft buttons, and the portal
 * sign-out/nav controls. Deliberately excludes secondary inline links (e.g.
 * per-card "View"/"Show more") — those aren't the primary navigation the
 * mobile bar is graded on. */
const MOBILE_CONTROL_SELECTOR = [
  "nav a",
  "form[role='search'] input",
  "form[role='search'] button",
  "form button[type='submit']",
  "form input[type='submit']",
  "header form button",
].join(", ");

// DEC-387: admin mobile pass (390x844, advisory) — the organizer + reviewer
// entries of ROUTE_MANIFEST, with the "/admin/*" catch-all excluded (it's
// not a real page, just App.tsx's fallback route). This is the instrument
// that makes DEC-385's phone-frame redesign checkable; it lands advisory
// (see ADMIN_MOBILE_PASS_BLOCKING in render-sweep-lib.ts) because these
// routes have never been measured at 390px before.
// w25-e: carries expectedStatus through from ROUTE_MANIFEST — a route that
// deliberately renders a non-200 on desktop (e.g. /portal/preview's
// existence-hiding 404 with no ?eventId=, src/routes/portal/preview.tsx:96-145)
// renders the same deliberate non-200 at 390px too; dropping the field here
// made every such row read a permanent "status 404 !== 200" FAIL on the
// mobile pass even once the desktop pass's equivalent row passed.
export const ADMIN_MOBILE_ROUTE_MANIFEST: readonly MobileRouteEntry[] = ROUTE_MANIFEST.filter(
  (entry) => (entry.role === "organizer" || entry.role === "reviewer") && entry.path !== "/admin/*",
).map((entry) => ({ path: entry.path, role: entry.role, expectedStatus: entry.expectedStatus }));

/** DEC-387 control selector: the redesign's phone-bar/primary-control
 * vocabulary (tabbar links/buttons, .chq-btn, .chq-input, .chq-select,
 * header nav links), visible only — same `offsetParent !== null` filter as
 * the public mobile pass. */
const ADMIN_MOBILE_CONTROL_SELECTOR = [
  ".chq-tabbar a",
  ".chq-tabbar button",
  ".chq-btn",
  ".chq-input",
  ".chq-select",
  "header nav a",
].join(", ");

// DEC-991: KNOWN_CLIP_EXCEPTIONS is not a scheduling or deferred-work list.
// The only admissible reason to name an offender here is a fact about the
// element itself -- a deliberate, designed truncation (e.g. a
// -webkit-line-clamp on a card that scrolls) -- never "owned by another
// in-flight branch" (a wave-scoped scheduling note, not a property of the
// element) and never "needs a visual pass" (a deferred fix, not a reason
// the clip is correct). Every other named offender in this list's history
// was a real line-height-vs-font-metrics bug and has been fixed at its CSS
// source rather than parked here. Keyed `${route path}::${selector}` where
// selector is the offender string's leading "tag.class.class" token (before
// " clip="). Never widen OVERFLOW_TOLERANCE_PX-style tolerance to absorb a
// real offender; see filterKnownClipExceptions in render-sweep-lib.ts.
export const KNOWN_CLIP_EXCEPTIONS: Readonly<Record<string, string>> = {
  // app/src/pages/agenda/agenda.css .chq-session-card-title is a deliberate
  // 3-line -webkit-line-clamp truncation (a long title on a short-duration
  // card) — the card itself now scrolls (DEC-620 fix above), so this is
  // designed truncation, not lost content.
  "/admin/agenda::div.chq-session-card-title": "intentional 3-line -webkit-line-clamp truncation",
};

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(SCRIPT_DIR, "..");
const FIXTURE_PATH = join(REPO_ROOT, "docs", "fixtures", "sample-data.json");

interface Persona {
  email: string;
  password: string;
}

interface FixtureData {
  identities: {
    organizer: Persona;
    speaker: Persona;
    reviewer: Persona;
  };
}

/** Finds an unused TCP port by asking the OS to bind an ephemeral one. */
async function findFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = createServer();
    srv.unref();
    srv.on("error", reject);
    srv.listen(0, () => {
      const address = srv.address();
      if (address === null || typeof address === "string") {
        reject(new Error("findFreePort: could not determine bound port"));
        return;
      }
      const { port } = address;
      srv.close(() => resolve(port));
    });
  });
}

function runOrThrow(cmd: string, args: string[]): void {
  const result = spawnSync(cmd, args, { cwd: REPO_ROOT, stdio: "inherit" });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`render-sweep: command failed (exit ${result.status}): ${cmd} ${args.join(" ")}`);
  }
}

async function waitForHealth(baseUrl: string, timeoutMs = 30_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${baseUrl}/health`);
      if (res.ok) return;
    } catch {
      // server not accepting connections yet
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`render-sweep: ${baseUrl}/health did not become ready within ${timeoutMs}ms`);
}

function personaForRole(role: RouteManifestEntry["role"], identities: FixtureData["identities"]): Persona | null {
  switch (role) {
    case "organizer":
      return identities.organizer;
    case "reviewer":
      return identities.reviewer;
    case "speaker":
      return identities.speaker;
    case "public":
      return null;
  }
}

/** Logs in via the real HTML /login form (not the JSON API) so the render-sweep exercises the same path a real browser session takes. */
async function loginContext(
  browser: Browser,
  baseUrl: string,
  persona: Persona,
  options?: { viewport?: { width: number; height: number } },
): Promise<BrowserContext> {
  const context = await browser.newContext(options?.viewport ? { viewport: options.viewport } : {});
  const page = await context.newPage();
  const getRes = await page.goto(`${baseUrl}/login`);
  if (!getRes || getRes.status() !== 200) {
    throw new Error(`render-sweep login: GET /login expected 200, got ${getRes?.status()}`);
  }
  await page.fill('input[name="email"]', persona.email);
  await page.fill('input[name="password"]', persona.password);
  await Promise.all([page.waitForNavigation(), page.click('button[type="submit"]')]);
  const url = page.url();
  if (url.includes("/login")) {
    throw new Error(`render-sweep login: still on /login after submit for ${persona.email} (bad credentials or CSRF failure)`);
  }
  await page.close();
  return context;
}

// DEC-421: walks every rendered element, keeping only those with a non-empty
// direct text node and a non-zero rendered box, and returns the smallest
// getComputedStyle(el).fontSize plus up to 3 structural (never text-content)
// descriptors for elements under MIN_FONT_PX, smallest first. Runs inside
// the browser page context — must only be called on a page that already had
// PAGE_EVALUATE_KEEPNAMES_SHIM applied via addInitScript (DEC-411).
const FONT_FLOOR_MIN_PX = 10;

async function measureFontFloor(page: Page): Promise<{ minPx: number | null; offenders: string[] }> {
  return page.evaluate((minFontPx: number) => {
    const hasNonEmptyDirectText = (el: Element): boolean => {
      for (const node of Array.from(el.childNodes)) {
        if (node.nodeType === Node.TEXT_NODE && (node.textContent ?? "").trim().length > 0) return true;
      }
      return false;
    };
    const describe = (el: Element, px: number): string => {
      const tag = el.tagName.toLowerCase();
      const classes = Array.from(el.classList).slice(0, 3);
      const base = classes.length > 0 ? `${tag}.${classes.join(".")}` : tag;
      return `${base} ${px}px`;
    };

    const elements = Array.from(document.querySelectorAll("*"));
    let minPx: number | null = null;
    const under: { el: Element; px: number }[] = [];
    for (const el of elements) {
      if (!hasNonEmptyDirectText(el)) continue;
      const rect = el.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) continue;
      const px = parseFloat(getComputedStyle(el).fontSize);
      if (Number.isNaN(px)) continue;
      if (minPx === null || px < minPx) minPx = px;
      if (px < minFontPx) under.push({ el, px });
    }
    under.sort((a, b) => a.px - b.px);
    const offenders = under.slice(0, 3).map(({ el, px }) => describe(el, Math.round(px)));
    return { minPx, offenders };
  }, FONT_FLOOR_MIN_PX);
}

// DEC-643: measures getComputedStyle(fontSize/fontWeight/letterSpacing) for
// every OVERVIEW_TYPE_ROLES selector on the current page (only meaningful on
// /admin/overview desktop — see the call site below), plus the observed
// font-weight AND rendered text of every ".chq-overview-deadline-value" cell
// for the deadline-strip group rule (DEC-611 wave-2 amendment: the tie is a
// SET measured on the displayed value, see evaluateDeadlineNearestWeights).
// letter-spacing "normal" (unset) reports as undefined rather than NaN so
// evaluateTypeRoleResult reports it as "not measured" instead of a false
// numeric mismatch.
async function measureTypeRoles(
  page: Page,
  selectors: readonly string[],
): Promise<{
  bySelector: Record<string, { fontSizePx?: number; fontWeight?: number; letterSpacingEm?: number }>;
  deadlineCells: { weight: number; value: string }[];
}> {
  return page.evaluate((sels: string[]) => {
    const readOne = (el: Element): { fontSizePx?: number; fontWeight?: number; letterSpacingEm?: number } => {
      const style = getComputedStyle(el);
      const fontSizePx = parseFloat(style.fontSize);
      const fontWeight = parseInt(style.fontWeight, 10);
      const fontSizeForEm = Number.isNaN(fontSizePx) ? 16 : fontSizePx;
      let letterSpacingEm: number | undefined;
      if (style.letterSpacing !== "normal") {
        const raw = parseFloat(style.letterSpacing); // computed value comes back in px
        letterSpacingEm = Number.isNaN(raw) ? undefined : raw / fontSizeForEm;
      }
      return {
        fontSizePx: Number.isNaN(fontSizePx) ? undefined : fontSizePx,
        fontWeight: Number.isNaN(fontWeight) ? undefined : fontWeight,
        letterSpacingEm,
      };
    };

    const bySelector: Record<string, { fontSizePx?: number; fontWeight?: number; letterSpacingEm?: number }> = {};
    for (const sel of sels) {
      const el = document.querySelector(sel);
      if (el) bySelector[sel] = readOne(el);
    }

    const deadlineCells = Array.from(document.querySelectorAll(".chq-overview-deadline-value")).map((el) => {
      const w = parseInt(getComputedStyle(el).fontWeight, 10);
      return { weight: Number.isNaN(w) ? 0 : w, value: (el.textContent ?? "").trim() };
    });

    return { bySelector, deadlineCells };
  }, selectors as string[]);
}

// DEC-409 wave-35 amendment: three deterministically measurable B8
// interaction-state checks, one authenticated admin surface (hover, disabled)
// and one public surface (focus — DEC-409's own rationale singles out the
// public CFP form as "the last surface that should be guessing"). Same seed
// ids as app/src/routeManifest.ts (PLAN_ID = "seed_evaluation_plan_0001",
// unexported there — literal here, same convention as this file's
// MOBILE_SESSION_ID/MOBILE_SPEAKER_ID duplicating routeManifest.ts's private
// consts above).
const INTERACTION_STATE_PLAN_ID = "seed_evaluation_plan_0001";

// DEC-409 wave-29 amendment: the desktop context's default Playwright
// viewport (browser.newContext() with no viewport option, same as the
// primary "public"/"organizer"/"reviewer" contexts set up below).
const DESKTOP_VIEWPORT = { width: 1280, height: 720 };
// DEC-253's 390x844 phone viewport — declared here (rather than solely at
// its original call sites further down) because INTERACTION_STATE_ENTRIES
// below needs it before those declarations run.
const MOBILE_VIEWPORT = { width: 390, height: 844 };

export const INTERACTION_STATE_ENTRIES: readonly InteractionStateEntry[] = [
  // FOCUS: the public CFP form's step-1 primary button (button.chq-btn.
  // chq-btn-primary.chq-cfp-step-next — src/routes/public/submit-views.tsx),
  // the global `:focus-visible { outline: 2px solid var(--chq-brand);
  // outline-offset: 2px }` rule (src/views/theme.ts) applies here.
  // DEC-409 wave-29 amendment: this control is `display: none` above
  // 700px width (src/routes/public/cfp.css.ts:181, inline-flex only inside
  // `@media (max-width: 700px)` at :202-203) — it is the phone-only
  // two-step wizard's "Continue" button (src/routes/public/submit-
  // views.tsx:648-653), so it must be measured at the 390x844 viewport, not
  // desktop. No number of keyboard Tab presses at desktop could ever reach
  // an element the cascade never displays there.
  {
    kind: "focus",
    path: `/submit/${EVENT_SLUG}`,
    selector: ".chq-cfp-step-next",
    role: "cfp-primary-focus",
    viewport: MOBILE_VIEWPORT,
    personaRole: "public",
    expected: { outlineWidthPx: 2, outlineStyle: "solid", outlineColorHex: "#4E5C31", outlineOffsetPx: 2 },
  },
  // HOVER: an /admin/content worklist row (.chq-content-row — app/src/pages/
  // content/content.css) with no layout shift.
  {
    kind: "hover",
    path: "/admin/content",
    selector: ".chq-content-row",
    role: "content-row-hover",
    viewport: DESKTOP_VIEWPORT,
    personaRole: "organizer",
    expected: { backgroundColorHex: "#EFEBDF", noLayoutShift: true },
  },
  // DISABLED: the review plan editor's anonymise checkbox label, frozen once
  // the plan has a submitted review (planHasSubmittedReview — app/src/pages/
  // review/PlanEditor.tsx; seed_evaluation_plan_0001 has 31 seeded
  // evaluations, scripts/seed.ts, so this is true for the seeded plan).
  // DEC-426 wave-29 amendment: `/admin/review/plans/:id` is one PATH shared
  // by TWO structurally different manifest rows (app/src/routeManifest.ts
  // :114 role "organizer" -> PlanEditor, :132 role "reviewer" ->
  // ReviewerQueue, app/src/pages/Review.tsx:47-56 — "the two views never
  // mount at once"). Matching this check by path alone (as before) also
  // fired it against the reviewer-role visit, where
  // `.chq-review-field-disabled .chq-review-checkbox-label` can never
  // resolve BY CONSTRUCTION (PlanEditor never mounts there) — an instrument
  // defect masquerading as "selector never resolved". personaRole pins this
  // check to the one visit where the element can actually exist.
  {
    kind: "disabled",
    path: `/admin/review/plans/${INTERACTION_STATE_PLAN_ID}`,
    selector: ".chq-review-field-disabled .chq-review-checkbox-label",
    role: "review-anonymize-disabled",
    viewport: DESKTOP_VIEWPORT,
    personaRole: "organizer",
    // --chq-disabled on --chq-disabled-bg. DEC-436's wave-25 amendment
    // darkened the ink token #8E8A7A -> #7D7869 (app/src/styles.css,
    // src/views/theme.ts); the fill is unchanged, so only colorHex moves.
    expected: { colorHex: "#7D7869", backgroundColorHex: "#DDD8C8" },
  },
] as const;

/** Focuses `selector` (page.locator.focus(), which Chromium treats as a
 * keyboard-equivalent focus for :focus-visible purposes) and reads its
 * computed outline. Returns null if the selector never resolved. */
// w25-e: Chromium's :focus-visible heuristic keys off input MODALITY — a
// programmatic `locator.focus()` call does not reliably read as a keyboard
// interaction for a <button>, so `:focus-visible { outline: 2px solid
// var(--chq-brand) }` (src/views/theme.ts:170) never actually applied even
// though the rule is present in the cascade (THEME_CSS inlined before
// CFP_CSS, src/routes/public/submit-views.tsx:47-69). The probe must induce
// a REAL keyboard Tab so it measures the ring a keyboard user actually sees.
const FOCUS_TAB_ATTEMPT_LIMIT = 25;

async function measureFocusState(
  page: Page,
  selector: string,
): Promise<{ outlineWidthPx?: number; outlineStyle?: string; outlineColorHex?: string; outlineOffsetPx?: number } | null> {
  const locator = page.locator(selector).first();
  if ((await locator.count()) === 0) return null;
  // Start each Tab walk from a known, unfocused baseline.
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  let reached = false;
  for (let i = 0; i < FOCUS_TAB_ATTEMPT_LIMIT && !reached; i++) {
    await page.keyboard.press("Tab");
    reached = await page.evaluate((sel: string) => document.activeElement?.matches(sel) ?? false, selector);
  }
  if (!reached) {
    throw new Error(`selector unreachable via keyboard Tab within ${FOCUS_TAB_ATTEMPT_LIMIT} presses: ${selector}`);
  }
  return page.evaluate((sel: string) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    const style = getComputedStyle(el);
    const rgbToHex = (value: string): string | undefined => {
      const m = value.match(/rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)/);
      if (!m) return undefined;
      const toHex = (c: string): string => Math.round(parseFloat(c)).toString(16).padStart(2, "0");
      return `#${toHex(m[1]!)}${toHex(m[2]!)}${toHex(m[3]!)}`.toUpperCase();
    };
    const outlineWidthPx = parseFloat(style.outlineWidth);
    const outlineOffsetPx = parseFloat(style.outlineOffset);
    return {
      outlineWidthPx: Number.isNaN(outlineWidthPx) ? undefined : outlineWidthPx,
      outlineStyle: style.outlineStyle,
      outlineColorHex: rgbToHex(style.outlineColor),
      outlineOffsetPx: Number.isNaN(outlineOffsetPx) ? undefined : outlineOffsetPx,
    };
  }, selector);
}

/** Reads `selector`'s box (y, height) at rest, hovers it (page.hover, a real
 * mouse move so :hover applies), then re-reads box + background-color.
 * Returns null if the selector never resolved. */
async function measureHoverState(
  page: Page,
  selector: string,
): Promise<{ backgroundColorHex?: string; boxBefore: { y: number; height: number }; boxAfter: { y: number; height: number } } | null> {
  const locator = page.locator(selector).first();
  if ((await locator.count()) === 0) return null;
  const before = await page.evaluate((sel: string) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    return { y: rect.y, height: rect.height };
  }, selector);
  if (!before) return null;
  await locator.hover();
  const after = await page.evaluate((sel: string) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    const rgbToHex = (value: string): string | undefined => {
      const m = value.match(/rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)/);
      if (!m) return undefined;
      const toHex = (c: string): string => Math.round(parseFloat(c)).toString(16).padStart(2, "0");
      return `#${toHex(m[1]!)}${toHex(m[2]!)}${toHex(m[3]!)}`.toUpperCase();
    };
    return { y: rect.y, height: rect.height, backgroundColorHex: rgbToHex(getComputedStyle(el).backgroundColor) };
  }, selector);
  if (!after) return null;
  return { backgroundColorHex: after.backgroundColorHex, boxBefore: before, boxAfter: { y: after.y, height: after.height } };
}

/** Reads `selector`'s computed color + background-color with no interaction
 * (the disabled register applies purely from the class chain / [disabled]
 * attribute, DEC-409's amendment). Returns null if the selector never
 * resolved. */
// w25-e: `.chq-review-field-disabled` only attaches once PlanEditor's
// evaluationCountsByRound fetch resolves and planHasSubmittedReview flips
// true (app/src/pages/review/PlanEditor.tsx:448) — a bare `.count()` read
// immediately after #root appears could race that state update and read 0
// even though the field genuinely disables a beat later on the SAME route.
// Waiting for the selector to actually attach (rather than snapshotting
// once) is the re-pin: the row still measures the real disabled register,
// it just gives the instrument time to observe it.
const DISABLED_STATE_ATTACH_TIMEOUT_MS = 5000;

async function measureDisabledState(
  page: Page,
  selector: string,
): Promise<{ colorHex?: string; backgroundColorHex?: string } | null> {
  const locator = page.locator(selector).first();
  try {
    await locator.waitFor({ state: "attached", timeout: DISABLED_STATE_ATTACH_TIMEOUT_MS });
  } catch {
    return null;
  }
  return page.evaluate((sel: string) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    const rgbToHex = (value: string): string | undefined => {
      const m = value.match(/rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)/);
      if (!m) return undefined;
      const toHex = (c: string): string => Math.round(parseFloat(c)).toString(16).padStart(2, "0");
      return `#${toHex(m[1]!)}${toHex(m[2]!)}${toHex(m[3]!)}`.toUpperCase();
    };
    const style = getComputedStyle(el);
    return { colorHex: rgbToHex(style.color), backgroundColorHex: rgbToHex(style.backgroundColor) };
  }, selector);
}

/** Runs whichever INTERACTION_STATE_ENTRIES entry(ies) match BOTH `path` and
 * `personaRole` (DEC-426 wave-29 amendment — a path can be shared by two
 * structurally different component trees per persona, so path alone is not
 * a safe match), pushing PASS/FAIL/instrument-blocked rows onto `results` —
 * same "advisory, never lets an instrument failure fail the desktop
 * render-sweep pass above" convention as measureTypeRoles' call site.
 *
 * DEC-409 wave-29 amendment: each entry now names its own required
 * `viewport`. When it equals `page`'s current viewport, `page` itself is
 * reused (same page/session as before). When it differs (the CFP focus
 * check needs 390x844 while its route's primary desktop visit is
 * 1280x720), a fresh page is opened in the SAME already-authenticated
 * BrowserContext (`page.context()` — no re-login needed) at the required
 * viewport, navigated to `stateEntry.path`, measured, and closed. */
async function measureInteractionStatesForRoute(
  baseUrl: string,
  page: Page,
  path: string,
  personaRole: RouteManifestEntry["role"],
  results: InteractionStateResult[],
): Promise<void> {
  for (const stateEntry of INTERACTION_STATE_ENTRIES) {
    if (stateEntry.path !== path || stateEntry.personaRole !== personaRole) continue;
    const currentViewport = page.viewportSize();
    const needsOwnViewport =
      !currentViewport ||
      currentViewport.width !== stateEntry.viewport.width ||
      currentViewport.height !== stateEntry.viewport.height;
    let statePage = page;
    let ownPage: Page | undefined;
    try {
      if (needsOwnViewport) {
        ownPage = await page.context().newPage();
        await ownPage.setViewportSize(stateEntry.viewport);
        await ownPage.addInitScript({ content: PAGE_EVALUATE_KEEPNAMES_SHIM });
        await ownPage.goto(`${baseUrl}${stateEntry.path}`, { waitUntil: "networkidle" });
        statePage = ownPage;
      }
      if (stateEntry.kind === "focus") {
        const observed = await measureFocusState(statePage, stateEntry.selector);
        if (!observed) throw new Error(`selector never resolved: ${stateEntry.selector}`);
        results.push(evaluateInteractionState(stateEntry, observed));
      } else if (stateEntry.kind === "hover") {
        const observed = await measureHoverState(statePage, stateEntry.selector);
        if (!observed) throw new Error(`selector never resolved: ${stateEntry.selector}`);
        results.push(evaluateInteractionState(stateEntry, observed));
      } else {
        const observed = await measureDisabledState(statePage, stateEntry.selector);
        if (!observed) throw new Error(`selector never resolved: ${stateEntry.selector}`);
        results.push(evaluateInteractionState(stateEntry, observed));
      }
    } catch (err) {
      results.push(interactionStateErrorResult(stateEntry, err instanceof Error ? err.message : String(err)));
    } finally {
      if (ownPage) await ownPage.close();
    }
  }
}

// DEC-620 wave-25 amendment: the in-page probe now measures raw geometry +
// clip-relevant context per candidate element (scrollHeight > clientHeight,
// whether a real clipping context exists on self/ancestor, whether the
// overflowing content is a replaced-content crop) and hands the array back
// to node; the PASS/FAIL decision itself is the pure, unit-testable
// isGenuineClipOffender/selectClipOffenders predicate in render-sweep-lib.ts
// (see its comment there for the exact three-part rule). Must only be
// called on a page that already had PAGE_EVALUATE_KEEPNAMES_SHIM applied via
// addInitScript (DEC-411).
const CLIP_TOLERANCE_PX = 2;
const MAX_CLIP_OFFENDERS = 5;

async function measureClipOffenders(page: Page): Promise<string[]> {
  const candidates: ClipCandidate[] = await page.evaluate(({ tolerance }: { tolerance: number }) => {
    const describe = (el: Element): string => {
      const tag = el.tagName.toLowerCase();
      const classes = Array.from(el.classList).slice(0, 3);
      return classes.length > 0 ? `${tag}.${classes.join(".")}` : tag;
    };

    // DEC-620 wave-25 amendment (i): a real clipping context is overflow-x/y
    // hidden|scroll|auto, or a clipping clip/clip-path — walking self up
    // through every ancestor (an element clipped by a grandparent container
    // is still clipped).
    const establishesClippingContext = (el: Element): boolean => {
      const style = getComputedStyle(el);
      if (["hidden", "scroll", "auto"].includes(style.overflowX)) return true;
      if (["hidden", "scroll", "auto"].includes(style.overflowY)) return true;
      if (style.clipPath && style.clipPath !== "none") return true;
      if (style.clip && style.clip !== "auto") return true;
      return false;
    };
    const hasClippingContext = (el: Element): boolean => {
      let node: Element | null = el;
      while (node) {
        if (establishesClippingContext(node)) return true;
        node = node.parentElement;
      }
      return false;
    };

    // DEC-620 wave-25 amendment (iii): the overflowing content is a
    // replaced-content crop when the element itself (or an immediate child,
    // the usual "wrapper clips an <img>" shape) is an img/video, or declares
    // a non-default object-fit.
    const isReplacedContentCrop = (el: Element): boolean => {
      const isCropTag = (node: Element): boolean => node.tagName === "IMG" || node.tagName === "VIDEO";
      const declaresObjectFit = (node: Element): boolean => {
        const fit = getComputedStyle(node).objectFit;
        return fit !== "" && fit !== "fill";
      };
      if (isCropTag(el) || declaresObjectFit(el)) return true;
      for (const child of Array.from(el.children)) {
        if (isCropTag(child) || declaresObjectFit(child)) return true;
      }
      return false;
    };

    const allElements = Array.from(document.querySelectorAll("*")) as HTMLElement[];
    const visibleElements = allElements.filter((el) => el.offsetParent !== null); // visible only (not display:none)

    const candidates: {
      descriptor: string;
      scrollHeight: number;
      clientHeight: number;
      isSelfScrollContainer: boolean;
      hasClippingContext: boolean;
      isReplacedContentCrop: boolean;
    }[] = [];
    for (const el of visibleElements) {
      const sh = el.scrollHeight;
      const ch = el.clientHeight;
      if (sh <= ch + tolerance) continue;
      // Pre-existing DEC-620 rule the wave-25 amendment doesn't repeal: an
      // element that resolves its own vertical overflow with a scrollbar
      // (own computed overflow-y auto|scroll) is not clipped — it's
      // scrollable. `.chq-main` (app/src/styles.css:404-409) is exactly
      // this shape.
      const selfOverflowY = getComputedStyle(el).overflowY;
      const isSelfScrollContainer = selfOverflowY === "auto" || selfOverflowY === "scroll";
      candidates.push({
        descriptor: describe(el),
        scrollHeight: sh,
        clientHeight: ch,
        isSelfScrollContainer,
        hasClippingContext: hasClippingContext(el),
        isReplacedContentCrop: isReplacedContentCrop(el),
      });
    }
    return candidates;
  }, { tolerance: CLIP_TOLERANCE_PX });
  return selectClipOffenders(candidates, CLIP_TOLERANCE_PX, MAX_CLIP_OFFENDERS);
}

// DEC-426: walks every rendered element, keeping only those with a non-empty
// direct text node and a non-zero rendered box, and returns the lowest
// observed foreground/background contrast ratio (against the applicable
// WCAG AA threshold — CONTRAST_MIN_RATIO_LARGE for >=24px text, or >=18.66px
// at font-weight >= 700, else CONTRAST_MIN_RATIO) plus up to 3 structural
// (never text-content, DEC-401) offender descriptors. Kept INLINE in the
// page.evaluate callback rather than a helper serialised across the
// boundary (DEC-411) — must only be called on a page that already had
// PAGE_EVALUATE_KEEPNAMES_SHIM applied via addInitScript.
async function measureContrast(
  page: Page,
): Promise<{
  minRatio: number | null;
  offenders: string[];
  exempted: string[];
  namedPair: { descriptor: string; ratio: number; ok: boolean } | null;
}> {
  return page.evaluate(
    ({
      minRatioNormal,
      minRatioLarge,
      namedSelector,
    }: {
      minRatioNormal: number;
      minRatioLarge: number;
      namedSelector: string;
    }) => {
      const hasNonEmptyDirectText = (el: Element): boolean => {
        for (const node of Array.from(el.childNodes)) {
          if (node.nodeType === Node.TEXT_NODE && (node.textContent ?? "").trim().length > 0) return true;
        }
        return false;
      };

      const parseColor = (value: string): { rgb: [number, number, number]; alpha: number } | null => {
        const m = value.match(/rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+)\s*)?\)/);
        if (!m) return null;
        return {
          rgb: [parseFloat(m[1]!), parseFloat(m[2]!), parseFloat(m[3]!)],
          alpha: m[4] !== undefined ? parseFloat(m[4]) : 1,
        };
      };

      const luminance = (rgb: [number, number, number]): number => {
        const channel = (c: number): number => {
          const s = c / 255;
          return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
        };
        return 0.2126 * channel(rgb[0]) + 0.7152 * channel(rgb[1]) + 0.0722 * channel(rgb[2]);
      };
      const ratio = (fg: [number, number, number], bg: [number, number, number]): number => {
        const l1 = luminance(fg);
        const l2 = luminance(bg);
        const lighter = Math.max(l1, l2);
        const darker = Math.min(l1, l2);
        return (lighter + 0.05) / (darker + 0.05);
      };

      const backgroundFor = (el: Element): [number, number, number] => {
        let node: Element | null = el;
        while (node) {
          const parsed = parseColor(getComputedStyle(node).backgroundColor);
          if (parsed && parsed.alpha > 0) return parsed.rgb;
          node = node.parentElement;
        }
        return [255, 255, 255]; // default: white
      };

      const describe = (el: Element, r: number, fg: [number, number, number], bg: [number, number, number]): string => {
        const tag = el.tagName.toLowerCase();
        const classes = Array.from(el.classList).slice(0, 3);
        const base = classes.length > 0 ? `${tag}.${classes.join(".")}` : tag;
        return `${base} ratio=${r.toFixed(2)} fg=rgb(${fg.map((c) => Math.round(c)).join(",")}) bg=rgb(${bg
          .map((c) => Math.round(c))
          .join(",")})`;
      };

      // DEC-426 wave-29 amendment: an element under threshold whose fg/bg
      // pair is the --chq-disabled / --chq-disabled-bg token pair (#7D7869
      // on #DDD8C8) is an inactive component — WCAG 2.1 SC 1.4.3 exempts
      // "Inactive User Interface Components" from the contrast requirement.
      // Kept inline (DEC-411, no helper closure across the page.evaluate
      // boundary) rather than imported from render-sweep-contrast.ts.
      const DISABLED_INK_RGB: [number, number, number] = [125, 120, 105]; // #7D7869
      const DISABLED_BG_RGB: [number, number, number] = [221, 216, 200]; // #DDD8C8
      const RGB_MATCH_TOLERANCE = 2;
      const closeEnough = (a: [number, number, number], b: [number, number, number]): boolean =>
        Math.abs(a[0] - b[0]) <= RGB_MATCH_TOLERANCE &&
        Math.abs(a[1] - b[1]) <= RGB_MATCH_TOLERANCE &&
        Math.abs(a[2] - b[2]) <= RGB_MATCH_TOLERANCE;
      const isDisabledTokenPair = (fg: [number, number, number], bg: [number, number, number]): boolean =>
        closeEnough(fg, DISABLED_INK_RGB) && closeEnough(bg, DISABLED_BG_RGB);

      // The token-pair test above recognises an inactive component only when
      // the disabled ink sits on --chq-disabled-bg, i.e. only for the FILLED
      // button tiers. styles.css:744-751 states the opposite rule for the
      // tertiary tier ("a disabled tertiary is a link-shaped control — it
      // keeps NO surface: muted label only, no box"), so its disabled ink is
      // measured against the page ground and the pair test can never fire.
      // That is exactly the /admin/submissions/forms reading: three
      // `<button class="chq-btn chq-btn-tertiary" disabled>Delete</button>`
      // rows (FieldList.tsx:340) at ratio 3.90 on paper -- genuinely
      // inactive controls, reported as offenders. WCAG 2.1 SC 1.4.3 exempts
      // by INACTIVITY, not by colour, so ask the element (or the control it
      // sits inside -- a disabled fieldset's label is inactive too) whether
      // it is disabled. Same DEC-411 inline-only constraint as above.
      const isInactiveComponent = (el: Element): boolean =>
        el.closest(
          "button:disabled, input:disabled, select:disabled, textarea:disabled, fieldset:disabled, [aria-disabled='true']",
        ) !== null;

      const elements = Array.from(document.querySelectorAll("*"));
      let minRatio: number | null = null;
      const under: { el: Element; ratio: number; fg: [number, number, number]; bg: [number, number, number] }[] = [];
      const exempt: { el: Element; ratio: number; fg: [number, number, number]; bg: [number, number, number] }[] = [];
      for (const el of elements) {
        if (!hasNonEmptyDirectText(el)) continue;
        const rect = el.getBoundingClientRect();
        if (rect.width <= 0 || rect.height <= 0) continue;
        const style = getComputedStyle(el);
        const fgParsed = parseColor(style.color);
        if (!fgParsed) continue;
        const fg = fgParsed.rgb;
        const bg = backgroundFor(el);
        const r = ratio(fg, bg);
        if (minRatio === null || r < minRatio) minRatio = r;

        const fontSize = parseFloat(style.fontSize);
        const fontWeight = parseInt(style.fontWeight, 10) || 400;
        const isLarge = fontSize >= 24 || (fontSize >= 18.66 && fontWeight >= 700);
        const threshold = isLarge ? minRatioLarge : minRatioNormal;
        if (r < threshold) {
          if (isDisabledTokenPair(fg, bg) || isInactiveComponent(el)) {
            exempt.push({ el, ratio: r, fg, bg });
          } else {
            under.push({ el, ratio: r, fg, bg });
          }
        }
      }
      under.sort((a, b) => a.ratio - b.ratio);
      exempt.sort((a, b) => a.ratio - b.ratio);
      const offenders = under.slice(0, 3).map(({ el, ratio: r, fg, bg }) => describe(el, r, fg, bg));
      const exempted = exempt.slice(0, 3).map(({ el, ratio: r, fg, bg }) => describe(el, r, fg, bg));

      // task-w36-e: the named selector (DEC-830, task-w29-d's credited-but-
      // never-enumerated PASS) measured explicitly, independent of whether
      // it happens to be this route's global-minimum offender.
      let namedPair: { descriptor: string; ratio: number; ok: boolean } | null = null;
      const namedEl = document.querySelector(namedSelector);
      if (namedEl) {
        if (!hasNonEmptyDirectText(namedEl) || namedEl.getBoundingClientRect().width <= 0 || namedEl.getBoundingClientRect().height <= 0) {
          namedPair = { descriptor: `${namedSelector} present but not reachable by sampler (no direct text or zero rect)`, ratio: -1, ok: true };
        } else {
          const style = getComputedStyle(namedEl);
          const fgParsed = parseColor(style.color);
          if (fgParsed) {
            const fg = fgParsed.rgb;
            const bg = backgroundFor(namedEl);
            const r = ratio(fg, bg);
            const fontSize = parseFloat(style.fontSize);
            const fontWeight = parseInt(style.fontWeight, 10) || 400;
            const isLarge = fontSize >= 24 || (fontSize >= 18.66 && fontWeight >= 700);
            const threshold = isLarge ? minRatioLarge : minRatioNormal;
            namedPair = { descriptor: describe(namedEl, r, fg, bg), ratio: r, ok: r >= threshold };
          } else {
            namedPair = { descriptor: `${namedSelector} present, computed color unparseable (${style.color})`, ratio: -1, ok: true };
          }
        }
      }
      return { minRatio, offenders, exempted, namedPair };
    },
    { minRatioNormal: CONTRAST_MIN_RATIO, minRatioLarge: CONTRAST_MIN_RATIO_LARGE, namedSelector: NAMED_CONTRAST_SELECTOR },
  );
}

async function visitRoute(
  context: BrowserContext,
  baseUrl: string,
  entry: RouteManifestEntry,
  fontFloorResults?: FontFloorResult[],
  contrastResults?: ContrastResult[],
  typeRoleResults?: TypeRoleResult[],
  interactionStateResults?: InteractionStateResult[],
): Promise<RouteResult> {
  const page = await context.newPage();
  // DEC-411: must run before any in-page evaluation on this page.
  await page.addInitScript({ content: PAGE_EVALUATE_KEEPNAMES_SHIM });
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  page.on("console", (msg: ConsoleMessage) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });
  page.on("pageerror", (err: Error) => {
    pageErrors.push(err.message);
  });

  let status = 0;
  try {
    const res = await page.goto(`${baseUrl}${entry.path}`, { waitUntil: "networkidle" });
    status = res ? res.status() : 0;
  } catch (err) {
    pageErrors.push(err instanceof Error ? err.message : String(err));
  }

  let bodyText = "";
  // w17-d: a row with expectedStatus !== 200 under /admin (the DEC-945
  // chromeless /admin/* 404) is a plain server-rendered NotFoundDocument,
  // not the React admin SPA -- it has no #root, so grading it as an SPA
  // route always produced a false "empty rendered text" failure. Only rows
  // that actually land on the SPA shell wait for #root.
  const isAdminSpaRoute = entry.path.startsWith("/admin") && (entry.expectedStatus ?? 200) === 200;
  try {
    if (isAdminSpaRoute) {
      await page.waitForSelector("#root", { timeout: 5000 });
      bodyText = (await page.locator("#root").innerText()).trim();
    } else {
      bodyText = (await page.locator("body").innerText()).trim();
    }
  } catch {
    bodyText = "";
  }

  // w45-a: the pathname the browser actually landed on once navigation
  // settled -- read after the goto/waitForSelector block above so a
  // redirect (e.g. GET /logout -> /login) is reflected rather than silently
  // assumed to equal entry.path.
  const landedPath = new URL(page.url()).pathname;

  // DEC-620: vertical-clip probe, same page/session — filtered against
  // KNOWN_CLIP_EXCEPTIONS before being handed to evaluateRoute, so a named
  // exception never fails the gate.
  let clipOffenders: string[] = [];
  try {
    clipOffenders = filterKnownClipExceptions(entry.path, await measureClipOffenders(page), KNOWN_CLIP_EXCEPTIONS);
  } catch {
    clipOffenders = [];
  }

  // DEC-421: advisory type-floor measurement, same page/session — never lets
  // an instrument failure (e.g. a missed keepNames shim) fail the desktop
  // render-sweep pass above.
  if (fontFloorResults) {
    try {
      const { minPx, offenders } = await measureFontFloor(page);
      fontFloorResults.push(evaluateFontFloor(entry, "desktop", { minFontPx: minPx, offenders }));
    } catch (err) {
      fontFloorResults.push(fontFloorErrorResult(entry, "desktop", err instanceof Error ? err.message : String(err)));
    }
  }

  // DEC-426: advisory WCAG AA contrast measurement, same page/session — never
  // lets an instrument failure fail the desktop render-sweep pass above.
  if (contrastResults) {
    try {
      const { minRatio, offenders, exempted, namedPair } = await measureContrast(page);
      contrastResults.push(evaluateContrast(entry, { minRatio, offenders, exempted, namedPair }));
    } catch (err) {
      contrastResults.push(contrastErrorResult(entry, err instanceof Error ? err.message : String(err)));
    }
  }

  // DEC-643: advisory type-role measurement, /admin/overview desktop only —
  // same page/session, never lets an instrument failure fail the desktop
  // render-sweep pass above.
  if (typeRoleResults && entry.path === "/admin/overview") {
    try {
      const selectors = OVERVIEW_TYPE_ROLES.map((r) => r.selector);
      const { bySelector, deadlineCells } = await measureTypeRoles(page, selectors);
      for (const roleEntry of OVERVIEW_TYPE_ROLES) {
        const observed = bySelector[roleEntry.selector] ?? {};
        const { ok, failureReason } = evaluateTypeRoleResult(observed, roleEntry.expected);
        typeRoleResults.push({ selector: roleEntry.selector, role: roleEntry.role, ok, failureReason, observed, expected: roleEntry.expected });
      }
      const nearest = evaluateDeadlineNearestWeights(deadlineCells);
      typeRoleResults.push({
        selector: ".chq-overview-deadline-value (group)",
        role: "deadline-strip-nearest",
        ok: nearest.ok,
        failureReason: nearest.failureReason,
        observed: {},
        expected: {},
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      typeRoleResults.push({
        selector: "(all)",
        role: "type-role",
        ok: false,
        failureReason: `instrument-blocked: ${message}`,
        observed: {},
        expected: {},
      });
    }
  }

  // DEC-409 wave-35 amendment: advisory B8 interaction-state measurement —
  // same page/session, never lets an instrument failure fail the desktop
  // render-sweep pass above. Only the routes named in
  // INTERACTION_STATE_ENTRIES do anything (see measureInteractionStatesForRoute).
  if (interactionStateResults) {
    await measureInteractionStatesForRoute(baseUrl, page, entry.path, entry.role, interactionStateResults);
  }

  await page.close();
  return evaluateRoute(entry, { status, bodyText, consoleErrors, pageErrors, clipOffenders, landedPath });
}

/** DEC-253: visits one mobile-manifest route in a 390x844 context and
 * measures page-level horizontal overflow + the shortest primary control. */
async function visitMobileRoute(
  context: BrowserContext,
  baseUrl: string,
  entry: MobileRouteEntry,
  controlSelector: string = MOBILE_CONTROL_SELECTOR,
  fontFloorResults?: FontFloorResult[],
): Promise<MobileRouteResult> {
  const page = await context.newPage();
  // DEC-411: must run before the in-page evaluation below.
  await page.addInitScript({ content: PAGE_EVALUATE_KEEPNAMES_SHIM });
  // DEC-253 wave-30 amendment: same console/pageerror collectors as the
  // desktop pass (visitRoute above) — a phone-only component (e.g.
  // PhoneAgenda) mounts only at this 390px viewport, so the desktop pass
  // never observes its console/pageerror events.
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  page.on("console", (msg: ConsoleMessage) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });
  page.on("pageerror", (err: Error) => {
    pageErrors.push(err.message);
  });
  let status = 0;
  try {
    const res = await page.goto(`${baseUrl}${entry.path}`, { waitUntil: "networkidle" });
    status = res ? res.status() : 0;
  } catch (err) {
    pageErrors.push(err instanceof Error ? err.message : String(err));
  }

  const measured = await page.evaluate((selector: string) => {
    // DEC-401: structural-only descriptor — tag + up to 3 classes, never
    // text content (gate logs must not carry seed or user data).
    const describe = (el: Element): string => {
      const tag = el.tagName.toLowerCase();
      const classes = Array.from(el.classList).slice(0, 3);
      return classes.length > 0 ? `${tag}.${classes.join(".")}` : tag;
    };

    // DEC-424: an element deliberately held inside a horizontal scroller
    // (DEC-414's remedy) is not an overflow bug — walk up to (but not
    // including) <body>/<html> and exclude elements whose overflow is
    // contained by an ancestor with overflow-x: auto|scroll.
    const inHorizontalScroller = (el: Element): boolean => {
      let p = el.parentElement;
      while (p && p !== document.body && p !== document.documentElement) {
        const overflowX = getComputedStyle(p).overflowX;
        if (overflowX === "auto" || overflowX === "scroll") return true;
        p = p.parentElement;
      }
      return false;
    };

    const scrollWidth = document.scrollingElement ? document.scrollingElement.scrollWidth : document.body.scrollWidth;
    const viewportWidth = window.innerWidth;

    const allElements = Array.from(document.body.querySelectorAll("*")) as HTMLElement[];
    const visibleElements = allElements.filter((el) => el.offsetParent !== null); // visible only (not display:none)

    let maxElementRight = 0;
    const overflowing: { el: HTMLElement; right: number }[] = [];
    for (const el of visibleElements) {
      if (inHorizontalScroller(el)) continue; // DEC-424
      const rect = el.getBoundingClientRect();
      if (rect.right > maxElementRight) maxElementRight = rect.right;
      if (rect.right > viewportWidth + 1) overflowing.push({ el, right: rect.right });
    }
    overflowing.sort((a, b) => b.right - a.right);
    let overflowOffenders = overflowing
      .slice(0, 3)
      .map(({ el, right }) => `${describe(el)} w=${Math.round(el.getBoundingClientRect().width)}px right=${Math.round(right)}px`);

    // DEC-424: content-spill attribution — when the page scrollWidth itself
    // overflows but no single element's rect.right exceeded the viewport
    // (e.g. a wide inline run bleeding past its ancestors), name the
    // spilling element(s) directly rather than reporting an empty offender
    // list.
    if (overflowOffenders.length === 0 && scrollWidth > viewportWidth + 1) {
      const spilling: { el: HTMLElement; spill: number; sw: number; cw: number }[] = [];
      for (const el of visibleElements) {
        if (inHorizontalScroller(el)) continue;
        const sw = el.scrollWidth;
        const cw = el.clientWidth;
        if (sw > cw + 1) spilling.push({ el, spill: sw - cw, sw, cw });
      }
      spilling.sort((a, b) => b.spill - a.spill);
      overflowOffenders = spilling
        .slice(0, 3)
        .map(({ el, spill, sw, cw }) => `${describe(el)} spill=${Math.round(spill)}px (scrollWidth ${Math.round(sw)} > clientWidth ${Math.round(cw)})`);
    }

    const controls = Array.from(document.querySelectorAll(selector)) as HTMLElement[];
    let minControlHeight: number | null = null;
    let minControlSelector: string | null = null;
    for (const el of controls) {
      if (el.offsetParent === null) continue; // visible only (not display:none)
      const height = el.getBoundingClientRect().height;
      if (minControlHeight === null || height < minControlHeight) {
        minControlHeight = height;
        minControlSelector = describe(el);
      }
    }

    return { scrollWidth, viewportWidth, minControlHeight, maxElementRight, overflowOffenders, minControlSelector };
  }, controlSelector);

  // DEC-421: advisory type-floor measurement at this route's viewport.
  if (fontFloorResults) {
    try {
      const { minPx, offenders } = await measureFontFloor(page);
      fontFloorResults.push(evaluateFontFloor(entry, "mobile", { minFontPx: minPx, offenders }));
    } catch (err) {
      fontFloorResults.push(fontFloorErrorResult(entry, "mobile", err instanceof Error ? err.message : String(err)));
    }
  }

  // DEC-620: vertical-clip probe at this route's viewport, filtered against
  // KNOWN_CLIP_EXCEPTIONS before being handed to evaluateMobileRoute, so a
  // named exception never fails the gate.
  let clipOffenders: string[] = [];
  try {
    clipOffenders = filterKnownClipExceptions(entry.path, await measureClipOffenders(page), KNOWN_CLIP_EXCEPTIONS);
  } catch {
    clipOffenders = [];
  }

  await page.close();
  return evaluateMobileRoute(entry, { status, ...measured, clipOffenders, consoleErrors, pageErrors });
}

async function main(): Promise<void> {
  ensureDevVars(REPO_ROOT); // DEC-187
  const port = await findFreePort();
  const baseUrl = `http://localhost:${port}`;

  console.log("render-sweep: building admin SPA bundle...");
  // DEC-268: a fresh worktree has no gitignored app/dist bundle unless something
  // built it first; wrangler dev serves static assets from that dir, so build it
  // here rather than relying on a prior `npm run build` having been run.
  runOrThrow("npx", ["vite", "build", "--config", "app/vite.config.ts"]);

  console.log("render-sweep: applying migrations + seed data...");
  runOrThrow("npx", ["wrangler", "d1", "migrations", "apply", "chautauqua", "--local"]);
  runOrThrow("npx", ["tsx", "scripts/seed.ts"]);
  runOrThrow("npx", ["wrangler", "d1", "execute", "chautauqua", "--local", "--file=.seed.sql"]);
  runOrThrow("npx", ["tsx", "scripts/seed-r2.ts"]);

  console.log(`render-sweep: starting wrangler dev on port ${port}...`);
  const server: ChildProcess = spawn("npx", ["wrangler", "dev", "--port", String(port)], {
    cwd: REPO_ROOT,
    stdio: ["ignore", "pipe", "pipe"],
    // Own process group, so the teardown in the finally block below can
    // signal wrangler and workerd (npx's grandchildren) and not just npx --
    // see the comment there.
    detached: true,
  });
  let serverLog = "";
  server.stdout?.on("data", (chunk: Buffer) => (serverLog += chunk.toString()));
  server.stderr?.on("data", (chunk: Buffer) => (serverLog += chunk.toString()));

  let browser: Browser | undefined;
  let failed = false;
  try {
    await waitForHealth(baseUrl);
    console.log("render-sweep: wrangler dev is up");

    const fixture = JSON.parse(readFileSync(FIXTURE_PATH, "utf-8")) as FixtureData;

    browser = await chromium.launch();
    const contextByRole = new Map<RouteManifestEntry["role"], BrowserContext>();
    const loginErrorByRole = new Map<RouteManifestEntry["role"], string>();
    contextByRole.set("public", await browser.newContext());
    for (const role of ["organizer", "reviewer", "speaker"] as const) {
      const persona = personaForRole(role, fixture.identities);
      if (!persona) continue;
      console.log(`render-sweep: logging in as ${role} (${persona.email})...`);
      // DEC-389: a login failure (e.g. the dev server died mid-run) marks
      // every manifest entry for this role FAIL below instead of aborting
      // the whole gate uncaught.
      try {
        contextByRole.set(role, await loginContext(browser, baseUrl, persona));
      } catch (err) {
        loginErrorByRole.set(role, err instanceof Error ? err.message : String(err));
      }
    }

    // DEC-421: collects font-floor readings from every visitRoute/
    // visitMobileRoute call below into one flat list for the advisory
    // type-floor table printed after the three existing passes.
    const fontFloorResults: FontFloorResult[] = [];

    // DEC-426: collects contrast readings from every visitRoute call below
    // (desktop pass only) into one flat list for the advisory contrast table
    // printed after the type-floor pass.
    const contrastResults: ContrastResult[] = [];

    // DEC-643: collects type-role readings from the /admin/overview desktop
    // visit only (visitRoute is a no-op for every other path).
    const typeRoleResults: TypeRoleResult[] = [];

    // DEC-409 wave-35 amendment: collects the three B8 interaction-state
    // readings from their three named INTERACTION_STATE_ENTRIES routes only
    // (visitRoute is a no-op for every other path).
    const interactionStateResults: InteractionStateResult[] = [];

    const results: RouteResult[] = [];
    for (const entry of ROUTE_MANIFEST) {
      const context = contextByRole.get(entry.role);
      if (!context) {
        const loginError = loginErrorByRole.get(entry.role);
        results.push(
          routeErrorResult(
            entry,
            loginError !== undefined
              ? `login failed for role '${entry.role}': ${loginError}`
              : `no browser context for role '${entry.role}'`,
          ),
        );
        continue;
      }
      try {
        results.push(
          await visitRoute(context, baseUrl, entry, fontFloorResults, contrastResults, typeRoleResults, interactionStateResults),
        );
      } catch (err) {
        results.push(routeErrorResult(entry, err instanceof Error ? err.message : String(err)));
      }
    }

    console.log("");
    console.log(formatResultsTable(results));
    console.log("");
    console.log(formatSummary(results));

    if (!allPassed(results)) {
      failed = true;
    }

    // DEC-253: second pass at a 390x844 mobile viewport over the no-login/
    // portal surfaces. Separate contexts (viewport is fixed per-context in
    // Playwright) — the speaker persona logs in again inside its own mobile
    // context so /portal is exercised through the real cookie session.
    console.log("");
    console.log("render-sweep: mobile pass (390x844)...");
    const mobileContextByRole = new Map<MobileRouteEntry["role"], BrowserContext>();
    let speakerLoginError: string | undefined;
    mobileContextByRole.set("public", await browser.newContext({ viewport: MOBILE_VIEWPORT }));
    const speakerPersona = personaForRole("speaker", fixture.identities);
    if (!speakerPersona) throw new Error("render-sweep: fixture is missing the speaker identity");
    try {
      mobileContextByRole.set(
        "speaker",
        await loginContext(browser, baseUrl, speakerPersona, { viewport: MOBILE_VIEWPORT }),
      );
    } catch (err) {
      speakerLoginError = err instanceof Error ? err.message : String(err);
    }

    const mobileResults: MobileRouteResult[] = [];
    for (const entry of MOBILE_ROUTE_MANIFEST) {
      const context = mobileContextByRole.get(entry.role);
      if (!context) {
        mobileResults.push(
          mobileErrorResult(
            entry,
            speakerLoginError !== undefined
              ? `login failed for role '${entry.role}': ${speakerLoginError}`
              : `no mobile browser context for role '${entry.role}'`,
          ),
        );
        continue;
      }
      try {
        mobileResults.push(await visitMobileRoute(context, baseUrl, entry, MOBILE_CONTROL_SELECTOR, fontFloorResults));
      } catch (err) {
        mobileResults.push(mobileErrorResult(entry, err instanceof Error ? err.message : String(err)));
      }
    }
    for (const ctx of mobileContextByRole.values()) await ctx.close();

    console.log("");
    console.log(formatMobileResultsTable(mobileResults));
    console.log("");
    console.log(formatMobileSummary(mobileResults));

    if (!allMobilePassed(mobileResults)) {
      failed = true;
    }

    // DEC-387: admin mobile pass (390x844, advisory). Organizer + reviewer
    // contexts logged in fresh (viewport is fixed per-context) and visited
    // at the same 390x844 viewport as the public mobile pass, evaluated with
    // the same evaluateMobileRoute but the redesign's own control selector
    // (ADMIN_MOBILE_CONTROL_SELECTOR). Failures only flip the exit code when
    // ADMIN_MOBILE_PASS_BLOCKING is true (false on landing; see its comment
    // in render-sweep-lib.ts for the flip rule).
    console.log("");
    console.log("render-sweep: admin mobile pass (390x844, advisory)...");
    const adminMobileContextByRole = new Map<"organizer" | "reviewer", BrowserContext>();
    const adminLoginErrorByRole = new Map<"organizer" | "reviewer", string>();
    for (const role of ["organizer", "reviewer"] as const) {
      const persona = personaForRole(role, fixture.identities);
      if (!persona) throw new Error(`render-sweep: fixture is missing the ${role} identity`);
      try {
        adminMobileContextByRole.set(
          role,
          await loginContext(browser, baseUrl, persona, { viewport: MOBILE_VIEWPORT }),
        );
      } catch (err) {
        adminLoginErrorByRole.set(role, err instanceof Error ? err.message : String(err));
      }
    }

    const adminMobileResults: MobileRouteResult[] = [];
    for (const entry of ADMIN_MOBILE_ROUTE_MANIFEST) {
      const role = entry.role as "organizer" | "reviewer";
      const context = adminMobileContextByRole.get(role);
      if (!context) {
        const loginError = adminLoginErrorByRole.get(role);
        adminMobileResults.push(
          mobileErrorResult(
            entry,
            loginError !== undefined
              ? `login failed for role '${entry.role}': ${loginError}`
              : `no admin mobile browser context for role '${entry.role}'`,
          ),
        );
        continue;
      }
      try {
        adminMobileResults.push(
          await visitMobileRoute(context, baseUrl, entry, ADMIN_MOBILE_CONTROL_SELECTOR, fontFloorResults),
        );
      } catch (err) {
        adminMobileResults.push(mobileErrorResult(entry, err instanceof Error ? err.message : String(err)));
      }
    }
    for (const ctx of adminMobileContextByRole.values()) await ctx.close();

    console.log("");
    console.log(formatMobileResultsTable(adminMobileResults));
    console.log("");
    console.log(formatMobileSummary(adminMobileResults));

    if (!allMobilePassed(adminMobileResults) && ADMIN_MOBILE_PASS_BLOCKING) {
      failed = true;
    }

    // DEC-421: type-floor pass (advisory) — one reading per route+viewport
    // already visited above (desktop ROUTE_MANIFEST + mobile/admin-mobile
    // MOBILE_ROUTE_MANIFEST/ADMIN_MOBILE_ROUTE_MANIFEST passes), no separate
    // route list or extra page visits. Failures never flip the exit code
    // while FONT_FLOOR_BLOCKING is false (see its flip-rule comment in
    // render-sweep-lib.ts).
    console.log("");
    console.log("render-sweep: type-floor pass (10px minimum, advisory)...");
    console.log("");
    console.log(formatFontFloorTable(fontFloorResults));
    console.log("");
    console.log(formatFontFloorSummary(fontFloorResults));

    if (!allFontFloorPassed(fontFloorResults) && FONT_FLOOR_BLOCKING) {
      failed = true;
    }

    // DEC-643: type-role pass (advisory) — /admin/overview desktop only, one
    // reading per OVERVIEW_TYPE_ROLES selector plus the deadline-strip group
    // rule, collected during the desktop ROUTE_MANIFEST visit above (no
    // separate route list or extra page visits). Failures never flip the
    // exit code while TYPE_ROLE_BLOCKING is false (see its flip-rule comment
    // in render-sweep-lib.ts).
    console.log("");
    console.log("render-sweep: type-role pass (/admin/overview desktop, advisory)...");
    console.log("");
    console.log(formatTypeRoleTable(typeRoleResults));
    console.log("");
    console.log(typeRoleSummaryLine(typeRoleResults));

    if (!allTypeRolePassed(typeRoleResults) && TYPE_ROLE_BLOCKING) {
      failed = true;
    }

    // DEC-426: WCAG AA contrast pass (advisory) — desktop ROUTE_MANIFEST
    // visits only, one reading per route from the same visitRoute pass
    // above (no separate route list or extra page visits). Failures never
    // flip the exit code while CONTRAST_BLOCKING is false (see its flip-rule
    // comment in scripts/render-sweep-contrast.ts).
    console.log("");
    console.log("render-sweep: contrast pass (WCAG AA, advisory)...");
    console.log("");
    console.log(formatContrastTable(contrastResults));
    console.log("");
    console.log(formatContrastSummary(contrastResults));

    if (!allContrastPassed(contrastResults) && CONTRAST_BLOCKING) {
      failed = true;
    }

    // DEC-409 wave-35 amendment: B8 interaction-state pass (advisory) — one
    // focus/hover/disabled reading per INTERACTION_STATE_ENTRIES row,
    // collected during the desktop ROUTE_MANIFEST visits above (no separate
    // route list or extra page visits). Failures never flip the exit code
    // while INTERACTION_STATE_BLOCKING is false (DEC-387 flip rule).
    console.log("");
    console.log("render-sweep: interaction-state pass (B8 focus/hover/disabled, advisory)...");
    console.log("");
    console.log(formatInteractionStateTable(interactionStateResults));
    console.log("");
    console.log(interactionStateSummaryLine(interactionStateResults));

    if (!allInteractionStatesPassed(interactionStateResults) && INTERACTION_STATE_BLOCKING) {
      failed = true;
    }

    if (!failed) {
      console.log("gate:render-sweep OK");
    }
  } finally {
    if (browser) await browser.close();
    // `server` is `npx`, not wrangler: npm exec runs wrangler as a CHILD, and
    // wrangler in turn runs workerd. A bare server.kill() signals only the npx
    // wrapper, so on Linux the wrangler/workerd grandchildren survive, keep
    // the inherited stdout/stderr pipes open, and node's event loop never
    // drains -- the script prints its whole report and then hangs forever
    // (observed on ubuntu-latest CI: the job sat in `npm run gate:render-sweep`
    // for 100+ minutes with every check already done). `detached: true` above
    // makes npx a process-group leader so the negative-pid signal reaches the
    // whole tree, and destroying the pipes releases the loop even if something
    // in that tree ignores SIGTERM.
    if (server.pid !== undefined) {
      try {
        process.kill(-server.pid, "SIGTERM");
      } catch {
        // Already gone (or never got its own group) -- fall back to the
        // direct signal rather than leaving the child running.
        server.kill("SIGTERM");
      }
    }
    server.stdout?.destroy();
    server.stderr?.destroy();
    if (failed) {
      console.error("--- wrangler dev log (tail) ---");
      console.error(serverLog.split("\n").slice(-100).join("\n"));
    }
  }

  if (failed) process.exitCode = 1;
}

// Only run when executed directly (`tsx scripts/render-sweep.ts` /
// `npm run gate:render-sweep`), not when imported — test/render-sweep-lib.test.ts
// imports ADMIN_MOBILE_ROUTE_MANIFEST from this module for unit testing and
// must not trigger a full wrangler-dev boot as a side effect of that import.
const isMainModule = process.argv[1] !== undefined && import.meta.url === `file://${process.argv[1]}`;
if (isMainModule) {
  main().catch((err) => {
    console.error(err);
    process.exitCode = 1;
  });
}
