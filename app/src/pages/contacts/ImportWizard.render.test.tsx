// DEC-663: the import wizard runs a dry-run POST (dryRun: true) before ever
// committing, shows the plan as a Review step (per-row action, overwrites,
// possible duplicates, a "skip this row" checkbox on EVERY row per DEC-858 --
// the column header and the "N rows marked to skip" caption promise it for
// all rows), then commits with the SAME {csvText, mapping} body plus
// `skipLines` from the checked boxes -- and the Done step renders the
// server's post-commit counts verbatim, never the dry run's intent counts.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen, fireEvent, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { ImportWizard } from './ImportWizard';
import { mockApi } from '../../test-utils/mockApi';
import type { ImportPlan, ImportResult } from './types';

const HERE = dirname(fileURLToPath(import.meta.url));
const CSS = readFileSync(join(HERE, 'contacts-panels.css'), 'utf-8');

/** Extracts a top-level (not inside an @media block) rule's declaration
 * body by selector — same helper as ContactsApp.newContact.render.test.tsx. */
function topLevelRuleBody(css: string, selector: string): string {
  const withoutMedia = css.replace(/@media[^{]*\{(?:[^{}]*\{[^{}]*\}[^{}]*)*\}/g, '');
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = withoutMedia.match(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`));
  const body = match?.[1];
  if (body === undefined) throw new Error(`no top-level rule found for ${selector}`);
  return body;
}

afterEach(() => {
  cleanup();
});

const CSV = ['First Name,Last Name,Email,Company', 'John,Doe,john@example.com,Acme', 'Jane,Smith,jane@example.com,Beta'].join(
  '\n',
);

const PLAN: ImportPlan = {
  rows: [
    {
      line: 2,
      email: 'john@example.com',
      action: 'update',
      contactId: 'ct-john',
      overwrites: [{ field: 'company', from: 'OldCo', to: 'Acme' }],
    },
    { line: 3, email: 'jane@example.com', action: 'create' },
  ],
  created: 1,
  updated: 1,
  skipped: 0,
};

const COMMIT_RESULT: ImportResult = {
  created: 1,
  updated: 0,
  skipped: [{ line: 2, reason: 'skipped by organizer' }],
};

async function pasteCsvAndPreview() {
  render(<ImportWizard onClose={() => {}} onImported={() => {}} />);
  fireEvent.change(screen.getByLabelText('Or paste CSV text'), { target: { value: CSV } });
  const preview = await screen.findByRole('button', { name: 'Preview 2 rows' });
  fireEvent.click(preview);
  return preview;
}

// DEC-960: the wizard's dialog chrome (scrim, header, Close control) is now
// ModalFrame's -- Close is the frame's own .chq-modal-close-btn, exercised
// generically by ModalFrame.render.test.tsx. This suite only asserts the
// wizard's own layout survives the switch (.chq-contacts-import still
// establishes the positioning context other rules in this file rely on).
describe('ImportWizard: dialog frame (DEC-960)', () => {
  it('.chq-contacts-import establishes the positioning context', () => {
    const body = topLevelRuleBody(CSS, '.chq-contacts-import');
    expect(body).toMatch(/position:\s*relative/);
  });

  it('renders through the shared ModalFrame as a portal child of document.body', async () => {
    render(<ImportWizard onClose={() => {}} onImported={() => {}} />);
    const dialog = await screen.findByRole('dialog', { name: 'Import contacts' });
    expect(dialog.parentElement).toBe(document.body);
    expect(within(dialog).getByRole('button', { name: 'Close' })).toBeInTheDocument();
  });
});

describe('ImportWizard: DEC-894 shared .chq-file control', () => {
  it('the CSV file input carries the shared chq-file class', () => {
    render(<ImportWizard onClose={() => {}} onImported={() => {}} />);
    const fileInput = screen.getByLabelText('Upload a CSV file') as HTMLInputElement;
    expect(fileInput.type).toBe('file');
    expect(fileInput).toHaveClass('chq-file');
  });
});

describe('ImportWizard: DEC-663 dry-run review step', () => {
  it('step strip reads Choose file / Match columns / Review / Done', async () => {
    mockApi({ 'POST /api/v1/contacts/import': PLAN });
    await pasteCsvAndPreview();
    const steps = await screen.findAllByRole('listitem');
    expect(steps.map((li) => li.textContent)).toEqual(['Choose file', 'Match columns', 'Review', 'Done']);
  });

  it('posts dryRun:true on Preview and renders per-row action, overwrites, and a skip checkbox on every row', async () => {
    const fetchMock = mockApi({ 'POST /api/v1/contacts/import': PLAN });
    await pasteCsvAndPreview();

    await screen.findByText('Review before import');

    const postCall = fetchMock.mock.calls.find(([input]) => (typeof input === 'string' ? input : input.toString()).includes('/contacts/import'));
    expect(postCall).toBeDefined();
    const body = JSON.parse((postCall![1]?.body as string) ?? '{}');
    expect(body.dryRun).toBe(true);
    expect(body.csvText).toContain('john@example.com');

    const rows = screen.getAllByRole('row');
    // rows[0] is the header row.
    const johnRow = rows.find((r) => within(r).queryByText('john@example.com'));
    const janeRow = rows.find((r) => within(r).queryByText('jane@example.com'));
    expect(johnRow).toBeDefined();
    expect(janeRow).toBeDefined();

    expect(within(johnRow!).getByText(/Update/)).toBeInTheDocument();
    expect(within(johnRow!).getByText('company: "OldCo" → "Acme"')).toBeInTheDocument();
    expect(within(johnRow!).getByRole('checkbox', { name: 'Skip line 2' })).not.toBeChecked();

    expect(within(janeRow!).getByText('Create')).toBeInTheDocument();
    // DEC-858: skipping is possible on every row, including a plain create
    // with no overwrites/duplicates to decorate it.
    expect(within(janeRow!).getByRole('checkbox', { name: 'Skip line 3' })).toBeInTheDocument();
  });

  it('DEC-858: a plan whose rows are all plain creates still renders one skip checkbox per row, and ticking one drops the primary button\'s count', async () => {
    const plainPlan: ImportPlan = {
      rows: [
        { line: 2, email: 'john@example.com', action: 'create' },
        { line: 3, email: 'jane@example.com', action: 'create' },
      ],
      created: 2,
      updated: 0,
      skipped: 0,
    };
    mockApi({ 'POST /api/v1/contacts/import': plainPlan });
    await pasteCsvAndPreview();
    await screen.findByText('Review before import');

    expect(screen.getByRole('checkbox', { name: 'Skip line 2' })).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Skip line 3' })).toBeInTheDocument();

    expect(screen.getByRole('button', { name: 'Import 2 rows' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Skip line 2' }));
    expect(screen.getByRole('button', { name: 'Import 1 row' })).toBeInTheDocument();
  });

  it('renders a possibleDuplicate as a plain-language line naming the contact and its different email', async () => {
    const dupPlan: ImportPlan = {
      rows: [
        {
          line: 2,
          email: 'john@example.com',
          action: 'create',
          possibleDuplicates: [{ contactId: 'ct-old', name: 'Jon Doe', email: 'jon.doe@old.example.com', company: 'Acme' }],
        },
      ],
      created: 1,
      updated: 0,
      skipped: 0,
    };
    mockApi({ 'POST /api/v1/contacts/import': dupPlan });
    render(<ImportWizard onClose={() => {}} onImported={() => {}} />);
    fireEvent.change(screen.getByLabelText('Or paste CSV text'), { target: { value: CSV } });
    fireEvent.click(await screen.findByRole('button', { name: 'Preview 2 rows' }));

    await screen.findByText('Review before import');
    expect(screen.getByText(/Jon Doe \(jon\.doe@old\.example\.com\)/)).toBeInTheDocument();
    expect(screen.getByText(/different email address/)).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Skip line 2' })).toBeInTheDocument();
  });

  it('checking "skip this row" and committing posts the SAME body plus skipLines, and Done renders the post-commit counts verbatim', async () => {
    let calls = 0;
    const fetchMock = mockApi({
      'POST /api/v1/contacts/import': () => {
        calls += 1;
        return calls === 1 ? PLAN : COMMIT_RESULT;
      },
    });

    let imported = false;
    render(<ImportWizard onClose={() => {}} onImported={() => (imported = true)} />);
    fireEvent.change(screen.getByLabelText('Or paste CSV text'), { target: { value: CSV } });
    fireEvent.click(await screen.findByRole('button', { name: 'Preview 2 rows' }));
    await screen.findByText('Review before import');

    fireEvent.click(screen.getByRole('checkbox', { name: 'Skip line 2' }));
    const commitBtn = await screen.findByRole('button', { name: 'Import 1 row' });
    fireEvent.click(commitBtn);

    await screen.findByText('Import complete');
    expect(imported).toBe(true);

    // Two POSTs to the same route: the dry run, then the commit.
    const postCalls = fetchMock.mock.calls.filter(([input]) => (typeof input === 'string' ? input : input.toString()).includes('/contacts/import'));
    expect(postCalls).toHaveLength(2);
    const commitBody = JSON.parse((postCalls[1]![1]?.body as string) ?? '{}');
    expect(commitBody.dryRun).toBeUndefined();
    expect(commitBody.skipLines).toEqual([2]);
    expect(commitBody.csvText).toContain('john@example.com');

    // Post-commit truth (1 created, 0 updated, 1 skipped), never the dry
    // run's intent counts (1 created, 1 updated, 0 skipped).
    expect(screen.getByText('Created 1, updated 0, skipped 1.')).toBeInTheDocument();
    expect(screen.getByText('Line 2: skipped by organizer')).toBeInTheDocument();
  });
});

// DEC-810: when the import is scoped to an event, the wizard collects a
// required session title for the batch (in the same step the event is
// already chosen), never lets the server invent an 'Invited: <name>' title.
describe('ImportWizard: DEC-810 session title required when scoped to an event', () => {
  it('shows no session title field when eventId is absent', async () => {
    render(<ImportWizard onClose={() => {}} onImported={() => {}} />);
    fireEvent.change(screen.getByLabelText('Or paste CSV text'), { target: { value: CSV } });
    await screen.findByRole('button', { name: 'Preview 2 rows' });
    expect(screen.queryByLabelText('Session title for this batch')).not.toBeInTheDocument();
  });

  it('disables Preview until a session title is entered, then sends it as sessionTitle', async () => {
    const fetchMock = mockApi({ 'POST /api/v1/contacts/import': PLAN });
    render(<ImportWizard onClose={() => {}} onImported={() => {}} eventId="ev-1" />);
    fireEvent.change(screen.getByLabelText('Or paste CSV text'), { target: { value: CSV } });

    const preview = await screen.findByRole('button', { name: 'Preview 2 rows' });
    expect(preview).toBeDisabled();

    const titleInput = screen.getByLabelText('Session title for this batch');
    fireEvent.change(titleInput, { target: { value: 'Lightning talks' } });
    expect(preview).not.toBeDisabled();

    fireEvent.click(preview);
    await screen.findByText('Review before import');

    const postCall = fetchMock.mock.calls.find(([input]) =>
      (typeof input === 'string' ? input : input.toString()).includes('/contacts/import'),
    );
    const body = JSON.parse((postCall![1]?.body as string) ?? '{}');
    expect(body.eventId).toBe('ev-1');
    expect(body.sessionTitle).toBe('Lightning talks');
  });

  // w40-h: the disabled Preview button previously gave no reason -- names
  // the blocker inline, and the sentence disappears the moment the field
  // that unblocks it is filled.
  it('names the blocker beside the disabled Preview button, and the sentence disappears once a title is entered', async () => {
    render(<ImportWizard onClose={() => {}} onImported={() => {}} eventId="ev-1" />);
    fireEvent.change(screen.getByLabelText('Or paste CSV text'), { target: { value: CSV } });

    const preview = await screen.findByRole('button', { name: 'Preview 2 rows' });
    expect(preview).toBeDisabled();
    expect(screen.getByText('Add a session title for this batch to preview')).toBeInTheDocument();

    const titleInput = screen.getByLabelText('Session title for this batch');
    fireEvent.change(titleInput, { target: { value: 'Lightning talks' } });

    expect(preview).not.toBeDisabled();
    expect(screen.queryByText('Add a session title for this batch to preview')).not.toBeInTheDocument();
  });
});
