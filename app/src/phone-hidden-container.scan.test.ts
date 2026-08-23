// DEC-808 wave-41 (task w41-e) amendment: "a phone `display:none` on a
// CONTAINER removes its subtree's capability, and the selector-keyed filter
// cannot see it." phone-capability-removal.scan.test.ts's own population
// (PHONE_DISPLAY_NONE_RULES, narrowed to INTERACTIVE_PHONE_DISPLAY_NONE_RULES
// by SELECTOR) only ever grades a rule whose own selector addresses an
// interactive element or a class placed directly on one. A rule whose
// selector names a CONTAINER class -- one that carries no interactive tag
// itself but wraps one in the markup -- is invisible to that filter even
// though hiding it removes exactly the same capability. `.chq-portal-
// actions-footer { display: none }` (src/routes/portal/portal.css.ts:1031)
// is the measured example: the selector is a bare container class, not
// itself interactive, but it wraps the profile form's inline Save submit
// button and its hide is the root of the confirmed desktop double-Save
// defect (wave-38, owned by v12m-w38-a/v12m-w38-f, NOT repaired here).
//
// This file WIDENS THE POPULATION BY SUBTREE, NOT BY SELECTOR: for every
// phone display:none rule whose selector is not itself interactive (i.e.
// every rule in PHONE_DISPLAY_NONE_RULES not already covered by
// INTERACTIVE_PHONE_DISPLAY_NONE_RULES) and that carries no phone-hidden
// receipt of its own, this resolves the rule's TARGET class token(s) --
// the class(es) on the actual element the selector addresses, i.e. the
// last (rightmost) compound in the selector, since that is the node CSS
// actually hides, never an ancestor combinator segment -- in the real
// markup (every non-test *.tsx under app/src/** and src/routes/**,
// DEC-808 readdirSync recursion, never a hand list) and asks whether that
// element's JSX subtree contains an interactive descendant (`<a>`,
// `<button>`, `<input>`, `<select>`, `<textarea>`, `role="button"`, or
// `type="submit"`). If yes, the rule owes the same `/* phone-hidden: */`
// receipt an interactive-selector rule owes.
//
// This is a SEPARATELY NAMED, SEPARATELY GATED population
// (PHONE_HIDDEN_CONTAINER_UNRECEIPTED_CEILING), registered
// OUT_OF_CAMPAIGN_SCOPE in scripts/exit-predicate/campaign-scope.ts rather
// than folded into PHONE_HIDDEN_UNRECEIPTED_CEILING -- a newly-derived
// population must never move an existing campaign-gating ratchet's
// goalposts mid-convergence (the same DEC-069/wave-30 rationale
// PUBLIC_MOBILE_INTERACTIVE_OFFENDERS_CEILING already follows). The
// PHONE_HIDDEN_UNRECEIPTED_CEILING=0 row above is untouched and stays a
// campaign-gating row; this one is not.
//
// Roster: docs/design/audit/phone-hidden-container-v12.md.

import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { DEC_808 } from '../../src/decisions';
import { INTERACTIVE_PHONE_DISPLAY_NONE_RULES, PHONE_DISPLAY_NONE_RULES } from './phone-capability-removal.scan.test';

void DEC_808; // this scan's whole reason to exist: DEC-808 wave-41's subtree-not-selector widening

const HERE = dirname(fileURLToPath(import.meta.url)); // app/src
const REPO_ROOT = join(HERE, '..', '..');
const SRC_ROOT = join(REPO_ROOT, 'src');

// --- population: non-interactive-selector, unreceipted phone display:none rules ---

interface PhoneDisplayNoneRule {
  sheet: string;
  selector: string;
  receipt: string | undefined;
}

function ruleKey(r: PhoneDisplayNoneRule): string {
  return `${r.sheet}\u0000${r.selector}\u0000${r.receipt ?? ''}`;
}

const INTERACTIVE_KEYS = new Set(INTERACTIVE_PHONE_DISPLAY_NONE_RULES.map(ruleKey));

/** Every phone display:none rule whose SELECTOR does not itself satisfy
 * phone-capability-removal.scan.test.ts's selectorIsInteractive -- the
 * exact complement of that file's own population, never re-derived by a
 * second copy of the interactivity predicate (DEC-613). */
const NON_INTERACTIVE_SELECTOR_RULES: PhoneDisplayNoneRule[] = PHONE_DISPLAY_NONE_RULES.filter(
  (r) => !INTERACTIVE_KEYS.has(ruleKey(r)),
);

/** Of those, the ones carrying no phone-hidden receipt of their own -- a
 * receipted rule is already covered regardless of what its subtree holds. */
const UNRECEIPTED_NON_INTERACTIVE_SELECTOR_RULES = NON_INTERACTIVE_SELECTOR_RULES.filter(
  (r) => r.receipt === undefined,
);

// --- target class token(s): the class(es) on the element the selector actually addresses ---

/** The rightmost (target) compound of one comma-free selector segment --
 * everything after the last top-level combinator (space/`>`/`+`/`~`),
 * with any `:has(...)`/`:not(...)` parenthetical content neutralised first
 * so a combinator quoted INSIDE a pseudo-class argument can't be mistaken
 * for a top-level one. This is the node CSS actually hides -- an ancestor
 * segment earlier in a descendant chain is never the display:none target. */
function targetTokensForPart(part: string): string[] {
  const noParens = part.replace(/\([^()]*\)/g, ' ');
  const noCombinators = noParens.replace(/[>+~]/g, ' ');
  const segments = noCombinators.trim().split(/\s+/).filter(Boolean);
  const last = segments[segments.length - 1] ?? '';
  return [...last.matchAll(/chq-[a-z0-9-]+/g)].map((m) => m[0]);
}

/** Every distinct target class token across a (possibly comma-separated)
 * selector's parts. */
function targetTokens(selector: string): string[] {
  const out = new Set<string>();
  for (const part of selector.split(',').map((s) => s.trim())) {
    for (const t of targetTokensForPart(part)) out.add(t);
  }
  return [...out];
}

// --- markup subtree resolution ---

function stripTsxComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
}

function allTsxFiles(root: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(root, { withFileTypes: true, recursive: true })) {
    if (!entry.isFile() || !entry.name.endsWith('.tsx')) continue;
    if (entry.name.includes('.test.')) continue;
    out.push(join(entry.parentPath, entry.name));
  }
  return out;
}

interface TsxFile {
  path: string;
  text: string;
}

const ALL_TSX: TsxFile[] = [...allTsxFiles(HERE), ...allTsxFiles(SRC_ROOT)].map((path) => ({
  path,
  text: stripTsxComments(readFileSync(path, 'utf-8')),
}));

interface Tag {
  text: string;
  start: number;
  end: number;
}

/** Every JSX-shaped opening/closing/self-closing tag substring in `text`
 * (regex-based, mirroring this codebase's existing tag-scan idiom in
 * app/src/phone-block-visibility.test.ts's extractOpeningTags -- a real
 * parser is not this population's contract). */
function allTags(text: string): Tag[] {
  const tagRe = /<\/?[A-Za-z][A-Za-z0-9.]*\b[^<>]*>/g;
  const out: Tag[] = [];
  let m: RegExpExecArray | null;
  while ((m = tagRe.exec(text)) !== null) {
    out.push({ text: m[0], start: m.index, end: m.index + m[0].length });
  }
  return out;
}

/** For every opening tag in `text` whose class/className literal contains
 * `token` as a whole word, returns the raw text of that tag's JSX subtree
 * (everything between its opening tag and its depth-matched closing tag,
 * tracked by tag NAME so an intervening same-named sibling can't
 * desynchronise the match). A self-closing target tag contributes an empty
 * subtree (it can have no descendant). An unmatched close (should not occur
 * in well-formed JSX) conservatively takes the rest of the file rather than
 * silently under-counting. */
function subtreesForClassToken(text: string, token: string): string[] {
  const tags = allTags(text);
  const tokenRe = new RegExp(`\\b${token}\\b`);
  const subtrees: string[] = [];
  for (let i = 0; i < tags.length; i++) {
    const tag = tags[i] as Tag;
    if (tag.text.startsWith('</')) continue;
    const classMatch = tag.text.match(/(?:class|className)\s*=\s*(\{[^}]*\}|"[^"]*"|`[^`]*`)/);
    if (!classMatch || !tokenRe.test(classMatch[1] as string)) continue;
    const isSelfClose = /\/>\s*$/.test(tag.text);
    if (isSelfClose) {
      subtrees.push('');
      continue;
    }
    const tagNameMatch = tag.text.match(/^<([A-Za-z][A-Za-z0-9.]*)/);
    const tagName = tagNameMatch?.[1];
    let depth = 1;
    let subtreeEnd: number | null = null;
    for (let j = i + 1; j < tags.length; j++) {
      const t = tags[j] as Tag;
      const nameMatch = t.text.match(/^<\/?([A-Za-z][A-Za-z0-9.]*)/);
      if (nameMatch?.[1] !== tagName) continue;
      if (t.text.startsWith('</')) {
        depth--;
        if (depth === 0) {
          subtreeEnd = t.end;
          break;
        }
      } else if (!/\/>\s*$/.test(t.text)) {
        depth++;
      }
    }
    subtrees.push(subtreeEnd !== null ? text.slice(tag.end, subtreeEnd) : text.slice(tag.end));
  }
  return subtrees;
}

const INTERACTIVE_DESCENDANT_RE = /<a\b|<button\b|<input\b|<select\b|<textarea\b/;
const ROLE_BUTTON_RE = /role\s*=\s*["'`]button["'`]/;
const TYPE_SUBMIT_RE = /type\s*=\s*["'`]submit["'`]/;

function subtreeHasInteractiveDescendant(subtree: string): boolean {
  return (
    INTERACTIVE_DESCENDANT_RE.test(subtree) || ROLE_BUTTON_RE.test(subtree) || TYPE_SUBMIT_RE.test(subtree)
  );
}

/** True if ANY markup mount of ANY of `selector`'s target tokens has a JSX
 * subtree containing an interactive descendant. */
function selectorContainerHasInteractiveDescendant(selector: string): { hit: boolean; file: string | undefined } {
  for (const token of targetTokens(selector)) {
    for (const { path, text } of ALL_TSX) {
      const subtrees = subtreesForClassToken(text, token);
      if (subtrees.some(subtreeHasInteractiveDescendant)) {
        return { hit: true, file: relative(REPO_ROOT, path) };
      }
    }
  }
  return { hit: false, file: undefined };
}

interface ContainerOffender {
  sheet: string;
  selector: string;
  markupFile: string;
}

const CONTAINER_OFFENDERS: ContainerOffender[] = UNRECEIPTED_NON_INTERACTIVE_SELECTOR_RULES.map((r) => {
  const { hit, file } = selectorContainerHasInteractiveDescendant(r.selector);
  return hit ? { sheet: r.sheet, selector: r.selector, markupFile: file as string } : null;
}).filter((x): x is ContainerOffender => x !== null);

// wave-49 (task w49-d): adjudicated the SHELL + SSR half of this roster (10
// rows: 6 in app/src/styles.css, 1 in src/routes/docs-site.css.ts, 3 in
// src/routes/portal/portal.css.ts) against their v12 frames -- all ten take
// disposition (a), a `/* phone-hidden: */` receipt, including
// .chq-portal-actions-footer: the wave-38 double-Save defect this row's
// history names (v12m-w38-a/v12m-w38-f, neither branch exists any more) was
// in fact already repaired on this tree -- profile.tsx's own comment at its
// .chq-portal-actions-footer usage states "exactly one Save control visible
// at any width", and portal.css.ts's .chq-portal-profile-dock/.chq-portal-
// actions-footer pair (phone: dock revealed, in-flow copy hidden) confirms
// it. The remaining 21 rows live under app/src/pages/** and were NOT this
// task's population -- see docs/design/audit/phone-hidden-container-v12.md.
//
// wave-52 (task w52-d): adjudicated 9 of those 21 rows (rows 1, 2, 9, 10,
// 11, 12, 19, 20, 21 in the audit doc's numbering) against their v12
// frames. Eight take disposition (a), a `/* phone-hidden: */` receipt
// naming the phone-side affordance that reaches the same capability by
// class and handler (agenda.css .chq-agenda-armed-bar is disposition (b),
// a verified navigation dead-end -- its onArm callback is never wired to
// a phone-rendered component, so the subtree's own buttons can never
// paint). One row -- speakers/task-view.css's
// `.chq-taskview-answers .chq-taskview-head-row, .chq-taskview-waiting
// .chq-taskview-head-row` -- was disposition (c), a REAL DEFECT: no v12
// frame at 390 exists for this screen at all, and hiding the head row
// removed the only "select all" control (toggleAll) with no phone-side
// replacement (per-row checkboxes remain, but there was no bulk-select-all
// affordance on phone). Ceiling lowered from 21 to 13 (21 - 8 receipted),
// measured (not assumed) by re-running the scan with the receipts in
// place. Rows 3-8 and 13-18 remain unadjudicated.
//
// wave-54 (task w54-c): built and receipted the disposition-(c) row above.
// TaskView.tsx's always-mounted bulk bar now renders an `All {n}` control
// (`.chq-taskview-bulk-selectall`, task-view.css) in both its idle and
// armed branches, calling the same `toggleAll` the head-row checkbox
// calls (DEC-989/DEC-825), and the head-row hide rule carries a
// `/* phone-hidden: */` receipt naming it. Ceiling lowered from 13 to 12,
// measured (not assumed) by re-running the scan with the receipt in
// place.
//
// wave-56 (task w56-d): adjudicated the last twelve rows (audit doc rows
// 3-8, 13-18, all app/src/pages/contacts/** and app/src/pages/overview.css
// /settings.css). All twelve take disposition (a) -- each is a re-lined
// phone-side replacement or a drill-in navigation swap already reachable
// on screen, named by class and handler in a `/* phone-hidden: */` receipt
// directly above its rule; none required a CSS declaration change to an
// existing rule. Ceiling lowered from 12 to 0, measured (not assumed) by
// re-running the scan with the ceiling forced to -1 and confirming the
// printed offender roster is empty. This drains the population this file
// was seeded to grade: promoted the same commit into the campaign-gating
// registries per DEC-069 (parked-fidelity-promises.ts row deleted,
// campaign-scope.ts OUT_OF_CAMPAIGN_SCOPE entry deleted, campaign-constant
// -names.ts + tier2-ceiling-names.ts both gained this name).
//
// SEED, measured on this branch's tree at authoring time (2026-08-23):
// this ceiling may only be LOWERED (receipt lands, rule is deleted, or the
// container's capability is otherwise restored) -- never raised to
// accommodate a new unreceipted rule.
export const PHONE_HIDDEN_CONTAINER_UNRECEIPTED_CEILING = 0;

describe('DEC-808 wave-41 phone container capability-removal probe (subtree, not selector)', () => {
  it('finds more than zero non-interactive-selector phone display:none rules (vacuous-population tripwire)', () => {
    expect(NON_INTERACTIVE_SELECTOR_RULES.length).toBeGreaterThan(0);
  });

  it('wave-49 shell+SSR adjudication: src/routes/portal/portal.css.ts .chq-portal-actions-footer now carries a phone-hidden receipt, not an offender', () => {
    expect(
      CONTAINER_OFFENDERS.some(
        (o) => o.sheet === 'src/routes/portal/portal.css.ts' && o.selector === '.chq-portal-actions-footer',
      ),
    ).toBe(false);
  });

  it('resolves the target token of a compound descendant selector to its rightmost (hidden) compound, not an ancestor segment (unit control)', () => {
    expect(targetTokens('.chq-content-worklist .chq-bulkbar')).toEqual(['chq-bulkbar']);
    expect(targetTokens('.chq-a > .chq-b, .chq-c + .chq-d')).toEqual(['chq-b', 'chq-d']);
  });

  it('neutralises a combinator quoted inside a :has()/:not() pseudo-class argument before splitting on top-level combinators (unit control)', () => {
    expect(targetTokens('.chq-shell:has([data-chq-phone-head]) .chq-header')).toEqual(['chq-header']);
  });

  it('flags a synthetic container class whose JSX subtree contains a <button> (positive control)', () => {
    const tsx = '<div className="chq-x-fake-container"><button type="button">Go</button></div>';
    const subtrees = subtreesForClassToken(tsx, 'chq-x-fake-container');
    expect(subtrees.length).toBe(1);
    expect(subtreeHasInteractiveDescendant(subtrees[0] as string)).toBe(true);
  });

  it('does not flag a synthetic container class whose JSX subtree has no interactive descendant (negative control)', () => {
    const tsx = '<div className="chq-x-fake-inert"><p>Just some text</p><span>and a span</span></div>';
    const subtrees = subtreesForClassToken(tsx, 'chq-x-fake-inert');
    expect(subtrees.length).toBe(1);
    expect(subtreeHasInteractiveDescendant(subtrees[0] as string)).toBe(false);
  });

  it('does not flag a self-closing element carrying the class (it can have no descendant, positive/negative boundary control)', () => {
    const tsx = '<input className="chq-x-fake-selfclose" />';
    const subtrees = subtreesForClassToken(tsx, 'chq-x-fake-selfclose');
    expect(subtrees).toEqual(['']);
    expect(subtreeHasInteractiveDescendant('')).toBe(false);
  });

  it('a same-named sibling tag between the target and its close does not desynchronise the depth match (nesting control)', () => {
    const tsx =
      '<div className="chq-x-fake-nested">' +
      '<div>plain</div>' +
      '<button type="submit">Submit</button>' +
      '</div>';
    const subtrees = subtreesForClassToken(tsx, 'chq-x-fake-nested');
    expect(subtrees.length).toBe(1);
    expect(subtreeHasInteractiveDescendant(subtrees[0] as string)).toBe(true);
  });

  it('unreceipted phone container display:none rules with an interactive subtree never exceed the ceiling (one-sided ratchet: may only fall)', () => {
    const detail = CONTAINER_OFFENDERS.map((o) => `${o.sheet} :: ${o.selector} (markup: ${o.markupFile})`).join(
      '\n',
    );
    expect(
      CONTAINER_OFFENDERS.length,
      `unreceipted phone container display:none rules with an interactive descendant ` +
        `(${CONTAINER_OFFENDERS.length}, ceiling ${PHONE_HIDDEN_CONTAINER_UNRECEIPTED_CEILING}):\n${detail}`,
    ).toBeLessThanOrEqual(PHONE_HIDDEN_CONTAINER_UNRECEIPTED_CEILING);
  });

  // Two-sided companion (mirrors phone-capability-removal.scan.test.ts's
  // own stale-ceiling companion, and satisfies the DEC-808 wave-85
  // amendment's two-sidedness requirement for every campaign ratchet name,
  // including an OUT_OF_CAMPAIGN_SCOPE one): a ceiling sitting ABOVE the
  // measured truth licenses stagnation instead of forbidding debt.
  it('never sits ABOVE the measured truth without the ceiling being tightened to match (a stale ceiling licenses stagnation)', () => {
    if (CONTAINER_OFFENDERS.length < PHONE_HIDDEN_CONTAINER_UNRECEIPTED_CEILING) {
      throw new Error(
        `${CONTAINER_OFFENDERS.length} unreceipted phone container display:none rule(s) with an ` +
          `interactive descendant, below the ratchet ceiling of ${PHONE_HIDDEN_CONTAINER_UNRECEIPTED_CEILING}. ` +
          `This is the ratchet working: coverage landed. Tighten the ceiling in the same commit (a ` +
          `merge-train act, never a worker's edit mid-lane) by replacing the line:\n` +
          `  export const PHONE_HIDDEN_CONTAINER_UNRECEIPTED_CEILING = ${CONTAINER_OFFENDERS.length};`,
      );
    }
    expect(CONTAINER_OFFENDERS.length).toBeGreaterThanOrEqual(PHONE_HIDDEN_CONTAINER_UNRECEIPTED_CEILING);
  });
});

export { CONTAINER_OFFENDERS };
