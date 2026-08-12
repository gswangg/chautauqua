import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// DEC-678: one delayed-loading policy, app-wide. A loading indicator that
// pops in instantly (no delay) reads as flicker on fast responses, and a
// bare "Loading…" literal hand-rolled at every call site makes it
// impossible to audit or change the policy in one place. Every page that
// needs one renders app/src/components/DelayedLoading.tsx's
// <DelayedLoading /> (or its useDelayedFlag hook for a non-<p> shape)
// instead. This is the repo-wide guard: no component outside
// DelayedLoading.tsx itself may render the bare word "Loading" as text.
//
// EXCLUDED (short, justified): these are inline BUSY-STATE labels on a
// control the user just activated (a button/subtitle that already reads
// as "in progress" from its own disabled state), not a block-level
// "the page/list is empty vs. still loading" indicator -- the pattern
// DEC-678 targets. Wrapping a 4-word button label in a 250ms-delayed
// block component would be a worse UX (the label would blank out mid-
// click), so these stay literal:
//   - RemindPreviewModal.tsx:27 (dialog subtitle, mirrors the dialog's own
//     "Sending..." action-button label two lines below)
//   - PipelineBoard.tsx:135 ("Load more" button's own busy label)
//   - PlanEditor.tsx:905 (a scope-preview button's own busy label)
//   - PlanList.tsx (its per-row "Loading progress…" <span> is already
//     gated through useDelayedFlag -- it just isn't spelled
//     `<DelayedLoading label=.../>` since the shell here is a <span>, not
//     the component's own <p>, so the DelayedLoading-substring carve-out
//     below doesn't recognise it)
const EXCLUDED = new Set([
  "app/src/pages/speakers/RemindPreviewModal.tsx",
  "app/src/pages/contacts/PipelineBoard.tsx",
  "app/src/pages/review/PlanEditor.tsx",
  "app/src/pages/review/PlanList.tsx",
]);

const REPO_ROOT = join(__dirname, "..");
const APP_SRC = join(REPO_ROOT, "app/src");
const DELAYED_LOADING_FILE = join(APP_SRC, "components", "DelayedLoading.tsx");

/** Recursively collect `.tsx` files under `dir`, skipping test files. */
function glob(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      out.push(...glob(full));
    } else if (entry.endsWith(".tsx") && !entry.endsWith(".test.tsx") && !entry.endsWith(".render.test.tsx")) {
      out.push(full);
    }
  }
  return out;
}

const tsxFiles = glob(APP_SRC).filter((f) => f !== DELAYED_LOADING_FILE);

interface Violation {
  file: string;
  line: number;
  text: string;
}

const LOADING_RE = /\bLoading\b/;

function scanFile(file: string): Violation[] {
  const rel = file.slice(REPO_ROOT.length + 1);
  if (EXCLUDED.has(rel)) return [];
  const src = readFileSync(file, "utf8");
  const lines = src.split("\n");
  const violations: Violation[] = [];
  lines.forEach((line, i) => {
    if (!LOADING_RE.test(line)) return;
    // Text passed as the `label` prop to <DelayedLoading /> (or the
    // component's own JSX name in an import) IS the sanctioned path --
    // only a "Loading" that appears outside that call is a violation.
    if (/DelayedLoading/.test(line)) return;
    violations.push({ file: rel, line: i + 1, text: line.trim() });
  });
  return violations;
}

describe("delayed-loading conformance (DEC-678)", () => {
  it("scanned at least 1 tsx file", () => {
    expect(tsxFiles.length).toBeGreaterThanOrEqual(1);
  });

  it("no app/src component renders a bare 'Loading' literal outside DelayedLoading.tsx", () => {
    const violations: Violation[] = [];
    for (const file of tsxFiles) {
      violations.push(...scanFile(file));
    }
    const message = violations.map((v) => `${v.file}:${v.line}: ${v.text}`).join("\n");
    expect(violations, `\n${message}`).toEqual([]);
  });
});
