// w29-b (DEC-976/DEC-967 wave-29): the "Files · 390" frame
// (docs/design/Chautauqua Content.dc.html:338-368, caption at :334) had
// ZERO markup instrument before this file -- every existing 390 test in
// this cluster (content-phone-frames.test.ts, content-phone-floor.test.ts)
// reads either source text or computed CSS, never mounts the component and
// asserts the DOM the frame actually draws. This is that frame's FIRST
// markup-level verdict: it mounts <FilesLibrary> directly (the harness
// FilesLibrary.render.test.tsx already uses) with the phone matchMedia
// stub FilesLibrary.kind-vocabulary.render.test.tsx already established,
// and asserts every one of the frame's 10 drawn strings/templates against
// the rendered tree.
//
// jsdom applies no stylesheet (no @media), so every assertion below is
// about DOM structure/order/text, never computed geometry.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { FilesLibrary } from './FilesLibrary';
import { listEnvelope, mockApi } from '../../test-utils/mockApi';
import { DEC_385, DEC_874, DEC_967, DEC_976 } from '../../../../src/decisions';
import { stripCssComments } from '../../../../test/helpers/strip-css-comments';

void DEC_385;
void DEC_874;
void DEC_967;
void DEC_976;

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, '..', '..', '..', '..');
const DESIGN_FILE = join(REPO_ROOT, 'docs', 'design', 'Chautauqua Content.dc.html');
const CONTENT_CSS = join(HERE, 'content.css');

/** DEC-976 wave-12 / phone-verdict-cascade-read lens (task w15-w): jsdom
 * applies no stylesheet, so this file's DOM-only assertions above are
 * really a claim about the un-cascaded desktop tree -- they would pass
 * whether or not the terminal `@media (max-width: 700px)` block actually
 * turns the header row into the stacked column the frame draws. content.css
 * has SIX `max-width: 700px` substrings (five are prose inside comments
 * that only MENTION the block; this is the one real
 * `@media (max-width: 700px) {` opener) -- extracted by brace-depth walk,
 * same idiom as Contacts.frame-verdicts.render.test.tsx's
 * `readContactsPhoneLayer()`. */
function readContentPhoneLayer(): string {
  const css = stripCssComments(readFileSync(CONTENT_CSS, 'utf-8'));
  const opener = /@media\s*\(max-width:\s*700px\)\s*\{/g;
  const openMatch = opener.exec(css);
  if (openMatch === null) throw new Error('content.css has no @media (max-width: 700px) block');
  let depth = 1;
  let i = openMatch.index + openMatch[0].length;
  const start = i;
  while (i < css.length && depth > 0) {
    if (css[i] === '{') depth += 1;
    else if (css[i] === '}') depth -= 1;
    i += 1;
  }
  if (depth !== 0) throw new Error('content.css phone block never closes');
  return css.slice(start, i - 1);
}

/** DEC-967 shape: read the ACTUAL line, assert it byte-for-byte matches the
 * literal this file claims -- a citation that can never silently rot to a
 * wrong line the way a bare `:line` reference can. Copied from
 * FilesLibrary.kind-vocabulary.render.test.tsx's own `verbatimLine`. */
function verbatimLine(lineNo: number, literal: string): void {
  const lines = readFileSync(DESIGN_FILE, 'utf-8').split('\n');
  const line = lines[lineNo - 1];
  if (line === undefined) throw new Error(`design file has no line ${lineNo}`);
  expect(line).toBe(literal);
}

// Follows the matchMedia-stub idiom FilesLibrary.kind-vocabulary.render.test.tsx
// uses (itself following SessionList.render.test.tsx /
// ContactDrawer.phoneRead.render.test.tsx) to force useIsPhone's split in
// jsdom, which implements no matchMedia at all -- unstubbed in afterEach so
// no other test in the process keeps the phone stub.
class FakeMediaQueryList {
  matches = true;
  addEventListener() {}
  removeEventListener() {}
}

function stubPhoneMatchMedia() {
  vi.stubGlobal('matchMedia', () => new FakeMediaQueryList());
}

const EVENT_ID = 'evt-files-frame390-1';

function makeItem(i: number, overrides: Partial<Record<string, unknown>> = {}) {
  return {
    rootFileId: `file-${i}`,
    latestFileId: `file-${i}-latest`,
    filename: `slides-${i}.pdf`,
    kind: 'presentation' as const,
    submissionId: `sub-${i}`,
    submissionRef: `SES-${i}`,
    submissionTitle: `Talk ${i}`,
    speakerName: 'Speaker',
    uploadedAt: 1700000000000,
    versionCount: 1,
    versionNo: 1,
    sizeBytes: 1000,
    uploaderName: 'Priya Raman',
    ...overrides,
  };
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('v12 Content "Files · 390" frame (:338-368): first markup-level render verdict (w29-b)', () => {
  it('renders every one of the frame\'s 10 drawn strings against the real DOM', async () => {
    verbatimLine(334, "      <span style=\"font-family:'Familjen Grotesk', sans-serif; font-size:19px; font-weight:600\">Files · 390</span>");
    verbatimLine(340, '        <a href="#" style="font-size:13px; font-weight:700; min-height:44px; display:flex; align-items:center">‹ Content</a>');
    verbatimLine(341, '        <h1 style="margin:0; font-family:\'Familjen Grotesk\', sans-serif; font-size:25px; font-weight:700; letter-spacing:-0.04em; line-height:1.05">Files</h1>');
    verbatimLine(342, '        <span style="font-size:13px; color:#565A4B">31 files · 412 MB</span>');
    verbatimLine(360, '        <span style="flex:1; background:#4E5C31; color:#F7F9F0; border-radius:6px; min-height:48px; display:flex; align-items:center; justify-content:center; font-size:14px; font-weight:700">Download all</span>');
    verbatimLine(361, '        <span style="border:1px solid #BAB6A6; border-radius:6px; min-height:48px; display:flex; align-items:center; padding:0 16px; font-size:13px; font-weight:600">Search</span>');

    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {
      throw new Error('console.error called during render');
    });

    stubPhoneMatchMedia();

    const items = [
      makeItem(1, { filename: 'slides-1.pdf' }),
      makeItem(2, { filename: 'slides-2.pdf' }),
    ];

    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/files`]: listEnvelope(items, {
        total: items.length,
        totalSizeBytes: 412 * 1024 * 1024,
        kindCounts: { presentation: 0, poster: 0, handout: 0, recording: 4, headshot: 0 },
      }),
    });

    render(<FilesLibrary eventId={EVENT_ID} onSelectSubmission={() => {}} onBack={() => {}} />);

    await waitFor(() => {
      expect(screen.getByTestId('files-library')).toBeInTheDocument();
    });
    await screen.findByText('slides-1.pdf');

    // :340 back control -- text ends "Content".
    const backControls = screen.getAllByText(/Content$/);
    expect(backControls.length).toBeGreaterThan(0);
    expect(backControls[0]!.textContent?.endsWith('Content')).toBe(true);

    // :341/:342 -- exactly one H1 reading "Files", with the stat line on
    // the SAME row (shared parent), per FilesLibrary.tsx's own :181 comment
    // ("H1 'Files', and the total/size stat ON this same row").
    const headings = screen.getAllByRole('heading', { level: 1 });
    expect(headings).toHaveLength(1);
    expect(headings[0]).toHaveTextContent('Files');
    const headerRow = headings[0]!.closest<HTMLElement>('.chq-content-files-header-row');
    expect(headerRow).not.toBeNull();
    const statLine = within(headerRow!).getByText(/^\d+ files · /);
    expect(headerRow!.contains(statLine)).toBe(true);

    // jsdom never evaluates @media, so the DOM assertion above (H1 and the
    // stat line sharing one parent) proves only that they share a parent --
    // NOT that the frame's :338-357 stacked header actually renders at 390.
    // Read the terminal phone cascade's own text and assert it turns that
    // SAME shared parent into the column stack the frame draws (back link
    // over title over stat line, :338-342), closing the cascade-blind gap
    // this file's DOM-only assertions leave open.
    const phoneLayer = readContentPhoneLayer();
    expect(phoneLayer).toMatch(/\.chq-content-files-header-row\s*\{[^}]*flex-direction:\s*column;/);
    expect(phoneLayer).toMatch(/\.chq-content-files-header-row\s*\{[^}]*align-items:\s*stretch;/);

    // :344 leading type-tab chip renders first, drawing "All" at the 390
    // register (accessible name stays pinned to "All types" at every
    // width -- DEC-833 shape -- so it is queried by its aria-label, never
    // by its shrunk visible text, and never asserted at both registers in
    // one file).
    const typeTabs = screen.getByRole('tablist', { name: 'File type' });
    const tabs = within(typeTabs).getAllByRole('tab');
    expect(tabs[0]).toHaveAccessibleName('All types');
    expect(tabs[0]).toHaveTextContent('All');
    expect(tabs[0]).not.toHaveTextContent('All types');

    // :345/:346 remaining chips each match `Label · N`.
    for (const tab of tabs.slice(1)) {
      expect(tab.textContent ?? '').toMatch(/^\S.* · \d+$/);
    }
    expect(within(typeTabs).getByRole('tab', { name: 'Video · 4' })).toBeInTheDocument();

    // :351-:356 row template -- each row carries a name, a version marker,
    // a session cell and a size cell (the frame draws them fused as one
    // "{{ f.session }} · {{ f.size }}" line; the product renders them as
    // two adjacent table cells sharing one grid row -- w11-tb, DEC-825,
    // recorded MATCHES in the audit file; the structural fusion itself is
    // asserted by FilesLibrary.session-size-fuse.receipt.render.test.tsx,
    // not here), an uploader, and a Download control.
    for (const item of items) {
      expect(screen.getByText(item.filename)).toBeInTheDocument();
      const openButtons = screen.getAllByRole('button', {
        name: `Open ${item.filename} versions and comments`,
      });
      expect(openButtons.length).toBeGreaterThan(0);
      const row = openButtons[0]!.closest('tr');
      expect(row).not.toBeNull();
      expect(within(row as HTMLElement).getByText(`v${item.versionNo}`)).toBeInTheDocument();
      expect(within(row as HTMLElement).getByText(item.submissionRef, { exact: false })).toBeInTheDocument();
      expect(within(row as HTMLElement).getByText(item.uploaderName, { exact: false })).toBeInTheDocument();
      expect(
        within(row as HTMLElement).getByRole('link', { name: `Download ${item.filename}` }),
      ).toBeInTheDocument();
    }

    // :359-:361 pinned dock -- exactly two controls, DOM order
    // ['Download all', 'Search'], scoped to the dock container (DEC-874
    // wave-29 shape: jsdom mounts no duplicate dock here, but the scoped
    // length assertion is the same discipline).
    const dock = document.querySelector('.chq-phone-dock');
    expect(dock).not.toBeNull();
    const dockButtons = within(dock as HTMLElement).getAllByRole('button');
    expect(dockButtons).toHaveLength(2);
    // Frame :359 draws bare "Download all"; the real control renders
    // "Download all N (.zip)" -- the DEC-901 scoped-download-count suffix,
    // a frame-silent addition recorded in the audit file, not a
    // divergence (the frame's own line does not contradict it).
    expect(dockButtons[0]!.textContent).toMatch(/^Download all \d+ \(\.zip\)$/);
    expect(dockButtons[1]!.textContent).toBe('Search');

    consoleError.mockRestore();
  });
});
