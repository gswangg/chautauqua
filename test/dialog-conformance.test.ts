import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

// DEC-651: every dialog gets the mock's header (chq-modal-title + a Close
// control) and every free-text input in it carries a placeholder --
// enumerated from the filesystem so a new dialog file can't silently opt
// out of the contract ModalFrame enforces. See also test/dialog-contract.ts
// (DEC-631), which locks aria-modal + an accessible name on the same tag.

const REPO_ROOT = join(__dirname, '..');
const APP_SRC = join(REPO_ROOT, 'app/src');

/** Recursively collect .tsx files under `dir`, excluding *.test.tsx. */
function glob(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      out.push(...glob(full));
    } else if (entry.endsWith('.tsx') && !entry.endsWith('.test.tsx')) {
      out.push(full);
    }
  }
  return out;
}

/** Strip // line comments and /* *\/ block comments so a comment merely
 * mentioning `role="dialog"` (documentation prose) can't be mistaken for
 * markup.
 *
 * Order and anchoring both matter. Line comments go FIRST, and a block
 * comment only OPENS at `{/*` (JSX) or at the start of a line -- because a
 * mid-line `/*` is code, not a comment: App.tsx's route literal
 * `path: '/review/*'` contains one. Stripping blocks first (and unanchored)
 * let that literal pair with a later `*\/}` and silently swallow every line
 * between them, including real role="dialog" markup, which made this scan
 * under-count instead of fail. */
function stripComments(src: string): string {
  const withoutLineComments = src
    .split('\n')
    .map((line) => (line.trim().startsWith('//') ? '' : line))
    .join('\n');
  return withoutLineComments.replace(/(\{[ \t]*|^[ \t]*|\n[ \t]*)\/\*[\s\S]*?\*\//g, (_match, prefix: string) =>
    prefix.startsWith('{') ? '{' : prefix,
  );
}

/** Extract every JSX-ish opening tag `<...>` (no nested `<`/`>`) from the
 * (comment-stripped) source, so attribute checks operate on ONE element at
 * a time rather than the whole file. Arrow functions (`=>`) inside an
 * attribute value (e.g. `onChange={(e) => ...}`) contain a `>` that isn't a
 * tag boundary, so they're masked out before matching. */
function extractTags(src: string): string[] {
  const masked = src.replace(/=>/g, '=→');
  const matches = masked.match(/<[a-zA-Z][^<>]*>/g);
  return (matches ?? []).map((tag) => tag.replace(/=→/g, '=>'));
}

const scannedFiles = glob(APP_SRC);

// app/src/pages/submissions/ and app/src/pages/forms/ are owned by sibling
// tasks (w9-a/w9-b) working the same DEC-651 header/placeholder pass in
// parallel; this task's remit there is exactly NewSubmissionModal.tsx and
// FieldModal.tsx (already on the contract below). Excluding the rest of
// those two directories from the general scan avoids this test taking a
// position on files this task has no permission to fix; once the sibling
// tasks land, dropping this filter is the right follow-up.
const OWNED_ELSEWHERE_DIRS = [join(APP_SRC, 'pages/submissions'), join(APP_SRC, 'pages/forms')];
const OWNED_ELSEWHERE_EXCEPTIONS = [
  join(APP_SRC, 'pages/submissions/NewSubmissionModal.tsx'),
  join(APP_SRC, 'pages/forms/FieldModal.tsx'),
];

const dialogFiles = scannedFiles
  .filter((file) => {
    const inOwnedElsewhere = OWNED_ELSEWHERE_DIRS.some((dir) => file.startsWith(dir + '/'));
    return !inOwnedElsewhere || OWNED_ELSEWHERE_EXCEPTIONS.includes(file);
  })
  .filter((file) => /role=["']dialog["']/.test(stripComments(readFileSync(file, 'utf8'))));

describe('dialog conformance (DEC-651)', () => {
  // DEC-651: ModalFrame (app/src/components/ModalFrame.tsx) now owns the
  // role="dialog" markup for most modals -- callers pass a title/onClose
  // and never write their own chq-scrim/role="dialog" JSX, so most
  // migrated files no longer contain the literal string this scan keys
  // off of (by design: they get the contract from ModalFrame, not from
  // re-declaring it). The files this scan DOES find are ModalFrame itself
  // plus every dialog that still hand-rolls its own scrim/modal markup,
  // which is exactly the set this test needs to hold to the DEC-651
  // contract.
  // DEC-684 moved contact merge out of DuplicatesView's hand-rolled modal and
  // into a full page at /admin/contacts/merge, so that file no longer declares
  // role="dialog" and the hand-rolled set legitimately dropped 7 -> 6. The
  // floor tracks reality rather than blocking a decision: the per-file contract
  // assertions below are what actually stop a new dialog opting out.
  it('scanned at least 60 source files and found at least 6 dialog files', () => {
    expect(scannedFiles.length).toBeGreaterThanOrEqual(60);
    expect(dialogFiles.length).toBeGreaterThanOrEqual(6);
  });

  it('every dialog file carries chq-modal-title and a Close control', () => {
    const violations: string[] = [];
    for (const file of dialogFiles) {
      const src = stripComments(readFileSync(file, 'utf8'));
      const hasTitle = /chq-modal-title/.test(src);
      // A "Close" control: either literal button text or an aria-label.
      const hasClose = /\bClose\b/.test(src);
      if (!hasTitle || !hasClose) {
        violations.push(
          `${relative(REPO_ROOT, file)} (title=${hasTitle}, close=${hasClose})`,
        );
      }
    }
    expect(violations, `dialogs missing chq-modal-title or a Close control:\n${violations.join('\n')}`).toEqual([]);
  });

  it('every chq-input/chq-textarea occurrence in a dialog file carries a placeholder', () => {
    const violations: string[] = [];
    for (const file of dialogFiles) {
      const src = stripComments(readFileSync(file, 'utf8'));
      for (const tag of extractTags(src)) {
        if (!/\bclassName=["'][^"']*\b(chq-input|chq-textarea)\b/.test(tag)) continue;
        if (!/\bplaceholder=/.test(tag)) {
          violations.push(`${relative(REPO_ROOT, file)}: ${tag.replace(/\s+/g, ' ')}`);
        }
      }
    }
    expect(violations, `chq-input/chq-textarea without a placeholder:\n${violations.join('\n')}`).toEqual([]);
  });
});
