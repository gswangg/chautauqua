// DEC-960: ModalFrame is now the ONLY module in the SPA that draws a dialog
// scrim -- every other *.tsx used to hand-roll its own `.chq-scrim` +
// `role="dialog"` pair (ImportWizard, PipelineBoard's card detail,
// ContactDrawer, ...). This scan enumerates every *.tsx under app/src (DEC-808
// idiom, same as page-measure.test.ts -- never a hand-listed manifest) and
// fails any file where a SINGLE JSX opening tag carries both the class token
// `chq-scrim` and `role="dialog"`.
//
// The ban is deliberately on the PAIR, not either class/attribute alone:
// App.tsx's 'More' sheet and PhoneAgenda's bottom sheet put `role="dialog"`
// on the INNER element (their scrim, if any, carries no `role="dialog"` of
// its own) -- they are phone chrome, held for the mobile round, and must
// keep working. components/ModalFrame.tsx itself is exempt: it is the one
// legitimate definition of the pair.
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const HERE = dirname(fileURLToPath(import.meta.url));

/** Every *.tsx file under app/src, enumerated rather than named (DEC-808),
 * excluding test files and ModalFrame itself (the one legitimate scrim). */
function scanTargets(root: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(root, { withFileTypes: true, recursive: true })) {
    if (!entry.isFile() || !entry.name.endsWith('.tsx')) continue;
    if (entry.name.endsWith('.test.tsx')) continue;
    const full = join(entry.parentPath, entry.name);
    if (relative(root, full) === join('components', 'ModalFrame.tsx')) continue;
    out.push(full);
  }
  return out.sort();
}

const FILES = scanTargets(HERE);

/** True if `source` contains a single JSX opening tag carrying both the
 * `chq-scrim` class token and a `role="dialog"` attribute. Scans tag-by-tag
 * (not line-by-line) so a tag's attributes split across multiple lines are
 * still caught. */
function hasScrimDialogPair(source: string): boolean {
  // Match JSX/HTML opening tags: `<name ...attrs...>` (non-greedy, no nested
  // `<`/`>` inside attribute values expected for class/role strings here).
  const tagRe = /<[a-zA-Z][^<>]*>/g;
  let m: RegExpExecArray | null;
  while ((m = tagRe.exec(source)) !== null) {
    const tag = m[0];
    const hasScrimClass = /className=(\{`[^`]*\bchq-scrim\b[^`]*`\}|"[^"]*\bchq-scrim\b[^"]*"|'[^']*\bchq-scrim\b[^']*')/.test(
      tag,
    );
    const hasRoleDialog = /role=(\{?["']dialog["']\}?)/.test(tag);
    if (hasScrimClass && hasRoleDialog) return true;
  }
  return false;
}

describe('dialog frame scan (DEC-960): ModalFrame is the ONLY scrim+role=dialog pair', () => {
  it('found more than five .tsx files to scan', () => {
    // Guards the enumeration itself: if readdirSync ever returned nothing
    // (or nearly nothing), every assertion below would vacuously pass.
    expect(FILES.length).toBeGreaterThan(5);
  });

  it('no file outside ModalFrame carries a chq-scrim + role="dialog" tag', () => {
    const offenders = FILES.filter((f) => hasScrimDialogPair(readFileSync(f, 'utf-8')));
    expect(offenders.map((f) => relative(HERE, f))).toEqual([]);
  });

  it('ModalFrame.tsx itself still defines the one legitimate pair', () => {
    const modalFrameSrc = readFileSync(join(HERE, 'components', 'ModalFrame.tsx'), 'utf-8');
    expect(hasScrimDialogPair(modalFrameSrc)).toBe(true);
  });
});
