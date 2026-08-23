// Shared types for the deviations-ledger scan, split out of
// test/deviations-ledger.scan.test.ts (contention decomposition, no
// behavior change -- see that file's header for the full population/ledger
// documentation this module supports).

export interface DerivedBullet {
  key: string;
  leadIn: string;
  heading: string;
}

export interface PresentCite {
  kind: "present";
  file: string;
  literal: string;
  testFile: string;
}
export interface AbsentCite {
  kind: "absent";
  /** Case-insensitive substring that must not appear anywhere under
   * src/** or app/src/**. */
  term: string;
}
export interface SupersededCite {
  /** The literal, verbatim substring from the LATER section of
   * DEVIATIONS.md that records the adjudication. */
  literal: string;
}

/** A single row's citation. Reused, never re-invented (DEC-613): a row
 * whose claim has two halves -- something asserted BUILT and something
 * else asserted explicitly NOT built (the shape DEC-967 wave-145 flags,
 * where a "present" citation of unrelated code let a blessed non-build
 * claim silently go stale once the "not built" half got built) -- carries
 * an array of Cite so both halves resolve against the tree, instead of a
 * single citation standing in for a claim it only half-covers. */
export type Cite = PresentCite | AbsentCite;

export interface LedgerEntry {
  key: string;
  status: "honored" | "superseded" | "gap";
  reason: string;
  honored?: Cite | Cite[];
  superseded?: SupersededCite;
}
