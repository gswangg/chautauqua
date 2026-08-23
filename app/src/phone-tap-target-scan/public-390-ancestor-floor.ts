// DEC-808 wave-50 amendment (task w50-b): the public/portal 390 CANDIDATE
// roster's ANCESTOR axis.
//
// PUBLIC_MOBILE_CANDIDATE_DEFECT_CEILING's 20 CANDIDATE rows are every one a
// bare (classless) `a`/`input` tag -- w44-j (wave-44) checked exactly ONE
// reaching mechanism (a BARE-TAG selector, e.g. `a { min-height: 44px }`,
// checked by test/public-390-roster-tag-resolution.scan.test.ts's
// `reachedByBareTagFloor`) and correctly found none, since this codebase's
// floor idiom never writes a bare-tag phone rule.
//
// But native `<label>`/list-row click-delegation makes a wrapping element's
// class the REAL hit box for a classless child -- test/public-390-request-
// verdicts-classless-roster.scan.test.ts (DEC-996 wave-39, task w39-e)
// already built and graded this exact ANCESTOR axis for 15 of the SAME
// sites, restricted to src/routes/public/**. This module reuses that same
// walk (`classlessTagSites`, DEC-613: imported, never re-derived) as the
// SINGLE owner of the derivation, so both
// test/public-390-roster-tag-resolution.scan.test.ts (which proves each row
// below, with synthetic controls) and
// test/public-390-offender-roster.scan.test.ts (which subtracts these rows
// from its CANDIDATE count) import the SAME constant rather than each
// re-deriving it.
//
// Two shapes are covered:
//   (a) still-classless in the current tree -- `classlessTagSites` finds
//       the tag with an empty own-class-attribute and reports its nearest
//       ancestor's chq- token(s), checked here for a live floor or a
//       `tap-floor-exempt:` receipt (composition for the `input` rows,
//       inline-in-prose or a real floor for the `a` rows).
//   (b) drifted OUT of the classless population since the wave-30 snapshot
//       (the roster's frozen text has no class token, but the tree today
//       shows the SAME anchor now carrying its own chq- class -- the
//       identical drift w39-e's own second describe block already
//       documented for two submit-views.tsx anchors): the anchor's own
//       token is checked the same way, directly.
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  allCssFiles,
  classlessTagSites,
  hasExemptionForToken,
  hasMinHeightFloor,
  narrowMediaRules,
  selectorMentionsToken,
  stripTsxComments,
  topLevelRulesWithExemption,
} from "./core";
import { extractCssTsLiteral } from "./ssr";

const HERE = dirname(fileURLToPath(import.meta.url)); // app/src/phone-tap-target-scan
const REPO_ROOT = join(HERE, "..", "..", "..");
export const PUBLIC_ROUTES_ROOT = join(REPO_ROOT, "src", "routes", "public");
export const PORTAL_ROUTES_ROOT = join(REPO_ROOT, "src", "routes", "portal");

const SSR_HAS_CLASS_ATTR_RE = /\bclass(?:Name)?\s*=/;
const SSR_CLASS_ATTR_RE = /\bclass(?:Name)?\s*=\s*(\{[^}]*\}|"[^"]*")/;

/** Every *.ts/*.tsx file under `root` (test files excluded) -- the src/**
 * counterpart to core.ts's allCssFiles (same helper
 * test/public-390-offender-roster.scan.test.ts defines locally; kept as its
 * own copy here too since both read-only callers already read it
 * identically off the same tree and moving it would touch an unrelated
 * in-flight file for no behaviour change). */
function allSrcTsSourceFiles(root: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(root, { withFileTypes: true, recursive: true })) {
    if (!entry.isFile()) continue;
    if (!entry.name.endsWith(".ts") && !entry.name.endsWith(".tsx")) continue;
    if (entry.name.includes(".test.")) continue;
    out.push(join(entry.parentPath, entry.name));
  }
  return out.sort();
}

const ANCESTOR_STYLESHEET_TEXTS: string[] = [
  ...allCssFiles(join(REPO_ROOT, "app", "src")).map((f) => readFileSync(f, "utf8")),
  ...allSrcTsSourceFiles(join(REPO_ROOT, "src")).map((f) => extractCssTsLiteral(readFileSync(f, "utf8"))),
];
const ANCESTOR_RAW_TEXTS: string[] = [
  ...allCssFiles(join(REPO_ROOT, "app", "src")).map((f) => readFileSync(f, "utf8")),
  ...allSrcTsSourceFiles(join(REPO_ROOT, "src")).map((f) => readFileSync(f, "utf8")), // hasExemptionForToken wants the RAW (un-extracted) text
];

/** True when `token` either declares a live >=44px min-height floor
 * effective at 390 (top-level, or inside an `@media (max-width: <=700px)`
 * block, DEC-385) somewhere in the tree, OR carries a `tap-floor-exempt:`
 * receipt comment -- either is sufficient for a classless child reached
 * through this ancestor (or a since-drifted anchor's own token) to be a
 * non-offender today. */
export function tokenFlooredOrExempt(token: string): boolean {
  for (const css of ANCESTOR_STYLESHEET_TEXTS) {
    const rules = [...topLevelRulesWithExemption(css), ...narrowMediaRules(css, 700)];
    for (const rule of rules) {
      if (selectorMentionsToken(rule.selector, token) && hasMinHeightFloor(rule.body)) return true;
    }
  }
  return ANCESTOR_RAW_TEXTS.some((raw) => hasExemptionForToken(raw, token));
}

/** Reads a TSX route file, comment-stripped, and walks it with
 * `classlessTagSites` for the given tag set -- the SAME walk w39-e's own
 * `livePublicClasslessSites` runs, restricted here to one file at a time so
 * each call site can name exactly which component it's checking. */
export function classlessSitesIn(absPath: string, tags: readonly string[]) {
  const src = stripTsxComments(readFileSync(absPath, "utf-8"));
  return classlessTagSites(src, tags, SSR_HAS_CLASS_ATTR_RE, SSR_CLASS_ATTR_RE);
}

/** DEC-808 wave-50 (task w50-b): every roster route+tag pair whose bare
 * CANDIDATE rows resolve via the ancestor axis. Keyed `${route}|${tag}`
 * exactly as the roster's own `## <route>` heading + bare offender-line tag
 * read -- ALL bare rows of that tag under that route resolve (the roster
 * records no finer key for a classless row -- there is no class token to
 * disambiguate one instance from another under the same heading), so a
 * route+tag pair listed here clears every CANDIDATE row it owns, never a
 * partial count.
 *
 * Each entry's evidence is proven, with a synthetic control, by
 * test/public-390-roster-tag-resolution.scan.test.ts's "ancestor axis"
 * describe blocks -- this constant is the derivation's single output, not a
 * second hand-typed claim about the tree. */
export const FLOORED_BY_ANCESTOR_ROWS: ReadonlySet<string> = new Set([
  // /docs/api's '/login' reference anchor: DRIFTED to its own class token
  // chq-docs-auth-link (DEVIATIONS.md §10 rung 3), receipted in
  // src/routes/tools.css.ts.
  "/docs/api|a",
  // /e/…/agenda and /embed/…/agenda: agenda-grid.tsx/agenda-rail.tsx/
  // sessions.tsx's classless anchors, ancestor chq-pub-agenda-block-title
  // or chq-pub-rail-day-row, both live-floored in rail.css.ts's terminal
  // phone block.
  "/e/devflow-conf-2027/agenda|a",
  "/embed/devflow-conf-2027/agenda|a",
  // /portal/tasks's completed-file-request download link: DRIFTED to its
  // own class token chq-portal-file-link (DEC-393 wave-38 amendment),
  // receipted in src/routes/portal/portal.css.ts.
  "/portal/tasks|a",
  // /submit/devflow-conf-2027: submit-views.tsx's classless anchors,
  // ancestor chq-cfp-links (live-floored) or chq-cfp-confirm-actions
  // (inline-in-prose receipt), both in cfp.css.ts.
  "/submit/devflow-conf-2027|a",
  // /submit/devflow-conf-2027: submit-views.tsx's classless radio/pill
  // inputs, ancestor chq-cfp-option (live-floored, min-height:46px, AND a
  // composition receipt), cfp.css.ts.
  "/submit/devflow-conf-2027|input",
  // /portal/submissions/seed_submission_0001/edit: portal/edit.tsx's
  // classless track checkboxes, ancestor chq-cfp-option (live-floored AND
  // a composition receipt), portal.css.ts.
  "/portal/submissions/seed_submission_0001/edit|input",
]);
