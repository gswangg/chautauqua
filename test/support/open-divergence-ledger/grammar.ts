// Open-divergence ledger grammar (DEC-099, task w11-td; decomposed from
// test/open-divergence-ledger.scan.test.ts, task custodian-test_open_
// divergence_ledger_scan_test_ts, wave 35 -- contention decomposition, no
// behavior change). This module holds the PURE adjudication grammar: the
// four line-shapes a verdict is stated in, the widened claim vocabulary, and
// the row-derivation function the scan (and its negative-control tests)
// drive directly. See test/open-divergence-ledger.scan.test.ts for the full
// grammar rationale comment -- kept there since it documents the ratchet and
// tests, not this module's functions in isolation.

const DEC_CITE_RE = /\bDEC-\d{3}\b/;
const DEVIATIONS_RE = /docs\/design\/DEVIATIONS\.md/;
export const TOKEN = 'DIVERGES';

// WIDENED CLAIM VOCABULARY (task w31-d, DEC-099 wave-31 amendment): see the
// file header comment in test/open-divergence-ledger.scan.test.ts for the
// full derivation and negative-control rationale.
const CLAIM_RE = /diverg|mismatch|does not match/i;
const DENIAL_RE = /\bno\b[^.|]{0,40}\bdiverg\w*|\bnot a\b[^.|]{0,20}\bdiverg\w*|\bnever\b[^.|]{0,20}\bdiverg\w*|\bcannot\b[^.|]{0,20}\bdiverg\w*/i;
// A markdown table's HEADER row names its VERDICT COLUMN, not a claim about
// any specific frame; excluded by the shape below (immediately followed by
// a markdown separator row), never by a hand-listed file.
const TABLE_SEPARATOR_RE = /^\s*\|?[\s:|-]*-{3,}[\s:|-]*\|?\s*$/;

export type RowShape = 'heading' | 'table' | 'bullet' | 'fallback';

export interface DivergenceRow {
  /** Repo-relative audit file, e.g. "docs/design/audit/contacts-v12.md". */
  file: string;
  /** 1-based line number of the DIVERGES occurrence. */
  line: number;
  shape: RowShape;
  paragraph: string;
  adjudicated: boolean;
}

/** Which of the four line-shapes governs this line's "paragraph it heads". */
export function classifyLineShape(line: string): RowShape {
  if (/^#+\s/.test(line)) return 'heading';
  if (/^\s*\|/.test(line)) return 'table';
  if (/^\s*-\s/.test(line)) return 'bullet';
  return 'fallback';
}

/** Resolves "the paragraph" a DIVERGES-carrying line at `idx` heads, per the
 * four-shape grammar documented in test/open-divergence-ledger.scan.test.ts.
 * Pure function of `lines` + `idx` -- exported so the negative-control tests
 * can drive it with synthetic fixtures rather than real files. */
export function paragraphFor(lines: string[], idx: number): string {
  const shape = classifyLineShape(lines[idx]!);
  if (shape === 'heading') {
    let end = lines.length;
    for (let i = idx + 1; i < lines.length; i++) {
      if (/^#+\s/.test(lines[i]!)) {
        end = i;
        break;
      }
    }
    return lines.slice(idx, end).join('\n');
  }
  if (shape === 'table') {
    return lines[idx]!;
  }
  if (shape === 'bullet') {
    let end = idx + 1;
    while (end < lines.length && /^\s+\S/.test(lines[end]!) && !/^\s*-\s/.test(lines[end]!)) end++;
    return lines.slice(idx, end).join('\n');
  }
  // fallback: blank-line-delimited paragraph containing idx.
  let start = idx;
  while (start > 0 && lines[start - 1]!.trim() !== '') start--;
  let end = idx;
  while (end < lines.length - 1 && lines[end + 1]!.trim() !== '') end++;
  return lines.slice(start, end + 1).join('\n');
}

/** A row is ADJUDICATED when its own line, or the paragraph it heads,
 * carries a DEC-NNN citation or names docs/design/DEVIATIONS.md. */
export function isAdjudicated(line: string, paragraph: string): boolean {
  return DEC_CITE_RE.test(line) || DEVIATIONS_RE.test(line) || DEC_CITE_RE.test(paragraph) || DEVIATIONS_RE.test(paragraph);
}

/** Whether `line`, at its own shape, opens a row under the WIDENED claim
 * vocabulary (heading / bold-led / table-row carrying CLAIM_RE, minus a
 * same-line DENIAL_RE denial). Exported so the negative-control tests can
 * drive it directly. */
export function isWidenedClaimTrigger(line: string, nextLine?: string): boolean {
  if (!CLAIM_RE.test(line)) return false;
  if (DENIAL_RE.test(line)) return false;
  const shape = classifyLineShape(line);
  if (shape === 'table') {
    // A table row immediately followed by a separator row is the header,
    // naming its verdict column -- not a claim about a frame.
    if (nextLine !== undefined && TABLE_SEPARATOR_RE.test(nextLine)) return false;
    return true;
  }
  if (shape === 'heading') return true;
  return /^\s*\*\*/.test(line); // bold-led verdict span
}

/** Derives every claim row in `text` (already split into `lines`), tagged
 * with its file, shape, paragraph and adjudication status. Pure function --
 * exported for the negative-control tests. A row opens on either the
 * literal TOKEN (any shape, original grammar) or the widened claim
 * vocabulary (heading/bold-led/table-row only, see comment above). */
export function deriveRowsFromLines(relFile: string, lines: string[]): DivergenceRow[] {
  const out: DivergenceRow[] = [];
  lines.forEach((line, idx) => {
    if (!line.includes(TOKEN) && !isWidenedClaimTrigger(line, lines[idx + 1])) return;
    const paragraph = paragraphFor(lines, idx);
    out.push({
      file: relFile,
      line: idx + 1,
      shape: classifyLineShape(line),
      paragraph,
      adjudicated: isAdjudicated(line, paragraph),
    });
  });
  return out;
}
