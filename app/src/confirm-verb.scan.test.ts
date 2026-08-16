// DEC-941 (wave-58 amendment): the ConfirmDialog primary label must carry
// the verb ("Turn it off", "Delete it") -- 'Confirm'/'OK'/'Yes'/'Continue'
// are banned by an enumerating scan over every `<ConfirmDialog` call site.
// This scan enumerates EVERY .tsx file under app/src/** (DEC-808
// readdirSync({recursive:true}) idiom, never a hand-listed manifest) and
// fails, naming file+line, for any `<ConfirmDialog` occurrence whose
// `confirmLabel` is one of the banned literal strings.
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const HERE = dirname(fileURLToPath(import.meta.url));
// HERE is app/src itself -- the scan's population is every .tsx file in
// this directory tree, not one page's subdirectory.
const SRC_ROOT = HERE;

const BANNED_LABELS = new Set(['Confirm', 'OK', 'Yes', 'Continue']);

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
  file: string;
  line: number;
  confirmLabel: string | null;
}

/** Finds every `<ConfirmDialog ...>` opening tag in `src`, using brace-depth
 * tracking (not a naive '>'-search) so a `>` inside a JSX expression
 * attribute (e.g. an arrow function `onClick={() => ...}`) never mistakenly
 * closes the tag early -- same idiom as text-caps.scan.test.ts's findTags. */
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

function extractConfirmLabel(tagSrc: string): string | null {
  // confirmLabel="literal string" -- only a literal is checkable statically;
  // a template/expression confirmLabel (e.g. `confirmLabel={`Delete ${x}`}`)
  // is data-derived and out of this scan's population.
  const m = tagSrc.match(/confirmLabel\s*=\s*["']([^"']*)["']/);
  return m ? m[1]! : null;
}

function scan(files: string[]): Occurrence[] {
  const all: Occurrence[] = [];
  for (const path of files) {
    const src = readFileSync(path, 'utf-8');
    const relFile = relative(SRC_ROOT, path);
    for (const tag of findConfirmDialogTags(src)) {
      all.push({ file: relFile, line: tag.lineNumber, confirmLabel: extractConfirmLabel(tag.tagSrc) });
    }
  }
  return all;
}

describe('every <ConfirmDialog confirmLabel carries a verb, never a banned generic word (DEC-941, w58-b)', () => {
  const FILES = srcFiles();

  it('scanned a non-empty population of files', () => {
    expect(FILES.length).toBeGreaterThan(40);
  });

  it('found at least one real <ConfirmDialog call site', () => {
    const occurrences = scan(FILES);
    expect(occurrences.length).toBeGreaterThan(0);
  });

  it('no <ConfirmDialog confirmLabel is a banned generic word', () => {
    const occurrences = scan(FILES);
    const offenders = occurrences.filter((o) => o.confirmLabel !== null && BANNED_LABELS.has(o.confirmLabel));
    const rendered = offenders.map((o) => `${o.file}:${o.line} (confirmLabel="${o.confirmLabel}")`).join('\n');
    expect(offenders, `banned confirmLabel literals:\n${rendered}`).toEqual([]);
  });

  // Negative control: the matcher actually catches a banned label when one
  // is present in a fixture string -- a scan whose blindness is not itself
  // asserted is not evidence (DEC-941 wave-56 amendment doctrine).
  it('negative control: a synthetic banned confirmLabel is detected as an offender', () => {
    const fixtures = [
      `<ConfirmDialog title="x" confirmLabel="Confirm" onConfirm={f} onCancel={g} />`,
      `<ConfirmDialog title="x" confirmLabel="OK" onConfirm={f} onCancel={g} />`,
      `<ConfirmDialog title="x" confirmLabel="Yes" onConfirm={f} onCancel={g} />`,
      `<ConfirmDialog title="x" confirmLabel="Continue" onConfirm={f} onCancel={g} />`,
    ];
    for (const src of fixtures) {
      const tags = findConfirmDialogTags(src);
      expect(tags.length).toBe(1);
      const label = extractConfirmLabel(tags[0]!.tagSrc);
      expect(label).not.toBeNull();
      expect(BANNED_LABELS.has(label!)).toBe(true);
    }
  });

  // Negative control: a verb-carrying label is not flagged, and a call site
  // spanning multiple attributes/lines (an onClick with an arrow function
  // containing '>') is still parsed correctly by the brace-depth tracker.
  it('negative control: a verb-carrying confirmLabel across a multi-attribute tag is not flagged', () => {
    const src = `<ConfirmDialog
      title="Delete this resource?"
      body={foo > bar ? 'a' : 'b'}
      confirmLabel="Delete resource"
      weight="irreversible"
      confirmPhrase={pendingDelete.title}
      onConfirm={() => void doDelete()}
      onCancel={() => setPendingDelete(null)}
    />`;
    const tags = findConfirmDialogTags(src);
    expect(tags.length).toBe(1);
    const label = extractConfirmLabel(tags[0]!.tagSrc);
    expect(label).toBe('Delete resource');
    expect(BANNED_LABELS.has(label!)).toBe(false);
  });
});
