// w15-tg (DEC-385): the 390 frame's Contacts row action is `Email`, not the
// desktop `Open` (Chautauqua Contacts.dc.html:201-209). Follows the
// FakeMediaQueryList idiom PipelineBoard.render.test.tsx:1316-1324 already
// uses to force useIsPhone's split in jsdom (which implements no matchMedia
// at all, so every OTHER contacts render test keeps exercising the desktop
// tree). Copies verbatimLine from Settings.frame-verdicts.render.test.tsx,
// repointed at Chautauqua Contacts.dc.html.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ContactsTable } from './ContactsTable';
import { EMPTY_SELECTION } from './selection';
import type { ContactListItem } from './types';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, '..', '..', '..', '..');
const DESIGN_FILE = join(REPO_ROOT, 'docs', 'design', 'Chautauqua Contacts.dc.html');

/** DEC-967 shape: read the ACTUAL line, assert it byte-for-byte matches the
 * literal this file claims -- a citation that can never silently rot to a
 * wrong line the way a bare `:line` reference can. Copied from
 * Settings.frame-verdicts.render.test.tsx's own `verbatimLine`. */
function verbatimLine(lineNo: number, literal: string): void {
  const lines = readFileSync(DESIGN_FILE, 'utf-8').split('\n');
  const line = lines[lineNo - 1];
  if (line === undefined) throw new Error(`design file has no line ${lineNo}`);
  expect(line).toBe(literal);
}

class FakeMediaQueryList {
  matches = true;
  addEventListener() {}
  removeEventListener() {}
}

function stubPhoneMatchMedia() {
  vi.stubGlobal('matchMedia', () => new FakeMediaQueryList());
}

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
];

function renderTable(overrides: Partial<Parameters<typeof ContactsTable>[0]> = {}) {
  return render(
    <ContactsTable
      items={ITEMS}
      total={1}
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
  vi.unstubAllGlobals();
});

describe('ContactsTable row action at 390 (Chautauqua Contacts.dc.html:179/201-209, DEC-385)', () => {
  it('desktop (jsdom default, no matchMedia): keeps the Open verb verbatim', () => {
    renderTable();
    expect(screen.getByRole('button', { name: 'Open' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Email/ })).not.toBeInTheDocument();
  });

  it('phone (matchMedia stubbed true): renders the frame\'s Email verb, named for the contact, instead of Open', () => {
    stubPhoneMatchMedia();
    verbatimLine(
      209,
      '            <span style="border:1px solid #BAB6A6; border-radius:6px; min-height:44px; display:flex; align-items:center; padding:0 14px; font-size:13px; font-weight:600; flex-shrink:0">Email</span>',
    );

    renderTable();
    expect(screen.queryByRole('button', { name: 'Open' })).not.toBeInTheDocument();
    const emailButton = screen.getByRole('button', { name: 'Email Ada Lovelace' });
    expect(emailButton).toHaveTextContent('Email');
  });

  it('phone: clicking the row Email button opens the same BulkEmailModal path the drawer\'s DEC-959 dock uses (contactIds:[id], eventId:null)', () => {
    stubPhoneMatchMedia();
    renderTable();

    fireEvent.click(screen.getByRole('button', { name: 'Email Ada Lovelace' }));

    // BulkEmailModal titles itself "Email <count> contact(s)" and subtitles
    // with the recipient names line -- proof this is the shared modal, not a
    // second-minted flow, and that it was opened with exactly this one row's
    // id/name (ContactDrawer.tsx:701/739-746's dock pattern: contactIds:[id],
    // eventId:null, recipientNames:[name]).
    expect(screen.getByText('Email 1 contact')).toBeInTheDocument();
    expect(screen.getAllByText('Ada Lovelace').length).toBeGreaterThan(0);
  });

  it('phone: the name cell stays a real onOpenContact control once the boxed action becomes Email, so the record stays reachable', () => {
    stubPhoneMatchMedia();
    const onOpenContact = vi.fn();
    renderTable({ onOpenContact });

    const nameButton = screen.getByRole('button', { name: 'Ada Lovelace' });
    expect(nameButton).toHaveClass('chq-link-button');
    fireEvent.click(nameButton);
    expect(onOpenContact).toHaveBeenCalledWith('ct1');
  });

  it('phone: the row selection checkbox stays live, never suppressed (frame :183 draws a live "2 of 318" selection counter)', () => {
    stubPhoneMatchMedia();
    renderTable();
    expect(screen.getByRole('checkbox', { name: 'Select Ada Lovelace' })).toBeInTheDocument();
  });

  it('phone: the three info lines carry the frame\'s registers -- name, company · role (line 206), labels (line 207)', () => {
    stubPhoneMatchMedia();
    verbatimLine(
      206,
      '              <span style="font-size:13px; color:#565A4B; white-space:nowrap; overflow:hidden; text-overflow:ellipsis">{{ row.company }} · {{ row.role }}</span>',
    );
    verbatimLine(
      207,
      '              <span style="font-size:11px; font-weight:700; letter-spacing:0.06em; text-transform:uppercase; color:#565A4B">{{ row.tags }}</span>',
    );

    renderTable();
    expect(screen.getByText('Ada Lovelace')).toBeInTheDocument();
    expect(screen.getByText('Acme')).toBeInTheDocument();
    expect(screen.getByText('Engineer')).toBeInTheDocument();
    expect(screen.getByText('role speaker - tshirt L')).toBeInTheDocument();
  });
});
