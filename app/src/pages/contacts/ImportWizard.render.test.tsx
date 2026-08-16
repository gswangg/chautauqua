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
import { MAX_IMPORT_ROWS, MAX_IMPORT_CSV_BYTES } from '../../../../src/domain/contacts';
import { formatBytes } from '../../../../src/domain/files';

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
  const preview = await screen.findByRole('button', { name: 'Import 2 rows' });
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

    // B5: the heading names the two counts the dedupe outcome earns.
    await screen.findByText('1 new · 1 updated');

    const postCall = fetchMock.mock.calls.find(([input]) => (typeof input === 'string' ? input : input.toString()).includes('/contacts/import'));
    expect(postCall).toBeDefined();
    const body = JSON.parse((postCall![1]?.body as string) ?? '{}');
    expect(body.dryRun).toBe(true);
    expect(body.csvText).toContain('john@example.com');

    // w49-f: john (update) is a "losing" row and visible by default; jane
    // (plain create) is not -- reveal it via the disclosure before
    // asserting DEC-858's every-row-skippable guarantee.
    let rows = screen.getAllByRole('row');
    const johnRow = rows.find((r) => within(r).queryByText('john@example.com'));
    expect(johnRow).toBeDefined();
    expect(screen.queryByText('jane@example.com')).not.toBeInTheDocument();

    expect(within(johnRow!).getByText(/Update/)).toBeInTheDocument();
    expect(within(johnRow!).getByText('OldCo')).toBeInTheDocument();
    expect(within(johnRow!).getByText('OldCo').tagName).toBe('S');
    expect(within(johnRow!).getByText('Acme', { selector: '.chq-contacts-import-overwrite-new' })).toBeInTheDocument();
    expect(within(johnRow!).getByRole('checkbox', { name: 'Skip line 2' })).not.toBeChecked();

    fireEvent.click(screen.getByRole('button', { name: 'Show all 2 rows' }));
    rows = screen.getAllByRole('row');
    const janeRow = rows.find((r) => within(r).queryByText('jane@example.com'));
    expect(janeRow).toBeDefined();
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
    await screen.findByText('2 new · 0 updated');

    // w49-f: both rows are plain creates -- neither is a "losing" row, so
    // both start behind the disclosure.
    fireEvent.click(screen.getByRole('button', { name: 'Show all 2 rows' }));

    expect(screen.getByRole('checkbox', { name: 'Skip line 2' })).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Skip line 3' })).toBeInTheDocument();

    expect(screen.getByRole('button', { name: 'Import 2 rows' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Skip line 2' }));
    expect(screen.getByRole('button', { name: 'Import 1 row' })).toBeInTheDocument();
  });

  it('renders a possibleDuplicate as a radio group naming the candidate\'s real name and email', async () => {
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
    fireEvent.click(await screen.findByRole('button', { name: 'Import 2 rows' }));

    await screen.findByText('1 new · 0 updated');
    // The bug this closes: the duplicate's real NAME must be visible, not
    // blank.
    expect(screen.getByText(/Merge into Jon Doe \(jon\.doe@old\.example\.com\)/)).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Import as new' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Skip line 2' })).toBeInTheDocument();
  });

  // DEC-663 amendment (wave 61): an update row from a same-file email
  // collapse carries a `reason` (no `contactId`) that Review must state
  // inline, reusing the existing overwrite/duplicate detail list rather
  // than a new column.
  it('renders a same-file-collapse update row\'s reason in the review detail list', async () => {
    const collapsePlan: ImportPlan = {
      rows: [
        { line: 2, email: 'jane@example.com', action: 'create' },
        {
          line: 3,
          email: 'jane@example.com',
          action: 'update',
          reason: 'same email as an earlier row in this file',
        },
      ],
      created: 1,
      updated: 1,
      skipped: 0,
    };
    mockApi({ 'POST /api/v1/contacts/import': collapsePlan });
    await pasteCsvAndPreview();
    await screen.findByText('1 new · 1 updated');

    const rows = screen.getAllByRole('row');
    const secondRow = rows.find((r) => within(r).queryByText('same email as an earlier row in this file'));
    expect(secondRow).toBeDefined();
    expect(within(secondRow!).getByText(/Update/)).toBeInTheDocument();
    expect(within(secondRow!).getByText('same email as an earlier row in this file')).toBeInTheDocument();
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
    fireEvent.click(await screen.findByRole('button', { name: 'Import 2 rows' }));
    await screen.findByText('1 new · 1 updated');

    fireEvent.click(screen.getByRole('checkbox', { name: 'Skip line 2' }));
    const commitBtn = await screen.findByRole('button', { name: 'Import 1 row' });
    fireEvent.click(commitBtn);

    // w15-c: the step title and the Done step's own heading are now both
    // "Import complete" -- assert there are two, rather than a single
    // unique match.
    await screen.findAllByText('Import complete');
    expect(screen.getAllByText('Import complete')).toHaveLength(2);
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

// DEC-663 (wave-64 amendment): the third possible-duplicate disposition --
// 'Import as new' (default) or 'Merge into <name> (<email>)' per candidate,
// mutually exclusive with the row's own Skip checkbox.
describe('ImportWizard: DEC-663 wave-64 amendment -- possible-duplicate merge disposition', () => {
  const MULTI_DUP_PLAN: ImportPlan = {
    rows: [
      {
        line: 2,
        email: 'john@example.com',
        action: 'create',
        possibleDuplicates: [
          { contactId: 'ct-old-1', name: 'Jon Doe', email: 'jon.doe@old.example.com', company: 'Acme' },
          { contactId: 'ct-old-2', name: 'Johnny Doe', email: 'johnny@other.example.com', company: null },
        ],
        possibleDuplicatesMore: 3,
      },
    ],
    created: 1,
    updated: 0,
    skipped: 0,
  };

  it('renders one merge radio option per candidate, plus Import as new, and the honest overflow sentence', async () => {
    mockApi({ 'POST /api/v1/contacts/import': MULTI_DUP_PLAN });
    await pasteCsvAndPreview();
    await screen.findByText('1 new · 0 updated');

    expect(screen.getByRole('radio', { name: 'Import as new' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Merge into Jon Doe (jon.doe@old.example.com)' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Merge into Johnny Doe (johnny@other.example.com)' })).toBeInTheDocument();
    expect(screen.getByText(/3 more possible matches not shown/)).toBeInTheDocument();
    expect(screen.getByText(/Duplicates view/)).toBeInTheDocument();
  });

  it('selecting a merge option clears the Skip checkbox, and checking Skip clears the merge selection', async () => {
    mockApi({ 'POST /api/v1/contacts/import': MULTI_DUP_PLAN });
    await pasteCsvAndPreview();
    await screen.findByText('1 new · 0 updated');

    const skipBox = screen.getByRole('checkbox', { name: 'Skip line 2' });
    const importAsNew = screen.getByRole('radio', { name: 'Import as new' });
    const mergeOption = screen.getByRole('radio', { name: 'Merge into Jon Doe (jon.doe@old.example.com)' });

    // Check Skip first, then select a merge option -- Skip must clear.
    fireEvent.click(skipBox);
    expect(skipBox).toBeChecked();
    fireEvent.click(mergeOption);
    expect(mergeOption).toBeChecked();
    expect(importAsNew).not.toBeChecked();
    expect(skipBox).not.toBeChecked();

    // Now check Skip again -- the merge selection must clear back to
    // 'Import as new'.
    fireEvent.click(skipBox);
    expect(skipBox).toBeChecked();
    expect(importAsNew).toBeChecked();
    expect(mergeOption).not.toBeChecked();
  });

  it('the applied request body carries mergeLines for a selected merge, and commits normally', async () => {
    let calls = 0;
    const fetchMock = mockApi({
      'POST /api/v1/contacts/import': () => {
        calls += 1;
        return calls === 1 ? MULTI_DUP_PLAN : { created: 0, updated: 1, skipped: [] };
      },
    });

    await pasteCsvAndPreview();
    await screen.findByText('1 new · 0 updated');

    fireEvent.click(screen.getByRole('radio', { name: 'Merge into Jon Doe (jon.doe@old.example.com)' }));
    const commitBtn = await screen.findByRole('button', { name: 'Import 1 row' });
    fireEvent.click(commitBtn);

    await screen.findAllByText('Import complete');

    const postCalls = fetchMock.mock.calls.filter(([input]) =>
      (typeof input === 'string' ? input : input.toString()).includes('/contacts/import'),
    );
    expect(postCalls).toHaveLength(2);
    const commitBody = JSON.parse((postCalls[1]![1]?.body as string) ?? '{}');
    expect(commitBody.mergeLines).toEqual([{ line: 2, contactId: 'ct-old-1' }]);
    expect(commitBody.skipLines).toEqual([]);
  });
});

// B5 (DEC-663 amendment, w27-i): the review step says what the dedupe
// outcome earns (two counts, not a generic heading), orders UPDATE rows --
// the only rows where something is lost -- first, shows each overwrite as
// struck-old/plain-new rather than a quoted sentence, and names the
// irreversibility of the commit immediately above the button that fires it.
describe('ImportWizard: B5 review step (DEC-663 amendment)', () => {
  const MIXED_PLAN: ImportPlan = {
    rows: [
      { line: 2, email: 'jane@example.com', action: 'create' },
      {
        line: 3,
        email: 'john@example.com',
        action: 'update',
        contactId: 'ct-john',
        overwrites: [
          { field: 'company', from: 'OldCo', to: 'Acme' },
          { field: 'title', from: 'Engineer', to: 'Staff Engineer' },
        ],
      },
    ],
    created: 205,
    updated: 9,
    skipped: 0,
  };

  it('the heading renders both counts for a mixed plan', async () => {
    mockApi({ 'POST /api/v1/contacts/import': MIXED_PLAN });
    await pasteCsvAndPreview();
    expect(await screen.findByText('205 new · 9 updated')).toBeInTheDocument();
  });

  it('a row with two overwrites renders both old values struck and both new values plain', async () => {
    mockApi({ 'POST /api/v1/contacts/import': MIXED_PLAN });
    await pasteCsvAndPreview();
    await screen.findByText('205 new · 9 updated');

    const rows = screen.getAllByRole('row');
    const johnRow = rows.find((r) => within(r).queryByText('john@example.com'));
    expect(johnRow).toBeDefined();

    const oldValues = within(johnRow!).getAllByText(/OldCo|Engineer$/, { selector: '.chq-contacts-import-overwrite-old' });
    expect(oldValues.map((el) => el.textContent)).toEqual(['OldCo', 'Engineer']);
    oldValues.forEach((el) => expect(el.tagName).toBe('S'));

    const newValues = within(johnRow!).getAllByText(/Acme|Staff Engineer/, { selector: '.chq-contacts-import-overwrite-new' });
    expect(newValues.map((el) => el.textContent)).toEqual(['Acme', 'Staff Engineer']);
  });

  it('update rows precede create rows in document order', async () => {
    mockApi({ 'POST /api/v1/contacts/import': MIXED_PLAN });
    await pasteCsvAndPreview();
    await screen.findByText('205 new · 9 updated');

    // w49-f: jane (plain create) starts behind the disclosure; open it to
    // see both rows in document order.
    fireEvent.click(screen.getByRole('button', { name: 'Show all 2 rows' }));

    const rows = screen.getAllByRole('row');
    // rows[0] is the header row; the plan lists the create row (jane) before
    // the update row (john), but the table must render update first.
    const emails = rows.slice(1).map((r) => (within(r).queryByText('john@example.com') ? 'john' : 'jane'));
    expect(emails).toEqual(['john', 'jane']);
  });

  it('the irreversibility line renders once, above the commit control', async () => {
    mockApi({ 'POST /api/v1/contacts/import': MIXED_PLAN });
    await pasteCsvAndPreview();
    await screen.findByText('205 new · 9 updated');

    const lines = screen.getAllByText('A bulk import cannot be undone.');
    expect(lines).toHaveLength(1);
    const line = lines[0]!;

    const commitBtn = screen.getByRole('button', { name: /Import \d+ rows?/ });
    // DOCUMENT_POSITION_FOLLOWING means the irreversibility line comes
    // before the commit button in document order.
    // eslint-disable-next-line no-bitwise
    expect(line.compareDocumentPosition(commitBtn) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});

// DEC-810: when the import is scoped to an event, the wizard collects a
// required session title for the batch (in the same step the event is
// already chosen), never lets the server invent an 'Invited: <name>' title.
describe('ImportWizard: DEC-810 session title required when scoped to an event', () => {
  it('shows no session title field when eventId is absent', async () => {
    render(<ImportWizard onClose={() => {}} onImported={() => {}} />);
    fireEvent.change(screen.getByLabelText('Or paste CSV text'), { target: { value: CSV } });
    await screen.findByRole('button', { name: 'Import 2 rows' });
    expect(screen.queryByLabelText('Session title for this batch')).not.toBeInTheDocument();
  });

  it('disables Preview until a session title is entered, then sends it as sessionTitle', async () => {
    const fetchMock = mockApi({ 'POST /api/v1/contacts/import': PLAN });
    render(<ImportWizard onClose={() => {}} onImported={() => {}} eventId="ev-1" />);
    fireEvent.change(screen.getByLabelText('Or paste CSV text'), { target: { value: CSV } });

    const preview = await screen.findByRole('button', { name: 'Import 2 rows' });
    // DEC-290: the eventId is a candidate, not an instruction -- the
    // session-title requirement only kicks in once the opt-in is ticked.
    fireEvent.click(screen.getByLabelText('Also add these people to this event as accepted speakers'));
    expect(preview).toBeDisabled();

    const titleInput = screen.getByLabelText('Session title for this batch');
    fireEvent.change(titleInput, { target: { value: 'Lightning talks' } });
    expect(preview).not.toBeDisabled();

    fireEvent.click(preview);
    await screen.findByText('1 new · 1 updated');

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

    const preview = await screen.findByRole('button', { name: 'Import 2 rows' });
    fireEvent.click(screen.getByLabelText('Also add these people to this event as accepted speakers'));
    expect(preview).toBeDisabled();
    expect(screen.getByText('Add a session title for this batch to preview')).toBeInTheDocument();

    const titleInput = screen.getByLabelText('Session title for this batch');
    fireEvent.change(titleInput, { target: { value: 'Lightning talks' } });

    expect(preview).not.toBeDisabled();
    expect(screen.queryByText('Add a session title for this batch to preview')).not.toBeInTheDocument();
  });

  // DEC-290 (wave-59 amendment): a supplied eventId is a CANDIDATE, not an
  // instruction -- with the attach-to-event opt-in left unticked, the
  // import writes contacts only: no eventId, no sessionTitle, and the
  // primary is enabled with an empty title.
  it('with an eventId supplied and the attach-to-event box unticked, the dry-run body carries neither eventId nor sessionTitle, and the primary is enabled', async () => {
    const fetchMock = mockApi({ 'POST /api/v1/contacts/import': PLAN });
    render(<ImportWizard onClose={() => {}} onImported={() => {}} eventId="ev-1" />);
    fireEvent.change(screen.getByLabelText('Or paste CSV text'), { target: { value: CSV } });

    const preview = await screen.findByRole('button', { name: 'Import 2 rows' });
    expect(preview).not.toBeDisabled();
    expect(screen.queryByLabelText('Session title for this batch')).not.toBeInTheDocument();

    fireEvent.click(preview);
    await screen.findByText('1 new · 1 updated');

    const postCall = fetchMock.mock.calls.find(([input]) =>
      (typeof input === 'string' ? input : input.toString()).includes('/contacts/import'),
    );
    const body = JSON.parse((postCall![1]?.body as string) ?? '{}');
    expect(body).not.toHaveProperty('eventId');
    expect(body).not.toHaveProperty('sessionTitle');
  });
});

// w1-i (DEC-663, frame 08--03): step 2 ("Match columns") is a real screen --
// once a header row is parsed, step 1's file/paste controls unmount, and
// the screen becomes one block per CSV column (header above a sample value,
// target select beneath) plus a dedupe footer and the primary carrying the
// row count.
describe('ImportWizard: w1-i step 2 "Match columns" screen', () => {
  it('unmounts step 1\'s file/paste controls once a header row is parsed', async () => {
    render(<ImportWizard onClose={() => {}} onImported={() => {}} />);
    // Step 1: file/paste controls present, no column blocks yet.
    expect(screen.getByLabelText('Upload a CSV file')).toBeInTheDocument();
    expect(screen.getByLabelText('Or paste CSV text')).toBeInTheDocument();
    expect(screen.queryByLabelText('Map column Email')).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Or paste CSV text'), { target: { value: CSV } });

    // Step 2: column blocks appear, and step 1's controls are gone.
    await screen.findByLabelText('Map column Email');
    expect(screen.queryByLabelText('Upload a CSV file')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Or paste CSV text')).not.toBeInTheDocument();
  });

  it('pairs each column\'s header with a sample value from the file, above its target select', async () => {
    render(<ImportWizard onClose={() => {}} onImported={() => {}} />);
    fireEvent.change(screen.getByLabelText('Or paste CSV text'), { target: { value: CSV } });

    const emailSelect = await screen.findByLabelText('Map column Email');
    const emailBlock = emailSelect.closest('.chq-contacts-import-column-block');
    expect(emailBlock).not.toBeNull();
    expect(within(emailBlock as HTMLElement).getByText('Email')).toBeInTheDocument();
    expect(within(emailBlock as HTMLElement).getByText('john@example.com')).toBeInTheDocument();
    expect(within(emailBlock as HTMLElement).getByRole('button', { name: 'Skip this column' })).toBeInTheDocument();

    const companySelect = screen.getByLabelText('Map column Company');
    const companyBlock = companySelect.closest('.chq-contacts-import-column-block');
    expect(within(companyBlock as HTMLElement).getByText('Company')).toBeInTheDocument();
    expect(within(companyBlock as HTMLElement).getByText('Acme')).toBeInTheDocument();
  });

  it('the "skip this column" affordance clears that column\'s mapping', async () => {
    render(<ImportWizard onClose={() => {}} onImported={() => {}} />);
    fireEvent.change(screen.getByLabelText('Or paste CSV text'), { target: { value: CSV } });

    const emailSelect = (await screen.findByLabelText('Map column Email')) as HTMLSelectElement;
    expect(emailSelect.value).toBe('email');

    const emailBlock = emailSelect.closest('.chq-contacts-import-column-block') as HTMLElement;
    fireEvent.click(within(emailBlock).getByRole('button', { name: 'Skip this column' }));

    expect(emailSelect.value).toBe('');
  });

  it('the primary\'s label carries the row count on step 2', async () => {
    render(<ImportWizard onClose={() => {}} onImported={() => {}} />);
    fireEvent.change(screen.getByLabelText('Or paste CSV text'), { target: { value: CSV } });
    await screen.findByLabelText('Map column Email');

    expect(screen.getByRole('button', { name: 'Import 2 rows' })).toBeInTheDocument();
  });
});

// w15-c: the dialog title now names the current step, with "Import
// contacts from CSV" moved down to the ModalFrame subtitle; the frame
// itself widens to 640px (.is-wide) for the two-column match screen.
describe('ImportWizard: w15-c step-named title + wide frame', () => {
  it('step 1 renders the "Choose a file" title, the subtitle, and no session-title field', async () => {
    render(<ImportWizard onClose={() => {}} onImported={() => {}} eventId="ev-1" />);
    expect(screen.getByText('Choose a file')).toBeInTheDocument();
    expect(screen.getByText('Import contacts from CSV')).toBeInTheDocument();
    expect(screen.queryByLabelText('Session title for this batch')).not.toBeInTheDocument();
  });

  it('step 2 renders the "Match the columns" title and the session-title field once the attach-to-event opt-in is ticked', async () => {
    render(<ImportWizard onClose={() => {}} onImported={() => {}} eventId="ev-1" />);
    fireEvent.change(screen.getByLabelText('Or paste CSV text'), { target: { value: CSV } });

    await screen.findByLabelText('Map column Email');
    expect(screen.getByText('Match the columns')).toBeInTheDocument();
    expect(screen.queryByLabelText('Session title for this batch')).not.toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('Also add these people to this event as accepted speakers'));
    expect(screen.getByLabelText('Session title for this batch')).toBeInTheDocument();
  });

  it('the modal element carries is-wide', async () => {
    render(<ImportWizard onClose={() => {}} onImported={() => {}} />);
    const dialog = await screen.findByRole('dialog', { name: 'Import contacts' });
    const modal = dialog.querySelector('.chq-modal');
    expect(modal).not.toBeNull();
    expect(modal).toHaveClass('is-wide');
  });

  it('the columns grid uses minmax(0, 1fr) tracks so a long option can\'t force overflow', () => {
    const body = topLevelRuleBody(CSS, '.chq-contacts-import-columns');
    expect(body).toMatch(/grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/);
  });
});

// DEC-478 (amendment, wave 62): the row/byte caps are disclosed where the
// file is chosen (step 1's caption), and enforced BEFORE the match-columns
// step -- never only as the 400 the server would return after every column
// has already been mapped.
function csvWithDataRows(n: number): string {
  const header = 'First Name,Last Name,Email';
  const rows = Array.from({ length: n }, (_, i) => `First${i},Last${i},user${i}@example.com`);
  return [header, ...rows].join('\n');
}

describe('ImportWizard: DEC-478 amendment -- import caps disclosed at choose-file, enforced before match-columns', () => {
  it('the choose-file step names both caps, sourced from the imported constants', () => {
    render(<ImportWizard onClose={() => {}} onImported={() => {}} />);
    // Text is split across JSX expression nodes -- assert against the
    // caption element's flattened textContent rather than a single node.
    const caption = document.querySelector('.chq-contacts-import-drop .chq-contacts-pipeline-caption');
    expect(caption).not.toBeNull();
    expect(caption!.textContent).toBe(`Up to ${MAX_IMPORT_ROWS} rows · ${formatBytes(MAX_IMPORT_CSV_BYTES)} max`);
  });

  it('a file over MAX_IMPORT_ROWS is refused before the match-columns step, with the overage counted', async () => {
    render(<ImportWizard onClose={() => {}} onImported={() => {}} />);
    const overage = 143;
    fireEvent.change(screen.getByLabelText('Or paste CSV text'), {
      target: { value: csvWithDataRows(MAX_IMPORT_ROWS + overage) },
    });

    const heading = await screen.findByText(
      `${MAX_IMPORT_ROWS + overage} rows — ${overage} over the ${MAX_IMPORT_ROWS}-row limit`,
    );
    expect(heading).toBeInTheDocument();
    expect(screen.getByText('Split the file and import each part.')).toBeInTheDocument();

    // Never advances to the match-columns step.
    expect(screen.queryByLabelText('Map column Email')).not.toBeInTheDocument();

    // The file stays addressable -- an explicit action clears it, never a
    // silent reset.
    const resetBtn = screen.getByRole('button', { name: 'Choose a different file' });
    fireEvent.click(resetBtn);
    expect((screen.getByLabelText('Or paste CSV text') as HTMLTextAreaElement).value).toBe('');
  });

  it('a paste over MAX_IMPORT_CSV_BYTES is refused the same way, with the byte overage counted', async () => {
    render(<ImportWizard onClose={() => {}} onImported={() => {}} />);
    const bigField = 'x'.repeat(MAX_IMPORT_CSV_BYTES + 1000);
    const oversizeCsv = `First Name,Last Name,Email,Company\nJohn,Doe,john@example.com,${bigField}`;
    fireEvent.change(screen.getByLabelText('Or paste CSV text'), { target: { value: oversizeCsv } });

    await screen.findByText('Split the file and import each part.');
    const byteLength = new TextEncoder().encode(oversizeCsv).length;
    expect(
      screen.getByText(
        `${formatBytes(byteLength)} — ${formatBytes(byteLength - MAX_IMPORT_CSV_BYTES)} over the ${formatBytes(MAX_IMPORT_CSV_BYTES)} limit`,
      ),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText('Map column Email')).not.toBeInTheDocument();
  });

  it('a file at exactly MAX_IMPORT_ROWS proceeds to the match-columns step', async () => {
    render(<ImportWizard onClose={() => {}} onImported={() => {}} />);
    fireEvent.change(screen.getByLabelText('Or paste CSV text'), {
      target: { value: csvWithDataRows(MAX_IMPORT_ROWS) },
    });
    expect(await screen.findByLabelText('Map column Email')).toBeInTheDocument();
    expect(screen.queryByText('Split the file and import each part.')).not.toBeInTheDocument();
  });
});
