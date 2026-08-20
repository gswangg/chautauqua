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
import { join } from "node:path";

export function mdFilesIn(dir: string, namePattern: RegExp = /\.md$/): string[] {
  return readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isFile() && namePattern.test(e.name))
    .map((e) => e.name)
    .sort();
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
