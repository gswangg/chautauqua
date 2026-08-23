// Frame control-label ledger -- POPULATION module (DEC-976/DEC-967 wave-40;
// task w40-g; split from test/frame-control-label.scan.test.ts by the same
// contention-custodian decomposition test/frame-caption-ledger/population.ts
// already used, no behaviour change).
//
// Extracts every footer/anchor/painted-span control label from
// docs/design/*.dc.html. See test/frame-control-label.scan.test.ts's own
// header for the full grammar rationale. This module owns the EXTRACTION
// grammar (frame enumeration + labelsInFrameText) as a plain, non-test
// module -- vitest.config.ts's `include` is `test/**/*.test.ts`, so a bare
// `.ts` file under `test/` is never collected as a test file, meaning a
// SIBLING scan (test/frame-conditional-state.scan.test.ts) can import it
// directly, exactly the way it already imports
// test/frame-caption-ledger/population.ts's `captionsInText`, without
// pulling this file's own `describe`/`it` suite into its collection (the
// empirically-verified hazard the eyebrow/field-label local-approximation
// comment documents).
//
// `labelsInFrameText` now ACTUALLY USES its `lineStartIndex`/`baseOffset`
// parameters (previously accepted but unread -- the caller,
// `controlLabelsInFile`, redid the same offset math itself) to return each
// label's own absolute file OFFSET and 1-based LINE directly, so every
// caller -- the footer-label ledger and this file's sc-if overlap join --
// shares one frame-relative offset setup rather than two.
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url)); // test/frame-control-label/
const REPO_ROOT = join(HERE, '..', '..');
export const DESIGN_ROOT = join(REPO_ROOT, 'docs', 'design');

export interface Frame {
  fileName: string;
  line: number;
  title: string;
  extentEnd: number;
}

const LABEL_SPAN_RE = />([^<]+)<\/span>/;

function isFrameLine(line: string): boolean {
  return line.includes('width:390px') && line.includes('height:844');
}

function isLabelLine(line: string): boolean {
  return line.includes('font-size:19px') && LABEL_SPAN_RE.test(line);
}

/** Every *.dc.html file directly under docs/design, enumerated rather than
 * named (DEC-808), identical to every sibling ledger's own designFiles(). */
export function designFiles(): string[] {
  return readdirSync(DESIGN_ROOT, { withFileTypes: true })
    .filter((e) => e.isFile() && e.name.endsWith('.dc.html'))
    .map((e) => e.name)
    .sort();
}

export function framesInFile(fileName: string): Frame[] {
  const full = join(DESIGN_ROOT, fileName);
  const lines = readFileSync(full, 'utf-8').split('\n');

  const labelLines: { line: number; title: string }[] = [];
  const frameLineNums: number[] = [];
  lines.forEach((content, idx) => {
    const lineNo = idx + 1;
    if (isLabelLine(content)) {
      const m = content.match(LABEL_SPAN_RE);
      if (m) labelLines.push({ line: lineNo, title: m[1]!.trim() });
    }
    if (isFrameLine(content)) frameLineNums.push(lineNo);
  });

  return frameLineNums.map((frameLine) => {
    let title: string | undefined;
    for (let i = labelLines.length - 1; i >= 0; i--) {
      if (labelLines[i]!.line <= frameLine) {
        title = labelLines[i]!.title;
        break;
      }
    }
    if (title === undefined) {
      throw new Error(`${fileName}:${frameLine} -- no preceding font-size:19px label found`);
    }
    const nextLabel = labelLines.find((l) => l.line > frameLine);
    return {
      fileName,
      line: frameLine,
      title,
      extentEnd: nextLabel ? nextLabel.line : Infinity,
    };
  });
}

export interface ControlLabel {
  fileName: string;
  /** 1-based line the label's own text node sits on (not the frame's line). */
  line: number;
  /** 0-based absolute byte offset into the file's full content. */
  offset: number;
  label: string;
  kind: 'footer' | 'anchor' | 'span';
  frameTitle: string;
  frameLine: number;
}

const FOOTER_SIGNATURE = 'flex-shrink:0; border-top:1px solid #1B1D17; background:#EFEBDF';
const FOOTER_TEXT_NODE_RE = />([^<>]+)</g;
const ANCHOR_RE = /<a\b[^>]*min-height:44px[^>]*>([^<]+)<\/a>/g;

const SPAN_RE = /<span\b([^>]*)>([^<]+)<\/span>/g;
const SPAN_MIN_HEIGHT_RE = /min-height:4[468]px/;
const SPAN_BORDER_RADIUS_RE = /border-radius/;
const SPAN_BORDER_RE = /border:1px/;
const SPAN_BACKGROUND_RE = /background:#4E5C31/;

function isPaintedSpanFace(attrs: string): boolean {
  return (
    SPAN_MIN_HEIGHT_RE.test(attrs) &&
    SPAN_BORDER_RADIUS_RE.test(attrs) &&
    (SPAN_BORDER_RE.test(attrs) || SPAN_BACKGROUND_RE.test(attrs))
  );
}

export function offsetToLine(lineStartIndex: number[], offset: number): number {
  let lo = 0;
  let hi = lineStartIndex.length - 1;
  let ans = 0;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (lineStartIndex[mid]! <= offset) {
      ans = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return ans + 1;
}

function isRealLabel(label: string): boolean {
  return label.trim().length >= 2 && !label.includes('{{');
}

/** Walks `<div`/`</div>` tokens forward from `openStart` with a depth
 * counter, returning the index just past the matching balanced `</div>`'s
 * own `>`. */
function balancedDivEnd(text: string, openStart: number): number {
  const re = /<(\/?)div\b/g;
  re.lastIndex = openStart;
  let depth = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (m[1] === '/') {
      depth--;
      if (depth === 0) {
        const closeGt = text.indexOf('>', m.index);
        if (closeGt === -1) throw new Error('unterminated </div> tag during balanced walk');
        return closeGt + 1;
      }
    } else {
      depth++;
    }
  }
  throw new Error(`balancedDivEnd: <div> at offset ${openStart} never closed`);
}

/** Extracts every footer/anchor/painted-span control label from one frame's
 * raw text extent. Returns each label's `offset` RELATIVE to `text` (the
 * frame extent's own start) -- unchanged from the pre-wave-40 grammar, so
 * every existing caller that does its own `baseOffset + r.offset` addition
 * (e.g. test/frame-eyebrow-label.scan.test.ts's `controlLabelSitesInFile`,
 * which imports this function directly, DEC-613) keeps working unmodified.
 *
 * `lineStartIndex`/`baseOffset` are the FRAME-RELATIVE offset setup this
 * function now ACTUALLY USES (previously accepted but unread) to also
 * compute each label's ABSOLUTE `absoluteOffset`/`line` directly, so a NEW
 * caller that wants the absolute position (this file's own
 * `controlLabelsInFile`, and test/frame-conditional-state.scan.test.ts's
 * false-hinted-extent overlap join) does not need to duplicate that
 * addition + binary search a second time. A synthetic caller can pass a
 * trivial identity mapping (`[0]`, `0`), in which case `absoluteOffset`
 * equals `offset` and `line` is always 1. */
export function labelsInFrameText(
  text: string,
  lineStartIndex: number[],
  baseOffset: number
): { label: string; kind: 'footer' | 'anchor' | 'span'; offset: number; absoluteOffset: number; line: number }[] {
  const out: { label: string; kind: 'footer' | 'anchor' | 'span'; offset: number; absoluteOffset: number; line: number }[] = [];
  const footerOffsets = new Set<number>();
  const withAbsolute = (relOffset: number) => {
    const absoluteOffset = baseOffset + relOffset;
    return { absoluteOffset, line: offsetToLine(lineStartIndex, absoluteOffset) };
  };

  let sigIdx = text.indexOf(FOOTER_SIGNATURE);
  while (sigIdx !== -1) {
    const divStart = text.lastIndexOf('<div', sigIdx);
    if (divStart === -1) {
      throw new Error(`footer signature at offset ${sigIdx} has no enclosing <div`);
    }
    const endIdx = balancedDivEnd(text, divStart);
    const footerText = text.slice(divStart, endIdx);
    FOOTER_TEXT_NODE_RE.lastIndex = 0;
    let tm: RegExpExecArray | null;
    while ((tm = FOOTER_TEXT_NODE_RE.exec(footerText))) {
      const label = tm[1]!.trim();
      const offset = divStart + tm.index;
      if (isRealLabel(label)) {
        const { absoluteOffset, line } = withAbsolute(offset);
        out.push({ label, kind: 'footer', offset, absoluteOffset, line });
        footerOffsets.add(offset);
      }
    }
    sigIdx = text.indexOf(FOOTER_SIGNATURE, endIdx);
  }

  ANCHOR_RE.lastIndex = 0;
  let am: RegExpExecArray | null;
  while ((am = ANCHOR_RE.exec(text))) {
    const label = am[1]!.trim();
    if (isRealLabel(label)) {
      const { absoluteOffset, line } = withAbsolute(am.index);
      out.push({ label, kind: 'anchor', offset: am.index, absoluteOffset, line });
    }
  }

  SPAN_RE.lastIndex = 0;
  let sm: RegExpExecArray | null;
  while ((sm = SPAN_RE.exec(text))) {
    const attrs = sm[1]!;
    if (!isPaintedSpanFace(attrs)) continue;
    const label = sm[2]!.trim();
    if (!isRealLabel(label)) continue;
    const openTagEnd = text.indexOf('>', sm.index);
    if (openTagEnd === -1) {
      throw new Error(`span at offset ${sm.index} has no closing '>' on its opening tag`);
    }
    if (footerOffsets.has(openTagEnd)) continue;
    const { absoluteOffset, line } = withAbsolute(openTagEnd);
    out.push({ label, kind: 'span', offset: openTagEnd, absoluteOffset, line });
  }

  return out;
}

function controlLabelsInFile(fileName: string): ControlLabel[] {
  const full = join(DESIGN_ROOT, fileName);
  const content = readFileSync(full, 'utf-8');
  const lines = content.split('\n');
  const lineStartIndex: number[] = [0];
  for (let i = 0; i < lines.length; i++) {
    lineStartIndex.push(lineStartIndex[i]! + lines[i]!.length + 1);
  }

  const frames = framesInFile(fileName);
  const out: ControlLabel[] = [];
  for (const frame of frames) {
    const startOff = lineStartIndex[frame.line - 1]!;
    const endOff = frame.extentEnd === Infinity ? content.length : lineStartIndex[frame.extentEnd - 1]!;
    const text = content.slice(startOff, endOff);
    const raw = labelsInFrameText(text, lineStartIndex, startOff);
    for (const r of raw) {
      out.push({
        fileName,
        line: r.line,
        offset: r.absoluteOffset,
        label: r.label,
        kind: r.kind,
        frameTitle: frame.title,
        frameLine: frame.line,
      });
    }
  }
  return out;
}

export const ALL_LABELS: ControlLabel[] = designFiles().flatMap(controlLabelsInFile);
