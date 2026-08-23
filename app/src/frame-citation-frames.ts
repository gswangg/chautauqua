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

// ---------------------------------------------------------------------------
// DEC-967 wave-41 amendment (task w41-b, citation side): a `.dc.html:<line>`
// landing past `</x-dc>` is not a frame citation. Every frame extent
// previously ran to the next label line OR END-OF-FILE for the file's last
// labelled block, which let the last block of every docs/design/*.dc.html
// swallow the whole `<script data-dc-script>` body below `</x-dc>` -- 236
// lines onto Portal/Resources, 1,049 style declarations tree-wide (field
// guide, wave-41). `</x-dc>` closes the drawn template exactly one line
// before the script tag opens in all 13 files; this is the single-line
// clip point every frame extent below is now bounded by.
// ---------------------------------------------------------------------------

const templateCloseLineByFile = new Map<string, number>();

/** The 1-based line number of the single `</x-dc>` closing tag in
 * `fileName`'s drawn template, or throws loudly if the file has zero or
 * more than one (fail-loudly: this derivation depends on there being
 * exactly one template boundary per design file, and a file that violates
 * that assumption must stop every extent computation, not silently pick
 * one). */
export function templateCloseLine(fileName: string): number {
  let cached = templateCloseLineByFile.get(fileName);
  if (cached !== undefined) return cached;
  const lines = readFileSync(join(DESIGN_ROOT, fileName), 'utf-8').split('\n');
  const hits: number[] = [];
  lines.forEach((content, idx) => {
    if (content.includes('</x-dc>')) hits.push(idx + 1);
  });
  if (hits.length !== 1) {
    throw new Error(
      `${fileName}: expected exactly one </x-dc> closing tag, found ${hits.length} ` +
        `(templateCloseLine cannot derive a single template-close boundary)`
    );
  }
  cached = hits[0]!;
  templateCloseLineByFile.set(fileName, cached);
  return cached;
}

/** True when `line` (a citation's cited FRAME line, 1-based) falls at or
 * after the design file's template close -- inside or past the
 * `<script data-dc-script>` body, never inside the drawn template. Such a
 * citation is neither a frame claim nor an offender under any of the
 * receipt ceilings (UNRECEIPTED_CLAIM_CEILING and siblings): it names a
 * position the frame extents below no longer cover. */
export function isPastTemplate(fileName: string, line: number): boolean {
  return line > templateCloseLine(fileName);
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
  const close = templateCloseLine(fileName);
  return frameLineNums.map((line) => {
    const nextLabel = labelLineNums.find((l) => l > line);
    return { fileName, line, extentEnd: Math.min(nextLabel ?? Infinity, close) };
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
  const close = templateCloseLine(fileName);
  const out: DesktopFrameExtent[] = [];
  labelLineNums.forEach((line, i) => {
    const rawExtentEnd = labelLineNums[i + 1] ?? Infinity;
    const extentLines = lines.slice(line - 1, rawExtentEnd === Infinity ? lines.length : rawExtentEnd - 1);
    if (extentLines.some(isFrameLine)) return; // has a width:390px+height:844 line -- phone, not desktop
    out.push({ fileName, line, extentEnd: Math.min(rawExtentEnd, close) });
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
