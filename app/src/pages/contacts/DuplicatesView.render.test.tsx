// DEC-684: merge is a PAGE at its own URL (MergePage.tsx), not a modal — this
// view now only lists duplicate groups and links each one to
// /contacts/merge?ids=<contactIds>. No dialog, no merge POST, no merge-local
// error plumbing here anymore.
// DEC-734: each pair also renders its company, a 'Keep both' dismiss, a pair
// counter, and reads a one-shot dismissPairIds notice from MergePage's own
// 'Not a duplicate' footer button the same way it reads a merge notice.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen, waitFor, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter } from 'react-router-dom';
import { DuplicatesView } from './DuplicatesView';
import { mockApi, listEnvelope } from '../../test-utils/mockApi';

const HERE = dirname(fileURLToPath(import.meta.url));
const CSS = readFileSync(join(HERE, 'contacts-panels.css'), 'utf-8');

/** Extracts a top-level (not inside an @media block) rule's declaration
 * body by selector — same helper as ContactsApp.newContact.render.test.tsx
 * and shell-geometry.test.ts. */
function topLevelRuleBody(css: string, selector: string): string {
  const withoutMedia = css.replace(/@media[^{]*\{(?=((?:[^{}]*\{[^{}]*\}[^{}]*)*))\1\}/g, '');
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = withoutMedia.match(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`));
  const body = match?.[1];
  if (body === undefined) throw new Error(`no top-level rule found for ${selector}`);
  return body;
}

const GROUP = {
  contactIds: ['ct-keep', 'ct-merge'],
  reason: 'email',
  contacts: [
    { id: 'ct-keep', firstName: 'Jane', lastName: 'Doe', email: 'jane@example.com', company: 'Acme' },
    { id: 'ct-merge', firstName: 'Jane', lastName: 'Doe', email: 'jane@example.com', company: 'Acme Corp' },
  ],
};

const SECOND_GROUP = {
  contactIds: ['ct-a', 'ct-b'],
  reason: 'name_and_company',
  contacts: [
    { id: 'ct-a', firstName: 'Sam', lastName: 'Ng', email: 'sam@example.com', company: null },
    { id: 'ct-b', firstName: 'Sam', lastName: 'Ng', email: 'sam2@example.com', company: null },
  ],
};

const NAME_ONLY_GROUP = {
  contactIds: ['ct-c', 'ct-d'],
  reason: 'name',
  contacts: [
    { id: 'ct-c', firstName: 'Ali', lastName: 'Rao', email: 'ali@old-employer.example', company: 'Old Co' },
    { id: 'ct-d', firstName: 'Ali', lastName: 'Rao', email: 'ali@new-employer.example', company: 'New Co' },
  ],
};

// DEC-711 amendment (wave 40): synthetic groups for past-row-200 coverage --
// unique contactIds per index so a specific group's merge link is checkable
// after "Show all" appends a second page.
function generateGroups(count: number, offset: number) {
  return Array.from({ length: count }, (_, i) => {
    const n = offset + i;
    return {
      contactIds: [`ct-${n}-a`, `ct-${n}-b`],
      reason: 'email' as const,
      contacts: [
        { id: `ct-${n}-a`, firstName: 'Dup', lastName: `${n}`, email: `dup${n}a@example.com`, company: null },
        { id: `ct-${n}-b`, firstName: 'Dup', lastName: `${n}`, email: `dup${n}b@example.com`, company: null },
      ],
    };
  });
}

afterEach(() => {
  cleanup();
});

describe('DuplicatesView render (DEC-684: merge moved to its own page)', () => {
  it('links each duplicate group to /contacts/merge?ids=<contactIds> instead of opening a dialog, and shows company', async () => {
    mockApi({
      'GET /api/v1/contacts/duplicates': listEnvelope([GROUP]),
    });

    render(
      <MemoryRouter initialEntries={['/contacts']}>
        <DuplicatesView onMerged={() => {}} />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText(/Jane Doe/)).toBeInTheDocument();
    });

    expect(screen.getByText(/Acme Corp/)).toBeInTheDocument();

    const mergeLink = screen.getByRole('link', { name: 'Merge' });
    expect(mergeLink).toHaveAttribute('href', '/contacts/merge?ids=ct-keep,ct-merge');

    expect(screen.queryByRole('dialog', { name: 'Merge duplicates' })).not.toBeInTheDocument();
  });

  it('DEC-748: states the DEC-143 matching rule on the tab so a same-name-different-company non-match reads as intentional', async () => {
    mockApi({
      'GET /api/v1/contacts/duplicates': listEnvelope([GROUP]),
    });

    render(
      <MemoryRouter initialEntries={['/contacts']}>
        <DuplicatesView onMerged={() => {}} />
      </MemoryRouter>,
    );

    expect(
      screen.getByText(
        'Matched on the same email, the same name at the same company, or the same name at a different company.',
      ),
    ).toBeInTheDocument();
  });

  it('DEC-800: renders the duplicate reason as a plain-text caption on each pair', async () => {
    mockApi({
      'GET /api/v1/contacts/duplicates': listEnvelope([GROUP, SECOND_GROUP, NAME_ONLY_GROUP]),
    });

    render(
      <MemoryRouter initialEntries={['/contacts']}>
        <DuplicatesView onMerged={() => {}} />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText(/Jane Doe/)).toBeInTheDocument();
    });

    expect(screen.getByText('Same email')).toBeInTheDocument();
    expect(screen.getByText('Same name and company')).toBeInTheDocument();
    expect(screen.getByText('Same name, different company')).toBeInTheDocument();
  });

  it('shows the one-shot merge notice passed in via initialNotice, without re-fetching a merge dialog', async () => {
    mockApi({
      'GET /api/v1/contacts/duplicates': listEnvelope([]),
    });

    render(
      <MemoryRouter initialEntries={['/contacts']}>
        <DuplicatesView onMerged={() => {}} initialNotice="Contacts merged." />
      </MemoryRouter>,
    );

    expect(screen.getByText('Contacts merged.')).toBeInTheDocument();
  });

  it('DEC-734/DEC-770: a pair counter tracks the visible groups, and "Keep both" dismisses a pair from the list without merging, POSTing the dismissal', async () => {
    const fetchMock = mockApi({
      'GET /api/v1/contacts/duplicates': listEnvelope([GROUP, SECOND_GROUP]),
      'POST /api/v1/contacts/duplicates/dismiss': { ok: true },
    });

    render(
      <MemoryRouter initialEntries={['/contacts']}>
        <DuplicatesView onMerged={() => {}} />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText(/Possible duplicates/).closest('h2')).toHaveTextContent('· 2');
    });

    const keepBothButtons = screen.getAllByRole('button', { name: 'Keep both' });
    expect(keepBothButtons).toHaveLength(2);
    fireEvent.click(keepBothButtons[0]!);

    expect(screen.getByText(/Possible duplicates/).closest('h2')).toHaveTextContent('· 1');
    expect(screen.queryByText(/Jane Doe/)).not.toBeInTheDocument();
    expect(screen.getByText(/Sam Ng/)).toBeInTheDocument();

    await waitFor(() => {
      const dismissCall = fetchMock.mock.calls.find(([input]) =>
        (typeof input === 'string' ? input : input.toString()).endsWith('/contacts/duplicates/dismiss'),
      );
      expect(dismissCall).toBeDefined();
      const body = JSON.parse((dismissCall![1] as RequestInit).body as string);
      expect(body).toEqual({ contactIds: ['ct-keep', 'ct-merge'] });
    });
  });

  // DEC-678 (w55-b): a zero-row settle here is always the 'fresh' voice --
  // this list has no filter/search axis of its own to name and clear.
  it('DEC-678: renders the shared EmptyState (fresh, no escape) when settled with zero groups, and drops the old bare chq-empty line', async () => {
    mockApi({
      'GET /api/v1/contacts/duplicates': listEnvelope([]),
    });

    render(
      <MemoryRouter initialEntries={['/contacts']}>
        <DuplicatesView onMerged={() => {}} />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText('No duplicate groups found.')).toBeInTheDocument();
    });
    expect(document.querySelector('.chq-empty')).not.toBeInTheDocument();
    expect(document.querySelector('.chq-empty-block-fresh')).not.toBeNull();
    expect(document.querySelector('.chq-empty-escape')).not.toBeInTheDocument();
  });

  it('DEC-734: reads a one-shot initialDismissPairIds (from MergePage\'s "Not a duplicate" footer) and drops that pair on mount', async () => {
    mockApi({
      'GET /api/v1/contacts/duplicates': listEnvelope([GROUP, SECOND_GROUP]),
    });

    render(
      <MemoryRouter initialEntries={['/contacts']}>
        <DuplicatesView
          onMerged={() => {}}
          initialNotice="Marked as not a duplicate."
          initialDismissPairIds={['ct-merge', 'ct-keep']}
        />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText(/Possible duplicates/).closest('h2')).toHaveTextContent('· 1');
    });
    expect(screen.queryByText(/Jane Doe/)).not.toBeInTheDocument();
    expect(screen.getByText(/Sam Ng/)).toBeInTheDocument();
    expect(screen.getByText('Marked as not a duplicate.')).toBeInTheDocument();
  });
});

// DEC-711 amendment (wave 40): the tab must state the server's true total
// (never the loaded page's length) and every group past row 200 must stay
// reachable via a DEC-845-style "Showing X of N / Show all N" affordance.
describe('DuplicatesView render (DEC-711 amendment wave 40: total-backed count + Show all)', () => {
  it('renders the envelope total, not the loaded page length, plus the Showing/Show-all line', async () => {
    const page1 = generateGroups(200, 0);
    mockApi({
      'GET /api/v1/contacts/duplicates': listEnvelope(page1, { total: 612, perPage: 200 }),
    });

    render(
      <MemoryRouter initialEntries={['/contacts']}>
        <DuplicatesView onMerged={() => {}} />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText(/Possible duplicates/).closest('h2')).toHaveTextContent('· 612');
    });
    expect(screen.getByText('Showing 200 of 612')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Show all 612' })).toBeInTheDocument();
  });

  it('Show all issues the page-2 request and appends its groups, so a page-2 group renders with its merge link', async () => {
    const page1 = generateGroups(200, 0);
    const page2 = generateGroups(12, 200);
    let call = 0;
    const fetchMock = mockApi({
      'GET /api/v1/contacts/duplicates': () => {
        call += 1;
        if (call === 1) return listEnvelope(page1, { total: 612, perPage: 200 });
        if (call === 2) return listEnvelope(page2, { total: 612, perPage: 200 });
        return listEnvelope([], { total: 612, perPage: 200 });
      },
    });

    render(
      <MemoryRouter initialEntries={['/contacts']}>
        <DuplicatesView onMerged={() => {}} />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Show all 612' })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: 'Show all 612' }));

    await waitFor(() => {
      const links = screen.getAllByRole('link', { name: 'Merge' });
      const target = links.find((l) => l.getAttribute('href') === '/contacts/merge?ids=ct-200-a,ct-200-b');
      expect(target).toBeDefined();
    });

    const page2Call = fetchMock.mock.calls.find(([input]) =>
      (typeof input === 'string' ? input : input.toString()).includes('page=2'),
    );
    expect(page2Call).toBeDefined();

    // The affordance itself is gone once every group is loaded.
    expect(screen.queryByRole('button', { name: /Show all/ })).not.toBeInTheDocument();
  });

  it('Keep both decrements the stated total by exactly one, past row 200', async () => {
    const page1 = generateGroups(200, 0);
    mockApi({
      'GET /api/v1/contacts/duplicates': listEnvelope(page1, { total: 612, perPage: 200 }),
      'POST /api/v1/contacts/duplicates/dismiss': { ok: true },
    });

    render(
      <MemoryRouter initialEntries={['/contacts']}>
        <DuplicatesView onMerged={() => {}} />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText(/Possible duplicates/).closest('h2')).toHaveTextContent('· 612');
    });

    const keepBothButtons = screen.getAllByRole('button', { name: 'Keep both' });
    fireEvent.click(keepBothButtons[0]!);

    expect(screen.getByText(/Possible duplicates/).closest('h2')).toHaveTextContent('· 611');
  });

  it('renders no Show-all affordance when the org total fits on one page', async () => {
    mockApi({
      'GET /api/v1/contacts/duplicates': listEnvelope([GROUP, SECOND_GROUP]),
    });

    render(
      <MemoryRouter initialEntries={['/contacts']}>
        <DuplicatesView onMerged={() => {}} />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText(/Possible duplicates/).closest('h2')).toHaveTextContent('· 2');
    });
    expect(screen.queryByRole('button', { name: /Show all/ })).not.toBeInTheDocument();
    expect(screen.queryByText(/Showing/)).not.toBeInTheDocument();
  });
});

// Gate report: the Duplicates tab's row wrapped at desktop width (the names
// span, reason caption, and Merge/Keep-both actions all fighting for one
// flex-wrap row's baseline). jsdom does not evaluate @media rules, so —
// mirroring ContactsApp.newContact.render.test.tsx — this is a source-scan
// of contacts-panels.css's own text rather than computed style.
describe('contacts-panels.css: duplicate group row does not wrap at desktop width', () => {
  it('.chq-contacts-duplicate-group is a 3-column grid outside the 700px media query', () => {
    const body = topLevelRuleBody(CSS, '.chq-contacts-duplicate-group');
    expect(body).toMatch(/display:\s*grid/);
    expect(body).not.toMatch(/flex-wrap/);
  });

  it('.chq-contacts-duplicate-names truncates instead of wrapping', () => {
    const body = topLevelRuleBody(CSS, '.chq-contacts-duplicate-names');
    expect(body).toMatch(/white-space:\s*nowrap/);
    expect(body).toMatch(/text-overflow:\s*ellipsis/);
  });

  it('stacks to a single column inside the 700px media query', () => {
    const mediaBlocks = CSS.match(/@media \(max-width: 700px\) \{(?:[^{}]*\{[^{}]*\})*[^{}]*\}/g) ?? [];
    const block = mediaBlocks.find((b) => b.includes('.chq-contacts-duplicate-group'));
    expect(block).toBeDefined();
    expect(block).toMatch(/\.chq-contacts-duplicate-group\s*\{[^}]*grid-template-columns:\s*1fr/);
  });
});
