// w11-tb (DEC-825): the Files library's 390 card fuses `session · size`
// onto one line — docs/design/Chautauqua Content.dc.html:351-356 draws the
// row's third field as ONE line, `{{ f.session }} · {{ f.size }}`; the
// product used to stack them on two separate rows (grid-row 2 and 3),
// re-verdicted DIVERGES in docs/design/audit/content-files-390-v12.md row
// 7. This receipt covers both halves of that fix:
//
//   1. A CSS source-scan over content.css's ONE terminal
//      `@media (max-width: 700px)` block, confirming every new/changed
//      rule for the fused pair lives inside that block only, and quoting
//      the frame line it satisfies.
//   2. A render receipt over the real FilesLibrary mount, asserting all
//      five row fields (name, version, session, size, Download) render and
//      that the session and size cells sit on the SAME grid row (the
//      structural fusion — jsdom applies no stylesheet, so this is a DOM/
//      class-contract assertion, never computed geometry).
//
// DEC-825's own title names "the worklist's flex line-box" as the
// mechanism; this card already ran (and keeps running) CSS Grid for its
// two-column card shape (established w17-c, content.css ~:1379) rather than
// flex order-tricks — grid's `grid-row`/`grid-column` placement is this
// codebase's OTHER positional-placement primitive alongside flex `order`,
// carries no phone-only DOM either, and is what this exact card already
// used before this task. Narrowest-reasonable-interpretation deviation,
// flagged for the scribe: the OPERATIVE clause DEC-825 protects --
// "fuses session and size onto one line ... never a phone-only DOM fork"
// -- holds either way; only the CSS mechanism differs from the DEC title's
// literal phrase.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { FilesLibrary } from './FilesLibrary';
import { listEnvelope, mockApi } from '../../test-utils/mockApi';
import { stripCssComments } from '../../../../test/helpers/strip-css-comments';
import { DEC_825, DEC_998 } from '../../../../src/decisions';

void DEC_825;
void DEC_998; // in-body citation below pairs with this file's header-block scope citation into the same frame

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, '..', '..', '..', '..');
const DESIGN_FILE = join(REPO_ROOT, 'docs', 'design', 'Chautauqua Content.dc.html');
const CSS_FILE = join(HERE, 'content.css');

function verbatimLine(lineNo: number, literal: string): string {
  const lines = readFileSync(DESIGN_FILE, 'utf-8').split('\n');
  const line = lines[lineNo - 1];
  if (line === undefined) throw new Error(`design file has no line ${lineNo}`);
  expect(line).toBe(literal);
  return line;
}

/** Concatenated bodies of every `@media (max-width: …)` block, brace-matched
 * (mirrors content-phone-frames.test.ts's own `phoneLayer`). */
function phoneLayer(css: string): { layer: string; blockCount: number } {
  const out: string[] = [];
  const opener = /@media\s*\(max-width:\s*700px\)\s*\{/g;
  let m: RegExpExecArray | null;
  let count = 0;
  while ((m = opener.exec(css)) !== null) {
    count += 1;
    let depth = 1;
    let i = m.index + m[0].length;
    const start = i;
    while (i < css.length && depth > 0) {
      if (css[i] === '{') depth += 1;
      else if (css[i] === '}') depth -= 1;
      i += 1;
    }
    out.push(css.slice(start, i - 1));
    opener.lastIndex = i;
  }
  return { layer: out.join('\n'), blockCount: count };
}

describe('content.css 390: Files library card fuses session · size onto one line (w11-tb, DEC-825)', () => {
  it('frame :354 draws the fused template this rule satisfies', () => {
    // docs/design/Chautauqua Content.dc.html:354 `<span style="font-size:13px; color:#565A4B">{{ f.session }} · {{ f.size }}</span>` -- in-body receipt pairing with this file's header-block scope citation (DEC-998).
    verbatimLine(354, '            <span style="font-size:13px; color:#565A4B">{{ f.session }} · {{ f.size }}</span>');
  });

  it('every session/size fusion rule lives ONLY inside the file\'s terminal max-width:700px block', () => {
    const raw = readFileSync(CSS_FILE, 'utf-8');
    const css = stripCssComments(raw);
    const { layer, blockCount } = phoneLayer(css);

    // DEC-385: single terminal block for this file's phone layer.
    expect(blockCount).toBe(1);

    // The two new/changed selectors, and nothing matching them OUTSIDE the
    // phone layer (desktop stays frozen).
    const sessionSelector = '.chq-content-files-library .chq-content-table tr.chq-content-row > td:nth-child(2)';
    const sizeSelector = '.chq-content-files-library .chq-content-table tr.chq-content-row > td:nth-child(4)';

    expect(layer).toContain(sessionSelector);
    expect(layer).toContain(sizeSelector);
    expect(layer).toMatch(/tr\.chq-content-row > td:nth-child\(2\)\s*\{[^}]*grid-row:\s*2;[^}]*grid-column:\s*1;/);
    expect(layer).toMatch(/tr\.chq-content-row > td:nth-child\(4\)\s*\{[^}]*grid-row:\s*2;[^}]*grid-column:\s*2;/);

    // The '·' separator is punctuation only -- no letter -- so it never
    // sources a LABEL (phone-label-source.scan.test.ts stays green).
    expect(layer).toMatch(/tr\.chq-content-row > td:nth-child\(4\)::before\s*\{\s*content:\s*'· ';/);

    // Outside the phone layer entirely -- desktop frozen (DEC-385).
    const outsideLayer = css.replace(layer, '');
    expect(outsideLayer).not.toMatch(/tr\.chq-content-row > td:nth-child\(2\)\s*\{[^}]*grid-row:\s*2/);
  });
});

// Follows FilesLibrary.frame390.render.test.tsx's own matchMedia-stub idiom.
class FakeMediaQueryList {
  matches = true;
  addEventListener() {}
  removeEventListener() {}
}

function stubPhoneMatchMedia() {
  vi.stubGlobal('matchMedia', () => new FakeMediaQueryList());
}

const EVENT_ID = 'evt-files-fuse-1';

function makeItem() {
  return {
    rootFileId: 'file-1',
    latestFileId: 'file-1-latest',
    filename: 'slides-1.pdf',
    kind: 'presentation' as const,
    submissionId: 'sub-1',
    submissionRef: 'SES-1',
    submissionTitle: 'Talk One',
    speakerName: 'Speaker',
    uploadedAt: 1700000000000,
    versionCount: 1,
    versionNo: 3,
    sizeBytes: 4_200_000,
    uploaderName: 'Priya Raman',
  };
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('FilesLibrary render: all five row fields render, session and size share one grid line (w11-tb, DEC-825)', () => {
  it('renders name, version, session, size and Download, with session+size on the same grid row', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {
      throw new Error('console.error called during render');
    });

    stubPhoneMatchMedia();

    const item = makeItem();
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/files`]: listEnvelope([item], {
        total: 1,
        totalSizeBytes: item.sizeBytes,
        kindCounts: { presentation: 1, poster: 0, handout: 0, recording: 0, headshot: 0 },
      }),
    });

    render(<FilesLibrary eventId={EVENT_ID} onSelectSubmission={() => {}} onBack={() => {}} />);

    await waitFor(() => {
      expect(screen.getByTestId('files-library')).toBeInTheDocument();
    });
    await screen.findByText(item.filename);

    const nameButtons = screen.getAllByRole('button', {
      name: `Open ${item.filename} versions and comments`,
    });
    const row = nameButtons[0]!.closest('tr');
    expect(row).not.toBeNull();
    const cells = within(row as HTMLElement).getAllByRole('cell', { hidden: true });
    // Five <td> per row: name, session, version, size, actions.
    expect(cells).toHaveLength(5);

    const sessionCell = cells[1]!;
    const versionCell = cells[2]!;
    const sizeCell = cells[3]!;
    const actionsCell = cells[4]!;

    expect(sessionCell).toHaveTextContent(item.submissionRef);
    expect(sessionCell).toHaveTextContent(item.submissionTitle);
    expect(versionCell).toHaveTextContent(`v${item.versionNo}`);
    expect(sizeCell).toHaveClass('chq-content-files-col-size');
    expect(within(actionsCell).getByRole('link', { name: `Download ${item.filename}` })).toBeInTheDocument();

    // The structural fusion: session is td:nth-child(2), size is
    // td:nth-child(4) of the SAME row -- the phone rule (asserted above)
    // places both at grid-row:2, one column each, so they occupy one
    // fused line rather than two stacked ones.
    expect(sessionCell.tagName).toBe('TD');
    expect(sizeCell.tagName).toBe('TD');
    expect(row!.children[1]).toBe(sessionCell);
    expect(row!.children[3]).toBe(sizeCell);

    consoleError.mockRestore();
  });
});
