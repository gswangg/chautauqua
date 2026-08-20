// Phone tap-target floor scan (DEC-253 amendment, DEC-367 floor -- wave 25 /
// task w25-d).
//
// Measured on the admin-mobile pass at 390x844:
// `input.chq-input.chq-submissions-filterbar-search` rendered a 26px tap
// target against the 44px minimum
// (docs/verification-log/task-w17-d-render-sweep.md:163-165). The 26px is
// a deliberate DESKTOP chip height (submissions.css's
// .chq-submissions-filterbar-search/-select match the adjacent .chq-pill
// row), so the fix is additive only: a phone-width override, not a desktop
// change.
//
// This scan enumerates (readdirSync, DEC-808 idiom, never a hand-listed
// manifest) every app/src *.css file and every app/src *.tsx file
// (excluding *.test.tsx) and:
//
//   1. Collects every `chq-…` class token that appears in a class position
//      on an `<input`, `<select`, `<button`, or an `<a>` whose class list
//      also carries `chq-btn` (an anchor styled as a button-face control).
//   2. For each such token, finds its TOP-LEVEL (outside any @media block)
//      CSS rule -- a plain `.chq-token { ... }` selector, alone or in a
//      comma list -- and reads any `height`/`min-height` declaration.
//   3. If that declared value is below 44px, the token is a tap-target
//      offender UNLESS one of:
//        a) some `@media (max-width: <=700px) { ... }` block declares
//           `height`/`min-height` >= 44px for the same selector, or
//        b) the top-level rule carries an inline exemption comment
//           immediately above it: `/* tap-floor-exempt: <reason> */`.
//   Never an allowlist populated from the failure output -- every
//   exemption is a comment sitting next to the rule it exempts.
//
// The scanning primitives live in ./phone-tap-target-scan/{core,anchor-
// floor,ssr}.ts (custodian decomposition, wave v12m-w8: this file had grown
// into a repeated merge-conflict hotspot at 882 lines). This file keeps
// every population wiring, ceiling constant, and `describe`/`it` block --
// NO behavior change, only where the code that does it lives.
import { readFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  allCssFiles,
  allTsxFiles,
  declaredHeightPx,
  hasFlexCenter,
  hasMinHeightFloor,
  horizontalPaddingNonZero,
  narrowMediaRules,
  selectorDeclaresBareClass,
  selectorMentionsToken,
  SSR_CLASS_ATTR_RE,
  stripTsxComments,
  TAP_FLOOR_PX,
  tapTargetTagTokens,
  topLevelRulesWithExemption,
} from './phone-tap-target-scan/core.js';
import {
  allBareAnchorTokens,
  bareAnchorTokens,
  findAnchorFloorOffenders,
  rowActionContainerTokens,
  selectorReachesAnchor,
} from './phone-tap-target-scan/anchor-floor.js';
import {
  allSsrTapTargetTokens,
  extractCssTsLiteral,
  findSsrOffenders,
  findSsrUnflooredTokens,
  ssrCssModuleFiles,
  ssrTsxFiles,
} from './phone-tap-target-scan/ssr.js';

const HERE = dirname(fileURLToPath(import.meta.url)); // app/src
const REPO_ROOT = join(HERE, '..', '..');

const CSS_FILES = allCssFiles(HERE);
const TSX_FILES = allTsxFiles(HERE);

/** All tap-target-eligible `chq-…` tokens found across every TSX file. */
function allTapTargetTokens(): Set<string> {
  const out = new Set<string>();
  for (const path of TSX_FILES) {
    const src = stripTsxComments(readFileSync(path, 'utf-8'));
    for (const t of tapTargetTagTokens(src)) out.add(t);
  }
  return out;
}

/**
 * For a given token, find offenders: a top-level rule declaring
 * height/min-height < 44px, with no phone-width override >= 44px and no
 * inline exemption comment.
 */
function findOffenders(): string[] {
  const tokens = allTapTargetTokens();
  const offenders: string[] = [];
  for (const path of CSS_FILES) {
    const label = relative(REPO_ROOT, path);
    const raw = readFileSync(path, 'utf-8');
    for (const { selector, body, exempt } of topLevelRulesWithExemption(raw)) {
      const matchingTokens = [...tokens].filter((t) => selectorDeclaresBareClass(selector, t));
      if (matchingTokens.length === 0) continue;
      const height = declaredHeightPx(body);
      if (height === undefined || height >= TAP_FLOOR_PX) continue;
      if (exempt) continue;
      const narrow = narrowMediaRules(raw, 700).some((r) => {
        if (!matchingTokens.some((t) => selectorDeclaresBareClass(r.selector, t))) return false;
        const h = declaredHeightPx(r.body);
        return h !== undefined && h >= TAP_FLOOR_PX;
      });
      if (narrow) continue;
      offenders.push(`${label}: "${selector}" (${height}px, tokens: ${matchingTokens.join(', ')})`);
    }
  }
  return offenders;
}

// Measured directly on this branch (`npx vitest run
// app/src/phone-tap-target.scan.test.ts`) after fixing every offender that
// lives in a file this lane owns (`app/src/components/*.css`,
// `app/src/pages/submissions/*.css`); every remaining offender is filed in
// `docs/design/audit/tap-floor-v12.md` for its owning cluster/wave. This
// number may only be LOWERED by a future wave closing more of the audit
// file's rows -- never raised to accommodate a new offender.
//
// Re-measured wave 108 (v12m-w4-o, DEC-808 amendment) by forcing this const
// to -1 and reading the printed offender list: truth is 64, not the stale
// 92 this constant carried. Set to the measured truth; see the companion
// "never below the ceiling without lowering it" test below for the other
// half of the ratchet this file's own test name always claimed to have.
//
// Re-measured wave 8 task w8-h: `checkToken`'s `(no CSS rule)` branch only
// ever checked TOP-LEVEL rules, so a phone-only token whose rule correctly
// lives inside the <=700px block and nowhere else was misreported as
// undeclared -- verified false for `.chq-review-plan-action-link`
// (review.css), `.chq-settings-public-pages-view-action` (settings.css)
// and `.chq-overview-link-btn-read` (overview.css), all of which have real
// narrow-media rules. Added a narrow-media fallback with the SAME
// predicate/reach/exemption logic; forcing the const to -1 afterwards reads
// 65 -> 64 (one of the three drops out fully floored, the other two become
// real per-file rows). Three container tokens
// (`.chq-comms-phone-recent-head-actions`, `.chq-overview-row-actions-stacked`,
// `.chq-speakers-card-actions`) genuinely stay `(no CSS rule)`: each has a
// narrow rule, but it never reaches an anchor (DEC-393: "the floor is
// reached by the anchor, not its container") -- a real finding, left
// standing, not a scan bug. Then fixed the five real offenders this lane
// owns in `app/src/pages/forms/forms.css` (`.chq-forms-back`,
// `.chq-forms-field-actions`, `.chq-forms-field-modal-actions-right`,
// `.chq-forms-header-actions`, `.chq-modal-actions`) inside the file's
// single terminal `@media (max-width: 700px)` block: `.chq-forms-back` and
// the two anchor-bearing containers (`.chq-forms-field-actions`,
// `.chq-forms-header-actions`) got a conforming min-height/flex-centre/
// padding rule on the anchor itself; `.chq-forms-field-modal-actions-right`
// and forms.css's own `.chq-modal-actions` scope wrap Cancel/Save/Delete
// -- all `<button>`, never an `<a>`/`<Link>` -- so they carry a
// `tap-floor-exempt` comment instead of a rule that could never reach an
// anchor. Re-measured truth after both fixes: 59.
export const ANCHOR_FLOOR_OFFENDERS_CEILING = 59;

describe('row-action-anchor tap-target floor scan (DEC-393 wave-87 amendment)', () => {
  it('derives a non-empty population and includes a known-good token (vacuous-population tripwire)', () => {
    const anchorTokens = allBareAnchorTokens(TSX_FILES);
    const containerTokens = rowActionContainerTokens(CSS_FILES);
    expect(anchorTokens.size).toBeGreaterThan(0);
    expect(containerTokens.size).toBeGreaterThan(0);
    // `chq-overview-link-btn` is a real bare `<a>`/`<Link>` class with no
    // `chq-btn` (Overview.tsx) -- a regex that silently matched nothing
    // could not have found it.
    expect(anchorTokens.has('chq-overview-link-btn')).toBe(true);
    // `chq-breaks-row-actions` is a real row-action container class defined
    // in agenda.css.
    expect(containerTokens.has('chq-breaks-row-actions')).toBe(true);
  });

  it('flags a synthetic bare anchor with only padding declared (positive control: padding alone does not reach the floor)', () => {
    const tsx = `export const X = () => <a className="chq-x-fake-anchor" href="/x">Go</a>;`;
    const css = `
      @media (max-width: 700px) {
        .chq-x-fake-anchor { padding: 0 16px; }
      }
    `;
    const tokens = bareAnchorTokens(stripTsxComments(tsx));
    expect(tokens).toEqual(['chq-x-fake-anchor']);
    const narrow = narrowMediaRules(css, 700);
    const rule = narrow.find((r) => selectorMentionsToken(r.selector, 'chq-x-fake-anchor'))!;
    expect(hasMinHeightFloor(rule.body)).toBe(false);
    expect(horizontalPaddingNonZero(rule.body)).toBe(true);
  });

  it('does not flag a synthetic bare anchor declaring all three phone properties (negative control)', () => {
    const css = `
      @media (max-width: 700px) {
        .chq-x-fake-anchor-2 {
          min-height: 44px;
          display: flex;
          align-items: center;
          padding: 0 16px;
        }
      }
    `;
    const rule = narrowMediaRules(css, 700).find((r) =>
      selectorMentionsToken(r.selector, 'chq-x-fake-anchor-2'),
    )!;
    expect(hasMinHeightFloor(rule.body)).toBe(true);
    expect(hasFlexCenter(rule.body)).toBe(true);
    expect(horizontalPaddingNonZero(rule.body)).toBe(true);
  });

  it('does not flag a row-action container reaching its anchor via a descendant selector (negative control)', () => {
    const css = `
      @media (max-width: 700px) {
        .chq-x-fake-row-actions a {
          min-height: 44px;
          display: flex;
          align-items: center;
          padding: 0 16px;
        }
      }
    `;
    const narrow = narrowMediaRules(css, 700);
    const rule = narrow.find((r) => selectorMentionsToken(r.selector, 'chq-x-fake-row-actions'))!;
    expect(selectorReachesAnchor(rule.selector, new Set())).toBe(true);
  });

  it('stays at or under the offender ceiling (one-sided ratchet: may only fall)', () => {
    const offenders = findAnchorFloorOffenders(CSS_FILES, TSX_FILES, REPO_ROOT);
    expect(
      offenders.length,
      `row-action-anchor tap-target floor offenders (${offenders.length}, ceiling ${ANCHOR_FLOOR_OFFENDERS_CEILING}):\n${offenders.join('\n')}`,
    ).toBeLessThanOrEqual(ANCHOR_FLOOR_OFFENDERS_CEILING);
  });

  it(`never falls below the offender ceiling (${ANCHOR_FLOOR_OFFENDERS_CEILING}) without the ceiling being lowered to match (a stale ceiling licenses stagnation)`, () => {
    const offenders = findAnchorFloorOffenders(CSS_FILES, TSX_FILES, REPO_ROOT);
    if (offenders.length < ANCHOR_FLOOR_OFFENDERS_CEILING) {
      throw new Error(
        `row-action-anchor tap-target floor offenders (${offenders.length}) fell below the ` +
          `ANCHOR_FLOOR_OFFENDERS_CEILING of ${ANCHOR_FLOOR_OFFENDERS_CEILING}. This is the ratchet ` +
          `working: offenders got fixed. Lower the ceiling in the same commit (a merge-train act, ` +
          `never a worker's edit mid-lane) by replacing the line:\n` +
          `  export const ANCHOR_FLOOR_OFFENDERS_CEILING = ${offenders.length};`,
      );
    }
    expect(offenders.length).toBeGreaterThanOrEqual(ANCHOR_FLOOR_OFFENDERS_CEILING);
  });
});

describe('phone tap-target floor scan (DEC-253 amendment, DEC-367)', () => {
  it('found more than one CSS file and one TSX file to scan (vacuous-scan tripwire)', () => {
    expect(CSS_FILES.length).toBeGreaterThan(5);
    expect(TSX_FILES.length).toBeGreaterThan(5);
  });

  it('flags a synthetic sub-floor input rule with no override or exemption (positive control)', () => {
    const tsx = `export const X = () => <input className="chq-x-fake-search" />;`;
    const css = `.chq-x-fake-search { min-height: 26px; }`;
    const tokens = new Set(tapTargetTagTokens(stripTsxComments(tsx)));
    expect(tokens.has('chq-x-fake-search')).toBe(true);
    const rules = topLevelRulesWithExemption(css);
    const rule = rules.find((r) => selectorDeclaresBareClass(r.selector, 'chq-x-fake-search'));
    expect(rule).toBeDefined();
    expect(declaredHeightPx(rule!.body)).toBe(26);
    expect(rule!.exempt).toBe(false);
  });

  it('does not flag a sub-floor rule with a phone-width >=44px override (negative control)', () => {
    const css = `
      .chq-x-fake-search { min-height: 26px; }
      @media (max-width: 700px) {
        .chq-x-fake-search { min-height: 44px; }
      }
    `;
    const rule = topLevelRulesWithExemption(css).find((r) =>
      selectorDeclaresBareClass(r.selector, 'chq-x-fake-search'),
    )!;
    expect(declaredHeightPx(rule.body)).toBe(26);
    const overridden = narrowMediaRules(css, 700).some(
      (r) =>
        selectorDeclaresBareClass(r.selector, 'chq-x-fake-search') &&
        (declaredHeightPx(r.body) ?? 0) >= TAP_FLOOR_PX,
    );
    expect(overridden).toBe(true);
  });

  it('does not flag a sub-floor rule carrying a named tap-floor-exempt comment (negative control)', () => {
    const css = `
      /* tap-floor-exempt: decorative icon-only chip, never a phone tap target */
      .chq-x-fake-chip { min-height: 20px; }
    `;
    const rule = topLevelRulesWithExemption(css).find((r) =>
      selectorDeclaresBareClass(r.selector, 'chq-x-fake-chip'),
    )!;
    expect(rule.exempt).toBe(true);
  });

  it('every sub-44px input/select/button/chq-btn-anchor control has a >=44px phone override or a named exemption', () => {
    const offenders = findOffenders();
    expect(
      offenders,
      `sub-44px tap targets with no phone-width override and no tap-floor-exempt comment:\n${offenders.join('\n')}`,
    ).toEqual([]);
  });
});

// --- SSR population widening (mandate item 5) ---------------------------
//
// Everything above scans app/src ONLY: the SPA bundle's *.css sheets and
// its React *.tsx views. The SSR half of the product -- src/routes/public
// (the CFP, the public event site), src/routes/portal, src/routes/docs-site,
// src/routes/auth -- ships its own Hono JSX views and its own CSS-in-TS
// stylesheets. See phone-tap-target-scan/ssr.ts for the full population
// rationale, the ratchet's one-sided-by-design rationale, and the known
// composed-modifier noise named in its ceiling comment.

const SSR_ROOT = join(REPO_ROOT, 'src');
const SSR_CSS_MODULES = ssrCssModuleFiles(SSR_ROOT);
const SSR_TSX_FILES = ssrTsxFiles(SSR_ROOT);

/**
 * Seeded at the count measured when this population was first scanned
 * (mandate item 5). ONE-SIDED: may only be LOWERED, never raised.
 *
 * This is a TO-DO LIST, not a licence, and deliberately NOT the two-sided
 * ratchet the rest of this repo prefers. Giving the SSR route sheets a
 * shared control-face primitive that carries the 44px floor is engine work
 * with its own frame-fidelity consequences; forcing it to be finished in
 * the same change that first makes the surface visible is exactly the
 * trade that keeps a surface invisible. Seeing first, then fixing.
 */
export const SSR_UNFLOORED_TOKENS_CEILING = 3;

// task w7-e (DEC-367/DEC-385) lowered this from 14 to 3, measured after
// repair by forcing the ceiling to -1 and reading the printed offender
// list. Retired with named `tap-floor-exempt:` comments (the three
// modifiers a per-token text scan can't follow through composition):
// `.chq-visually-hidden` (src/routes/public/css/chrome.css.ts,
// screen-reader-only utility, never a tap target),
// `.chq-btn-secondary`/`.chq-btn-tertiary` (src/views/theme.ts) and
// `.chq-field-invalid` (src/views/error-states.css.ts). Given a real
// >=44px phone-width floor (additive, inside each sheet's terminal
// `@media (max-width: 700px)` block): `.chq-auth-demo-btn`
// (src/routes/auth.css.ts, live-probed at 269.8x17), `.chq-docs-search-
// input` (src/routes/docs-site.css.ts), `.chq-pub-search-submit`,
// `.chq-pub-search`, `.chq-pub-select`, `.chq-pub-select-active` (all
// src/routes/public/css/chrome.css.ts) and `.chq-itinerary-toggle`
// (src/routes/public/css/rail.css.ts -- floored on the visually-hidden
// checkbox itself with `pointer-events:none`, since the real tap surface
// is, and stays, the wrapping `.chq-pub-save`/`.chq-pub-itinerary-row`
// label already floored on this same phone block).
//
// The 3 remaining are `.chq-portal-copresenter-email-flagged`,
// `.chq-portal-header-signout-btn`, `.chq-portal-preview-download` --
// all declared in src/routes/portal/portal.css.ts.
//
// Merge note (thunderdome megabatch): the custodian decomposition branch
// (v12m-custodian-w8-1) predates w7-e's lowering and carried the stale 14.
// Restored to 3 here -- the decomposition is explicitly NO behavior
// change, and this ceiling may only ever be LOWERED.

/** Seeded at the count measured when this population was first scanned
 * (mandate item 5). ONE-SIDED: may only be LOWERED, never raised. There is
 * deliberately no companion "ceiling is not stale" test -- the engine work
 * that would drive this to zero is not this change's job, and a two-sided
 * ratchet would force it to be. */
export const SSR_TAP_FLOOR_OFFENDERS_CEILING = 0;

describe('phone tap-target floor scan — SSR routes (public/portal/docs/auth)', () => {
  it('derives a non-empty SSR population from both halves (vacuous-scan tripwire)', () => {
    expect(SSR_CSS_MODULES.length).toBeGreaterThan(5);
    expect(SSR_TSX_FILES.length).toBeGreaterThan(5);
    // The four route families the mandate names must each be represented,
    // asserted by path rather than count so a silently-emptied population
    // cannot pass by staying "non-empty" on one family alone.
    const labels = SSR_CSS_MODULES.map((p) => relative(REPO_ROOT, p));
    for (const family of ['src/routes/public/', 'src/routes/portal/', 'src/routes/docs-site.css.ts', 'src/routes/auth.css.ts']) {
      expect(labels.some((l) => l.startsWith(family) || l === family), `no SSR stylesheet under ${family}`).toBe(true);
    }
  });

  it('reads Hono JSX `class=` where the SPA extractor reads `className=` (positive control)', () => {
    const ssr = `export const X = () => <button class="chq-pub-search-submit">Search</button>;`;
    // The SPA-shaped extractor is blind to it -- which is exactly why the
    // SSR half went unscanned for so long.
    expect(tapTargetTagTokens(ssr)).toEqual([]);
    expect(tapTargetTagTokens(ssr, SSR_CLASS_ATTR_RE)).toContain('chq-pub-search-submit');
  });

  it('extracts rules out of a CSS-in-TS template literal, interpolations stripped (positive control)', () => {
    const mod = 'export const FAKE_CSS = `.chq-x-ssr-btn { min-height: 26px; }\n${OTHER_CSS}\n`;';
    const css = extractCssTsLiteral(mod);
    expect(css).toContain('.chq-x-ssr-btn');
    expect(css).not.toContain('OTHER_CSS');
    const rule = topLevelRulesWithExemption(css).find((r) =>
      selectorDeclaresBareClass(r.selector, 'chq-x-ssr-btn'),
    )!;
    expect(declaredHeightPx(rule.body)).toBe(26);
  });

  it('honours the same <=700px override and tap-floor-exempt escapes as the SPA scan (negative controls)', () => {
    const overridden = 'export const FAKE_CSS = `.chq-x-ssr-btn { min-height: 26px; }\n@media (max-width: 700px) { .chq-x-ssr-btn { min-height: 44px; } }`;';
    const css = extractCssTsLiteral(overridden);
    expect(
      narrowMediaRules(css, 700).some(
        (r) => selectorDeclaresBareClass(r.selector, 'chq-x-ssr-btn') && (declaredHeightPx(r.body) ?? 0) >= TAP_FLOOR_PX,
      ),
    ).toBe(true);

    const exempted = extractCssTsLiteral(
      'export const FAKE_CSS = `/* tap-floor-exempt: decorative */\n.chq-x-ssr-chip { min-height: 20px; }`;',
    );
    expect(
      topLevelRulesWithExemption(exempted).find((r) => selectorDeclaresBareClass(r.selector, 'chq-x-ssr-chip'))!.exempt,
    ).toBe(true);
  });

  it('stays at or under the SSR declared-sub-floor ceiling, and never raises it silently', () => {
    const tokens = allSsrTapTargetTokens(SSR_TSX_FILES);
    const offenders = findSsrOffenders(SSR_CSS_MODULES, tokens, REPO_ROOT);
    expect(
      offenders.length,
      `SSR sub-44px tap targets with no phone-width override and no tap-floor-exempt comment ` +
        `(${offenders.length}, ceiling ${SSR_TAP_FLOOR_OFFENDERS_CEILING} -- may only be LOWERED):\n${offenders.join('\n')}`,
    ).toBeLessThanOrEqual(SSR_TAP_FLOOR_OFFENDERS_CEILING);
  });

  it('the unfloored-token population is non-empty and includes a token the live probe measured sub-floor (tripwire)', () => {
    // A scan that silently stopped matching would report zero and look
    // like progress. Pin it to a token the meta-fidelity probe measured at
    // 390 with its own eyes, so "clean" can never mean "blind".
    const tokens = allSsrTapTargetTokens(SSR_TSX_FILES);
    expect(tokens.size).toBeGreaterThan(20);
    expect(tokens.has('chq-auth-demo-btn')).toBe(true);
  });

  it('stays at or under the SSR unfloored-token ceiling, and never raises it silently', () => {
    const tokens = allSsrTapTargetTokens(SSR_TSX_FILES);
    const offenders = findSsrUnflooredTokens(SSR_CSS_MODULES, tokens, REPO_ROOT);
    expect(
      offenders.length,
      `SSR tap targets whose CSS never declares a >=44px floor at any width ` +
        `(${offenders.length}, ceiling ${SSR_UNFLOORED_TOKENS_CEILING} -- may only be LOWERED):\n${offenders.join('\n')}`,
    ).toBeLessThanOrEqual(SSR_UNFLOORED_TOKENS_CEILING);
  });
});
