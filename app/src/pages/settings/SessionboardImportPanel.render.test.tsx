// task-w5-c render test: SessionboardImportPanel over the DEC-613 wire
// contract (mocked -- this task is independent of the server task-w5-b).
// Covers: DEC-614's prose (no disabled control for the API-token path),
// the styled file input (never a raw <input type=file>), the mapping
// picker as a styled .chq-segmented pill group (never a bare <select>),
// and the dry-run -> "Import N rows" -> real-run flow re-posting
// dryRun:false through the same endpoint.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { SessionboardImportPanel } from './SessionboardImportPanel';
import { mockApi } from '../../test-utils/mockApi';

const EVENT_ID = 'evt-sbimport-render';
const ENDPOINT = `POST /api/v1/events/${EVENT_ID}/import/sessionboard`;

let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  window.localStorage.setItem('chq.currentEventId', EVENT_ID);
  consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  expect(consoleErrorSpy).not.toHaveBeenCalled();
  consoleErrorSpy.mockRestore();
  window.localStorage.clear();
  vi.unstubAllGlobals();
  cleanup();
});

describe('SessionboardImportPanel', () => {
  it('renders the DEC-614 prose without a disabled API-token control', () => {
    render(<SessionboardImportPanel />);

    expect(screen.getByRole('heading', { name: 'Import from Sessionboard' })).toBeInTheDocument();
    expect(
      screen.getByText(/Connecting a\s*Sessionboard API token is not implemented in this build/),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /api token/i })).not.toBeInTheDocument();
    for (const btn of screen.queryAllByRole('button')) {
      expect(btn).not.toBeDisabled();
    }
  });

  it('states plainly that imported speakers are added hidden (DEC-675/DEC-656)', () => {
    render(<SessionboardImportPanel />);
    expect(screen.getByText(/Imported speakers are added hidden/)).toBeInTheDocument();
  });

  it('uses a styled file input, not a raw one, and a styled pill picker, not a bare select', () => {
    render(<SessionboardImportPanel />);

    const fileInput = screen.getByLabelText('Upload the Sessionboard export') as HTMLInputElement;
    expect(fileInput).toHaveAttribute('type', 'file');
    expect(fileInput.className).toContain('chq-file');

    fireEvent.change(screen.getByLabelText(/Or paste the exported CSV text/), {
      target: { value: 'Full Name,Work Email\nAda Lovelace,ada@example.com' },
    });

    // No bare <select> anywhere in the mapping table.
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    const targetPicker = screen.getByRole('group', { name: 'Map column Full Name' });
    expect(within(targetPicker).getByRole('button', { name: 'firstName' })).toHaveClass('chq-pill');
  });

  it('runs a dry run, prints exactly the server report, then re-posts dryRun:false on confirm', async () => {
    let calls = 0;
    const fetchMock = mockApi({
      [ENDPOINT]: () => {
        calls += 1;
        return {
          dryRun: calls === 1,
          entity: 'contacts',
          created: 2,
          updated: 1,
          skipped: [{ row: 4, reason: 'missing email' }],
          issues: [{ row: 2, field: 'email', message: 'not a valid address' }],
        };
      },
    });

    render(<SessionboardImportPanel />);

    fireEvent.change(screen.getByLabelText(/Or paste the exported CSV text/), {
      target: { value: 'name,email\nAda Lovelace,ada@example.com\nBad Row,not-an-email' },
    });

    const nameColumnPicker = screen.getByRole('group', { name: 'Map column name' });
    fireEvent.click(within(nameColumnPicker).getByRole('button', { name: 'firstName' }));
    const emailColumnPicker = screen.getByRole('group', { name: 'Map column email' });
    fireEvent.click(within(emailColumnPicker).getByRole('button', { name: 'email' }));

    fireEvent.click(screen.getByRole('button', { name: 'Preview import (dry run)' }));

    await waitFor(() => {
      expect(screen.getByText('Created 2, updated 1, skipped 1.')).toBeInTheDocument();
    });
    expect(screen.getByRole('heading', { name: 'Dry run report' })).toBeInTheDocument();
    expect(screen.getByText('Row 4: missing email')).toBeInTheDocument();
    expect(screen.getByText('Row 2, email: not a valid address')).toBeInTheDocument();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const firstCall = fetchMock.mock.calls[0];
    if (!firstCall) throw new Error('expected a first fetch call');
    const firstCallBody = JSON.parse(String(firstCall[1]?.body));
    expect(firstCallBody).toMatchObject({
      dryRun: true,
      entity: 'contacts',
      mapping: { name: 'firstName', email: 'email' },
    });

    const confirmButton = screen.getByRole('button', { name: 'Import 3 rows' });
    fireEvent.click(confirmButton);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Import complete' })).toBeInTheDocument();
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const secondCall = fetchMock.mock.calls[1];
    if (!secondCall) throw new Error('expected a second fetch call');
    const secondCallBody = JSON.parse(String(secondCall[1]?.body));
    expect(secondCallBody).toMatchObject({ dryRun: false, entity: 'contacts' });

    // The report prints only the server's own numbers -- no invented
    // total beyond created+updated on the confirm button, which is gone
    // once the real run's report has replaced the dry-run report.
    expect(screen.queryByRole('button', { name: /Import \d+ rows/ })).not.toBeInTheDocument();
  });

  it('switching entity resets the mapping and any prior report', async () => {
    const fetchMock = mockApi({
      [ENDPOINT]: {
        dryRun: true,
        entity: 'contacts',
        created: 1,
        updated: 0,
        skipped: [],
        issues: [],
      },
    });

    render(<SessionboardImportPanel />);

    fireEvent.change(screen.getByLabelText(/Or paste the exported CSV text/), {
      target: { value: 'name,email\nAda Lovelace,ada@example.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Preview import (dry run)' }));

    await waitFor(() => {
      expect(screen.getByText('Created 1, updated 0, skipped 0.')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Tracks' }));

    expect(screen.queryByText('Created 1, updated 0, skipped 0.')).not.toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
