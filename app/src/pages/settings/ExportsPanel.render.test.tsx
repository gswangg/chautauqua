// DEC-032 amendment (wave 20, B10): exports are actions, not settings --
// ExportsPanel has no local summary/edit split of its own; the download
// table renders unconditionally. This panel is only ever mounted inside
// its caller's own edit drill (YourDataPanel's "More export formats"
// disclosure), so there is no section-level read/edit split to lose here.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
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
