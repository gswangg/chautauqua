// Citation-FORM-drift population (DEC-967 amendment, task w11-t).
//
// Extracted from test/citation-form-drift.scan.test.ts (contention-hotspot
// decomposition, custodian task custodian-test_citation_form_drift_scan_test_ts):
// pure extraction, no behavior change. Derives the SAME widened population
// test/decision-doc-citation.scan.test.ts already derives --
// src/decisions-data/DEC-*.md, docs/design/audit/*.md, docs/probes/*.md,
// docs/design/DEVIATIONS.md, docs/design/DESIGN-RULINGS.md and
// docs/mobile-campaign.md -- via readdirSync over each directory, never a
// hand-listed manifest (DEC-808).
import { readFileSync, readdirSync } from "node:fs";
import { join, relative, sep } from "node:path";

/**
 * Recursively walks `dir`, returning repo-relative-to-`dir` paths (POSIX
 * separators, e.g. "settings-v12/w10-frame-verdicts.md") for every FILE
 * whose own basename matches `namePattern` -- the pattern is tested against
 * `entry.name`, never the full relative path, so a directory-scoped
 * extension pattern like /^DEC-\d+\.md$/ still only matches files literally
 * named that way, wherever they live in the tree.
 *
 * DEC-967 wave-43: this used to be a single-level readdirSync, invisible to
 * anything under a subdirectory (docs/design/audit/settings-v12/ held three
 * files no citation instrument could see). Three sibling instruments over
 * the same docs/design/audit/ corpus already recurse
 * (open-divergence-ledger.scan.test.ts, audit-gap-row-staleness.scan.test.ts,
 * decision-path-references.scan.test.ts) -- this makes the two remaining
 * flat enumerators (this function, and
 * test/decision-doc-citation.scan.test.ts's auditDocFiles, which now calls
 * this same helper) a TREE walk instead of a second, narrower copy
 * (DEC-613: one implementation).
 */
export function mdFilesIn(dir: string, namePattern: RegExp = /\.md$/): string[] {
  const out: string[] = [];
  function walk(current: string) {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const full = join(current, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (entry.isFile() && namePattern.test(entry.name)) {
        out.push(relative(dir, full).split(sep).join("/"));
      }
    }
  }
  walk(dir);
  return out.sort();
}

export interface SourceDoc {
  /** Label used in offender messages, e.g. "src/decisions-data/DEC-986.md". */
  doc: string;
  content: string;
}

/**
 * Builds the widened population's SourceDoc list against `root` (the repo
 * root). Kept as a function of root rather than a module-level constant so
 * callers (and tests) can point it at a fixture root if ever needed; the
 * scan test itself calls this once against the real repo root.
 */
export function buildPopulationClasses(root: string): { label: string; docs: SourceDoc[] }[] {
  const decisionsDataDir = join(root, "src", "decisions-data");
  const auditDir = join(root, "docs", "design", "audit");
  const probesDir = join(root, "docs", "probes");

  const decisionDocNames = mdFilesIn(decisionsDataDir, /^DEC-\d+\.md$/);
  const auditDocNames = mdFilesIn(auditDir);
  const probeDocNames = mdFilesIn(probesDir);

  return [
    {
      label: "src/decisions-data/DEC-*.md",
      docs: decisionDocNames.map((name) => ({
        doc: `src/decisions-data/${name}`,
        content: readFileSync(join(decisionsDataDir, name), "utf-8"),
      })),
    },
    {
      label: "docs/design/audit/*.md",
      docs: auditDocNames.map((name) => ({
        doc: `docs/design/audit/${name}`,
        content: readFileSync(join(auditDir, name), "utf-8"),
      })),
    },
    {
      label: "docs/probes/*.md",
      docs: probeDocNames.map((name) => ({
        doc: `docs/probes/${name}`,
        content: readFileSync(join(probesDir, name), "utf-8"),
      })),
    },
    {
      label: "docs/design/DEVIATIONS.md",
      docs: [
        {
          doc: "docs/design/DEVIATIONS.md",
          content: readFileSync(join(root, "docs", "design", "DEVIATIONS.md"), "utf-8"),
        },
      ],
    },
    {
      label: "docs/design/DESIGN-RULINGS.md",
      docs: [
        {
          doc: "docs/design/DESIGN-RULINGS.md",
          content: readFileSync(join(root, "docs", "design", "DESIGN-RULINGS.md"), "utf-8"),
        },
      ],
    },
    {
      label: "docs/mobile-campaign.md",
      docs: [
        {
          doc: "docs/mobile-campaign.md",
          content: readFileSync(join(root, "docs", "mobile-campaign.md"), "utf-8"),
        },
      ],
    },
  ];
}
