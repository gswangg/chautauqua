// DEC-941 (wave-9 amendment): Settings frame :1414 -- an irreversible
// confirm's TITLE names the resource it deletes ('Delete "Speaker handbook
// 2027.pdf"?', Chautauqua Settings.dc.html:1421), not a bare generic
// question. This scan enumerates EVERY .tsx file under app/src/** (DEC-808
// readdirSync({recursive:true}) idiom, never a hand-listed manifest), finds
// every `<ConfirmDialog` call site (brace-depth tag parser reused from
// confirm-verb.scan.test.ts's findConfirmDialogTags, so a `>` inside a JSX
// expression attribute never mis-closes the tag), and grades each one's
// `title=` prop: a JSX EXPRESSION (`title={...}`, whether a template
// literal or any other expression) is the object-naming form; a bare fixed
// string (`title="..."`) is not.
//
// The population is every ConfirmDialog call site across the whole app, not
// only irreversible/destructive ones -- most of today's confirms are still
// bare fixed strings ("Advance round", "Merge these records?") and this
// scan does not require them to change; it only measures the idiom's
// current adoption, two-sided (DEC-808 wave-85 amendment idiom: a ceiling
// that may only fall, plus a companion that fails if the measured count
// drops below it, forcing the constant down in the same batch as any fix).
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC_ROOT = HERE; // app/src

// DEC-374: a comment-blind scan grades its own warning. Masks `//` line
// comments and `/* */` block comments to spaces (preserving length and
// newlines, so line numbers stay correct) before any tag search runs --
// ApiTokensPanel.tsx:28's own prose ("the SAME <ConfirmDialog/> the edit
// branch already owns") would otherwise be misread as a real, title-less
// call site. Not string-aware (no JSX source here uses `//` or `/* */`
// inside a string literal in a way that would matter for this population),
// unlike campaign-ratchet-two-sided.scan.test.ts's fuller buildMask, which
// also masks quotes/regex literals for a different purpose.
function stripComments(src: string): string {
  let out = '';
  let i = 0;
  while (i < src.length) {
    if (src[i] === '/' && src[i + 1] === '/') {
      while (i < src.length && src[i] !== '\n') {
        out += ' ';
        i++;
      }
      continue;
    }
    if (src[i] === '/' && src[i + 1] === '*') {
      out += '  ';
      i += 2;
      while (i < src.length && !(src[i] === '*' && src[i + 1] === '/')) {
        out += src[i] === '\n' ? '\n' : ' ';
        i++;
      }
      if (i < src.length) {
        out += '  ';
        i += 2;
      }
      continue;
    }
    out += src[i];
    i++;
  }
  return out;
}

/** Every .tsx file under app/src/**, excluding tests. */
function srcFiles(): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(SRC_ROOT, { withFileTypes: true, recursive: true })) {
    if (!entry.isFile()) continue;
    if (!entry.name.endsWith('.tsx')) continue;
    if (entry.name.includes('.test.')) continue;
    out.push(join(entry.parentPath, entry.name));
  }
  return out.sort();
}

interface Occurrence {
  readonly file: string;
  readonly line: number;
  readonly titleIsLiteral: boolean | null; // null: no title= prop found at all
  readonly titleSource: string | null;
}

/** Finds every `<ConfirmDialog ...>` opening tag in `src`, brace-depth
 * tracked so a `>` inside a JSX expression attribute (e.g. an arrow
 * function or ternary) never mistakenly closes the tag early -- same idiom
 * as confirm-verb.scan.test.ts's findConfirmDialogTags. */
function findConfirmDialogTags(src: string): { tagSrc: string; lineNumber: number }[] {
  const tags: { tagSrc: string; lineNumber: number }[] = [];
  const tagStartRe = /<ConfirmDialog(?=[\s/>])/g;
  let match: RegExpExecArray | null;
  while ((match = tagStartRe.exec(src)) !== null) {
    const start = match.index;
    let depth = 0;
    let end = -1;
    for (let i = start; i < src.length; i++) {
      const ch = src[i];
      if (ch === '{') depth++;
      else if (ch === '}') depth--;
      else if (ch === '>' && depth === 0) {
        end = i;
        break;
      }
    }
    if (end === -1) continue; // malformed / unterminated -- skip rather than false-positive
    const tagSrc = src.slice(start, end + 1);
    const lineNumber = src.slice(0, start).split('\n').length;
    tags.push({ tagSrc, lineNumber });
  }
  return tags;
}

/** Extracts the `title=` prop's form: a literal string (`title="..."`)
 * grades `titleIsLiteral: true`; a brace expression (`title={...}`, brace-
 * depth matched so nested braces/strings inside the expression don't
 * truncate it) grades `false`. No `title=` prop at all is `null`. */
function extractTitleForm(tagSrc: string): { titleIsLiteral: boolean | null; titleSource: string | null } {
  const literalMatch = tagSrc.match(/\btitle\s*=\s*(["'])((?:(?!\1).)*)\1/);
  if (literalMatch) {
    return { titleIsLiteral: true, titleSource: literalMatch[0] };
  }
  const exprStart = tagSrc.match(/\btitle\s*=\s*\{/);
  if (exprStart) {
    const openIdx = (exprStart.index ?? 0) + exprStart[0].length - 1;
    let depth = 0;
    let end = -1;
    for (let i = openIdx; i < tagSrc.length; i++) {
      const ch = tagSrc[i];
      if (ch === '{') depth++;
      else if (ch === '}') {
        depth--;
        if (depth === 0) {
          end = i;
          break;
        }
      }
    }
    const source = end === -1 ? tagSrc.slice(openIdx) : tagSrc.slice(exprStart.index, end + 1);
    return { titleIsLiteral: false, titleSource: source };
  }
  return { titleIsLiteral: null, titleSource: null };
}

function scan(files: string[]): Occurrence[] {
  const all: Occurrence[] = [];
  for (const path of files) {
    const src = stripComments(readFileSync(path, 'utf-8'));
    const relFile = relative(SRC_ROOT, path);
    for (const tag of findConfirmDialogTags(src)) {
      const { titleIsLiteral, titleSource } = extractTitleForm(tag.tagSrc);
      all.push({ file: relFile, line: tag.lineNumber, titleIsLiteral, titleSource });
    }
  }
  return all;
}

// MEASURED, not hand-picked: the count of `<ConfirmDialog` call sites whose
// `title=` is a bare fixed string, over the whole app/src population.
// History: 24 after ResourcesPanel.tsx's :455 delete-resource confirm was
// converted (wave-9 baseline); lowered to 18 in wave 23 (task w23-e, DEC-941
// wave-23 amendment) converting ApiTokensPanel.tsx (both sites),
// TracksRoomsPanel.tsx (track/room), BreaksPanel.tsx, FormsPage.tsx (both
// Delete field sites) and Agenda.tsx's Unschedule confirm to the
// object-naming form. Sibling lane v12m-w23-i converts the remaining
// clusters in a separate commit and will lower this again -- re-seeding it
// then is a merge-train act, not a regression, per wave-22/23 field-guide
// findings on branch collisions. May only be LOWERED as further call sites
// adopt the idiom -- the companion `it` below fails if the measured count
// drops below this constant, so the ceiling can never sit stale.
// Wave 25 (task w25-d): lowered 18 -> 9. Repair: sibling lane v12m-w23-i
// (merge commit 6723d6483, "confirm titles name their object across
// contacts/comms/content/submissions/review/speakers", DEC-941 wave-23
// amendment) converted the remaining clusters this comment forecast.
export const CONFIRM_TITLE_OBJECT_CEILING = 9;

describe('every <ConfirmDialog title= is graded literal-vs-expression (DEC-941 wave-9 amendment)', () => {
  const FILES = srcFiles();

  it('scanned a non-empty population of files', () => {
    expect(FILES.length).toBeGreaterThan(40);
  });

  it('found at least one real <ConfirmDialog call site', () => {
    const occurrences = scan(FILES);
    expect(occurrences.length).toBeGreaterThan(0);
  });

  it('every <ConfirmDialog call site has a title= prop (no silently-skipped tag)', () => {
    const occurrences = scan(FILES);
    const missing = occurrences.filter((o) => o.titleIsLiteral === null);
    const rendered = missing.map((o) => `${o.file}:${o.line}`).join('\n');
    expect(missing, `<ConfirmDialog with no title= prop:\n${rendered}`).toEqual([]);
  });

  it('the Settings resource-delete confirm (Chautauqua Settings.dc.html:1421) names the object in its title', () => {
    const occurrences = scan(FILES);
    const resourceDelete = occurrences.find((o) => o.file === 'pages/settings/ResourcesPanel.tsx' && o.titleSource?.includes('pendingDelete.title'));
    expect(resourceDelete, `occurrences:\n${occurrences.map((o) => `${o.file}:${o.line}`).join('\n')}`).toBeDefined();
    expect(resourceDelete!.titleIsLiteral).toBe(false);
  });

  it('no more than CONFIRM_TITLE_OBJECT_CEILING call sites use a bare fixed-string title (may only fall)', () => {
    const occurrences = scan(FILES);
    const offenders = occurrences.filter((o) => o.titleIsLiteral === true);
    const rendered = offenders.map((o) => `${o.file}:${o.line} (${o.titleSource})`).join('\n');
    expect(offenders.length, `bare fixed-string <ConfirmDialog title= sites:\n${rendered}`).toBeLessThanOrEqual(CONFIRM_TITLE_OBJECT_CEILING);
  });

  // Two-sided companion (DEC-808 wave-85 amendment idiom): fails, naming the
  // exact replacement line, if the measured count falls below the ceiling
  // -- forces CONFIRM_TITLE_OBJECT_CEILING down in the same batch as any
  // fix, rather than letting it sit stale.
  it('CONFIRM_TITLE_OBJECT_CEILING is not stale (fails if the measured count has fallen)', () => {
    const occurrences = scan(FILES);
    const offenders = occurrences.filter((o) => o.titleIsLiteral === true);
    if (offenders.length < CONFIRM_TITLE_OBJECT_CEILING) {
      throw new Error(
        `CONFIRM_TITLE_OBJECT_CEILING is stale: measured ${offenders.length} bare fixed-string titles but the ` +
          `ceiling still reads ${CONFIRM_TITLE_OBJECT_CEILING}. Lower it in the same batch: ` +
          `export const CONFIRM_TITLE_OBJECT_CEILING = ${offenders.length};`,
      );
    }
    expect(offenders.length).toBeGreaterThanOrEqual(CONFIRM_TITLE_OBJECT_CEILING);
  });

  // Negative control: the matcher actually catches a bare literal title.
  it('negative control: a synthetic bare literal title is graded titleIsLiteral: true', () => {
    const fixture = `<ConfirmDialog title="Delete this thing?" confirmLabel="Delete thing" onConfirm={f} onCancel={g} />`;
    const tags = findConfirmDialogTags(fixture);
    expect(tags.length).toBe(1);
    const form = extractTitleForm(tags[0]!.tagSrc);
    expect(form.titleIsLiteral).toBe(true);
  });

  // Positive control: a template-literal title naming an object is graded
  // titleIsLiteral: false, and a call site spanning multiple attributes
  // (an onConfirm arrow function containing '>') is still parsed correctly.
  it('positive control: a template-literal title is graded titleIsLiteral: false, tag parsed across multi-attribute lines', () => {
    const src = `<ConfirmDialog
      title={\`Delete "\${pendingDelete.title}"?\`}
      body={foo > bar ? 'a' : 'b'}
      confirmLabel="Delete resource"
      weight="irreversible"
      confirmPhrase={pendingDelete.title}
      onConfirm={() => void doDelete()}
      onCancel={() => setPendingDelete(null)}
    />`;
    const tags = findConfirmDialogTags(src);
    expect(tags.length).toBe(1);
    const form = extractTitleForm(tags[0]!.tagSrc);
    expect(form.titleIsLiteral).toBe(false);
    expect(form.titleSource).toContain('pendingDelete.title');
  });
});
