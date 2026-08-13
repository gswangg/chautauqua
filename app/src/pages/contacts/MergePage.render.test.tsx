// DEC-684: contact merge is a PAGE at its own URL (/contacts/merge), not a
// modal. The records to merge travel in the query string (?ids=<id>,<id>) so
// the page survives a reload — matched here against the same
// GET /contacts/duplicates data DuplicatesView already fetches. Proves: the
// field-by-field KEEP/DISCARD comparison renders from ?ids=, an honest empty
// state renders with fewer than two ids (the render sweep visits this path
// with no params and must not crash), and the footer's Merge -> confirm ->
// POST /contacts/merge {keepId, mergeIds} flow (DEC-629: set-based).
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { MergePage } from './MergePage';
import { mockApi, listEnvelope } from '../../test-utils/mockApi';

// DEC-992: createdAt (epoch ms) rides along on every contact -- 1 Jan 2024
// and 15 Jun 2024, both in the past so formatDate always appends the year.
// Noon UTC (not midnight) so formatDate's local-timezone getDate() never
// rolls the calendar day backward/forward in a non-UTC test runner.
const CREATED_A = Date.UTC(2024, 0, 1, 12);
const CREATED_B = Date.UTC(2024, 5, 15, 12);

const GROUP = {
  contactIds: ['ct-keep', 'ct-merge'],
  contacts: [
    { id: 'ct-keep', firstName: 'Jane', lastName: 'Doe', email: 'jane@example.com', company: 'Acme', title: 'Principal Engineer', createdAt: CREATED_A },
    { id: 'ct-merge', firstName: 'Jane', lastName: 'Doe', email: 'jane.merge@example.com', company: 'Acme Corp', title: 'Developer Advocate', createdAt: CREATED_B },
  ],
};

// DEC-705: what GET /contacts/merge/preview would report for this pair —
// a plain discard for Company, and a combine/append outcome for Notes that
// must render WITHOUT strikethrough (it's incorporated, not thrown away).
const PREVIEW_FIELDS = [
  { key: 'company', label: 'Company', kept: 'Acme', discarded: ['Acme Corp'], outcome: 'keep' },
  {
    key: 'notes',
    label: 'Notes',
    kept: 'Met at PlatformCon.\n\n---\n\nPrefers Tuesday.',
    discarded: [],
    outcome: 'append',
  },
];

afterEach(() => {
  cleanup();
});

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/contacts/merge" element={<MergePage />} />
        <Route path="/contacts" element={<div>Contacts landing</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('MergePage render (DEC-748: struck-empty discards, Labels row, keep-column name, pair counter)', () => {
  it('renders a struck em dash for a field the duplicate left blank, a Labels row combining customFields, the kept name as the column head, and a pair counter', async () => {
    mockApi({
      'GET /api/v1/contacts/duplicates': listEnvelope([GROUP, {
        contactIds: ['ct-a', 'ct-b'],
        contacts: [
          { id: 'ct-a', firstName: 'Sam', lastName: 'Ng', email: 'sam@example.com', createdAt: CREATED_A },
          { id: 'ct-b', firstName: 'Sam', lastName: 'Ng', email: 'sam2@example.com', createdAt: CREATED_B },
        ],
      }]),
      'GET /api/v1/contacts/merge/preview': {
        fields: [
          { key: 'company', label: 'Company', kept: 'Acme', discarded: [''], outcome: 'keep' },
          { key: 'customFields.shirtSize', label: 'shirtSize', kept: 'M', discarded: [], outcome: 'combine' },
        ],
      },
    });

    renderAt('/contacts/merge?ids=ct-keep,ct-merge&keep=ct-keep');

    await waitFor(() => {
      expect(screen.getByText('Merge two records')).toBeInTheDocument();
    });

    // "1 of N pairs" counter above the compare table.
    await waitFor(() => {
      expect(screen.getByText('1 of 2 pairs')).toBeInTheDocument();
    });

    // DEC-992: column heads name both the record AND its vintage --
    // "Keeping · <name> · added <date>" / "Discarding · <name> · added
    // <date>". DEC-802: the third column also now names the discarded
    // record (also "Jane Doe" in this fixture). DEC-834: since the names
    // collide, both heads carry the pick list's disambiguator (email) so
    // they read distinctly.
    const headRow = document.querySelector('.chq-contacts-merge-compare-head') as HTMLElement;
    expect(within(headRow).getByText('Keeping · Jane Doe (jane@example.com) · added 1 Jan 2024')).toBeInTheDocument();
    expect(within(headRow).getByText('Discarding · Jane Doe (jane.merge@example.com) · added 15 Jun 2024')).toBeInTheDocument();

    // A blank duplicate side still renders a row, but DEC-802: nothing was
    // actually dropped (the duplicate's side was already blank), so it
    // renders a plain em dash -- NOT the struck 'drop' class, since strike
    // styling is evidence of a real loss, not decoration. The compare rows
    // come from a SECOND request (GET /contacts/merge/preview) that can
    // land after the pair counter's, so this waits for it instead of
    // racing it.
    await waitFor(() => {
      expect(screen.getByText('Company')).toBeInTheDocument();
    });
    const companyRow = screen.getByText('Company').closest('.chq-contacts-merge-compare-row') as HTMLElement;
    const dropCell = within(companyRow).getByText('—');
    expect(dropCell).toHaveClass('chq-contacts-merge-compare-blank');
    expect(dropCell).not.toHaveClass('chq-contacts-merge-compare-drop');

    // Labels combine into one row via src/domain/contact-labels.ts, and the
    // raw customFields.* row is folded into it, not listed separately.
    expect(screen.queryByText('shirtSize')).not.toBeInTheDocument();
    const labelsRow = screen.getByText('Labels').closest('.chq-contacts-merge-compare-row') as HTMLElement;
    expect(within(labelsRow).getByText('shirtSize M')).toBeInTheDocument();
    expect(screen.getByText(/Labels always combine/)).toBeInTheDocument();
  });
});

describe('MergePage render (DEC-834: same-name pair disambiguates compare heads, notes footnote)', () => {
  const SAME_NAME_GROUP = {
    contactIds: ['ct-keep', 'ct-merge'],
    contacts: [
      { id: 'ct-keep', firstName: 'Sam', lastName: 'Ng', email: 'sam@lattice.com', company: 'Lattice', createdAt: CREATED_A },
      { id: 'ct-merge', firstName: 'Sam', lastName: 'Ng', email: 'sam@other.com', company: 'Other Co', createdAt: CREATED_B },
    ],
  };

  it('gives each column head an email disambiguator when the kept and discarded names are identical, and prints the notes-append footnote', async () => {
    mockApi({
      'GET /api/v1/contacts/duplicates': listEnvelope([SAME_NAME_GROUP]),
      'GET /api/v1/contacts/merge/preview': { fields: PREVIEW_FIELDS },
    });

    renderAt('/contacts/merge?ids=ct-keep,ct-merge&keep=ct-keep');

    await waitFor(() => {
      expect(screen.getByText('Merge two records')).toBeInTheDocument();
    });

    const headRow = document.querySelector('.chq-contacts-merge-compare-head') as HTMLElement;
    // Both heads read "Sam Ng" alone before DEC-834 -- indistinguishable at
    // the moment of an irreversible choice. Each must now carry the pick
    // list's own disambiguator (email) so the two heads read differently,
    // plus DEC-992's Keeping/Discarding prefix and added-date vintage.
    const keepHead = within(headRow).getByText('Keeping · Sam Ng (sam@lattice.com) · added 1 Jan 2024');
    const discardHead = within(headRow).getByText('Discarding · Sam Ng (sam@other.com) · added 15 Jun 2024');
    expect(keepHead).toBeInTheDocument();
    expect(discardHead).toBeInTheDocument();
    expect(keepHead.textContent).not.toEqual(discardHead.textContent);

    await waitFor(() => {
      expect(screen.getByText('Labels combine, notes are appended')).toBeInTheDocument();
    });
  });

  // DEC-858: names differing only by case are the same name at a merge --
  // the disambiguator must fire on a case-insensitive collision too, not
  // just an exact string match.
  const CASE_COLLIDE_GROUP = {
    contactIds: ['ct-keep', 'ct-merge'],
    contacts: [
      { id: 'ct-keep', firstName: 'PARKER', lastName: 'anders', email: 'parker@upper.com', company: 'Upper Co', createdAt: CREATED_A },
      { id: 'ct-merge', firstName: 'Parker', lastName: 'Anders', email: 'parker@lower.com', company: 'Lower Co', createdAt: CREATED_B },
    ],
  };

  it('gives each column head a disambiguator when the kept and discarded names differ only by case', async () => {
    mockApi({
      'GET /api/v1/contacts/duplicates': listEnvelope([CASE_COLLIDE_GROUP]),
      'GET /api/v1/contacts/merge/preview': { fields: PREVIEW_FIELDS },
    });

    renderAt('/contacts/merge?ids=ct-keep,ct-merge&keep=ct-keep');

    await waitFor(() => {
      expect(screen.getByText('Merge two records')).toBeInTheDocument();
    });

    const headRow = document.querySelector('.chq-contacts-merge-compare-head') as HTMLElement;
    const keepHead = within(headRow).getByText('Keeping · PARKER anders (parker@upper.com) · added 1 Jan 2024');
    const discardHead = within(headRow).getByText('Discarding · Parker Anders (parker@lower.com) · added 15 Jun 2024');
    expect(keepHead).toBeInTheDocument();
    expect(discardHead).toBeInTheDocument();
    expect(keepHead.textContent).not.toEqual(discardHead.textContent);
  });
});

describe('MergePage render (DEC-802: honest discard column head and impact line)', () => {
  const DISTINCT_GROUP = {
    contactIds: ['ct-keep', 'ct-merge'],
    contacts: [
      { id: 'ct-keep', firstName: 'Jane', lastName: 'Doe', email: 'jane@example.com', company: 'Acme', createdAt: CREATED_A },
      { id: 'ct-merge', firstName: 'Janie', lastName: 'Doerson', email: 'janie@example.com', company: 'Acme Corp', createdAt: CREATED_B },
    ],
  };

  it("heads the third column with the discarded record's own name and shows the submissions/tasks impact line", async () => {
    mockApi({
      'GET /api/v1/contacts/duplicates': listEnvelope([DISTINCT_GROUP]),
      'GET /api/v1/contacts/merge/preview': {
        fields: PREVIEW_FIELDS,
        impact: { submissions: 3, tasks: 1 },
      },
    });

    renderAt('/contacts/merge?ids=ct-keep,ct-merge&keep=ct-keep');

    await waitFor(() => {
      expect(screen.getByText('Merge two records')).toBeInTheDocument();
    });

    // Column head names the record that would be discarded, not the
    // literal "Discard", and carries DEC-992's vintage.
    await waitFor(() => {
      const head = document.querySelector('.chq-contacts-merge-compare-head') as HTMLElement;
      expect(within(head).getByText('Discarding · Janie Doerson · added 15 Jun 2024')).toBeInTheDocument();
    });
    expect(screen.queryByText('Discard')).not.toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('3 submissions and 1 task move to Jane Doe.')).toBeInTheDocument();
    });
  });
});

describe('MergePage render (DEC-684)', () => {
  it('renders an honest empty state with no ids — the render sweep must not crash', () => {
    renderAt('/contacts/merge');

    expect(screen.getByText('Pick two or more duplicate records from the Duplicates tab.')).toBeInTheDocument();
  });

  it('renders an honest empty state with only one id', () => {
    renderAt('/contacts/merge?ids=ct-keep');

    expect(screen.getByText('Pick two or more duplicate records from the Duplicates tab.')).toBeInTheDocument();
  });

  it('renders the field-by-field KEEP/DISCARD comparison from ?ids=, then posts /contacts/merge {keepId, mergeIds} after confirming', async () => {
    const fetchMock = mockApi({
      'GET /api/v1/contacts/duplicates': listEnvelope([GROUP]),
      'GET /api/v1/contacts/merge/preview': { fields: PREVIEW_FIELDS },
      'POST /api/v1/contacts/merge': { id: 'ct-keep', firstName: 'Jane', lastName: 'Doe', email: 'jane@example.com' },
    });

    renderAt('/contacts/merge?ids=ct-keep,ct-merge&keep=ct-keep');

    await waitFor(() => {
      expect(screen.getByText('Merge two records')).toBeInTheDocument();
    });

    // Field comparison rows: kept value in ink, discarded value struck through.
    await waitFor(() => {
      expect(screen.getByText('Acme')).toBeInTheDocument();
    });
    const discardCell = screen.getByText('Acme Corp');
    expect(discardCell).toHaveClass('chq-contacts-merge-compare-drop');
    expect(discardCell).not.toHaveClass('chq-contacts-merge-compare-combine');

    // Notes is a combine/append outcome: labelled as what will happen,
    // never rendered as a struck-through discard.
    const notesRow = screen.getByText('Notes').closest('.chq-contacts-merge-compare-row') as HTMLElement;
    expect(within(notesRow).getByText(/Met at PlatformCon\..*Prefers Tuesday\./s)).toBeInTheDocument();
    const notesCombineCell = within(notesRow).getByText(/will be appended/);
    expect(notesCombineCell).toHaveClass('chq-contacts-merge-compare-combine');
    expect(notesCombineCell).not.toHaveClass('chq-contacts-merge-compare-drop');

    // DEC-734: the identity pick rows carry company AND title, drawn from
    // the same GET /contacts/duplicates payload -- never a second by-ids
    // fetch.
    expect(screen.getByText(/Developer Advocate/)).toBeInTheDocument();

    // DEC-992: the primary button names its target instead of a bare "Merge".
    fireEvent.click(screen.getByRole('button', { name: 'Merge into Jane Doe' }));

    const dialog = await screen.findByRole('dialog', { name: 'Merge these records?' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Merge' }));

    await waitFor(() => {
      expect(screen.getByText('Contacts landing')).toBeInTheDocument();
    });

    const mergeCall = fetchMock.mock.calls.find(
      ([input], i, calls) =>
        (typeof input === 'string' ? input : input.toString()).endsWith('/contacts/merge') &&
        (calls[i]![1] as RequestInit | undefined)?.method === 'POST',
    );
    expect(mergeCall).toBeDefined();
    const body = JSON.parse((mergeCall![1] as RequestInit).body as string);
    expect(body).toEqual({ keepId: 'ct-keep', mergeIds: ['ct-merge'] });
  });

  it('DEC-734/DEC-770: the footer\'s "Not a duplicate" POSTs the dismissal then navigates back to /contacts with the pair to dismiss, no merge POST', async () => {
    const fetchMock = mockApi({
      'GET /api/v1/contacts/duplicates': listEnvelope([GROUP]),
      'GET /api/v1/contacts/merge/preview': { fields: PREVIEW_FIELDS },
      'POST /api/v1/contacts/duplicates/dismiss': { ok: true },
    });

    renderAt('/contacts/merge?ids=ct-keep,ct-merge&keep=ct-keep');

    await waitFor(() => {
      expect(screen.getByText('Merge two records')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Not a duplicate' }));

    await waitFor(() => {
      expect(screen.getByText('Contacts landing')).toBeInTheDocument();
    });

    const mergeCall = fetchMock.mock.calls.find(
      ([input], i, calls) =>
        (typeof input === 'string' ? input : input.toString()).endsWith('/contacts/merge') &&
        (calls[i]![1] as RequestInit | undefined)?.method === 'POST',
    );
    expect(mergeCall).toBeUndefined();

    const dismissCall = fetchMock.mock.calls.find(([input]) =>
      (typeof input === 'string' ? input : input.toString()).endsWith('/contacts/duplicates/dismiss'),
    );
    expect(dismissCall).toBeDefined();
    const body = JSON.parse((dismissCall![1] as RequestInit).body as string);
    expect(body).toEqual({ contactIds: ['ct-keep', 'ct-merge'] });
  });
});

describe('MergePage render (DEC-992: vintage heads, swap control, 3+ group fallback)', () => {
  it('"Swap which is kept" flips keepId, re-heads the columns, and re-issues the preview GET with the other keep id', async () => {
    const fetchMock = mockApi({
      'GET /api/v1/contacts/duplicates': listEnvelope([GROUP]),
      'GET /api/v1/contacts/merge/preview': { fields: PREVIEW_FIELDS },
    });

    renderAt('/contacts/merge?ids=ct-keep,ct-merge&keep=ct-keep');

    await waitFor(() => {
      expect(screen.getByText('Merge two records')).toBeInTheDocument();
    });

    const headRow = document.querySelector('.chq-contacts-merge-compare-head') as HTMLElement;
    expect(within(headRow).getByText('Keeping · Jane Doe (jane@example.com) · added 1 Jan 2024')).toBeInTheDocument();
    expect(within(headRow).getByText('Discarding · Jane Doe (jane.merge@example.com) · added 15 Jun 2024')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Swap which is kept' }));

    await waitFor(() => {
      expect(within(headRow).getByText('Keeping · Jane Doe (jane.merge@example.com) · added 15 Jun 2024')).toBeInTheDocument();
      expect(within(headRow).getByText('Discarding · Jane Doe (jane@example.com) · added 1 Jan 2024')).toBeInTheDocument();
    });

    // The primary button re-names its new target too.
    expect(screen.getByRole('button', { name: 'Merge into Jane Doe' })).toBeInTheDocument();

    const previewCalls = fetchMock.mock.calls.filter(([input]) =>
      (typeof input === 'string' ? input : input.toString()).includes('/contacts/merge/preview'),
    );
    const lastPreviewUrl = (previewCalls[previewCalls.length - 1]![0] as string).toString();
    expect(lastPreviewUrl).toContain('keep=ct-merge');
  });

  it('DEC-802/DEC-992: a 3+ group still renders "N other records" with no date', async () => {
    const GROUP_OF_THREE = {
      contactIds: ['ct-keep', 'ct-b', 'ct-c'],
      contacts: [
        { id: 'ct-keep', firstName: 'Jane', lastName: 'Doe', email: 'jane@example.com', createdAt: CREATED_A },
        { id: 'ct-b', firstName: 'Jan', lastName: 'Doerson', email: 'jan@example.com', createdAt: CREATED_B },
        { id: 'ct-c', firstName: 'J', lastName: 'D', email: 'jd@example.com', createdAt: CREATED_B },
      ],
    };
    mockApi({
      'GET /api/v1/contacts/duplicates': listEnvelope([GROUP_OF_THREE]),
      'GET /api/v1/contacts/merge/preview': { fields: PREVIEW_FIELDS },
    });

    renderAt('/contacts/merge?ids=ct-keep,ct-b,ct-c&keep=ct-keep');

    await waitFor(() => {
      expect(screen.getByText('Merge two records')).toBeInTheDocument();
    });

    const headRow = document.querySelector('.chq-contacts-merge-compare-head') as HTMLElement;
    // No single discarded record to name, so no vintage for it either --
    // the keep head (a real, single, named record) legitimately still
    // shows its own "added <date>".
    const discardHead = within(headRow).getByText('Discarding · 2 other records');
    expect(discardHead).toBeInTheDocument();
    expect(discardHead.textContent).not.toMatch(/added/);
    // A 3+ group has no single record to swap onto.
    expect(screen.queryByRole('button', { name: 'Swap which is kept' })).not.toBeInTheDocument();
  });
});
