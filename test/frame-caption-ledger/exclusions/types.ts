// Frame caption/consequence ledger -- shared exclusion type.
// Split from exclusions.ts by the contention-custodian decomposition (no behaviour change).
export interface Exclusion {
  fileName: string;
  line: number;
  text: string;
  reason: string;
}
