import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

// DEC-631: the ONE dialog contract, locked by a scan rather than a habit.
// (1) window.confirm/prompt/alert are browser chrome the design never saw
//     -- zero occurrences anywhere in app/src.
// (2) every role="dialog" carries aria-modal="true" and an accessible name
//     (aria-label or aria-labelledby) on the same element.
// Floor counts guard against the glob silently matching nothing and the
// whole suite passing vacuously.

const REPO_ROOT = join(__dirname, "..");
const APP_SRC = join(REPO_ROOT, "app/src");

/** Recursively collect .tsx files under `dir`, excluding *.test.tsx. */
function glob(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      out.push(...glob(full));
    } else if (entry.endsWith(".tsx") && !entry.endsWith(".test.tsx")) {
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
    .split("\n")
    .map((line) => (line.trim().startsWith("//") ? "" : line))
    .join("\n");
  return withoutLineComments.replace(/(\{[ \t]*|^[ \t]*|\n[ \t]*)\/\*[\s\S]*?\*\//g, (_match, prefix: string) =>
    prefix.startsWith("{") ? "{" : prefix,
  );
}

/** Extract every JSX-ish opening tag `<...>` (no nested `<`/`>`) from the
 * (comment-stripped) source, so attribute checks operate on ONE element at
 * a time rather than the whole file. */
function extractTags(src: string): string[] {
  const matches = src.match(/<[a-zA-Z][^<>]*>/g);
  return matches ?? [];
}

const scannedFiles = glob(APP_SRC);

describe("dialog contract (DEC-631)", () => {
  it("scanned at least 60 files", () => {
    expect(scannedFiles.length).toBeGreaterThanOrEqual(60);
  });

  it("zero occurrences of window.confirm / window.prompt / window.alert", () => {
    const offenders: string[] = [];
    for (const file of scannedFiles) {
      const src = readFileSync(file, "utf8");
      const lines = src.split("\n");
      lines.forEach((line, idx) => {
        if (/window\.(confirm|prompt|alert)\s*\(/.test(line)) {
          offenders.push(`${relative(REPO_ROOT, file)}:${idx + 1}`);
        }
      });
    }
    expect(offenders, `native dialog calls found:\n${offenders.join("\n")}`).toEqual([]);
  });

  // DEC-651/DEC-750: ModalFrame (app/src/components/ModalFrame.tsx) now
  // owns the role="dialog" markup for most modals in the app -- callers
  // pass a title/onClose and no longer write their own chq-scrim/
  // role="dialog" JSX. ViewTabs' save-view dialog (w3-g) is the latest to
  // fold in, joining Submissions/Speakers/etc. That collapses many
  // previously-duplicated per-file occurrences into ONE (ModalFrame's own
  // tag), so the floor here guards against the glob matching nothing
  // rather than against per-page duplication; the remaining
  // still-standalone dialogs (ContactDrawer, PipelineBoard, ImportWizard,
  // DuplicatesView, PhoneAgenda, App.tsx) plus ModalFrame itself keep the
  // count comfortably above zero.
  it("finds at least 7 dialogs, and every one carries aria-modal + an accessible name", () => {
    const dialogTags: string[] = [];
    const violations: string[] = [];
    for (const file of scannedFiles) {
      const src = stripComments(readFileSync(file, "utf8"));
      for (const tag of extractTags(src)) {
        if (!/role=["']dialog["']/.test(tag)) continue;
        dialogTags.push(tag);
        const hasAriaModal = /aria-modal=["']true["']/.test(tag);
        const hasAccessibleName = /aria-label=/.test(tag) || /aria-labelledby=/.test(tag);
        if (!hasAriaModal || !hasAccessibleName) {
          violations.push(`${relative(REPO_ROOT, file)}: ${tag.replace(/\s+/g, " ")}`);
        }
      }
    }
    expect(dialogTags.length).toBeGreaterThanOrEqual(7);
    expect(violations, `dialog missing aria-modal/accessible name:\n${violations.join("\n")}`).toEqual([]);
  });
});
