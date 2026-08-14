// w1-f, DEC-785: ExportsPanel is only ever mounted inside its caller's own
// edit drill, so at rest it must not ALSO dump straight into the full
// download table -- it owns its own local summary/edit split. At rest it
// lists the available formats; 'Change' switches to the download-link table.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, fireEvent } from '@testing-library/react';
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

describe('ExportsPanel (w1-f, DEC-785)', () => {
  it('renders the available formats at rest, before any Change click', () => {
    mockApi({});
    render(<ExportsPanel />);

    ['Submissions', 'Speakers', 'Evaluations', 'Agenda', 'Email log', 'Contacts', 'Show-flow (CSV only)'].forEach(
      (label) => {
        expect(screen.getByText(label)).toBeInTheDocument();
      },
    );

    expect(screen.queryByRole('link', { name: 'Download CSV' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Change' })).toBeInTheDocument();
  });

  it('switches to the full download table after Change', async () => {
    mockApi({});
    render(<ExportsPanel />);

    fireEvent.click(screen.getByRole('button', { name: 'Change' }));

    expect(await screen.findAllByRole('link', { name: 'Download CSV' })).not.toHaveLength(0);
    expect(screen.getByRole('button', { name: 'Back' })).toBeInTheDocument();
  });
});
