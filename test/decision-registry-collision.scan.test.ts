// Decision-registry collision ratchet (DEC-976 wave-155, task w11-pd).
//
// WHY: two directories hold `DEC-NNN.md` files and their ids COLLIDE --
// `decisions/` (999 files, the older/canonical directory for
// test/decisions-parity.test.ts and the `void DEC_NNN` compile pins) and
// `src/decisions-data/` (77 files, what the scribe has written since wave
// 5, checked by test/decision-doc-citation.scan.test.ts's two-directional
// citation grammar). Every id in src/decisions-data/ also exists in
// decisions/; zero pairs are byte-identical; 35 carry a DIFFERENT H1 title
// under the same id -- a different subject entirely, not a rewording. The
// full ledger, including a row per divergent id and its classification
// (AMENDS/SUPERSEDES/CONTRADICTS), lives in
// docs/design/audit/decision-registry-collision-v12.md.
//
// This file re-derives the counts directly from the tree
// (readdirSync both directories, DEC-808: "a directory is not a
// population" -- never a hand-listed manifest) rather than trusting the
// ledger's own numbers, and ratchets the population of title-divergent ids
// that carry NO registry note in their src/decisions-data/DEC-NNN.md file.
// A registry note is a first line of the form
// `> Registry note: decisions/DEC-NNN.md holds a different ruling (...);
// this file AMENDS|SUPERSEDES it because ...` -- written for the
// campaign-governing subset this wave (DEC-991, DEC-393, DEC-385, DEC-253,
// DEC-367, DEC-374, DEC-728, DEC-967, DEC-976, DEC-989, DEC-381; DEC-808
// was dropped from the task's candidate list because it measures as NOT
// title-divergent). Writing a note for a remaining offender is the only
// way to lower this ratchet -- never editing this file's ceiling alone.
import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

const repoRoot = fileURLToPath(new URL("..", import.meta.url));
const decisionsDir = join(repoRoot, "decisions");
const decisionsDataDir = join(repoRoot, "src", "decisions-data");

const DEC_FILE_RE = /^DEC-\d+\.md$/;
const REGISTRY_NOTE_RE = /^> Registry note: decisions\/(DEC-\d+)\.md holds a different ruling \(.*\); this file (AMENDS|SUPERSEDES) it because .+\.\s*$/m;

function listDecFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isFile() && DEC_FILE_RE.test(e.name))
    .map((e) => e.name)
    .sort();
}

function h1(file: string): string {
  const content = readFileSync(file, "utf8");
  const match = content.match(/^#\s+(.*)$/m);
  if (match?.[1] === undefined) {
    throw new Error(`${file}: no H1 (leading "# ...") line found`);
  }
  return match[1].trim();
}

function hasRegistryNote(file: string): boolean {
  const content = readFileSync(file, "utf8");
  return REGISTRY_NOTE_RE.test(content);
}

interface Divergence {
  id: string;
  decH1: string;
  srcH1: string;
  noted: boolean;
}

function measure() {
  const decFiles = listDecFiles(decisionsDir);
  const srcFiles = listDecFiles(decisionsDataDir);

  const decSet = new Set(decFiles);
  const colliding = srcFiles.filter((f) => decSet.has(f));

  const divergences: Divergence[] = [];
  for (const f of colliding) {
    const id = f.replace(/\.md$/, "");
    const decFile = join(decisionsDir, f);
    const srcFile = join(decisionsDataDir, f);
    const decH1 = h1(decFile);
    const srcH1 = h1(srcFile);
    if (decH1 !== srcH1) {
      divergences.push({ id, decH1, srcH1, noted: hasRegistryNote(srcFile) });
    }
  }

  return { decFiles, srcFiles, colliding, divergences };
}

// RATCHET: seeded at (35 title-divergent ids) - (11 registry notes written
// task w11-pd) = 24. May only be LOWERED, by writing a registry note into
// the src/decisions-data side of a still-unnoted divergent pair, never
// raised.
export const UNNOTED_REGISTRY_COLLISION_CEILING = 24;

describe("decision-registry collision scan (DEC-976 wave-155, task w11-pd)", () => {
  it("non-vacuity: both directories are read and non-empty (a broken path must not read as a clean pass)", () => {
    const { decFiles, srcFiles } = measure();
    expect(decFiles.length).toBeGreaterThan(0);
    expect(srcFiles.length).toBeGreaterThan(0);
  });

  it("every id in src/decisions-data/ also exists in decisions/ (the collision is total)", () => {
    const { srcFiles, colliding } = measure();
    expect(colliding.length).toBe(srcFiles.length);
  });

  it(
    "count of title-divergent ids with NO registry note never exceeds UNNOTED_REGISTRY_COLLISION_CEILING " +
      "(may only be LOWERED, by writing a registry note into the src/decisions-data side, never raised)",
    () => {
      const { divergences } = measure();
      const unnoted = divergences.filter((d) => !d.noted);
      if (unnoted.length > UNNOTED_REGISTRY_COLLISION_CEILING) {
        throw new Error(
          `${unnoted.length} title-divergent decision-registry ids with no registry note found, above the ` +
            `ratchet ceiling of ${UNNOTED_REGISTRY_COLLISION_CEILING} (may only be LOWERED, never raised to paper ` +
            `over a regression). Offenders: ${unnoted.map((d) => d.id).join(", ")}. See ` +
            "docs/design/audit/decision-registry-collision-v12.md.",
        );
      }
      expect(unnoted.length).toBeLessThanOrEqual(UNNOTED_REGISTRY_COLLISION_CEILING);
    },
  );

  it(
    "the ceiling is not stale: the measured unnoted count is not below UNNOTED_REGISTRY_COLLISION_CEILING " +
      "(two-sided ratchet)",
    () => {
      const { divergences } = measure();
      const unnoted = divergences.filter((d) => !d.noted);
      if (unnoted.length < UNNOTED_REGISTRY_COLLISION_CEILING) {
        throw new Error(
          `decision-registry-collision.scan: UNNOTED_REGISTRY_COLLISION_CEILING ` +
            `(${UNNOTED_REGISTRY_COLLISION_CEILING}) exceeds the measured unnoted count (${unnoted.length}) -- ` +
            "lower the ceiling to the worker's measured value:\n" +
            `  export const UNNOTED_REGISTRY_COLLISION_CEILING = ${unnoted.length};`,
        );
      }
      expect(unnoted.length).toBeGreaterThanOrEqual(UNNOTED_REGISTRY_COLLISION_CEILING);
    },
  );

  it("DEC-991's registry note explicitly resolves the line-height contradiction", () => {
    const srcFile = join(decisionsDataDir, "DEC-991.md");
    const content = readFileSync(srcFile, "utf8");
    expect(content).toMatch(/^> Registry note: decisions\/DEC-991\.md holds a different ruling/);
    expect(content.toLowerCase()).toMatch(/line-height/);
  });

  it("each campaign-governing note names a real divergent decisions/DEC-NNN.md H1 (positive control)", () => {
    const notedIds = [
      "DEC-991",
      "DEC-393",
      "DEC-385",
      "DEC-253",
      "DEC-367",
      "DEC-374",
      "DEC-728",
      "DEC-967",
      "DEC-976",
      "DEC-989",
      "DEC-381",
    ];
    const { divergences } = measure();
    const byId = new Map(divergences.map((d) => [d.id, d]));
    for (const id of notedIds) {
      const d = byId.get(id);
      expect(d, `${id} did not measure as title-divergent -- it must not be in the noted set`).toBeDefined();
      expect(d!.noted, `${id} has no registry note`).toBe(true);
    }
  });

  it("DEC-808 was correctly dropped from the task's candidate note list (it does not measure as title-divergent)", () => {
    const { divergences } = measure();
    expect(divergences.some((d) => d.id === "DEC-808")).toBe(false);
  });
});
