// DEC-576 wave-39 (task w39-b): twin visibility ledger.
//
// `app/src/phone-block-visibility.test.ts`'s MARKUP_PHONE_UNHIDDEN_CEILING
// grades ONLY class selectors whose token literally contains the substring
// `phone` -- a control rendered twice in the DOM where CSS alone decides
// which copy is on screen sat entirely outside that population when the
// classes involved carry no `phone` segment at all
// (`.chq-portal-actions-footer` / `.chq-portal-edit-dock`, the desktop
// double-Save on /portal/profile). This ledger grades that population
// directly: every `dock={...}` call site under src/routes/portal/**, which
// is the app's one place a control is deliberately rendered a second time
// (through PortalLayout's footer dock slot) with a same-page inline twin
// meant to be CSS-exclusive with it.
//
// THE CORRECT IDIOM (portal.css.ts, `.chq-portal-edit-dock` /
// `.chq-portal-taskform-submit`, quoted verbatim in both their own
// comments): the DOCK copy carries a TOP-LEVEL `display: none;` (ahead of
// the terminal phone media block, DEC-919/DEC-385), and the phone media
// block reveals it (a non-`none` display) while hiding the INLINE twin --
// "exactly one copy draws at any width".
//
// POPULATION (derived, never hand-listed):
//   1. Every `dock={IDENT}` call site under src/routes/portal/**/*.tsx
//      (readdirSync walk, not a hand list -- five today).
//   2. For each IDENT, its declaration's JSX (or, when the declaration is a
//      bare function call, that function's own body in the same file).
//   3. Every `chq-` class token in that markup, excluding the app's generic
//      button-utility classes (`chq-btn`, `chq-btn-primary`,
//      `chq-btn-secondary`, `chq-btn-tertiary` -- reused on hundreds of
//      unrelated elements, so a selector built from one of these could
//      never reach only this dock copy).
//
// GRADES (this file's own, never borrowed from phone-block-visibility.test
// .ts's population, which cannot see any of this -- no `phone` substring
// anywhere in these tokens):
//   - CLASSLESS-TWIN: no non-generic `chq-` class token survives step 3 --
//     no selector can reach this dock copy at all, so it is IMPOSSIBLE to
//     hide it at any width. `src/routes/portal/profile.tsx`'s `profileDock`
//     is exactly this, and it is the root cause of the live /portal/profile
//     desktop double-Save (v12m-w38-f owns the product fix; this ledger
//     owns only the measurement).
//   - OFFENDER: a class token survives, but the CSS half of the DEC-576
//     idiom is incomplete -- the dock class has no top-level
//     `display: none;`, or is never revived inside the terminal phone
//     media block, or no same-page inline twin (a class the CSS hides
//     ONLY inside that same phone media block, unconditionally rendered
//     elsewhere on the same page) can be found for it. Both copies paint
//     at some width.
//   - VERIFIED: the class token has a top-level `display: none;`, is
//     revived (non-`none` display) inside the terminal phone media block,
//     and a same-page inline twin exists whose own CSS is the mirror image
//     (visible by default -- no top-level `display: none;` -- and hidden
//     inside that same terminal phone media block). Exactly one copy draws
//     at any width, the DEC-576 idiom's own contract.
//
// FIX NOTHING in src/routes/portal/portal.css.ts or
// src/routes/portal/profile.tsx (v12m-w38-f/v12m-w38-a own those) -- this
// file measures only.

import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { DEC_576 } from "../../src/decisions";
import { stripCssComments } from "../../test/helpers/strip-css-comments";

void DEC_576; // wave-39 amendment: "a twin whose only differentiator is CSS must be
// gradeable by a class token, and the ledger that grades it may not key on the word
// 'phone'" -- this file is that ledger.

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, "..", "..");
const PORTAL_ROOT = join(REPO_ROOT, "src", "routes", "portal");
const PORTAL_CSS_FILE = join(PORTAL_ROOT, "portal.css.ts");

// ---------------------------------------------------------------------------
// File walk (readdirSync recursive, DEC-808 idiom -- no manifest).
// ---------------------------------------------------------------------------

function walkTsxFiles(root: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(root)) {
    const p = join(root, entry);
    const st = statSync(p);
    if (st.isDirectory()) out.push(...walkTsxFiles(p));
    else if (entry.endsWith(".tsx") && !entry.includes(".test.")) out.push(p);
  }
  return out;
}

const PAGE_FILES = walkTsxFiles(PORTAL_ROOT).sort();
const PAGE_SOURCES = new Map<string, string>(PAGE_FILES.map((f) => [f, readFileSync(f, "utf-8")]));

// ---------------------------------------------------------------------------
// Step 1: every `dock={IDENT}` call site.
// ---------------------------------------------------------------------------

interface DockCallSite {
  readonly file: string;
  readonly rel: string;
  readonly ident: string;
}

const DOCK_CALL_RE = /\bdock=\{(\w+)\}/g;

function findDockCallSites(): DockCallSite[] {
  const out: DockCallSite[] = [];
  for (const file of PAGE_FILES) {
    const text = PAGE_SOURCES.get(file)!;
    DOCK_CALL_RE.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = DOCK_CALL_RE.exec(text))) {
      out.push({ file, rel: relative(REPO_ROOT, file), ident: m[1]! });
    }
  }
  return out;
}

export const DOCK_CALL_SITES = findDockCallSites();

// ---------------------------------------------------------------------------
// Step 2: resolve each IDENT to its declaration's markup text.
//
// `const IDENT = <rhs>;` — extracted by a string/template-aware
// paren/brace-depth scan from just after `=` to the first top-level `;`
// (this codebase's JSX dock declarations carry no embedded `//` comments,
// verified by inspection of all five call sites, so a plain depth scan is
// sufficient -- no comment masking needed here, unlike
// test/campaign-ratchet-two-sided.scan.test.ts's `it(...)` body extractor,
// which does need it because test bodies routinely comment).
// ---------------------------------------------------------------------------

function extractStatementRhs(text: string, afterIndex: number): string {
  let i = afterIndex;
  const n = text.length;
  let depth = 0;
  let quote: string | null = null;
  const start = i;
  while (i < n) {
    const ch = text[i];
    if (quote !== null) {
      if (ch === "\\") {
        i += 2;
        continue;
      }
      if (ch === quote) quote = null;
      i++;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === "`") {
      quote = ch;
      i++;
      continue;
    }
    if (ch === "(" || ch === "{" || ch === "[") depth++;
    else if (ch === ")" || ch === "}" || ch === "]") depth--;
    else if (ch === ";" && depth <= 0) break;
    i++;
  }
  return text.slice(start, i);
}

function findConstDeclarationRhs(text: string, ident: string): string | null {
  const re = new RegExp(`\\bconst\\s+${ident}\\s*=`);
  const m = re.exec(text);
  if (!m) return null;
  return extractStatementRhs(text, m.index + m[0].length);
}

function findFunctionBody(text: string, fnName: string): string | null {
  const re = new RegExp(`\\bfunction\\s+${fnName}\\s*\\(`);
  const m = re.exec(text);
  if (!m) return null;
  const braceIdx = text.indexOf("{", m.index);
  if (braceIdx === -1) return null;
  let depth = 0;
  let i = braceIdx;
  const n = text.length;
  let quote: string | null = null;
  while (i < n) {
    const ch = text[i];
    if (quote !== null) {
      if (ch === "\\") {
        i += 2;
        continue;
      }
      if (ch === quote) quote = null;
      i++;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === "`") {
      quote = ch;
      i++;
      continue;
    }
    if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) {
        i++;
        break;
      }
    }
    i++;
  }
  return text.slice(braceIdx, i);
}

/** The full markup text a dock IDENT's declaration renders: its own RHS,
 * widened to the body of any bare function call the RHS resolves to (in
 * the same file) so a value like `tasksPageDockPrimary(...)` is graded by
 * what that function actually returns, not by its call-site text alone. */
function resolveDockMarkup(file: string, ident: string): string {
  const text = PAGE_SOURCES.get(file)!;
  const rhs = findConstDeclarationRhs(text, ident);
  if (rhs === null) {
    throw new Error(`${relative(REPO_ROOT, file)}: no "const ${ident} =" declaration found for dock={${ident}}`);
  }
  let markup = rhs;
  const callMatch = /^\s*([A-Za-z_$][\w$]*)\s*\(/.exec(rhs);
  if (callMatch) {
    const fnBody = findFunctionBody(text, callMatch[1]!);
    if (fnBody !== null) markup += `\n${fnBody}`;
  }
  return markup;
}

// ---------------------------------------------------------------------------
// Step 3: non-generic `chq-` class tokens in that markup.
// ---------------------------------------------------------------------------

const GENERIC_CLASSES = new Set(["chq-btn", "chq-btn-primary", "chq-btn-secondary", "chq-btn-tertiary"]);

const CLASS_ATTR_RE = /\bclass="([^"]*)"/g;

/** Non-generic `chq-` tokens found in `markup`, in source order (first
 * occurrence first) -- the FIRST such token is the outermost dock-specific
 * wrapper in every real declaration this file has, since JSX text order
 * follows the DOM's own outer-to-inner order. */
function specificClassTokens(markup: string): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  CLASS_ATTR_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = CLASS_ATTR_RE.exec(markup))) {
    for (const token of m[1]!.split(/\s+/)) {
      if (!token.startsWith("chq-")) continue;
      if (GENERIC_CLASSES.has(token)) continue;
      if (seen.has(token)) continue;
      seen.add(token);
      out.push(token);
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// CSS side: portal.css.ts's terminal phone media block, and the bare
// single-declaration `display: none;` class rules top-level vs. inside it.
// Mirrors app/src/phone-block-visibility.test.ts's topLevelRuleBodies /
// extractPhoneMediaBodies shape rather than adding a second parser.
// ---------------------------------------------------------------------------

function loadPortalCss(): string {
  const raw = readFileSync(PORTAL_CSS_FILE, "utf-8");
  const match = raw.match(/export const PORTAL_CSS = `([\s\S]*?)`;/);
  const body = match?.[1];
  if (body === undefined) throw new Error(`${PORTAL_CSS_FILE}: no exported PORTAL_CSS template literal found`);
  return stripCssComments(body);
}

const PORTAL_CSS = loadPortalCss();

/** Strips every top-level @media {...} block (one level of nested braces
 * inside @media), mirroring shell-geometry.test.ts / phone-block-visibility
 * .test.ts's stripMedia helper. */
function stripMediaBlocks(css: string): string {
  return css.replace(/@media[^{]*\{(?=((?:[^{}]*\{[^{}]*\}[^{}]*)*))\1\}/g, "");
}

/** Body text of every @media block whose condition names a phone-width
 * max-width breakpoint (700px, the only one portal.css.ts uses). */
function phoneMediaBody(css: string): string {
  const re = /@media([^{]*)\{((?:[^{}]*\{[^{}]*\}[^{}]*)*)\}/g;
  let out = "";
  let m: RegExpExecArray | null;
  while ((m = re.exec(css))) {
    const condition = m[1];
    const body = m[2];
    if (condition !== undefined && body !== undefined && /max-width:\s*700px/.test(condition)) {
      out += `${body}\n`;
    }
  }
  return out;
}

const WITHOUT_MEDIA = stripMediaBlocks(PORTAL_CSS);
const PHONE_MEDIA = phoneMediaBody(PORTAL_CSS);

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Every bare (non-compound, one selector per rule, no comma list) class
 * whose rule body is EXACTLY `display: none;` and nothing else, one rule
 * per source line -- the shape both `.chq-portal-edit-dock`'s top-level
 * hide and `.chq-portal-actions-footer`'s phone-media hide share. A
 * compound selector (e.g. the descendant `.chq-portal-shell >
 * .chq-portal-footer .chq-portal-signout`) never matches: its rule spans
 * multiple lines and its selector text is not a bare `.token`. */
function bareDisplayNoneClasses(cssText: string): Set<string> {
  const re = /^[ \t]*\.([A-Za-z0-9_-]+)\s*\{\s*display:\s*none;\s*\}\s*$/gm;
  const out = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = re.exec(cssText))) out.add(m[1]!);
  return out;
}

const DESKTOP_HIDDEN_CLASSES = bareDisplayNoneClasses(WITHOUT_MEDIA);
const PHONE_HIDDEN_CLASSES = bareDisplayNoneClasses(PHONE_MEDIA);

/** All declaration bodies of a bare/last-in-list rule for `selector`
 * within `cssText` (topLevelRuleBodies' shape, ported per-file rather
 * than imported -- no shared module exports it). */
function ruleBodies(cssText: string, selector: string): string[] {
  const escaped = escapeRegExp(`.${selector}`);
  const re = new RegExp(`${escaped}\\s*(?:,[^{}]*)?\\{([^}]*)\\}`, "g");
  const bodies: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(cssText))) {
    const body = m[1];
    if (body !== undefined) bodies.push(body);
  }
  return bodies;
}

/** Whether `selector` has a rule inside the phone media block whose
 * display declaration(s) are all non-`none` (i.e. it is genuinely revived
 * there, not merely present-but-still-hidden). */
function revivedAtPhone(selector: string): boolean {
  const bodies = ruleBodies(PHONE_MEDIA, selector);
  if (bodies.length === 0) return false;
  const displayDecls = bodies.join("\n").match(/display:\s*[^;]+/g) ?? [];
  if (displayDecls.length === 0) return false;
  return displayDecls.every((d) => !/^display:\s*none$/.test(d.trim()));
}

/** Whether `selector`'s top-level rule (if any) does NOT hide it with
 * `display: none` -- either no top-level rule at all (inherits its
 * parent's visible state, the same "no top-level rule" branch
 * phone-block-visibility.test.ts allows) or a real top-level rule with a
 * non-`none` display. */
function visibleAtTopLevel(selector: string): boolean {
  const bodies = ruleBodies(WITHOUT_MEDIA, selector);
  if (bodies.length === 0) return true;
  const displayDecls = bodies.join("\n").match(/display:\s*[^;]+/g) ?? [];
  return displayDecls.every((d) => !/^display:\s*none$/.test(d.trim()));
}

// ---------------------------------------------------------------------------
// Grading.
// ---------------------------------------------------------------------------

type Verdict = "VERIFIED" | "OFFENDER" | "CLASSLESS-TWIN";

interface GradedSite {
  readonly rel: string;
  readonly ident: string;
  readonly verdict: Verdict;
  readonly dockClass: string | null;
  readonly twinClass: string | null;
  readonly reason: string;
}

function gradeSite(site: DockCallSite): GradedSite {
  const markup = resolveDockMarkup(site.file, site.ident);
  const tokens = specificClassTokens(markup);
  if (tokens.length === 0) {
    return {
      rel: site.rel,
      ident: site.ident,
      verdict: "CLASSLESS-TWIN",
      dockClass: null,
      twinClass: null,
      reason: "dock markup carries no chq- class token besides the generic button-utility " +
        "classes -- no selector can reach this copy to hide it at any width",
    };
  }
  const dockClass = tokens[0]!;
  if (!DESKTOP_HIDDEN_CLASSES.has(dockClass)) {
    return {
      rel: site.rel,
      ident: site.ident,
      verdict: "OFFENDER",
      dockClass,
      twinClass: null,
      reason: `.${dockClass} has no bare top-level "display: none;" rule in portal.css.ts`,
    };
  }
  if (!revivedAtPhone(dockClass)) {
    return {
      rel: site.rel,
      ident: site.ident,
      verdict: "OFFENDER",
      dockClass,
      twinClass: null,
      reason: `.${dockClass} is hidden at top level but never revived (non-"none" display) ` +
        "inside portal.css.ts's terminal phone media block",
    };
  }
  const pageText = PAGE_SOURCES.get(site.file)!;
  const twinClass = [...PHONE_HIDDEN_CLASSES].find((c) => new RegExp(`\\bclass="[^"]*\\b${escapeRegExp(c)}\\b`).test(pageText));
  if (twinClass === undefined) {
    return {
      rel: site.rel,
      ident: site.ident,
      verdict: "OFFENDER",
      dockClass,
      twinClass: null,
      reason: `.${dockClass} is revived at phone but no same-page class carries a bare ` +
        '"display: none;" rule inside the same terminal phone media block -- no inline ' +
        "twin found to stand down when the dock copy is revealed",
    };
  }
  if (!visibleAtTopLevel(twinClass)) {
    return {
      rel: site.rel,
      ident: site.ident,
      verdict: "OFFENDER",
      dockClass,
      twinClass,
      reason: `.${twinClass} (the same-page phone-hidden twin) is ALSO display:none at top ` +
        "level -- both copies are missing at desktop, neither ever hidden-only-at-phone",
    };
  }
  return {
    rel: site.rel,
    ident: site.ident,
    verdict: "VERIFIED",
    dockClass,
    twinClass,
    reason: `.${dockClass} (top-level display:none, revived at phone) / .${twinClass} ` +
      "(visible by default, display:none at phone) -- exactly one copy draws at any width",
  };
}

export const ROSTER: GradedSite[] = DOCK_CALL_SITES.map(gradeSite);

const OFFENDERS = ROSTER.filter((s) => s.verdict === "OFFENDER");
const CLASSLESS = ROSTER.filter((s) => s.verdict === "CLASSLESS-TWIN");

// SEED (forced to -1, then read back): OFFENDERS.length === 0,
// CLASSLESS.length === 3 (index.tsx's session-detail `dock`, profile.tsx's
// `profileDock` -- the live desktop double-Save root cause -- and
// tasks/views.tsx's `tasksPageDockPrimary` dock). Never arithmetic, never a
// snapshot: both ceilings below are read from this same ROSTER at seed time.
//
// LOWERED (task w44-f): profile.tsx's `profileDock` gained a
// `.chq-portal-profile-dock` class (paired with `.chq-portal-actions-footer`
// display:none-at-phone), closing the double-Save root cause the seed
// comment named and re-grading that site VERIFIED. Two CLASSLESS-TWIN sites
// remain: index.tsx's session-detail `dock` and tasks/views.tsx's `dock`.
export const TWIN_VISIBILITY_OFFENDER_CEILING = 0;
export const TWIN_VISIBILITY_CLASSLESS_CEILING = 2;

describe("phone twin-visibility ledger (w39-b, DEC-576)", () => {
  it("found exactly the five known dock={...} call sites under src/routes/portal/**", () => {
    // Measured on main at wave-39 (src/routes/portal/{index,profile,edit}.tsx,
    // src/routes/portal/tasks/views.tsx x2).
    expect(DOCK_CALL_SITES.length).toBe(5);
  });

  for (const site of ROSTER) {
    it(`${site.rel} :: dock={${site.ident}} -- ${site.verdict}: ${site.reason}`, () => {
      expect(site.verdict === "VERIFIED" || site.verdict === "OFFENDER" || site.verdict === "CLASSLESS-TWIN").toBe(
        true,
      );
    });
  }

  it(`does not exceed TWIN_VISIBILITY_OFFENDER_CEILING (${TWIN_VISIBILITY_OFFENDER_CEILING})`, () => {
    expect(
      OFFENDERS.length,
      OFFENDERS.length > 0
        ? `offenders:\n${OFFENDERS.map((o) => `  ${o.rel} :: dock={${o.ident}} -- ${o.reason}`).join("\n")}`
        : "",
    ).toBeLessThanOrEqual(TWIN_VISIBILITY_OFFENDER_CEILING);
  });

  it("TWIN_VISIBILITY_OFFENDER_CEILING does not sit stale above the measured count", () => {
    if (OFFENDERS.length < TWIN_VISIBILITY_OFFENDER_CEILING) {
      throw new Error(
        `ratchet stale -- replace with: export const TWIN_VISIBILITY_OFFENDER_CEILING = ${OFFENDERS.length};`,
      );
    }
    expect(OFFENDERS.length).toBeGreaterThanOrEqual(TWIN_VISIBILITY_OFFENDER_CEILING);
  });

  it(`does not exceed TWIN_VISIBILITY_CLASSLESS_CEILING (${TWIN_VISIBILITY_CLASSLESS_CEILING})`, () => {
    expect(
      CLASSLESS.length,
      CLASSLESS.length > 0
        ? `classless-twin sites:\n${CLASSLESS.map((o) => `  ${o.rel} :: dock={${o.ident}} -- ${o.reason}`).join("\n")}`
        : "",
    ).toBeLessThanOrEqual(TWIN_VISIBILITY_CLASSLESS_CEILING);
  });

  it("TWIN_VISIBILITY_CLASSLESS_CEILING does not sit stale above the measured count", () => {
    if (CLASSLESS.length < TWIN_VISIBILITY_CLASSLESS_CEILING) {
      throw new Error(
        `ratchet stale -- replace with: export const TWIN_VISIBILITY_CLASSLESS_CEILING = ${CLASSLESS.length};`,
      );
    }
    expect(CLASSLESS.length).toBeGreaterThanOrEqual(TWIN_VISIBILITY_CLASSLESS_CEILING);
  });
});
