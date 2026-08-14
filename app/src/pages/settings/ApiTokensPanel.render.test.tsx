// DEC-941: revoking an API token is unrecoverable (the plaintext is never
// shown again), so the row's Revoke link must open the shared ConfirmDialog
// and only DELETE after an explicit confirm -- never on the first click.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { ApiTokensPanel } from './ApiTokensPanel';
import { listEnvelope, mockApi } from '../../test-utils/mockApi';

function token() {
  return { id: 'tok-1', name: 'CI pipeline', tokenPrefix: 'chq_abc', lastUsedAt: null };
}

let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
    throw new Error(`console.error called during render: ${args.map(String).join(' ')}`);
  });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  consoleErrorSpy.mockRestore();
});

describe('ApiTokensPanel (w1-f, DEC-785)', () => {
  it('renders label + last-used at rest, before any Change click, never the secret', async () => {
    mockApi({
      'GET /api/v1/tokens': listEnvelope([token()]),
    });

    render(<ApiTokensPanel />);

    expect(await screen.findByText('CI pipeline')).toBeInTheDocument();
    expect(screen.getByText('Last used: Never')).toBeInTheDocument();
    expect(screen.queryByText(/chq_abc/)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Revoke' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Change' })).toBeInTheDocument();
  });
});

describe('ApiTokensPanel (DEC-941)', () => {
  it('gates Revoke behind a confirm dialog naming the token and the consequence, and only DELETEs on confirm', async () => {
    const fetchMock = mockApi({
      'GET /api/v1/tokens': listEnvelope([token()]),
      'DELETE /api/v1/tokens/tok-1': { status: 200, body: {} },
    });

    render(<ApiTokensPanel />);

    fireEvent.click(await screen.findByRole('button', { name: 'Change' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Revoke' }));

    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText('Revoke this token?')).toBeInTheDocument();
    expect(
      within(dialog).getByText(
        'Any script or embed still using CI pipeline stops working immediately. This cannot be undone.',
      ),
    ).toBeInTheDocument();

    expect(fetchMock.mock.calls.some(([, init]) => (init as RequestInit | undefined)?.method === 'DELETE')).toBe(
      false,
    );

    fireEvent.click(within(dialog).getByRole('button', { name: 'Revoke' }));

    await waitFor(() => {
      expect(fetchMock.mock.calls.some(([, init]) => (init as RequestInit | undefined)?.method === 'DELETE')).toBe(
        true,
      );
    });
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });
});
