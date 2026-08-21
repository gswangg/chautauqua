// w15-ta (DEC-825 wave-159): "CONTENT WORKLIST AT 390 -- make the rest/
// selecting headers actually exclusive and reach the frame's card row."
// Two things this file locks in:
//
//   1. ContentApp.tsx's summary line (`N need a decision · M re-uploaded`)
//      and the phone "selecting" meta row (`N selected` / `All N` / `Done`)
//      are mutually exclusive -- exactly one mounts at a time, gated on
//      `phoneSelectMode` -- entered through ContentApp's real /content
//      route (MemoryRouter), never a sub-component mounted directly.
//   2. content.css's terminal `@media (max-width: 700px)` card block
//      reaches frame :216-228's row anatomy: status pill, title, one
//      shared speaker/latest-file line, then the Approve/Open pair last.
//
// Every frame citation below is verbatimLine()'d against the actual design
// file line -- DEC-967 shape, copied from Settings.frame-verdicts.render.
// test.tsx's own helper -- so a stale `:line` reference fails loudly
// instead of rotting silently.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ContentApp } from './ContentApp';
import { listEnvelope, mockApi } from '../../test-utils/mockApi';

const EVENT_ID = 'evt-content-worklist-390';
const DESIGN_FILE = join(process.cwd(), 'docs', 'design', 'Chautauqua Content.dc.html');
const CSS_FILE = join(process.cwd(), 'app/src/pages/content/content.css');

/** DEC-967 shape: read the ACTUAL line, assert it byte-for-byte matches the
 * literal this file claims -- copied from Settings.frame-verdicts.render.
 * test.tsx's own verbatimLine. */
function verbatimLine(lineNo: number, literal: string): void {
  const lines = readFileSync(DESIGN_FILE, 'utf-8').split('\n');
  const line = lines[lineNo - 1];
  if (line === undefined) throw new Error(`design file has no line ${lineNo}`);
  expect(line).toBe(literal);
}

/** The body of content.css's terminal `@media (max-width: 700px)` block --
 * brace-matched, LAST occurrence (w8-e/DEC-385 appended a second terminal
 * block at true EOF; SessionList.render.test.tsx's own contentPhoneBlock
 * helper uses the identical technique). */
function contentPhoneBlock(): string {
  const source = readFileSync(CSS_FILE, 'utf-8');
  const open = source.lastIndexOf('@media (max-width: 700px) {');
  expect(open).toBeGreaterThan(-1);
  const bodyStart = source.indexOf('{', open) + 1;
  let depth = 1;
  let i = bodyStart;
  for (; i < source.length && depth > 0; i++) {
    if (source[i] === '{') depth++;
    else if (source[i] === '}') depth--;
  }
  return source.slice(bodyStart, i - 1);
}

function ruleBody(css: string, selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = css.match(new RegExp(`(?:^|\\n)\\s*${escaped}\\s*\\{([^}]*)\\}`));
  expect(match, `no rule for \`${selector}\``).not.toBeNull();
  return match![1]!;
}

beforeEach(() => {
  window.localStorage.setItem('chq.currentEventId', EVENT_ID);
});

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

function renderContentApp() {
  return render(
    <MemoryRouter initialEntries={['/content']}>
      <Routes>
        <Route path="/content/:submissionId" element={<ContentApp />} />
        <Route path="/content" element={<ContentApp />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('ContentApp 390: rest summary vs selecting meta row are exclusive (DEC-825 wave-159)', () => {
  it('renders the rest-state summary line and Select toggle, never the selecting meta row', async () => {
    // Frame :198's 390 "Content" screen; :207 draws the header's Select
    // link beside the summary line.
    verbatimLine(
      198,
      '    <div style="width:390px; height:844px; background:#F4F1E8; border:1px solid #D3CFC0; border-radius:20px; overflow:hidden; display:flex; flex-direction:column; box-shadow:0 18px 44px rgba(27,29,23,0.13)">',
    );
    verbatimLine(
      207,
      '          <a href="#" style="margin-left:auto; font-size:13px; font-weight:700; min-height:44px; display:inline-flex; align-items:center; white-space:nowrap">Select</a>',
    );

    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/submissions`]: listEnvelope([], {
        contentStatusCounts: { pending: 2, approved: 5, changes_requested: 3 },
        reuploadedCount: 4,
      }),
    });

    const { container } = renderContentApp();

    await waitFor(() => {
      expect(screen.getByText('5 need a decision · 4 re-uploaded')).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: 'Select' })).toBeInTheDocument();
    expect(container.querySelector('.chq-content-phone-selecting-meta')).not.toBeInTheDocument();
  });

  it('replaces the summary line + Select toggle with the selecting meta row once Select is tapped, and back on Done', async () => {
    // Frame :247's 390 "Content · selecting" screen; :255-257 draw `N
    // selected` / `All N` / `Done` and NO summary line.
    verbatimLine(
      247,
      '    <div style="width:390px; height:844px; background:#F4F1E8; border:1px solid #D3CFC0; border-radius:20px; overflow:hidden; display:flex; flex-direction:column; box-shadow:0 18px 44px rgba(27,29,23,0.13)">',
    );
    verbatimLine(
      255,
      '          <span style="font-family:\'Familjen Grotesk\', sans-serif; font-size:15px; font-weight:600">2 selected</span>',
    );
    verbatimLine(
      256,
      '          <a href="#" style="margin-left:auto; font-size:13px; font-weight:700; min-height:44px; display:inline-flex; align-items:center; white-space:nowrap">All 5</a>',
    );
    verbatimLine(
      257,
      '          <a href="#" style="font-size:13px; font-weight:700; min-height:44px; display:inline-flex; align-items:center">Done</a>',
    );

    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/submissions`]: listEnvelope([], {
        contentStatusCounts: { pending: 2, approved: 5, changes_requested: 3 },
        reuploadedCount: 4,
      }),
    });

    const { container } = renderContentApp();

    await waitFor(() => {
      expect(screen.getByText('5 need a decision · 4 re-uploaded')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Select' }));

    // PRODUCT bytes: the selecting meta row is up, the rest-state summary
    // and Select toggle are gone -- never both mounted at once.
    await waitFor(() => {
      expect(container.querySelector('.chq-content-phone-selecting-meta')).toBeInTheDocument();
    });
    expect(screen.queryByText('5 need a decision · 4 re-uploaded')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Select' })).not.toBeInTheDocument();
    expect(screen.getByText('0 selected')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Done' }));

    await waitFor(() => {
      expect(screen.getByText('5 need a decision · 4 re-uploaded')).toBeInTheDocument();
    });
    expect(container.querySelector('.chq-content-phone-selecting-meta')).not.toBeInTheDocument();
  });
});

describe('content.css 390 card: reaches frame :216-228\'s row anatomy (DEC-825 wave-159)', () => {
  const ROW = '.chq-content-worklist .chq-content-table tr.chq-content-row';

  it('keeps the pinned tick+status/title/actions reading order untouched (SessionList.render.test.tsx six-tracks suite)', () => {
    // w17-c (DEC-825): a wrapping flex line-box replaced the grid this test
    // used to pin -- `order` carries the reading-order job grid-row/
    // grid-column used to.
    const body = contentPhoneBlock();
    const row = ruleBody(body, ROW);
    expect(row).toMatch(/display:\s*flex/);
    expect(row).toMatch(/flex-wrap:\s*wrap/);
    expect(ruleBody(body, `${ROW} > td:nth-child(1)`)).toMatch(/order:\s*1/);
    expect(ruleBody(body, `${ROW} > td:nth-child(5)`)).toMatch(/order:\s*2/);
    expect(ruleBody(body, `${ROW} > td:nth-child(2)`)).toMatch(/order:\s*3/);
    expect(ruleBody(body, `${ROW} > td:nth-child(6)`)).toMatch(/order:\s*6/);
  });

  it('puts speaker (nth-child 3) and latest-file (nth-child 4) on the SAME flex line -- frame :220\'s one meta line', () => {
    // Frame :219/:220: title, then the ONE `speaker · file, when` meta line
    // (rest state); :272/:273 draw the same pairing in the selecting state.
    verbatimLine(
      220,
      '            <span style="font-size:13px; color:#565A4B; line-height:1.5">{{ row.speaker }} · {{ row.file }}, {{ row.when }}</span>',
    );

    const body = contentPhoneBlock();
    const speaker = ruleBody(body, `${ROW} > td:nth-child(3)`);
    const file = ruleBody(body, `${ROW} > td:nth-child(4)`);

    // PRODUCT bytes: both cells sit between the title (order:3) and actions
    // (order:6) lines and neither forces a break of its own (no `flex: 0 0
    // 100%`), so they flow onto the same wrapped line -- the merge the
    // frame's one meta line calls for, reached without touching the
    // markup SessionList.tsx owns (out of this task's file scope).
    const speakerOrder = speaker.match(/order:\s*(\d+)/);
    const fileOrder = file.match(/order:\s*(\d+)/);
    expect(speakerOrder).not.toBeNull();
    expect(fileOrder).not.toBeNull();
    expect(Number(speakerOrder![1])).toBeLessThan(Number(fileOrder![1]));
    expect(Number(speakerOrder![1])).toBeLessThan(6);
    expect(Number(speakerOrder![1])).toBeGreaterThan(3);
    expect(Number(fileOrder![1])).toBeLessThan(6);
    expect(speaker).not.toMatch(/flex:\s*0 0 100%/);
    expect(file).not.toMatch(/flex:\s*0 0 100%/);
  });

  it('reads status pill first, then title, then the merged meta line, then actions last -- frame :217-224\'s stack order', () => {
    // Frame :217's card wrapper opens directly on the status span (:218),
    // then title (:219), meta (:220), then the Approve/Open pair (:221-224)
    // as the card's LAST row.
    verbatimLine(
      217,
      '          <div style="padding:16px 0; border-bottom:1px solid #E1DDCE; display:flex; flex-direction:column; gap:9px">',
    );
    verbatimLine(218, '            <span style="{{ row.statusStyleM }}">{{ row.status }}</span>');

    const body = contentPhoneBlock();
    const statusOrder = Number(ruleBody(body, `${ROW} > td:nth-child(5)`).match(/order:\s*(\d+)/)![1]);
    const titleOrder = Number(ruleBody(body, `${ROW} > td:nth-child(2)`).match(/order:\s*(\d+)/)![1]);
    const speakerOrder = Number(ruleBody(body, `${ROW} > td:nth-child(3)`).match(/order:\s*(\d+)/)![1]);
    const actionsOrder = Number(ruleBody(body, `${ROW} > td:nth-child(6)`).match(/order:\s*(\d+)/)![1]);

    // PRODUCT bytes: status < title < speaker/file meta < actions, in that
    // strict order -- the frame's :217-224 read.
    expect(statusOrder).toBeLessThan(titleOrder);
    expect(titleOrder).toBeLessThan(speakerOrder);
    expect(speakerOrder).toBeLessThan(actionsOrder);
    expect(actionsOrder).toBe(6);
  });

  it('gives the merged meta line a separator, punctuation only (phone-label-source.scan.test.ts stays clean)', () => {
    const body = contentPhoneBlock();
    const separator = ruleBody(body, `${ROW} > td:nth-child(4)::before`);
    expect(separator).toMatch(/content:\s*'·'/);
  });

  it('never suppresses the row selection checkbox at 390 -- selection stays live (frame draws a live counter head-band)', () => {
    const body = contentPhoneBlock();
    const select = ruleBody(body, `${ROW} > td:nth-child(1)`);
    expect(select).not.toMatch(/display:\s*none/);
  });
});
