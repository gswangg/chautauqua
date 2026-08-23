// Frame side of the DEC-725 phone hidden-drawn-text ledger: every
// width:390/height:844 phone frame extent (ported from
// test/frame-eyebrow-label.scan.test.ts / test/frame-control-label.scan.test.ts's
// own Frame walk -- this campaign's standing "port, don't cross-import a
// population walk" convention, so a worker touching one ledger's population
// never becomes a merge-conflict on another's). Extracted (contention
// decomposition, no behavior change) from
// app/src/phone-hidden-drawn-text.scan.test.ts, which re-exports these
// symbols verbatim.
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { labelIsMatched, normalizeSource } from '../../../test/frame-source-corpus';

const HERE = dirname(fileURLToPath(import.meta.url)); // app/src/phone-hidden-drawn-text
const REPO_ROOT = join(HERE, '..', '..', '..');
const DESIGN_ROOT = join(REPO_ROOT, 'docs', 'design');

interface Frame {
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

export function designFiles(): string[] {
  return readdirSync(DESIGN_ROOT, { withFileTypes: true })
    .filter((e) => e.isFile() && e.name.endsWith('.dc.html'))
    .map((e) => e.name)
    .sort();
}

/** DEC-967 wave-42 amendment (porting v12m-w41-c's shape in
 * test/phone-frame-ledger.scan.test.ts verbatim, per this campaign's "port,
 * don't cross-import a population walk" convention): the 1-based line of
 * the single `</x-dc>` template close in `fullPath`, throwing loudly on
 * zero or multiple matches. A frame's extent is never allowed to reach
 * past this line -- without the clip, the last labelled block of a file
 * swallows the template's own closing tag and everything after it
 * (fixture `data-dc-script` bodies, trailing markup). */
export function templateCloseLine(fullPath: string): number {
  const lines = readFileSync(fullPath, 'utf-8').split('\n');
  const matches: number[] = [];
  lines.forEach((line, idx) => {
    if (line.includes('</x-dc>')) matches.push(idx + 1);
  });
  if (matches.length !== 1) {
    throw new Error(`${fullPath}: expected exactly one </x-dc>, found ${matches.length} (lines ${matches.join(', ')})`);
  }
  return matches[0]!;
}

function framesInFile(fileName: string): Frame[] {
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
    // Extent end: next label line strictly after this frame's own line, or
    // EOF -- clipped at the template's own close (DEC-967 wave-42
    // amendment) so the last labelled block can never swallow `</x-dc>`
    // and everything past it (fixture `data-dc-script` bodies included).
    const nextLabel = labelLines.find((l) => l.line > frameLine);
    return {
      fileName,
      line: frameLine,
      title,
      extentEnd: Math.min(nextLabel ? nextLabel.line : Infinity, templateCloseLine(full)),
    };
  });
}

export interface FrameBlob {
  fileName: string;
  line: number;
  title: string;
  normalized: string;
}

function frameBlobsInFile(fileName: string): FrameBlob[] {
  const full = join(DESIGN_ROOT, fileName);
  const content = readFileSync(full, 'utf-8');
  const lines = content.split('\n');
  const lineStartIndex: number[] = [0];
  for (let i = 0; i < lines.length; i++) lineStartIndex.push(lineStartIndex[i]! + lines[i]!.length + 1);

  return framesInFile(fileName).map((frame) => {
    const startOff = lineStartIndex[frame.line - 1]!;
    const endOff = frame.extentEnd === Infinity ? content.length : lineStartIndex[frame.extentEnd - 1]!;
    return {
      fileName,
      line: frame.line,
      title: frame.title,
      normalized: normalizeSource(content.slice(startOff, endOff)),
    };
  });
}

export const FRAME_BLOBS: FrameBlob[] = designFiles().flatMap(frameBlobsInFile);

/** The first phone frame whose extent contains `text` verbatim, or
 * `undefined` if none does. Uses `labelIsMatched`/`normalizeSource`
 * verbatim from test/frame-source-corpus.ts (DEC-613). */
export function matchingFrame(text: string, blobs: readonly FrameBlob[] = FRAME_BLOBS): FrameBlob | undefined {
  return blobs.find((b) => labelIsMatched(text, [b.normalized]));
}
