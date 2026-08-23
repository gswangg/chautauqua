// DEC-903 wave-41 (task w41-a): instrument audit-doc HANDOFF PROSE.
//
// Four consecutive waves (38, 39, 40, 41) have paid a hand-audit tax
// re-reading docs/design/audit/**/*.md's "not fixed" / "for the planner" /
// "left for a future wave" paragraphs by eye, every time discovering most
// were already paid (field guide wave-39: "audit handoff paragraphs are
// mostly already paid"). Nothing before this file counted that population
// automatically or graded each paragraph's claim against something the
// tree can still measure. This scan does both.
//
// POPULATION (derived, never hand-listed, DEC-808): `readdirSync
// docs/design/audit` RECURSIVELY (`{ recursive: true }`, so a nested
// directory such as `settings-v12/` is reached -- DEC-367/DEC-808 "a
// directory is not a population") for every `*.md` file, split into
// blank-line-delimited paragraphs, and kept if the paragraph text matches
// the handoff grammar (case-insensitive): "not fixed", "still open", "left
// for a future wave", "for the planner", "SIZED, NOT BUILT", "noted, not
// fixed", "recorded for a later lane", or a "next ... sweep to log" clause.
//
// GRADE (DEC-903 wave-41): each matched paragraph is legal under exactly
// two dispositions --
//   (a) it names a `<NAME>_CEILING` / `<NAME>_FLOOR` / `<NAME>_TRIPWIRE`
//       constant, resolved by grepping test/**, app/src/** and scripts/**
//       for a top-level `[export ]const <NAME> = <int>;` declaration, whose
//       LIVE value is non-zero (the claim "work remains" is still true
//       because the instrument that would prove it false still reads
//       non-zero); or
//   (b) the paragraph carries a closure marker -- CLOSED, RESOLVED,
//       RETIRED, SUPERSEDED, ALREADY RULED -- recording that a later wave
//       already adjudicated the claim.
// Anything else is an OFFENDER: a claim that work remains with nothing left
// in the tree that can still measure it -- fossil prose, not a live debt
// (field guide waves 34-40, repeatedly: "an audit handoff paragraph is
// where real product debt hides" AND "audit handoff paragraphs are mostly
// already paid" -- this instrument settles which is true per-paragraph
// instead of by hand).
//
// SEED: the ceiling below is forced by re-measuring the real population
// (never trusted from wave 40's by-hand ~30 figure) and is a hard-coded
// int literal (DEC-967 ruling (a): never an expression mentioning the
// measured population).
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, '..');
const AUDIT_DIR = join(REPO_ROOT, 'docs', 'design', 'audit');
const CODE_ROOTS = [join(REPO_ROOT, 'test'), join(REPO_ROOT, 'app', 'src'), join(REPO_ROOT, 'scripts')];

// ---------------------------------------------------------------------------
// Paragraph extraction (blank-line-delimited blocks, 1-indexed start line).
// ---------------------------------------------------------------------------

export interface Paragraph {
  readonly file: string; // relative to repo root
  readonly line: number; // 1-indexed start line
  readonly text: string;
}

export function splitParagraphs(content: string): { text: string; line: number }[] {
  const lines = content.split(/\r?\n/);
  const out: { text: string; line: number }[] = [];
  let cur: string[] = [];
  let startLine = 0;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    if (line.trim() === '') {
      if (cur.length > 0) {
        out.push({ text: cur.join('\n'), line: startLine });
        cur = [];
      }
    } else {
      if (cur.length === 0) startLine = i + 1;
      cur.push(line);
    }
  }
  if (cur.length > 0) out.push({ text: cur.join('\n'), line: startLine });
  return out;
}

function walkMarkdownFiles(root: string): { abs: string; rel: string; content: string }[] {
  const out: { abs: string; rel: string; content: string }[] = [];
  for (const entry of readdirSync(root, { withFileTypes: true, recursive: true })) {
    if (!entry.isFile() || !entry.name.endsWith('.md')) continue;
    const abs = join(entry.parentPath, entry.name);
    out.push({ abs, rel: relative(REPO_ROOT, abs), content: readFileSync(abs, 'utf8') });
  }
  return out;
}

export function collectParagraphs(root: string): Paragraph[] {
  const out: Paragraph[] = [];
  for (const f of walkMarkdownFiles(root)) {
    for (const p of splitParagraphs(f.content)) {
      out.push({ file: f.rel, line: p.line, text: p.text });
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Handoff grammar (case-insensitive).
// ---------------------------------------------------------------------------

interface HandoffPattern {
  readonly label: string;
  readonly re: RegExp;
}

export const HANDOFF_PATTERNS: readonly HandoffPattern[] = [
  { label: 'not fixed', re: /not fixed/i },
  { label: 'still open', re: /still open/i },
  { label: 'left for a future wave', re: /left for a future wave/i },
  { label: 'for the planner', re: /for the planner/i },
  { label: 'sized, not built', re: /sized,\s*not built/i },
  { label: 'noted, not fixed', re: /noted,\s*not fixed/i },
  { label: 'recorded for a later lane', re: /recorded for a later lane/i },
  { label: 'next ... sweep to log', re: /\bnext\b[\s\S]{0,80}?\bsweep to log\b/i },
];

export function matchesHandoffGrammar(text: string): string[] {
  const labels: string[] = [];
  for (const p of HANDOFF_PATTERNS) {
    if (p.re.test(text)) labels.push(p.label);
  }
  return labels;
}

// ---------------------------------------------------------------------------
// Disposition (a): a live, non-zero named constant.
// ---------------------------------------------------------------------------

const CONSTANT_NAME_RE = /\b[A-Z][A-Z0-9_]*_(?:CEILING|FLOOR|TRIPWIRE)\b/g;

export function findConstantNames(text: string): string[] {
  const out = new Set<string>();
  let m: RegExpExecArray | null;
  const re = new RegExp(CONSTANT_NAME_RE);
  while ((m = re.exec(text)) !== null) out.add(m[0]);
  return Array.from(out);
}

interface CodeFile {
  readonly content: string;
}

function walkCodeFiles(roots: readonly string[]): CodeFile[] {
  const out: CodeFile[] = [];
  for (const root of roots) {
    for (const entry of readdirSync(root, { withFileTypes: true, recursive: true })) {
      if (!entry.isFile()) continue;
      if (!entry.name.endsWith('.ts') && !entry.name.endsWith('.tsx')) continue;
      const abs = join(entry.parentPath, entry.name);
      out.push({ content: readFileSync(abs, 'utf8') });
    }
  }
  return out;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Resolves a `<NAME>_CEILING`/`_FLOOR`/`_TRIPWIRE` name's live declared
 * value by grepping `codeFiles` for a top-level `[export ]const NAME =
 * <int>;` declaration -- the same declaration shape
 * test/campaign-ratchet-two-sided.scan.test.ts's findDeclaringFiles uses.
 * Returns undefined when no such declaration exists in the tree. */
export function resolveConstantValue(codeFiles: readonly CodeFile[], name: string): number | undefined {
  const re = new RegExp(`^[ \\t]*(?:export\\s+)?const\\s+${escapeRegExp(name)}\\s*=\\s*(-?\\d+)\\s*;[ \\t]*$`, 'm');
  for (const f of codeFiles) {
    const m = re.exec(f.content);
    if (m) return parseInt(m[1]!, 10);
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// Disposition (b): a closure marker.
// ---------------------------------------------------------------------------

const CLOSURE_MARKER_RE = /\b(CLOSED|RESOLVED|RETIRED|SUPERSEDED|ALREADY RULED)\b/;

export function hasClosureMarker(text: string): boolean {
  return CLOSURE_MARKER_RE.test(text);
}

// ---------------------------------------------------------------------------
// Grading.
// ---------------------------------------------------------------------------

export interface GradedParagraph {
  readonly paragraph: Paragraph;
  readonly grammarLabels: string[];
  readonly constantNames: string[];
  readonly liveNonZeroConstant?: string;
  readonly closureMarker: boolean;
  readonly legal: boolean;
}

export function gradeParagraphs(paragraphs: readonly Paragraph[], codeFiles: readonly CodeFile[]): GradedParagraph[] {
  const out: GradedParagraph[] = [];
  for (const p of paragraphs) {
    const grammarLabels = matchesHandoffGrammar(p.text);
    if (grammarLabels.length === 0) continue;
    const constantNames = findConstantNames(p.text);
    let liveNonZeroConstant: string | undefined;
    for (const name of constantNames) {
      const v = resolveConstantValue(codeFiles, name);
      if (v !== undefined && v !== 0) {
        liveNonZeroConstant = name;
        break;
      }
    }
    const closureMarker = hasClosureMarker(p.text);
    const legal = liveNonZeroConstant !== undefined || closureMarker;
    out.push({ paragraph: p, grammarLabels, constantNames, liveNonZeroConstant, closureMarker, legal });
  }
  return out;
}

export function findOffenders(paragraphs: readonly Paragraph[], codeFiles: readonly CodeFile[]): GradedParagraph[] {
  return gradeParagraphs(paragraphs, codeFiles).filter((g) => !g.legal);
}

// ---------------------------------------------------------------------------
// Ceiling. Hard-coded int literal (DEC-967 ruling (a)) -- never an
// expression mentioning the measured population.
// ---------------------------------------------------------------------------

export const AUDIT_HANDOFF_STALE_CEILING = 22;

// ---------------------------------------------------------------------------
// Gate.
// ---------------------------------------------------------------------------

describe('audit-doc handoff paragraphs are graded against a live measurable, never left as fossil prose (DEC-903 wave-41)', () => {
  let paragraphs: Paragraph[];
  let codeFiles: CodeFile[];
  let offenders: GradedParagraph[];

  it('setup: derive the population', () => {
    paragraphs = collectParagraphs(AUDIT_DIR);
    codeFiles = walkCodeFiles(CODE_ROOTS);
    offenders = findOffenders(paragraphs, codeFiles);
    expect(paragraphs.length).toBeGreaterThan(50);
    expect(codeFiles.length).toBeGreaterThan(50);
  }, 30000);

  it(`no more than ${AUDIT_HANDOFF_STALE_CEILING} handoff paragraphs are offenders (may only shrink toward zero as claims are closed or their measuring constant proven live)`, () => {
    if (offenders.length > AUDIT_HANDOFF_STALE_CEILING) {
      throw new Error(
        `${offenders.length} audit-doc handoff paragraph(s) exceed AUDIT_HANDOFF_STALE_CEILING ` +
          `(${AUDIT_HANDOFF_STALE_CEILING}) -- a handoff-grammar paragraph naming neither a live ` +
          `non-zero <NAME>_CEILING/_FLOOR/_TRIPWIRE constant nor a closure marker (CLOSED, RESOLVED, ` +
          `RETIRED, SUPERSEDED, ALREADY RULED):\n` +
          offenders
            .map((o) => `  ${o.paragraph.file}:${o.paragraph.line} -- grammar: ${o.grammarLabels.join(', ')}`)
            .join('\n'),
      );
    }
    expect(offenders.length).toBeLessThanOrEqual(AUDIT_HANDOFF_STALE_CEILING);
  });

  it('the ceiling is not stale (fails when the measured offender count drops below the constant, forcing it down in the same batch -- DEC-808 two-sided ratchet)', () => {
    if (offenders.length < AUDIT_HANDOFF_STALE_CEILING) {
      throw new Error(
        `AUDIT_HANDOFF_STALE_CEILING is stale -- measured ${offenders.length} offender(s), constant ` +
          `reads ${AUDIT_HANDOFF_STALE_CEILING}. Lower it:\n` +
          `  export const AUDIT_HANDOFF_STALE_CEILING = ${offenders.length};`,
      );
    }
    expect(offenders.length).toBeGreaterThanOrEqual(AUDIT_HANDOFF_STALE_CEILING);
  });
});

// ---------------------------------------------------------------------------
// NON-VACUITY (DEC-967): fabricated tmpdir fixtures exercised through the
// SAME grading functions the population walk above uses -- never validated
// by reading the real docs/design/audit population back as its own
// evidence.
// ---------------------------------------------------------------------------

describe('non-vacuity: the detector discriminates fabricated offender/legal paragraphs', () => {
  it('a fabricated "not fixed" paragraph naming a zero-valued constant IS an offender', () => {
    const text = 'This gap is not fixed yet; see FIXTURE_ZERO_CEILING for the count.';
    const paragraphs: Paragraph[] = [{ file: 'fixture.md', line: 1, text }];
    const codeFiles: CodeFile[] = [{ content: 'export const FIXTURE_ZERO_CEILING = 0;\n' }];
    const offenders = findOffenders(paragraphs, codeFiles);
    expect(offenders.length).toBe(1);
  });

  it('the same paragraph with a CLOSED marker is NOT an offender', () => {
    const text = 'This gap is not fixed yet; see FIXTURE_ZERO_CEILING for the count. CLOSED (wave 41).';
    const paragraphs: Paragraph[] = [{ file: 'fixture.md', line: 1, text }];
    const codeFiles: CodeFile[] = [{ content: 'export const FIXTURE_ZERO_CEILING = 0;\n' }];
    const offenders = findOffenders(paragraphs, codeFiles);
    expect(offenders.length).toBe(0);
  });

  it('a fabricated "for the planner" paragraph naming a NON-ZERO live constant is NOT an offender', () => {
    const text = 'This row is for the planner; grade it against FIXTURE_NONZERO_TRIPWIRE.';
    const paragraphs: Paragraph[] = [{ file: 'fixture.md', line: 1, text }];
    const codeFiles: CodeFile[] = [{ content: 'export const FIXTURE_NONZERO_TRIPWIRE = 4;\n' }];
    const offenders = findOffenders(paragraphs, codeFiles);
    expect(offenders.length).toBe(0);
  });

  it('a fabricated paragraph naming a constant that does not exist in the tree IS an offender', () => {
    const text = 'This claim is still open pending FIXTURE_MISSING_FLOOR.';
    const paragraphs: Paragraph[] = [{ file: 'fixture.md', line: 1, text }];
    const codeFiles: CodeFile[] = [{ content: 'export const SOME_OTHER_CEILING = 5;\n' }];
    const offenders = findOffenders(paragraphs, codeFiles);
    expect(offenders.length).toBe(1);
  });

  it('a paragraph matching none of the handoff grammar is not even collected as a candidate', () => {
    const text = 'This row was fully implemented and matches its frame exactly.';
    const paragraphs: Paragraph[] = [{ file: 'fixture.md', line: 1, text }];
    const codeFiles: CodeFile[] = [];
    const graded = gradeParagraphs(paragraphs, codeFiles);
    expect(graded.length).toBe(0);
  });

  it('splitParagraphs is blank-line-delimited and 1-indexed', () => {
    const content = 'para one line one\npara one line two\n\npara two\n';
    const parts = splitParagraphs(content);
    expect(parts.length).toBe(2);
    expect(parts[0]!.line).toBe(1);
    expect(parts[0]!.text).toBe('para one line one\npara one line two');
    expect(parts[1]!.line).toBe(4);
    expect(parts[1]!.text).toBe('para two');
  });
});
