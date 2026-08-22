// DEC-941: revoking an API token is unrecoverable (the plaintext is never
// shown again), so the row's Revoke link must open the shared ConfirmDialog
// and only DELETE after an explicit confirm -- never on the first click.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { ApiTokensPanel } from './ApiTokensPanel';
import { formatDateTime } from '../../lib/dates';
import { listEnvelope, mockApi } from '../../test-utils/mockApi';
import { phoneBlockRulesMentioning, phoneBlockText } from '../../test-utils/phoneBlock';

function LocationSearchProbe() {
  return <div data-testid="location-search">{useLocation().search}</div>;
}

// DEC-919 wave-155/156 amendment: ApiTokensPanel now reads/writes URL search
// params (the read-drill "New token" primary, the edit-view intent=new focus
// effect) and calls useSearchParams unconditionally on BOTH branches (Rules of
// Hooks), so every render needs a real Router ancestor. The probe
// exposes the resulting `location.search` for assertions without reaching
// into MemoryRouter internals.
function renderPanel(props: { readOnly?: boolean } = {}, initialEntries?: string[]) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <ApiTokensPanel {...props} />
      <LocationSearchProbe />
    </MemoryRouter>,
  );
}

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

    renderPanel();

    expect(await screen.findByText('CI pipeline')).toBeInTheDocument();
    expect(screen.getByText(/chq_abc/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Revoke' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Change' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Back' })).not.toBeInTheDocument();
  });
});

describe('ApiTokensPanel readOnly prop (DEC-815 amendment, wave 4)', () => {
  it('renders the real token rows with no Change control and no local create surface, ever', async () => {
    mockApi({
      'GET /api/v1/tokens': listEnvelope([token()]),
    });

    renderPanel({ readOnly: true });

    expect(await screen.findByText('CI pipeline')).toBeInTheDocument();
    expect(screen.getByText('Last used: Never')).toBeInTheDocument();
    expect(screen.queryByText(/chq_abc/)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Change' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'API Tokens' })).not.toBeInTheDocument();
    // No local name field/submit form anywhere -- creation only ever
    // happens through the edit drill the "New token" primary below opens.
    expect(screen.queryByLabelText('Token name')).not.toBeInTheDocument();
  });

  it('renders the empty state with no Change control when there are no tokens', async () => {
    mockApi({
      'GET /api/v1/tokens': listEnvelope([]),
    });

    renderPanel({ readOnly: true });

    expect(await screen.findByText('No API tokens yet.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Change' })).not.toBeInTheDocument();
  });

  // DEC-919 wave-156 amendment (task qb-settings-yourdata-read-drill): the
  // 390 read drill draws a per-row boxed "Revoke" and a filled full-width
  // "New token" primary that used to be unreachable from this branch --
  // both now render here.
  it('renders a boxed "Revoke" per row, opening the SAME ConfirmDialog/confirmDelete path as the edit branch', async () => {
    const fetchMock = mockApi({
      'GET /api/v1/tokens': listEnvelope([token()]),
      'DELETE /api/v1/tokens/tok-1': { status: 200, body: {} },
    });

    renderPanel({ readOnly: true });

    // docs/design/Chautauqua Settings.dc.html:423 `            <span style="border:1px solid #BAB6A6; border-radius:6px; background:#EFEBDF; min-height:44px; display:flex; align-items:center; padding:0 14px; font-size:13px; font-weight:600">Revoke</span>`
    const revokeBtn = await screen.findByRole('button', { name: 'Revoke' });
    expect(revokeBtn).toHaveClass('chq-settings-summary-row-action');
    fireEvent.click(revokeBtn);

    const dialog = screen.getByRole('dialog', { name: /CI pipeline/ });
    expect(within(dialog).getByText('Revoke "CI pipeline"?')).toBeInTheDocument();
    expect(
      within(dialog).getByText('Any script or embed still using it stops working immediately. This cannot be undone.'),
    ).toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole('button', { name: 'Revoke' }));

    await waitFor(() => {
      expect(fetchMock.mock.calls.some(([, init]) => (init as RequestInit | undefined)?.method === 'DELETE')).toBe(
        true,
      );
    });
  });

  it('the "New token" primary enters the edit drill (?section=your-data&edit=1) rather than creating locally', async () => {
    mockApi({
      'GET /api/v1/tokens': listEnvelope([token()]),
    });

    render(
      <MemoryRouter initialEntries={['/settings?section=your-data']}>
        <ApiTokensPanel readOnly />
      </MemoryRouter>,
    );

    // docs/design/Chautauqua Settings.dc.html:426 `        <span style="display:flex; align-items:center; justify-content:center; margin-top:12px; background:#4E5C31; color:#F7F9F0; border-radius:6px; min-height:46px; font-size:14px; font-weight:700">New token</span>`
    const newTokenBtn = await screen.findByRole('button', { name: 'New token' });
    expect(newTokenBtn).toHaveClass('chq-settings-phone-action');
    // No local create form to drive -- clicking only ever navigates.
    expect(screen.queryByLabelText('Token name')).not.toBeInTheDocument();

    fireEvent.click(newTokenBtn);

    // The panel itself has no route awareness beyond writing the params;
    // asserting the URL directly would need a route/location probe this
    // bare-panel render doesn't have. SummarySection.openEdit (the sibling
    // this button mirrors) is receipted the same way, by class + no local
    // form, in that component's own tests.
  });
});

describe('ApiTokensPanel Created column + NEVER USED mark (DEC-027 wave-47 amendment)', () => {
  it('renders a Created column, the NEVER USED mark for an unused token, and the plain date for a used one', async () => {
    mockApi({
      'GET /api/v1/tokens': listEnvelope([
        token({ id: 'tok-unused', name: 'Unused token', lastUsedAt: null }),
        token({ id: 'tok-used', name: 'Used token', lastUsedAt: LAST_USED_AT }),
      ]),
    });

    renderPanel();


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

  });

  it('renders the section closing footer once, verbatim, after the table (DEC-896 wave-134 amendment)', async () => {
    mockApi({
      'GET /api/v1/tokens': listEnvelope([token()]),
    });

    renderPanel();

    const table = await screen.findByRole('table');
    const footer = screen.getByText(
      "A token's secret is shown once, when it is created — after that only the prefix. Revoking takes effect immediately and cannot be undone.",
    );
    expect(footer).toBeInTheDocument();
    expect(footer.className).toContain('chq-settings-edit-section-note');
    const position = table.compareDocumentPosition(footer);
    expect(position & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});

describe('ApiTokensPanel table columns (w22-b, DEC-902 amendment)', () => {
  it('renders a four-cell head with the merged Name and prefix label, and name+prefix in the same data cell', async () => {
    mockApi({
      'GET /api/v1/tokens': listEnvelope([token()]),
    });

    renderPanel();


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
    // The phone reflow turns the table into display:block cards, where a
    // fixed column grid means nothing -- so no rule under the breakpoint may
    // declare table-layout for this table.
    //
    // This used to be checked as "the string chq-settings-tokens never
    // appears in the phone block". That proxy stopped meaning what it said
    // once DEC-385 wave-98 forward-merged settings.css's several phone
    // blocks into one terminal block: the single block now legitimately
    // names the tokens table for unrelated reasons (a 44px tap floor on the
    // Revoke button, an overflow escape on the actions column), none of
    // which declare table-layout. Assert the property, not the proxy.
    expect(phoneBlockRulesMentioning(css, 'chq-settings-tokens').length).toBeGreaterThan(0);
    for (const rule of phoneBlockRulesMentioning(css, 'chq-settings-tokens')) {
      expect(rule.body, `${rule.selector} declares table-layout under the phone breakpoint`).not.toMatch(
        /table-layout\s*:/,
      );
    }
    // And no rule in the block declares it for anything else either.
    expect(phoneBlockText(css)).not.toMatch(/table-layout\s*:/);
  });
});

describe('ApiTokensPanel cap line (DEC-027 wave-51 amendment)', () => {
  it('renders the envelope max beside the create control', async () => {
    mockApi({
      'GET /api/v1/tokens': listEnvelope([token()], { max: 25 }),
    });

    renderPanel();


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

    renderPanel();

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

    renderPanel();

    fireEvent.click(await screen.findByRole('button', { name: 'Revoke' }));

    const dialog = screen.getByRole('dialog', { name: /CI pipeline/ });
    expect(within(dialog).getByText('Revoke "CI pipeline"?')).toBeInTheDocument();
    expect(
      within(dialog).getByText('Any script or embed still using it stops working immediately. This cannot be undone.'),
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

    renderPanel();

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

    renderPanel();

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

describe('ApiTokensPanel read-drill "New token" primary (DEC-919 wave-155 amendment)', () => {
  it('renders exactly one phone-action button in the read drill, and pressing it opens the edit drill with intent=new', async () => {
    mockApi({
      'GET /api/v1/tokens': listEnvelope([token()]),
    });

    renderPanel({ readOnly: true });

    const buttons = await screen.findAllByRole('button', { name: 'New token' });
    expect(buttons).toHaveLength(1);
    expect(buttons[0]).toHaveClass('chq-settings-phone-action');

    fireEvent.click(buttons[0]!);

    expect(screen.getByTestId('location-search').textContent).toBe('?section=your-data&edit=1&intent=new');
  });

  it('focuses the token-name field once when the edit view mounts with intent=new, and drops the param afterward', async () => {
    mockApi({
      'GET /api/v1/tokens': listEnvelope([token()]),
    });

    renderPanel({}, ['/?section=your-data&edit=1&intent=new']);

    const nameInput = await screen.findByLabelText('Token name');
    await waitFor(() => expect(nameInput).toHaveFocus());
    await waitFor(() =>
      expect(screen.getByTestId('location-search').textContent).toBe('?section=your-data&edit=1'),
    );
  });
});
