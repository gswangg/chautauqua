// w49-f (DEC-663 amendment): the match-step dedupe footer says only what it
// measured -- rows repeating an earlier row's email WITHIN THIS FILE, not a
// query against existing contacts -- and stays silent at zero. The
// existing-contacts claim moves to the Review step, sourced from the dry
// run's own plan.updated. And the Review table shows only the "losing" rows
// (update / overwrite / possible duplicate) by default, with the rest behind
// a "Show all N rows" disclosure that keeps every row skippable once opened.
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen, fireEvent, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { ImportWizard } from './ImportWizard';
import { mockApi } from '../../test-utils/mockApi';
import type { ImportPlan } from './types';

afterEach(() => {
  cleanup();
});

async function pasteCsv(csv: string) {
  render(<ImportWizard onClose={() => {}} onImported={() => {}} />);
  fireEvent.change(screen.getByLabelText('Or paste CSV text'), { target: { value: csv } });
}

describe('ImportWizard w49-f: match-step dedupe footer names an in-file repeat, and is silent at zero', () => {
  it('names the in-file repeat when two rows in the file share an email', async () => {
    const csv = [
      'First Name,Last Name,Email,Company',
      'John,Doe,john@example.com,Acme',
      'John,Doe,john@example.com,Acme',
    ].join('\n');
    await pasteCsv(csv);
    await screen.findByLabelText('Map column Email');

    expect(screen.getByText('Same-file email repeat: 1 row · the later row wins')).toBeInTheDocument();
    // Must never claim it queried existing contacts.
    expect(screen.queryByText(/match existing contacts/)).not.toBeInTheDocument();
  });

  it('renders nothing when no row repeats another row\'s email in this file', async () => {
    const csv = [
      'First Name,Last Name,Email,Company',
      'John,Doe,john@example.com,Acme',
      'Jane,Smith,jane@example.com,Beta',
    ].join('\n');
    await pasteCsv(csv);
    await screen.findByLabelText('Map column Email');

    expect(screen.queryByText(/Same-file email repeat/)).not.toBeInTheDocument();
    expect(screen.queryByText(/match existing contacts/)).not.toBeInTheDocument();
  });
});

describe('ImportWizard w49-f: review heading carries the dry run\'s updated count', () => {
  const CSV = ['First Name,Last Name,Email,Company', 'John,Doe,john@example.com,Acme', 'Jane,Smith,jane@example.com,Beta'].join(
    '\n',
  );

  it('states the existing-contacts claim on the review step, sourced from plan.updated', async () => {
    const plan: ImportPlan = {
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
    mockApi({ 'POST /api/v1/contacts/import': plan });
    await pasteCsv(CSV);
    fireEvent.click(await screen.findByRole('button', { name: 'Import 2 rows' }));

    await screen.findByText('1 new · 1 updated');
    expect(screen.getByText('1 row matched an existing contact by email · they will be updated')).toBeInTheDocument();
  });

  it('omits the existing-contacts clause when plan.updated is zero', async () => {
    const plan: ImportPlan = {
      rows: [{ line: 2, email: 'john@example.com', action: 'create' }],
      created: 1,
      updated: 0,
      skipped: 0,
    };
    mockApi({ 'POST /api/v1/contacts/import': plan });
    await pasteCsv(CSV);
    fireEvent.click(await screen.findByRole('button', { name: 'Import 2 rows' }));

    await screen.findByText('1 new · 0 updated');
    expect(screen.queryByText(/matched an existing contact/)).not.toBeInTheDocument();
  });
});

describe('ImportWizard w49-f: review table shows only the losing rows by default', () => {
  const CSV = [
    'First Name,Last Name,Email,Company',
    'John,Doe,john@example.com,Acme',
    'Jane,Smith,jane@example.com,Beta',
    'Amy,Wu,amy@example.com,Gamma',
  ].join('\n');

  const MIXED_PLAN: ImportPlan = {
    rows: [
      { line: 2, email: 'john@example.com', action: 'create' },
      {
        line: 3,
        email: 'jane@example.com',
        action: 'update',
        contactId: 'ct-jane',
        overwrites: [{ field: 'company', from: 'OldCo', to: 'Beta' }],
      },
      { line: 4, email: 'amy@example.com', action: 'create' },
    ],
    created: 2,
    updated: 1,
    skipped: 0,
  };

  async function previewMixedPlan() {
    mockApi({ 'POST /api/v1/contacts/import': MIXED_PLAN });
    await pasteCsv(CSV);
    fireEvent.click(await screen.findByRole('button', { name: 'Import 3 rows' }));
    await screen.findByText('2 new · 1 updated');
  }

  it('renders only the update row, hides the plain creates, and captions the created count', async () => {
    await previewMixedPlan();

    expect(screen.getByText('jane@example.com')).toBeInTheDocument();
    expect(screen.queryByText('john@example.com')).not.toBeInTheDocument();
    expect(screen.queryByText('amy@example.com')).not.toBeInTheDocument();

    expect(screen.getByRole('button', { name: 'Show all 3 rows' })).toBeInTheDocument();
    expect(screen.getByText('2 new contacts not shown here — nothing to review')).toBeInTheDocument();
  });

  it('the existing per-row Skip checkbox and field diffs survive on the visible losing row', async () => {
    await previewMixedPlan();

    const janeRow = screen.getAllByRole('row').find((r) => within(r).queryByText('jane@example.com'));
    expect(janeRow).toBeDefined();
    expect(within(janeRow!).getByRole('checkbox', { name: 'Skip line 3' })).toBeInTheDocument();
    expect(within(janeRow!).getByText('OldCo')).toBeInTheDocument();
    expect(within(janeRow!).getByText('Beta', { selector: '.chq-contacts-import-overwrite-new' })).toBeInTheDocument();
  });

  it('opening "Show all N rows" reveals every row, each still skippable, and removes the disclosure', async () => {
    await previewMixedPlan();

    fireEvent.click(screen.getByRole('button', { name: 'Show all 3 rows' }));

    expect(screen.getByText('john@example.com')).toBeInTheDocument();
    expect(screen.getByText('jane@example.com')).toBeInTheDocument();
    expect(screen.getByText('amy@example.com')).toBeInTheDocument();

    expect(screen.getByRole('checkbox', { name: 'Skip line 2' })).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Skip line 3' })).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Skip line 4' })).toBeInTheDocument();

    expect(screen.queryByRole('button', { name: 'Show all 3 rows' })).not.toBeInTheDocument();

    // The irreversibility line survives.
    expect(screen.getByText('Importing cannot be undone in bulk — a skipped row can be imported later.')).toBeInTheDocument();
  });

  it('the bulk import irreversibility line still renders exactly once with rows hidden', async () => {
    await previewMixedPlan();
    expect(screen.getAllByText('Importing cannot be undone in bulk — a skipped row can be imported later.')).toHaveLength(1);
  });
});
