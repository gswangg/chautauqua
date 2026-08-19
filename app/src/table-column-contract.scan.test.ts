// DEC-902 (wave 23 amendment) column-geometry contract, given its scan in
// the same wave it landed (DEC-808's "a contract lands with its scan or it
// drifts back"). Every admin `<table className="...">` literal is enumerated
// via readdirSync over app/src/**/*.tsx -- never a hand-listed manifest --
// and every `chq-*-table` / `chq-*-grid` token found in its className must
// satisfy one of exactly two idioms:
//
//   (i) TABLE IDIOM: `table-layout: fixed` declared at TOP LEVEL (outside
//       any @media) for the token's own selector, plus a declared `width`
//       on every column-class hook the table's <thead> markup carries but
//       exactly one -- the remainder column, which is either a class hook
//       with no width rule, or (per the DEC-902 wave-23 wording) no class
//       hook at all. Both shapes collapse to the same check: exactly one
//       <th> in the table's own <thead> resolves to "no width declared".
//
//   (ii) ROW-GRID IDIOM: the page sheet declares one `grid-template-columns`
//        shared by a `<selector> thead tr` / `<selector> tbody tr` pair --
//        the shape `.chq-detail-page .chq-participants-table` uses
//        (detail.css:638-644, `1fr 150px 210px auto`).
//
// Two exemptions, each stated as a reason in source (never grown from a
// failing run's output, per DEC-808's wave-23 amendment):
//
//   - `.chq-speakers-grid`: a data-driven column count (one <th> per event
//     task, README `## Widths` says those tracks split the measure evenly)
//     -- OnboardingGrid.tsx never gives a task <th> a class hook, so the
//     per-<th> width check cannot apply. It still owes `table-layout:
//     fixed` plus a pin on its one static, non-data-driven column: the
//     identity column, pinned via `th:first-child`/`td:first-child` rather
//     than a class hook (speakers.css:183/186-189).
//
//   - the phone reflow block (`@media (max-width: 700px)` etc turning the
//     table into `display: block` cards): table layout is moot once a row
//     is a block-level card, so a table idiom's `.token` selector must
//     never carry `table-layout: fixed` INSIDE a phone media block (it may
//     be absent there, or explicitly reset to `auto`).
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const HERE = dirname(fileURLToPath(import.meta.url));

/** Every *.tsx file under app/src, excluding *.test.tsx (DEC-808: enumerate,
 * never hand-list). */
function allTsxFiles(root: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(root, { withFileTypes: true, recursive: true })) {
    if (!entry.isFile() || !entry.name.endsWith('.tsx')) continue;
    if (entry.name.includes('.test.')) continue;
    out.push(join(entry.parentPath, entry.name));
  }
  return out.sort();
}

/** Every *.css file under app/src, enumerated (DEC-808). */
function allCssFiles(root: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(root, { withFileTypes: true, recursive: true })) {
    if (!entry.isFile() || !entry.name.endsWith('.css')) continue;
    out.push(join(entry.parentPath, entry.name));
  }
  return out.sort();
}

const TSX_FILES = allTsxFiles(HERE);
const CSS_FILES = allCssFiles(HERE);
const CSS_TEXTS = CSS_FILES.map((path) => ({ path, css: readFileSync(path, 'utf-8') }));

function stripComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, '');
}

/** Strips every @media block (top-level-only parsing, per house idiom). */
function stripMedia(css: string): string {
  return stripComments(css).replace(/@media[^{]*\{(?=((?:[^{}]*\{[^{}]*\}[^{}]*)*))\1\}/g, '');
}

/** Every top-level (@media stripped) `selector { body }` rule. */
function topLevelRules(css: string): Array<{ selector: string; body: string }> {
  const withoutMedia = stripMedia(css);
  const rules: Array<{ selector: string; body: string }> = [];
  const re = /([^{}]+)\{([^{}]*)\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(withoutMedia)) !== null) {
    rules.push({ selector: (m[1] ?? '').trim(), body: m[2] ?? '' });
  }
  return rules;
}

/** Every `selector { body }` rule found strictly INSIDE an @media block
 * (the mirror of topLevelRules), used by the phone-idiom exemption check. */
function mediaRules(css: string): Array<{ selector: string; body: string }> {
  const withoutComments = stripComments(css);
  const rules: Array<{ selector: string; body: string }> = [];
  withoutComments.replace(/@media[^{]*\{(?=((?:[^{}]*\{[^{}]*\}[^{}]*)*))\1\}/g, (_full, inner: string) => {
    const re = /([^{}]+)\{([^{}]*)\}/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(inner)) !== null) {
      rules.push({ selector: (m[1] ?? '').trim(), body: m[2] ?? '' });
    }
    return '';
  });
  return rules;
}

/** Splits a comma-separated selector list into its trimmed parts. */
function selectorParts(selector: string): string[] {
  return selector.split(',').map((s) => s.trim());
}

/** Whether `token`'s own selector (`.token`, possibly as one part of a
 * compound/comma-separated selector, or prefixed by an ancestor like
 * `.chq-detail-page .token`) declares `table-layout: fixed` in a TOP-LEVEL
 * rule anywhere in the CSS union. */
function hasTopLevelTableLayoutFixed(token: string): boolean {
  const dotToken = `.${token}`;
  for (const { css } of CSS_TEXTS) {
    for (const { selector, body } of topLevelRules(css)) {
      const parts = selectorParts(selector);
      const owns = parts.some((p) => p === dotToken || p.endsWith(` ${dotToken}`));
      if (owns && /table-layout\s*:\s*fixed/.test(body)) return true;
    }
  }
  return false;
}

/** Whether `token`'s own selector carries `table-layout: fixed` inside ANY
 * @media block -- a violation of "the phone reflow stays auto-layout". */
function hasPhoneTableLayoutFixed(token: string): boolean {
  const dotToken = `.${token}`;
  for (const { css } of CSS_TEXTS) {
    for (const { selector, body } of mediaRules(css)) {
      const parts = selectorParts(selector);
      const owns = parts.some((p) => p === dotToken || p.endsWith(` ${dotToken}`));
      if (owns && /table-layout\s*:\s*fixed/.test(body)) return true;
    }
  }
  return false;
}

/** The row-grid idiom: a single rule (anywhere, top level) whose selector
 * list includes both `<...>token thead tr` and `<...>token tbody tr`, whose
 * body declares grid-template-columns. */
function hasRowGridIdiom(token: string): boolean {
  const theadNeedle = `.${token} thead tr`;
  const tbodyNeedle = `.${token} tbody tr`;
  for (const { css } of CSS_TEXTS) {
    for (const { selector, body } of topLevelRules(css)) {
      const parts = selectorParts(selector);
      const hasThead = parts.some((p) => p.endsWith(theadNeedle));
      const hasTbody = parts.some((p) => p.endsWith(tbodyNeedle));
      if (hasThead && hasTbody && /grid-template-columns\s*:/.test(body)) return true;
    }
  }
  return false;
}

/** Whether a `chq-…` class token has a top-level rule (`.token` as one
 * selector-list part, standalone or compound/descendant) declaring `width`. */
function hookHasTopLevelWidth(token: string): boolean {
  const dotToken = `.${token}`;
  for (const { css } of CSS_TEXTS) {
    for (const { selector, body } of topLevelRules(css)) {
      const parts = selectorParts(selector);
      const owns = parts.some((p) => p === dotToken || p.endsWith(` ${dotToken}`) || p.endsWith(dotToken));
      if (owns && /(^|[;{\s])width\s*:/.test(body)) return true;
    }
  }
  return false;
}

/** Whether `.chq-speakers-grid`'s identity column is pinned via
 * `th:first-child`/`td:first-child` (its own exemption shape -- a
 * data-driven column count means no per-<th> class hook exists to check). */
function hasSpeakersGridIdentityPin(): boolean {
  for (const { css } of CSS_TEXTS) {
    for (const { selector, body } of topLevelRules(css)) {
      const parts = selectorParts(selector);
      const matchesFirstChild = parts.some(
        (p) => p === '.chq-speakers-grid th:first-child' || p === '.chq-speakers-grid td:first-child',
      );
      if (matchesFirstChild && /(^|[;{\s])width\s*:/.test(body)) return true;
    }
  }
  return false;
}

/** One `<table className="literal-string">...</table>` instance found by
 * literal className string search (matching the task's own "literal"
 * framing) -- captures the class list and the raw markup between the
 * opening and matching closing </table> tag (brace-free, so a naive
 * indexOf of the next `</table>` is sufficient; no table nests another). */
interface TableInstance {
  file: string;
  classList: string[];
  markup: string;
}

function findTableInstances(src: string): TableInstance[] {
  const out: TableInstance[] = [];
  const re = /<table\s+className="([^"]*)"[^>]*>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src)) !== null) {
    const classList = (m[1] ?? '').split(/\s+/).filter(Boolean);
    const closeIdx = src.indexOf('</table>', re.lastIndex);
    const markup = closeIdx === -1 ? src.slice(re.lastIndex) : src.slice(re.lastIndex, closeIdx);
    out.push({ file: '', classList, markup });
  }
  return out;
}

/** Every `<th ...>` tag's class list within a table's own <thead> region
 * (falls back to the whole markup if no <thead> tag is found, which never
 * happens for a real table but keeps this total). */
function theadThClassLists(markup: string): string[][] {
  const theadEnd = markup.indexOf('</thead>');
  const theadSrc = theadEnd === -1 ? markup : markup.slice(0, theadEnd);
  const out: string[][] = [];
  const re = /<th\b[^>]*>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(theadSrc)) !== null) {
    const clsMatch = m[0].match(/className="([^"]*)"/);
    out.push(clsMatch ? (clsMatch[1] ?? '').split(/\s+/).filter(Boolean) : []);
  }
  return out;
}

const TABLE_TOKEN_RE = /^chq-[a-z0-9-]+-(table|grid)$/;

/** `.chq-speakers-grid` (data-driven column count, see file header) is
 * exempt from the per-<th> width check, but must still show
 * table-layout:fixed and its own first-column pin. */
const DATA_DRIVEN_COLUMN_COUNT_TOKENS = new Set<string>(['chq-speakers-grid']);

describe('table column-geometry contract (DEC-902 wave-23 amendment)', () => {
  it('found tsx and css files to scan', () => {
    expect(TSX_FILES.length).toBeGreaterThan(5);
    expect(CSS_FILES.length).toBeGreaterThan(5);
  });

  it('every <table> instance has at least one chq-*-table/chq-*-grid token', () => {
    // Guards the scan itself: if the className regex or the token filter
    // ever stopped matching real markup, every assertion below would
    // vacuously pass over an empty set.
    let total = 0;
    for (const path of TSX_FILES) {
      const src = readFileSync(path, 'utf-8');
      for (const instance of findTableInstances(src)) {
        const tokens = instance.classList.filter((c) => TABLE_TOKEN_RE.test(c));
        if (tokens.length > 0) total++;
      }
    }
    expect(total).toBeGreaterThan(10);
  });

  it('every chq-*-table/chq-*-grid token satisfies the fixed-layout or row-grid idiom', () => {
    const offenders: string[] = [];
    for (const path of TSX_FILES) {
      const src = readFileSync(path, 'utf-8');
      const label = relative(HERE, path);
      for (const instance of findTableInstances(src)) {
        const tableTokens = instance.classList.filter((c) => TABLE_TOKEN_RE.test(c));
        if (tableTokens.length === 0) continue;

        // A className carrying several chq-*-table tokens (e.g. the shared
        // `chq-content-table` vocabulary class alongside the page-specific
        // `chq-content-worklist-table`/`chq-content-files-table`) needs at
        // least ONE token in the set to own the actual geometry rule --
        // a shared vocabulary class that only styles the header rule is
        // not itself required to also declare table-layout.
        const owningToken = tableTokens.find(
          (t) => hasTopLevelTableLayoutFixed(t) || hasRowGridIdiom(t),
        );
        if (owningToken === undefined) {
          offenders.push(`${label}: [${tableTokens.join(', ')}] -- no token owns table-layout:fixed or the row-grid idiom`);
          continue;
        }

        if (hasRowGridIdiom(owningToken)) {
          // Row-grid idiom: geometry lives in the shared grid-template-
          // columns rule, not per-<th> class hooks (participants-table's
          // <th> elements carry no className at all). Nothing further to
          // check for this instance.
          continue;
        }

        // Table idiom.
        if (DATA_DRIVEN_COLUMN_COUNT_TOKENS.has(owningToken)) {
          if (!hasSpeakersGridIdentityPin()) {
            offenders.push(
              `${label}: [${owningToken}] data-driven column count but no th:first-child/td:first-child width pin`,
            );
          }
          continue;
        }

        const thClassLists = theadThClassLists(instance.markup);
        if (thClassLists.length === 0) {
          offenders.push(`${label}: [${owningToken}] table-layout:fixed but no <th> found to check widths on`);
          continue;
        }

        let unwidthedCount = 0;
        for (const classes of thClassLists) {
          const hooks = classes.filter((c) => c.startsWith('chq-'));
          const anyHookHasWidth = hooks.some((h) => hookHasTopLevelWidth(h));
          if (!anyHookHasWidth) unwidthedCount++;
        }
        if (unwidthedCount !== 1) {
          offenders.push(
            `${label}: [${owningToken}] expected exactly ONE unwidthed <th> (the remainder column), found ${unwidthedCount}`,
          );
        }
      }
    }
    expect(offenders, `column-geometry contract violations:\n${offenders.join('\n')}`).toEqual([]);
  });

  it('no table-idiom token declares table-layout:fixed inside a phone (@media) block', () => {
    const offenders: string[] = [];
    for (const path of TSX_FILES) {
      const src = readFileSync(path, 'utf-8');
      const label = relative(HERE, path);
      for (const instance of findTableInstances(src)) {
        const tableTokens = instance.classList.filter((c) => TABLE_TOKEN_RE.test(c));
        for (const token of tableTokens) {
          if (hasRowGridIdiom(token)) continue; // row-grid idiom, not this check
          if (!hasTopLevelTableLayoutFixed(token)) continue; // not a table-idiom owner
          if (hasPhoneTableLayoutFixed(token)) {
            offenders.push(`${label}: .${token} declares table-layout:fixed inside an @media block`);
          }
        }
      }
    }
    expect(offenders, `phone reflow must stay auto-layout:\n${offenders.join('\n')}`).toEqual([]);
  });
});
