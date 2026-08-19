// DEC-941: revoking an API token is unrecoverable (the plaintext is never
// shown again), so the row's Revoke link must open the shared ConfirmDialog
// and only DELETE after an explicit confirm -- never on the first click.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ApiTokensPanel } from './ApiTokensPanel';
import { formatDateTime } from '../../lib/dates';
import { listEnvelope, mockApi } from '../../test-utils/mockApi';

const CREATED_AT = 1_700_000_500_000;
const LAST_USED_AT = 1_700_050_000_000;

function token(overrides: Partial<ReturnType<typeof baseToken>> = {}) {
  return { ...baseToken(), ...overrides };
}

function baseToken() {
  return { id: 'tok-1', name: 'CI pipeline', tokenPrefix: 'chq_abc', lastUsedAt: null as number | null, createdAt: CREATED_AT };
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

describe('ApiTokensPanel (DEC-785 amendment, wave 66)', () => {
  it('renders the full create/revoke surface directly at rest, with no local Change/Back drill', async () => {
    mockApi({
      'GET /api/v1/tokens': listEnvelope([token()]),
    });

    render(<ApiTokensPanel />);

    expect(await screen.findByText('CI pipeline')).toBeInTheDocument();
    expect(screen.getByText(/chq_abc/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Revoke' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Change' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Back' })).not.toBeInTheDocument();
  });
});

describe('ApiTokensPanel readOnly prop (DEC-815 amendment, wave 4)', () => {
  it('renders the real token rows with no Change control and no create/revoke surface, ever', async () => {
    mockApi({
      'GET /api/v1/tokens': listEnvelope([token()]),
    });

    render(<ApiTokensPanel readOnly />);

    expect(await screen.findByText('CI pipeline')).toBeInTheDocument();
    expect(screen.getByText('Last used: Never')).toBeInTheDocument();
    expect(screen.queryByText(/chq_abc/)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Change' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'New token' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Revoke' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'API Tokens' })).not.toBeInTheDocument();
  });

  it('renders the empty state with no Change control when there are no tokens', async () => {
    mockApi({
      'GET /api/v1/tokens': listEnvelope([]),
    });

    render(<ApiTokensPanel readOnly />);

    expect(await screen.findByText('No API tokens yet.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Change' })).not.toBeInTheDocument();
  });
});

describe('ApiTokensPanel Created column + NEVER USED mark (DEC-027 wave-47 amendment)', () => {
  it('renders a Created column, the NEVER USED mark for an unused token, the plain date for a used one, and both standing facts before any row', async () => {
    mockApi({
      'GET /api/v1/tokens': listEnvelope([
        token({ id: 'tok-unused', name: 'Unused token', lastUsedAt: null }),
        token({ id: 'tok-used', name: 'Used token', lastUsedAt: LAST_USED_AT }),
      ]),
    });

    render(<ApiTokensPanel />);


    expect(await screen.findByRole('columnheader', { name: 'Created' })).toBeInTheDocument();

    const table = screen.getByRole('table');
    const rows = within(table).getAllByRole('row');
    // rows[0] is the header row; data rows follow in list order.
    const unusedRow = rows[1]!;
    const usedRow = rows[2]!;

    expect(within(unusedRow).getByText(formatDateTime(CREATED_AT))).toBeInTheDocument();
    expect(within(unusedRow).getByText('NEVER USED')).toBeInTheDocument();
    expect(within(unusedRow).queryByText(formatDateTime(LAST_USED_AT))).not.toBeInTheDocument();

    expect(within(usedRow).getByText(formatDateTime(CREATED_AT))).toBeInTheDocument();
    expect(within(usedRow).getByText(formatDateTime(LAST_USED_AT))).toBeInTheDocument();
    expect(within(usedRow).queryByText('NEVER USED')).not.toBeInTheDocument();

    // Both standing facts render once, above the table (before any row).
    const factOne = screen.getByText('The token is shown once, when you create it.');
    const factTwo = screen.getByText('Revoking takes effect immediately and cannot be undone.');
    expect(factOne).toBeInTheDocument();
    expect(factTwo).toBeInTheDocument();
    const position = factOne.compareDocumentPosition(table);
    expect(position & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    const position2 = factTwo.compareDocumentPosition(table);
    expect(position2 & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});

describe('ApiTokensPanel table columns (w22-b, DEC-902 amendment)', () => {
  it('renders a four-cell head with the merged Name and prefix label, and name+prefix in the same data cell', async () => {
    mockApi({
      'GET /api/v1/tokens': listEnvelope([token()]),
    });

    render(<ApiTokensPanel />);


    const table = await screen.findByRole('table');
    const headerRow = within(table).getAllByRole('row')[0]!;
    const headCells = within(headerRow).getAllByRole('columnheader');
    expect(headCells).toHaveLength(4);
    expect(headCells[0]).toHaveTextContent('Name and prefix');

    const rows = within(table).getAllByRole('row');
    const dataRow = rows[1]!;
    const nameCell = within(dataRow).getAllByRole('cell')[0]!;
    expect(within(nameCell).getByText('CI pipeline')).toBeInTheDocument();
    expect(within(nameCell).getByText(/chq_abc/)).toBeInTheDocument();
  });
});

describe('ApiTokensPanel tokens table CSS (w22-b, DEC-902 amendment)', () => {
  const css = readFileSync(join(__dirname, 'settings.css'), 'utf8');

  function extractRule(selector: string): string {
    const idx = css.indexOf(selector);
    expect(idx).toBeGreaterThanOrEqual(0);
    const close = css.indexOf('}', idx);
    return css.slice(idx, close + 1);
  }

  it('declares table-layout: fixed on the tokens table with exactly one unwidthed column', () => {
    const tokensRule = extractRule('.chq-settings-tokens-table {');
    expect(tokensRule).toContain('table-layout: fixed;');

    // Exactly one column class (name) is left without a `width` rule; the
    // other three (created, last-used, actions) each get one.
    const widthedCols = ['created', 'last-used', 'actions'];
    for (const col of widthedCols) {
      const rule = extractRule(`.chq-settings-tokens-table .chq-settings-tokens-col-${col} {`);
      expect(rule).toMatch(/width:/);
    }
    expect(css).not.toContain('.chq-settings-tokens-col-name {');
  });

  it('declares no table-layout for the tokens table inside the phone reflow media block', () => {
    const mediaStart = css.indexOf('@media (max-width: 700px) {');
    expect(mediaStart).toBeGreaterThanOrEqual(0);
    // Brace-count from the media query's opening `{` to find its matching
    // close, since the block contains many nested rules of its own.
    let depth = 0;
    let i = mediaStart;
    let mediaEnd = -1;
    for (; i < css.length; i++) {
      if (css[i] === '{') depth++;
      else if (css[i] === '}') {
        depth--;
        if (depth === 0) {
          mediaEnd = i;
          break;
        }
      }
    }
    expect(mediaEnd).toBeGreaterThan(mediaStart);
    const mediaBlock = css.slice(mediaStart, mediaEnd + 1);
    expect(mediaBlock).not.toContain('chq-settings-tokens');
    expect(mediaBlock).not.toContain('table-layout');
  });
});

describe('ApiTokensPanel cap line (DEC-027 wave-51 amendment)', () => {
  it('renders the envelope max beside the create control', async () => {
    mockApi({
      'GET /api/v1/tokens': listEnvelope([token()], { max: 25 }),
    });

    render(<ApiTokensPanel />);


    expect(await screen.findByText('1 of 25 used')).toBeInTheDocument();
  });

  it('surfaces the 409 cap-refusal message on the error register', async () => {
    mockApi({
      'GET /api/v1/tokens': listEnvelope([token()], { max: 25 }),
      'POST /api/v1/tokens': {
        status: 409,
        body: { error: { code: 'conflict', message: '26 API tokens — 1 over the 25 limit -- revoke one before creating another' } },
      },
    });

    render(<ApiTokensPanel />);

    fireEvent.change(await screen.findByLabelText('Token name'), { target: { value: 'One more' } });
    // DEC-919 wave-99 amendment: "New token" now renders twice in the DOM
    // (the form's own submit + the phone-only sibling, jsdom applies no
    // media query so both are present) -- index 0 is the form's own submit.
    fireEvent.click(screen.getAllByRole('button', { name: 'New token' })[0]!);

    expect(
      await screen.findByText('26 API tokens — 1 over the 25 limit -- revoke one before creating another'),
    ).toBeInTheDocument();
  });
});

describe('ApiTokensPanel (DEC-941)', () => {
  it('gates Revoke behind a confirm dialog naming the token and the consequence, and only DELETEs on confirm', async () => {
    const fetchMock = mockApi({
      'GET /api/v1/tokens': listEnvelope([token()]),
      'DELETE /api/v1/tokens/tok-1': { status: 200, body: {} },
    });

    render(<ApiTokensPanel />);

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

describe('ApiTokensPanel phone "New token" primary (DEC-919 wave-99 amendment, task v12m-w2-a)', () => {
  it('renders the control exactly twice -- the form submit and the phone-only sibling -- the sibling carrying the phone-action class outside the form', async () => {
    mockApi({
      'GET /api/v1/tokens': listEnvelope([token()]),
    });

    render(<ApiTokensPanel />);

    // docs/design/Chautauqua Settings.dc.html:426
    // `        <span style="display:flex; align-items:center; justify-content:center; margin-top:12px; background:#4E5C31; color:#F7F9F0; border-radius:6px; min-height:46px; font-size:14px; font-weight:700">New token</span>`
    const buttons = await screen.findAllByRole('button', { name: 'New token' });
    expect(buttons).toHaveLength(2);

    const [formSubmit, phoneSibling] = buttons;
    expect(formSubmit).toHaveAttribute('type', 'submit');
    expect(formSubmit!.closest('form')).not.toBeNull();
    expect(phoneSibling).toHaveClass('chq-settings-phone-action');
    expect(phoneSibling!.closest('form')).toBeNull();
  });

  it('drives the same create call (and stays disabled with an empty name) from the phone-only sibling', async () => {
    const fetchMock = mockApi({
      'GET /api/v1/tokens': listEnvelope([token()]),
      'POST /api/v1/tokens': { status: 200, body: { token: 'chq_live_secret' } },
    });

    render(<ApiTokensPanel />);

    const [, phoneSibling] = await screen.findAllByRole('button', { name: 'New token' });
    expect(phoneSibling).toBeDisabled();

    fireEvent.change(await screen.findByLabelText('Token name'), { target: { value: 'Phone-created' } });
    expect(phoneSibling).not.toBeDisabled();

    fireEvent.click(phoneSibling!);

    await waitFor(() => {
      expect(
        fetchMock.mock.calls.some(([, init]) => (init as RequestInit | undefined)?.method === 'POST'),
      ).toBe(true);
    });
  });
});
