// Frame-citation frame-extent helpers: phone and desktop frame extent
// computation, shared by app/src/frame-citation.scan.test.ts. Extracted
// verbatim from that file's wave-87/wave-107 blocks as part of a contention
// decomposition (no behaviour change) -- see frame-citation-core.ts's header
// for the extraction rationale.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DESIGN_ROOT, designFileNames } from './frame-citation-core';

// ---------------------------------------------------------------------------
// Phone frame extents (DEC-976 wave-87 amendment, task w5-j). Frame extents
// are computed independently, the same way
// phone-frame-ledger.scan.test.ts computes them: from a frame's own
// `width:390px`/`height:844` line up to (but excluding) the next
// `font-size:19px` label line in the same file, or EOF for the last frame
// -- never a listed range, and never the label line itself (the label sits
// ~3 rows ABOVE the frame it labels).
// ---------------------------------------------------------------------------

export interface FrameExtent {
  fileName: string;
  line: number;
  extentEnd: number;
}

export function isFrameLine(line: string): boolean {
  return line.includes('width:390px') && line.includes('height:844');
}

export const LABEL_LINE_RE = />([^<]+)<\/span>/;
export function isLabelLine(line: string): boolean {
  return line.includes('font-size:19px') && LABEL_LINE_RE.test(line);
}

export function frameExtentsInFile(fileName: string): FrameExtent[] {
  const lines = readFileSync(join(DESIGN_ROOT, fileName), 'utf-8').split('\n');
  const labelLineNums: number[] = [];
  const frameLineNums: number[] = [];
  lines.forEach((content, idx) => {
    const lineNo = idx + 1;
    if (isLabelLine(content)) labelLineNums.push(lineNo);
    if (isFrameLine(content)) frameLineNums.push(lineNo);
  });
  return frameLineNums.map((line) => {
    const nextLabel = labelLineNums.find((l) => l > line);
    return { fileName, line, extentEnd: nextLabel ?? Infinity };
  });
}

export const ALL_FRAME_EXTENTS: FrameExtent[] = designFileNames().flatMap(frameExtentsInFile);

export function isInsideAPhoneFrame(frameFile: string, firstLine: number): boolean {
  return ALL_FRAME_EXTENTS.some(
    (f) => f.fileName === frameFile && firstLine >= f.line && firstLine < f.extentEnd
  );
}

// ---------------------------------------------------------------------------
// DEC-808 wave-107 amendment (task w3-v): a symmetric DESKTOP frame-extent
// population. DESKTOP CLASSIFICATION: test/desktop-frame-ledger.scan.test.ts
// derives "is this label-opened frame desktop" itself but exports ONLY
// `CLAIMED_FLOOR`, not a reusable classifier function -- so this block
// DERIVES the identical grammar rather than diverge from it (a second copy
// of a vocabulary is a trap with a delay fuse, DEC-613; if the ledger ever
// exports a classifier, import it here instead of re-deriving):
//   - a label line is `font-size:19px` plus a closing tag with a title
//     inside it, matched by />([^<]+)<\//  (wider than this file's own
//     phone-oriented `isLabelLine`, which requires `</span>` specifically --
//     the ledger widens to any closing tag because some desktop labels sit
//     on an `<a>`, e.g. Chautauqua Home.dc.html:205);
//   - a label opens a frame whose extent runs to the next label line (or
//     EOF);
//   - the frame is DESKTOP when that extent contains no `width:390px` +
//     `height:844` line anywhere in it (this module's own `isFrameLine`,
//     reused verbatim -- that part of the grammar is common to both files
//     already and is not duplicated here).
// This block does NOT reproduce the ledger's further exclusions (template
// interpolations, explainer panels) -- those narrow which frames count
// toward the desktop POPULATION total; this block only asks the narrower
// geometric question "does this cited line fall inside a desktop frame's
// extent", which the exclusions do not change.
// ---------------------------------------------------------------------------
export const DESKTOP_LABEL_RE = />([^<]+)<\//;

export function isDesktopLabelLine(line: string): boolean {
  return line.includes('font-size:19px') && DESKTOP_LABEL_RE.test(line);
}

export interface DesktopFrameExtent {
  fileName: string;
  line: number;
  extentEnd: number;
}

export function desktopFrameExtentsInFile(fileName: string): DesktopFrameExtent[] {
  const lines = readFileSync(join(DESIGN_ROOT, fileName), 'utf-8').split('\n');
  const labelLineNums: number[] = [];
  lines.forEach((content, idx) => {
    if (isDesktopLabelLine(content)) labelLineNums.push(idx + 1);
  });
  const out: DesktopFrameExtent[] = [];
  labelLineNums.forEach((line, i) => {
    const extentEnd = labelLineNums[i + 1] ?? Infinity;
    const extentLines = lines.slice(line - 1, extentEnd === Infinity ? lines.length : extentEnd - 1);
    if (extentLines.some(isFrameLine)) return; // has a width:390px+height:844 line -- phone, not desktop
    out.push({ fileName, line, extentEnd });
  });
  return out;
}

export const ALL_DESKTOP_FRAME_EXTENTS: DesktopFrameExtent[] = designFileNames().flatMap(
  desktopFrameExtentsInFile
);

export function isInsideADesktopFrame(frameFile: string, firstLine: number): boolean {
  return ALL_DESKTOP_FRAME_EXTENTS.some(
    (f) => f.fileName === frameFile && firstLine >= f.line && firstLine < f.extentEnd
  );
}
