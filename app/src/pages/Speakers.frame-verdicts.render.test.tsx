// w14-sc (DEC-976 wave-157): per-frame 390 render-verdict receipts for the
// Speakers cluster's two 390 frames -- docs/design/Chautauqua Speakers.dc.html
// :133 "Speakers" (the OnboardingGrid landing) and :260 "Roster · 390" (the
// drill-in behind the phone-only "Roster ›" link). Entered through
// SpeakersPage's real mount (the same component /speakers routes to), never
// by mounting OnboardingGrid or RosterPanel's RosterDrillIn directly -- the
// drill-in is reached the same way a user reaches it, by clicking the
// "Roster ›" trigger button OnboardingGrid itself renders. jsdom applies no
// stylesheet (no @media), so every assertion below is about DOM
// STRUCTURE/ORDER, never computed geometry -- consistent with
// Settings.frame-verdicts.render.test.tsx, which this file is modeled on.
// Full verdict prose lives in docs/design/audit/speakers-v12.md (this
// worker's own file for this batch); this file is the render RECEIPT each
// verdict row cites.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, cleanup, within, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MemoryRouter } from 'react-router-dom';
import { SpeakersPage } from './Speakers';
import { mockApi } from '../test-utils/mockApi';
import type { OnboardingGridResponse } from './speakers/types';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, '..', '..', '..');
const DESIGN_FILE = join(REPO_ROOT, 'docs', 'design', 'Chautauqua Speakers.dc.html');

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

const EVENT_ID = 'evt-speakers-frame-verdicts';
const DUE_DATE_MS = Date.UTC(2026, 0, 15);

// Shape reused from the existing Speakers.render.test.tsx harness (batch
// w3-e) -- two rows, one with an account (hasAccount) and one without, so
// the Roster drill-in's "N not claimed" summary is exercised honestly.
function grid(): OnboardingGridResponse {
  return {
    tasks: [{ id: 'task-1', kind: 'general', title: 'Sign speaker agreement', dueDate: DUE_DATE_MS, required: true }],
    rows: [
      {
        contact: {
          id: 'ct1',
          name: 'Ada Lovelace',
          email: 'ada@example.com',
          company: 'Acme',
          hasAccount: true,
          participations: [{ participantId: 'p-ct1', submissionId: 'sub-ct1', ref: 'SES-001', title: 'Talk', inviteStatus: 'accepted' }],
        },
        cells: [{ taskId: 'task-1', assignmentId: 'as1', status: 'complete', completedAt: 1700000000000, fileId: null, fileName: null, assignedAt: 0 }],
      },
      {
        contact: {
          id: 'ct2',
          name: 'Grace Hopper',
          email: 'grace@example.com',
          company: 'Navy',
          hasAccount: false,
          participations: [{ participantId: 'p-ct2', submissionId: 'sub-ct2', ref: 'SES-002', title: 'Compilers', inviteStatus: 'none' }],
        },
        cells: [{ taskId: 'task-1', assignmentId: 'as2', status: 'pending', completedAt: null, fileId: null, fileName: null, assignedAt: 0 }],
      },
    ],
    total: 2,
    page: 1,
    perPage: 50,
    counts: { speakers: 2, outstandingRequired: 1, overdue: 0, outstandingContacts: 1 },
    timezone: 'UTC',
  };
}

let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  window.localStorage.setItem('chq.currentEventId', EVENT_ID);
  consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  expect(consoleErrorSpy).not.toHaveBeenCalled();
  consoleErrorSpy.mockRestore();
  window.localStorage.clear();
  vi.unstubAllGlobals();
  cleanup();
});

function mockOnboarding() {
  mockApi({
    [`GET /api/v1/events/${EVENT_ID}/onboarding`]: grid(),
    [`GET /api/v1/events/${EVENT_ID}/forms`]: { forms: [{ id: 'form-1', title: 'Speaker agreement form', isDefault: true }] },
  });
}

describe('v12 Speakers 390 frames: per-frame render verdict receipts (w14-sc, DEC-976)', () => {
  // Frame :133 "Speakers" -- caption at :129 (`390` chip group).
  it('frame :133 Speakers landing -- DIVERGES (blessed, DEC-976): the phone head repeats the desktop H1/summary (frame :139-140) with a Remind-outstanding/Filter row (:142-143), plus a phone-only "Roster ›" trigger the frame draws no control for, blessed in DEVIATIONS.md as the narrowest possible entry point to the drawn :260 drill-in destination', async () => {
    mockOnboarding();
    render(
      <MemoryRouter initialEntries={['/speakers']}>
        <SpeakersPage />
      </MemoryRouter>,
    );
    // docs/design/Chautauqua Speakers.dc.html:139 `        <h1 style="margin:0; font-family:'Familjen Grotesk', sans-serif; font-size:27px; font-weight:700; letter-spacing:-0.04em; line-height:1">Speakers</h1>`
    verbatimLine(139, '        <h1 style="margin:0; font-family:\'Familjen Grotesk\', sans-serif; font-size:27px; font-weight:700; letter-spacing:-0.04em; line-height:1">Speakers</h1>');
    // DEC-662: exactly one <h1> on the page -- the same H1 serves both
    // desktop and phone (no duplicate title node toggled by CSS).
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getByRole('heading', { name: 'Speakers' })).toBeInTheDocument();

    await waitFor(() => expect(screen.getAllByText('Ada Lovelace').length).toBeGreaterThan(0));

    // docs/design/Chautauqua Speakers.dc.html:142 `          <span style="flex:1; background:#4E5C31; color:#F7F9F0; border-radius:6px; min-height:44px; display:flex; align-items:center; justify-content:center; font-size:13px; font-weight:700">Remind outstanding</span>`
    verbatimLine(142, '          <span style="flex:1; background:#4E5C31; color:#F7F9F0; border-radius:6px; min-height:44px; display:flex; align-items:center; justify-content:center; font-size:13px; font-weight:700">Remind outstanding</span>');
    expect(screen.getByRole('button', { name: 'Remind outstanding' })).toBeInTheDocument();
    // docs/design/Chautauqua Speakers.dc.html:143 `          <span style="border:1px solid #BAB6A6; border-radius:6px; min-height:44px; display:flex; align-items:center; padding:0 14px; font-size:13px; font-weight:600">Filter</span>`
    verbatimLine(143, '          <span style="border:1px solid #BAB6A6; border-radius:6px; min-height:44px; display:flex; align-items:center; padding:0 14px; font-size:13px; font-weight:600">Filter</span>');
    expect(screen.getByRole('button', { name: 'Filter' })).toBeInTheDocument();

    // OnboardingGrid.tsx's own comment (:1059-1062) states this trigger is
    // "this task's own narrowest addition" -- the frame draws no control
    // for the Roster drill-in's entry, only its destination (:260). This
    // is the divergence the title names, and it is already blessed in
    // docs/design/DEVIATIONS.md's "Speakers 390 landing's 'Roster ›'
    // trigger" bullet: without a trigger the drill-in destination would be
    // unreachable dead code, so the app adds this narrowest possible entry
    // point.
    expect(screen.getByRole('button', { name: 'Roster ›' })).toBeInTheDocument();
  });

  // Frame :260 "Roster · 390" -- caption at :257.
  it('frame :260 Roster -- MATCHES: back-link/H1/summary head, then per-row identity+status with a trailing Open action, then a primary Add-a-speaker + secondary Import-CSV dock, in that order', async () => {
    mockOnboarding();
    render(
      <MemoryRouter initialEntries={['/speakers']}>
        <SpeakersPage />
      </MemoryRouter>,
    );
    await waitFor(() => expect(screen.getAllByText('Ada Lovelace').length).toBeGreaterThan(0));

    // Enter the drill-in the same way a phone user does -- through the real
    // "Roster ›" trigger, never by mounting RosterDrillIn directly.
    fireEvent.click(screen.getByRole('button', { name: 'Roster ›' }));

    const backBtn = screen.getByRole('button', { name: '‹ Speakers' });
    // docs/design/Chautauqua Speakers.dc.html:263 `        <h1 style="margin:0; font-family:'Familjen Grotesk', sans-serif; font-size:25px; font-weight:700; letter-spacing:-0.04em; line-height:1.05">Roster</h1>`
    verbatimLine(263, '        <h1 style="margin:0; font-family:\'Familjen Grotesk\', sans-serif; font-size:25px; font-weight:700; letter-spacing:-0.04em; line-height:1.05">Roster</h1>');
    const h1 = screen.getByRole('heading', { name: 'Roster' });
    expect(backBtn.compareDocumentPosition(h1) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    // docs/design/Chautauqua Speakers.dc.html:264 `        <span style="font-size:13px; color:#565A4B">12 accepted · 2 not claimed</span>`
    verbatimLine(264, '        <span style="font-size:13px; color:#565A4B">12 accepted · 2 not claimed</span>');
    const summary = document.querySelector('.chq-speakers-roster-drillin .chq-summary')!;
    expect(summary.textContent).toMatch(/^\d+ accepted · \d+ not claimed$/);
    expect(h1.compareDocumentPosition(summary) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    // Row order: identity (name link + company meta) precedes the trailing
    // "Open" action, matching the frame's row (:267-274 name/meta/invite,
    // :274 boxed Open).
    const nameLink = screen.getByRole('link', { name: 'Ada Lovelace' });
    const row = nameLink.closest('.chq-speakers-roster-row')!;
    const openLink = within(row as HTMLElement).getByRole('link', { name: 'Open' });
    expect(nameLink.compareDocumentPosition(openLink) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    // docs/design/Chautauqua Speakers.dc.html:279 `        <span style="flex:1; background:#4E5C31; color:#F7F9F0; border-radius:6px; min-height:48px; display:flex; align-items:center; justify-content:center; font-size:14px; font-weight:700">Add a speaker</span>`
    verbatimLine(279, '        <span style="flex:1; background:#4E5C31; color:#F7F9F0; border-radius:6px; min-height:48px; display:flex; align-items:center; justify-content:center; font-size:14px; font-weight:700">Add a speaker</span>');
    const addBtn = screen.getByRole('button', { name: 'Add a speaker' });
    const importLink = screen.getByRole('link', { name: 'Import CSV' });
    expect(addBtn.compareDocumentPosition(importLink) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});
