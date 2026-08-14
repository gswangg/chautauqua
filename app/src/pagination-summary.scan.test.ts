// DEC-906 (wave-9 amendment): ONE pagination-summary shape for every paged
// table, produced only by app/src/lib/pagination-summary.ts's
// paginationSummary(). This scan enumerates every *.tsx file under app/src
// (readdirSync, mirroring css-contract.scan.test.ts / delayed-loading-
// conformance.test.ts rather than a hand-listed manifest) and fails if any
// file OTHER than that module renders a "Showing {a}<dash>{b} of {c}"
// range -- a raw JSX-interpolated range means a fold was skipped or a new
// one was inlined instead of calling the shared helper.
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const HERE = dirname(fileURLToPath(import.meta.url));

/** Every *.tsx file under app/src, excluding test files. */
function allTsxFiles(root: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(root, { withFileTypes: true, recursive: true })) {
    if (!entry.isFile() || !entry.name.endsWith('.tsx')) continue;
    if (entry.name.includes('.test.')) continue;
    out.push(join(entry.parentPath, entry.name));
  }
  return out.sort();
}

// A literal "Showing" followed by a `{...}` interpolation, then an en dash,
// ascii hyphen, or the `&ndash;` entity, then a second `{...}` interpolation
// -- the shape of an inlined range, as opposed to the capped-list product's
// "Showing N of M" (a single interpolation, no dash).
const INLINE_RANGE_RE = /Showing\s*\{[^}]*\}\s*(?:–|-|&ndash;)\s*\{[^}]*\}/;

// Named, justified exclusions (DEC-906 wave-9 task instructions): these four
// deliberately render a DIFFERENT, capped-list shape ("Showing N of M" /
// "Showing 5 of N" / "Showing first N of M reviewers") with no range dash,
// and must not be churned into the range form paginationSummary() produces.
const CAPPED_LIST_EXCLUSIONS = new Set<string>([
  join('pages', 'review', 'ReviewerQueue.tsx'), // 'Showing 5 of N' -- a fixed 5-row preview cap, not a page range.
  join('pages', 'review', 'PlanEditor.tsx'), // 'Showing first N of M reviewers' -- a picker's first-page-only disclosure.
  join('pages', 'settings', 'PeopleRolesPanel.tsx'), // 'Showing N of M' -- an unpaged capped list, no page/perPage exist here.
  join('pages', 'contacts', 'ContactDrawer.tsx'), // 'Showing N of M submissions' -- a capped cross-event history list, not a paged table.
]);

describe('pagination summary is produced by exactly one module (DEC-906 wave-9 amendment)', () => {
  const TSX_FILES = allTsxFiles(HERE);

  it('scanned more than one tsx file', () => {
    expect(TSX_FILES.length).toBeGreaterThan(5);
  });

  it('no app/src/**/*.tsx file other than the named exclusions inlines a "Showing {a}<dash>{b} of {c}" range', () => {
    const offenders: string[] = [];
    for (const path of TSX_FILES) {
      const label = relative(HERE, path);
      if (CAPPED_LIST_EXCLUSIONS.has(label)) continue;
      const src = readFileSync(path, 'utf-8');
      if (INLINE_RANGE_RE.test(src)) {
        offenders.push(label);
      }
    }
    expect(
      offenders,
      `files inlining a pagination range instead of calling app/src/lib/pagination-summary.ts's paginationSummary():\n${offenders.join('\n')}`,
    ).toEqual([]);
  });
});
