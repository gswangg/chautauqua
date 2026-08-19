// DEC-032 amendment (wave 20, B10): exports are actions, not settings --
// ExportsPanel has no local summary/edit split of its own; the download
// table renders unconditionally. This panel is only ever mounted inside
// its caller's own edit drill (YourDataPanel's "More export formats"
// disclosure), so there is no section-level read/edit split to lose here.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ExportsPanel } from './ExportsPanel';
import { mockApi } from '../../test-utils/mockApi';

const EVENT_ID = 'evt-exports-render';

let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  window.localStorage.setItem('chq.currentEventId', EVENT_ID);
  consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
    throw new Error(`console.error called during render: ${args.map(String).join(' ')}`);
  });
});

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  vi.unstubAllGlobals();
  consoleErrorSpy.mockRestore();
});

describe('ExportsPanel (DEC-032, wave 20 amendment)', () => {
  it('renders the full download table unconditionally, with no Change/Back gate', async () => {
    mockApi({});
    render(<ExportsPanel />);

    expect(await screen.findAllByRole('link', { name: 'Download CSV' })).not.toHaveLength(0);
    expect(screen.queryByRole('button', { name: 'Change' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Back' })).not.toBeInTheDocument();
  });

  it('covers all six DEC-027 kinds plus the show-flow row', async () => {
    mockApi({});
    render(<ExportsPanel />);

    ['Submissions', 'Speakers', 'Evaluations', 'Agenda', 'Email log', 'Contacts', 'Show-flow (CSV)'].forEach(
      (label) => {
        expect(screen.getByText(label)).toBeInTheDocument();
      },
    );
  });

  it('carries the frame\'s consequence line verbatim', () => {
    mockApi({});
    render(<ExportsPanel />);

    expect(
      screen.getByText('Exports are actions, not settings — they download at once and there is nothing here to save.'),
    ).toBeInTheDocument();
  });
});

describe('ExportsPanel exports table CSS (w23-c, DEC-902 amendment)', () => {
  const css = readFileSync(join(__dirname, 'settings.css'), 'utf8');

  function extractRule(selector: string): string {
    const idx = css.indexOf(selector);
    expect(idx).toBeGreaterThanOrEqual(0);
    const close = css.indexOf('}', idx);
    return css.slice(idx, close + 1);
  }

  it('declares table-layout: fixed on the exports table with exactly one unwidthed column', () => {
    const tableRule = extractRule('.chq-settings-exports-table {');
    expect(tableRule).toContain('table-layout: fixed;');

    const widthedCols = ['csv', 'json'];
    for (const col of widthedCols) {
      const rule = extractRule(`.chq-settings-exports-table .chq-settings-exports-col-${col} {`);
      expect(rule).toMatch(/width:\s*\d{2,3}px;/);
      expect(rule).toMatch(/white-space:\s*nowrap;/);
    }
    expect(css).not.toContain('.chq-settings-exports-col-data {');
  });

  it('declares no table-layout for the exports table inside the phone reflow media block', () => {
    // The phone reflow stacks the table into cards, where a fixed column
    // grid means nothing -- so no rule under the breakpoint may declare
    // table-layout for this table.
    //
    // This used to be checked as "the string chq-settings-exports never
    // appears in the phone block". That proxy stopped meaning what it said
    // once DEC-385 wave-98 forward-merged settings.css's several phone
    // blocks into one terminal block: the single block now legitimately
    // names the exports table (an overflow escape on the CSV/JSON columns)
    // without declaring table-layout. Assert the property, not the proxy.
    expect(phoneBlockRulesMentioning(css, 'chq-settings-exports').length).toBeGreaterThan(0);
    for (const rule of phoneBlockRulesMentioning(css, 'chq-settings-exports')) {
      expect(rule.body, `${rule.selector} declares table-layout under the phone breakpoint`).not.toMatch(
        /table-layout\s*:/,
      );
    }
    expect(phoneBlockText(css)).not.toMatch(/table-layout\s*:/);
  });

  it('gives the Data and CSV/JSON headers the expected class hooks in the DOM', async () => {
    mockApi({});
    render(<ExportsPanel />);

    const csvHeader = await screen.findByRole('columnheader', { name: 'CSV' });
    const jsonHeader = screen.getByRole('columnheader', { name: 'JSON' });
    const dataHeader = screen.getByRole('columnheader', { name: 'Data' });

    expect(csvHeader).toHaveClass('chq-settings-exports-col-csv');
    expect(jsonHeader).toHaveClass('chq-settings-exports-col-json');
    expect(dataHeader.className).toBe('');
  });
});
