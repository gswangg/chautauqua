// eval-findings 45+55 (DEC-712, task-w17-d) + DEC-738/DEC-726 (task-w2-c):
// the contacts directory table drops the '# Submissions' column and the
// FIELD/OPERATOR/VALUE FilterRulesPanel rule builder entirely (segment
// control moves to the tab row, owned by task-w17-c), gains a Labels column
// of chips reading the contact's customFields ("`key` `value`", server-
// formatted via src/domain/contact-labels.ts -- supersedes DEC-712's
// derived participation-role chips), and the row action becomes a quiet
// 'Open' tertiary link.
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ContactsTable } from './ContactsTable';
import { EMPTY_SELECTION } from './selection';
import type { ContactListItem } from './types';

const ITEMS: ContactListItem[] = [
  {
    id: 'ct1',
    firstName: 'Ada',
    lastName: 'Lovelace',
    email: 'ada@example.com',
    company: 'Acme',
    title: 'Engineer',
    labels: ['role speaker', 'tshirt L'],
  },
  {
    id: 'ct2',
    firstName: 'Grace',
    lastName: 'Hopper',
    email: 'grace@example.com',
    company: 'Navy',
    title: 'Admiral',
    labels: [],
  },
];

function renderTable(overrides: Partial<Parameters<typeof ContactsTable>[0]> = {}) {
  return render(
    <ContactsTable
      items={ITEMS}
      total={2}
      page={1}
      perPage={25}
      selection={EMPTY_SELECTION}
      loading={false}
      empty={{ variant: 'fresh' }}
      onChangePage={() => {}}
      onSelectionChange={() => {}}
      onOpenContact={() => {}}
      onBulkEmail={() => {}}
      {...overrides}
    />,
  );
}

afterEach(() => {
  cleanup();
});

describe('ContactsTable render (eval-findings 45+55, DEC-738/DEC-726)', () => {
  it('renders exactly the checkbox/Name and email/Company/Labels columns plus the row action', () => {
    renderTable();
    const headerRow = screen.getAllByRole('row')[0]!;
    const headers = Array.from(headerRow.querySelectorAll('th')).map((th) => th.textContent);
    expect(headers).toEqual(['', 'Name and email', 'Company', 'Labels', '']);
  });

  it('never renders the # Submissions column', () => {
    renderTable();
    expect(screen.queryByText('# Submissions')).not.toBeInTheDocument();
  });

  it('never renders the FIELD/OPERATOR/VALUE filter rules builder', () => {
    renderTable();
    expect(screen.queryByLabelText('Filter field')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Filter operator')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Filter value')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Segment filter')).not.toBeInTheDocument();
  });

  // DEC-738 amendment (wave 4): the LABELS cell prints the server-formatted
  // strings as plain small-caps meta joined by ' - ' -- no bordered-chip
  // chrome, no per-label list item.
  it('renders labels as plain small-caps meta joined by \' - \', no chip chrome', () => {
    renderTable();
    expect(screen.getByText('role speaker - tshirt L')).toBeInTheDocument();
    expect(document.querySelector('.chq-contacts-label-chip')).not.toBeInTheDocument();
  });

  it("renders the formatted '`key` `value`' string rather than a bare value", () => {
    renderTable();
    expect(screen.getByText('role speaker - tshirt L')).toBeInTheDocument();
    expect(screen.queryByText('speaker')).not.toBeInTheDocument();
  });

  it('renders a quiet Open tertiary link as the row action, not Add to event', () => {
    renderTable();
    const openButtons = screen.getAllByRole('button', { name: 'Open' });
    expect(openButtons).toHaveLength(2);
    expect(screen.queryByText(/Add to event/)).not.toBeInTheDocument();
  });

  // DEC-711 amendment (wave 4): the pager states the matching count as one
  // left-hand group; Previous/Next sit together on the right.
  it('groups the "Showing" count on the left and Previous/Next together on the right', () => {
    renderTable();
    const pager = document.querySelector('.chq-pager')!;
    const children = Array.from(pager.children);
    expect(children).toHaveLength(2);
    expect(children[0]!.textContent).toMatch(/^Showing/);
    const nav = children[1]!;
    expect(nav.className).toContain('chq-contacts-pager-nav');
    const navButtons = Array.from(nav.querySelectorAll('button')).map((b) => b.textContent);
    expect(navButtons).toEqual(['Previous', 'Next']);
  });
});

// USER RULING 2026-08-16: the always-mounted bulk bar's idle state is a
// real quiet state — same box, no aria-hidden, one muted hint line naming
// what selection unlocks instead of the armed controls.
describe('ContactsTable idle bulk bar (USER RULING 2026-08-16)', () => {
  it('idle renders the capability hint, stays in the accessibility tree, and hides the armed controls', () => {
    renderTable();
    const bar = screen.getByRole('toolbar', { name: 'Bulk actions' });
    expect(bar).not.toHaveAttribute('aria-hidden');
    expect(bar.classList.contains('chq-bulkbar-idle')).toBe(true);
    expect(within(bar).getByText('Tick rows to email contacts in bulk.')).toHaveClass('chq-bulkbar-hint');
    expect(within(bar).queryByRole('button', { name: /Bulk email/ })).not.toBeInTheDocument();
    expect(within(bar).queryByText(/selected/)).not.toBeInTheDocument();
  });

  it('a selection swaps the hint for the armed controls in the same bar', () => {
    renderTable({ selection: { ...EMPTY_SELECTION, selectedIds: new Set(['ct1']) } });
    const bar = screen.getByRole('toolbar', { name: 'Bulk actions' });
    expect(bar.classList.contains('chq-bulkbar-idle')).toBe(false);
    expect(within(bar).queryByText('Tick rows to email contacts in bulk.')).not.toBeInTheDocument();
    expect(within(bar).getByText('1 selected')).toBeInTheDocument();
    expect(within(bar).getByRole('button', { name: 'Bulk email (1)' })).toBeInTheDocument();
  });
});

// B7 rule 6 (DEC-678): a settled empty directory renders EmptyState INSTEAD
// of the <table>, never live column headers over an empty body.
describe('ContactsTable empty states (B7 rule 6, DEC-678)', () => {
  it('renders no <thead> when settled and empty', () => {
    renderTable({ items: [], total: 0, empty: { variant: 'fresh' } });
    expect(document.querySelector('thead')).not.toBeInTheDocument();
  });

  it('renders the fresh voice with no escape when there is no facet in flight', () => {
    renderTable({ items: [], total: 0, empty: { variant: 'fresh' } });
    expect(screen.getByText('No contacts yet.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Clear filter' })).not.toBeInTheDocument();
    // DEC-678 amendment (B7 rule 5, wave 53): a FRESH zero-state hides the
    // pager -- chrome over a directory that has never held a row.
    expect(document.querySelector('.chq-pager')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Previous' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Next' })).not.toBeInTheDocument();
  });

  it('renders the filtered voice with an escape naming the facet when one is in flight', () => {
    const onClear = () => {};
    renderTable({
      items: [],
      total: 0,
      empty: { variant: 'filtered', reason: 'Search "ada"', onClear },
    });
    expect(screen.getByText('No contacts match the current search/filter.')).toBeInTheDocument();
    expect(screen.getByText('Search "ada"')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Clear filter' })).toBeInTheDocument();
    // DEC-678 amendment (B7 rule 5, wave 53): a FILTERED zero-state keeps
    // the pager -- chrome is how a filter gets undone.
    expect(document.querySelector('.chq-pager')).not.toBeNull();
    expect(screen.getByRole('button', { name: 'Previous' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Next' })).toBeInTheDocument();
  });

  it('still paints the loading skeleton and no EmptyState while loading', () => {
    renderTable({ items: [], total: 0, loading: true, empty: { variant: 'fresh' } });
    expect(screen.getByText('Loading contacts…')).toBeInTheDocument();
    expect(screen.queryByText('No contacts yet.')).not.toBeInTheDocument();
  });

  // Post-eval polish: the placeholder rows are announced, not silent -- the
  // house PageSkeleton pattern is role="status" + aria-busy + a
  // visually-hidden label naming the region's own noun.
  it('announces the placeholder rows as a busy status region naming contacts', () => {
    renderTable({ items: [], total: 0, loading: true, empty: { variant: 'fresh' } });
    const status = screen.getByRole('status');
    expect(status).toHaveAttribute('aria-busy', 'true');
    expect(status).toHaveTextContent('Loading contacts…');
  });
});

// w20-c (DEC-902 amendment): docs/design/Chautauqua Contacts.dc.html:97/101
// (`display:grid; grid-template-columns:26px 1fr 130px 118px auto`)
// give the directory table an exact track list -- 26px 1fr 130px 118px
// auto -- but table-layout:auto left every column unwidthed. Pin the width
// class on each <th> and the table-layout:fixed + widths in styles.css.
describe('ContactsTable column allocation (w20-c, DEC-902)', () => {
  it('marks the select, company, labels and actions headers with their width-hook classes, leaving Name and email the sole unwidthed column', () => {
    renderTable();
    const table = screen.getByRole('table');
    const headers = within(table).getAllByRole('columnheader');
    expect(headers).toHaveLength(5);
    expect(headers[0]).toHaveClass('chq-contacts-col-select');
    expect(headers[1]).toHaveTextContent('Name and email');
    expect(headers[1]!.className).toBe('');
    expect(headers[2]).toHaveClass('chq-contacts-col-company');
    expect(headers[3]).toHaveClass('chq-contacts-col-labels');
    expect(headers[4]).toHaveClass('chq-contacts-col-actions');
  });

  it('declares table-layout:fixed and the four column widths unconditionally, leaving the phone reflow untouched', () => {
    const css = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '../../styles.css'), 'utf-8');

    // DEC-385: single-direction stylesheets -- narrow overrides wide via
    // max-width only, never min-width. So the desktop allocation is the
    // unconditional base layer, not a min-width block.
    expect(css).not.toMatch(/@media[^{]*min-width/);
    const desktopBlock = css.replace(/@media[^{]*\{(?=((?:[^{}]*\{[^{}]*\}[^{}]*)*))\1\}/g, '');

    expect(desktopBlock).toMatch(/\.chq-contacts-table\s*\{[^}]*table-layout:\s*fixed;/);
    expect(desktopBlock).toMatch(/\.chq-contacts-table \.chq-contacts-col-select\s*\{\s*width:\s*46px;\s*\}/);
    expect(desktopBlock).toMatch(/\.chq-contacts-table \.chq-contacts-col-company\s*\{\s*width:\s*130px;\s*\}/);
    expect(desktopBlock).toMatch(/\.chq-contacts-table \.chq-contacts-col-labels\s*\{\s*width:\s*118px;\s*\}/);
    // Gate-9 user-filed: the actions column carries a REAL width, not the
    // `width:1px` auto-layout shrink hack -- under table-layout:fixed that
    // width is literal and the content bled past the measure. The hack's
    // signature is now banned outright by test/fixed-table-column-hack.scan.
    // (`[^}]*` tolerates the explanatory comment inside the block.)
    // The trailing `[^}]*` is what tolerates DEC-989 wave-111's added
    // `overflow: hidden; text-overflow: ellipsis;` inside the SAME
    // unconditional block: this assertion pins that the width and the
    // nowrap are declared here, top level, not that they are the block's
    // last two declarations.
    expect(desktopBlock).toMatch(
      /\.chq-contacts-table \.chq-contacts-col-actions\s*\{[^}]*width:\s*96px;\s*white-space:\s*nowrap;[^}]*\}/,
    );

    // No column class carries a width; Name and email is the sole remainder.
    expect(css).not.toMatch(/chq-contacts-col-name/);

    // The phone reflow block (contacts.css) is a separate file/selector
    // that this change never touches -- table-layout only governs the
    // desktop <table> display mode, and the phone block overrides display
    // to block/flex on the same selectors regardless.
    const contactsCss = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), 'contacts.css'),
      'utf-8',
    );
    expect(contactsCss).toMatch(/@media \(max-width: 700px\) \{/);
    expect(contactsCss).not.toMatch(/table-layout/);
  });

  it('does not re-declare .chq-contacts-table as a second top-level selector', () => {
    const css = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '../../styles.css'), 'utf-8');
    const topLevelMatches = css.match(/^\.chq-contacts-table\s*\{/gm) ?? [];
    expect(topLevelMatches).toHaveLength(1);

    const contactsCss = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), 'contacts.css'),
      'utf-8',
    );
    expect(contactsCss).not.toMatch(/^\.chq-contacts-table\s*\{/m);
  });
});

// DEC-937 amendment (wave 24): the phone card's label is sourced from the
// cell itself (data-label mirroring its own <th>), never from column
// position -- a nth-child selector can't tell Company from Labels apart
// after a column reorder.
describe('ContactsTable phone card label source (DEC-937 wave-24)', () => {
  it('marks the company and labels cells with the exact string their own <th> renders, and no other cell', () => {
    renderTable();
    const table = screen.getByRole('table');
    const rows = within(table).getAllByRole('row').slice(1); // drop the header row
    for (const row of rows) {
      const cells = within(row).getAllByRole('cell');
      expect(cells).toHaveLength(5);
      expect(cells[0]).not.toHaveAttribute('data-label'); // select
      expect(cells[1]).not.toHaveAttribute('data-label'); // Name and email
      expect(cells[2]).toHaveAttribute('data-label', 'Company');
      expect(cells[3]).toHaveAttribute('data-label', 'Labels');
      expect(cells[4]).not.toHaveAttribute('data-label'); // actions
    }
  });

  it('never re-introduces a positional ::before label rule in contacts.css', () => {
    const contactsCss = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), 'contacts.css'),
      'utf-8',
    );
    const phoneBlockMatch = contactsCss.match(/@media \(max-width: 700px\) \{([\s\S]*)\}\s*$/);
    expect(phoneBlockMatch).not.toBeNull();
    const phoneBlock = phoneBlockMatch![1]!;

    // No nth-child/first-child/last-child selector paired with ::before/::after
    // may declare a letter-bearing content literal.
    const positionalPseudoWithBefore =
      /:(nth-child|nth-of-type|first-child|last-child)\([^)]*\)::(before|after)\s*\{[^}]*content:\s*'[^']*[A-Za-z][^']*'/;
    expect(phoneBlock).not.toMatch(positionalPseudoWithBefore);

    // The one guarded rule sources its text from the attribute, not a literal.
    expect(phoneBlock).toMatch(/td\[data-label\]::before\s*\{\s*content:\s*attr\(data-label\)/);
  });
});

describe('ContactsTable phone card caption suppression (DEC-937 wave-110 amendment)', () => {
  const contactsCss = readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), 'contacts.css'),
    'utf-8',
  );

  it('suppresses the attr(data-label) caption for .chq-contacts-table at 390 (frame: Chautauqua Contacts.dc.html:200-208 draws no COMPANY:/LABELS: caption)', () => {
    expect(contactsCss).toMatch(
      /\.chq-contacts-table tbody td\[data-label\]::before\s*\{\s*content:\s*none;\s*\}/,
    );
  });

  it('joins company and role onto one ellipsised 13px line at 390 (frame line 206)', () => {
    expect(contactsCss).toMatch(
      /\.chq-contacts-company-cell\s*\{[^}]*white-space:\s*nowrap;[^}]*overflow:\s*hidden;[^}]*text-overflow:\s*ellipsis;[^}]*min-width:\s*0;[^}]*font-size:\s*13px;/,
    );
    expect(contactsCss).toMatch(
      /\.chq-contacts-company-cell > span:first-child::after\s*\{\s*content:\s*' · ';\s*\}/,
    );
  });

  it('gives .chq-contacts-labels-meta the 11px/700/0.06em uppercase treatment at 390 (frame line 207)', () => {
    const phoneBlockMatch = contactsCss.match(/@media \(max-width: 700px\) \{([\s\S]*)\}\s*$/);
    expect(phoneBlockMatch).not.toBeNull();
    const phoneBlock = phoneBlockMatch![1]!;
    expect(phoneBlock).toMatch(
      /\.chq-contacts-labels-meta\s*\{\s*font-size:\s*11px;\s*font-weight:\s*700;\s*letter-spacing:\s*0\.06em;\s*text-transform:\s*uppercase;\s*color:\s*var\(--chq-muted\);\s*\}/,
    );
  });
});
