// findDeviationsProblems, split out of test/deviations-ledger.scan.test.ts
// (contention decomposition, no behavior change).

import type { DerivedBullet, LedgerEntry } from "./types";
import { bulletAssertsNonBuild } from "./resolvers";

/** Pure classifier: given the derived population and the ledger, returns the
 * list of problems found -- named by key, never just a count. Exported so
 * negative-control tests can feed it synthetic violations directly. */
export function findDeviationsProblems(
  derived: DerivedBullet[],
  ledger: LedgerEntry[],
  resolvers: {
    fileExists: (p: string) => boolean;
    fileContains: (file: string, literal: string) => boolean;
    termInTree: (t: string) => boolean;
    literalInDoc: (l: string) => boolean;
  },
): string[] {
  const problems: string[] = [];

  const derivedKeySet = new Map<string, DerivedBullet>();
  for (const d of derived) {
    if (derivedKeySet.has(d.key)) {
      problems.push(`duplicate derived key (broken population, not a ledger issue): ${d.key}`);
      continue;
    }
    derivedKeySet.set(d.key, d);
  }

  const ledgerKeyCounts = new Map<string, number>();
  for (const entry of ledger) {
    ledgerKeyCounts.set(entry.key, (ledgerKeyCounts.get(entry.key) ?? 0) + 1);
  }

  // (1) every derived bullet has exactly one ledger row
  for (const d of derived) {
    const count = ledgerKeyCounts.get(d.key) ?? 0;
    if (count === 0) problems.push(`derived bullet with no ledger row: ${d.key}`);
    else if (count > 1) problems.push(`derived bullet with ${count} ledger rows (must be exactly 1): ${d.key}`);
  }

  // (2) every ledger row names a live derived key (no stale rows)
  for (const entry of ledger) {
    if (!derivedKeySet.has(entry.key)) problems.push(`stale ledger row citing a non-existent key: ${entry.key}`);
  }

  // (3) honored rows. `honored` may be a single Cite or an array of Cite
  // (DEC-967 wave-145): a row whose claim mixes a positive half ("built")
  // with a negative half ("not built") must resolve BOTH against the
  // tree, so every element of the array is checked, not just the first.
  for (const entry of ledger) {
    if (entry.status !== "honored") continue;
    if (!entry.honored) {
      problems.push(`honored row ${entry.key} has no honored citation`);
      continue;
    }
    const cites = Array.isArray(entry.honored) ? entry.honored : [entry.honored];
    if (cites.length === 0) {
      problems.push(`honored row ${entry.key} has an empty citation array`);
      continue;
    }
    for (const cite of cites) {
      if (cite.kind === "present") {
        if (!resolvers.fileExists(cite.file)) {
          problems.push(`honored row ${entry.key} cites a nonexistent file: ${cite.file}`);
        } else if (!resolvers.fileContains(cite.file, cite.literal)) {
          problems.push(`honored row ${entry.key} cites ${cite.file} but it does not contain "${cite.literal}"`);
        }
        if (!resolvers.fileExists(cite.testFile)) {
          problems.push(`honored row ${entry.key} cites a nonexistent test file: ${cite.testFile}`);
        }
      } else {
        if (resolvers.termInTree(cite.term)) {
          problems.push(`honored (absent) row ${entry.key} claims absence of "${cite.term}" but it appears in the tree`);
        }
      }
    }
  }

  // (3b) generalised non-build check (DEC-967 wave-145): any derived
  // bullet whose own text asserts something is explicitly NOT built (the
  // exact phrasing this ledger's bullets use for a blessed non-build --
  // "no ... is minted/built/sent/reachable", or "must not appear") must
  // have an absent-kind Cite among its row's citations if that row is
  // "honored" -- a present-only citation of unrelated code is exactly the
  // hole that let the Contacts Pipeline bullet's "no phone dock is
  // minted" half go unverified while the dock got built underneath it.
  for (const d of derived) {
    if (!bulletAssertsNonBuild(d.leadIn)) continue;
    const entry = ledger.find((e) => e.key === d.key);
    if (!entry || entry.status !== "honored" || !entry.honored) continue;
    const cites = Array.isArray(entry.honored) ? entry.honored : [entry.honored];
    if (!cites.some((c) => c.kind === "absent")) {
      problems.push(
        `honored row ${entry.key} asserts a non-build ("${d.leadIn}") but carries no absent-kind citation for it`,
      );
    }
  }

  // (4) superseded rows: the cited literal must appear verbatim in
  // DEVIATIONS.md's own bytes.
  for (const entry of ledger) {
    if (entry.status !== "superseded") continue;
    if (!entry.superseded) {
      problems.push(`superseded row ${entry.key} has no superseded citation`);
      continue;
    }
    if (!resolvers.literalInDoc(entry.superseded.literal)) {
      problems.push(`superseded row ${entry.key} cites a literal not present in DEVIATIONS.md: "${entry.superseded.literal}"`);
    }
  }

  // (5) gap rows carry no fake citation
  for (const entry of ledger) {
    if (entry.status !== "gap") continue;
    if (entry.honored || entry.superseded) {
      problems.push(`gap row ${entry.key} carries a citation (a gap must never be faked as resolved)`);
    }
  }

  return problems;
}
