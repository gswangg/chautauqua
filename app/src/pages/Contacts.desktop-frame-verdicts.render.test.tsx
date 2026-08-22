// w23-g (DEC-976 wave-23 amendment): the per-frame DESKTOP (1600) render
// verdict for Contacts' CRM/pipeline family. Sibling to
// Contacts.frame-verdicts.render.test.tsx (the five 390 frames + the
// existing contacts-v12.md) -- this file owns FOUR desktop frames in
// docs/design/Chautauqua Contacts.dc.html and a NEW audit doc,
// docs/design/audit/contacts-desktop-v12.md, per this wave's split.
// STRICTLY MEASUREMENT ONLY: desktop is frozen by the mandate, so this file
// moves no desktop byte and edits no component/stylesheet -- it renders the
// real route, verdicts what the tree actually produces, and files
// divergences in prose.
//
// Modelled exactly on Speakers.desktop-frame-verdicts.render.test.tsx: same
// verbatimLine(lineNo, literal) helper, same beforeEach/afterEach console
// guard, same mockApi test-utils. jsdom applies no stylesheet (no @media),
// so every assertion here is DOM structure/order/text, or a readFileSync of
// the APP's own stylesheet TEXT for the claims that are inherently a CSS
// fact (the visibility default of a phone-only span) -- the design pack is
// never re-read as its own proof (DEC-976/DEC-967). Every DOM/CSS lookup
// runs BEFORE its citation comment so the citation sits immediately beside
// the `expect(` that receipts it (DEC-976 wave-116's EXPECT_PROXIMITY_LINES
// window).
//
// Route entry follows Contacts.frame-verdicts.render.test.tsx's own
// established idiom exactly: ContactsPage mounted directly (no wrapping
// Routes/Route -- ContactsApp reads ?tab= itself) for the PipelineBoard
// frames, and MergePage mounted directly (it is itself the leaf route,
// reads ?ids= via useSearchParams, and is never reached FROM ContactsPage)
// for the merge frame -- never a sub-component mounted in isolation from
// the surface that actually owns its state.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter } from 'react-router-dom';
import { ContactsPage } from './Contacts';
import { MergePage } from './contacts/MergePage';
import { listEnvelope, mockApi } from '../test-utils/mockApi';
import { resetEventsCacheForTests } from '../lib/useCurrentEvent';
import type { PipelineEntry } from './contacts/types';
import { PIPELINE_STAGE_LABELS } from './contacts/types';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, '..', '..', '..');
const DESIGN_FILE = join(REPO_ROOT, 'docs', 'design', 'Chautauqua Contacts.dc.html');

/** DEC-967 shape: read the ACTUAL line, assert it byte-for-byte matches the
 * literal this file claims. Copied from
 * Speakers.desktop-frame-verdicts.render.test.tsx's own verbatimLine. */
function verbatimLine(lineNo: number, literal: string): void {
  const lines = readFileSync(DESIGN_FILE, 'utf-8').split('\n');
  const line = lines[lineNo - 1];
  if (line === undefined) throw new Error(`design file has no line ${lineNo}`);
  expect(line).toBe(literal);
}

const EVENT_ID = 'evt-contacts-desktop-verdicts';

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
  resetEventsCacheForTests();
});

/** Base mocks every ContactsPage mount needs regardless of ?tab= panel --
 * copied from Contacts.frame-verdicts.render.test.tsx's own
 * mockContactsBase (stats/segments/duplicates/contacts/events all fire
 * unconditionally on mount). */
function mockContactsBase(overrides: Record<string, unknown> = {}) {
  return mockApi({
    'GET /api/v1/contacts/stats': {
      total: 318,
      speakerCount: 41,
      returningSpeakers: 0,
      eventCount: 1,
      topCompanies: [],
    },
    'GET /api/v1/segments': listEnvelope([]),
    'GET /api/v1/contacts/duplicates': listEnvelope([]),
    'GET /api/v1/contacts': listEnvelope([]),
    'GET /api/v1/events': listEnvelope([]),
    ...overrides,
  });
}

// stageSince/updatedAt default to "1 day ago" -- comfortably under
// pipeline-age.ts's 30-day STALE_AFTER_DAYS threshold, so the age chip's
// class stays the bare `.chq-contacts-pipeline-card-age` this file asserts
// on (never the `-stale` modifier, which is out of this frame pair's scope).
const RECENT = Date.now() - 24 * 60 * 60 * 1000;

function pipelineEntry(overrides: Partial<PipelineEntry> & Pick<PipelineEntry, 'id' | 'contactId' | 'firstName' | 'lastName' | 'stage'>): PipelineEntry {
  return {
    company: null,
    email: `${overrides.firstName.toLowerCase()}@example.com`,
    updatedAt: RECENT,
    stageSince: RECENT,
    declineReason: null,
    fitScore: null,
    rationale: null,
    ...overrides,
  };
}

describe('v12 Contacts DESKTOP (1600) frames: per-frame render verdict receipts (w23-g, DEC-976 wave-23 amendment)', () => {
  // ---------------------------------------------------------------------
  // Frame :312 "Pipeline · invitations for next year" -- the desktop
  // Kanban board, docs/design's "Chautauqua Contacts" sheet, frame span
  // roughly lines 305-341 (each assertion below cites its own exact line).
  // ---------------------------------------------------------------------
  describe('frame :312 "Pipeline · invitations for next year"', () => {
    function renderBoard(entries: PipelineEntry[]) {
      mockContactsBase({ 'GET /api/v1/pipeline': listEnvelope(entries) });
      return render(
        <MemoryRouter initialEntries={['/contacts?tab=pipeline']}>
          <ContactsPage />
        </MemoryRouter>,
      );
    }

    it('MATCHES: the head band is back-link + H1 "Pipeline" + "N people · drag between columns" caption', async () => {
      renderBoard([
        pipelineEntry({ id: 'e1', contactId: 'ct1', firstName: 'Priya', lastName: 'Raman', stage: 'identified' }),
      ]);
      const backLink = await screen.findByRole('button', { name: '‹ Contacts' });
      const heading = screen.getByRole('heading', { level: 1, name: 'Pipeline' });
      const caption = document.querySelector('.chq-contacts-pipeline-caption')?.textContent;
      // docs/design/Chautauqua Contacts.dc.html:318 --
      // `<a href="#" style="font-size:13px; font-weight:700">‹ Contacts</a>`
      // -- :319 draws the H1, :321 the caption; our fixture's own count
      // stands in for the frame's illustrative "20".
      verbatimLine(318, '          <a href="#" style="font-size:13px; font-weight:700">‹ Contacts</a>');
      expect(backLink).toBeInTheDocument();
      expect(heading).toBeInTheDocument();
      expect(caption).toMatch(/^\d+ people · drag between columns$/);
    });

    it('MATCHES: five columns render in Identified/Contacted/Interested/Confirmed/Declined order, each headed by its own name + live count', async () => {
      renderBoard([
        pipelineEntry({ id: 'e1', contactId: 'ct1', firstName: 'Priya', lastName: 'Raman', stage: 'identified' }),
        pipelineEntry({ id: 'e2', contactId: 'ct2', firstName: 'Ruth', lastName: 'Adeyemi', stage: 'identified' }),
      ]);
      await screen.findByRole('heading', { level: 1, name: 'Pipeline' });
      const columns = document.querySelectorAll('.chq-contacts-pipeline-column');
      const names = [...columns].map((c) => c.querySelector('.chq-contacts-pipeline-column-name')?.textContent);
      const counts = [...columns].map((c) => c.querySelector('.chq-contacts-pipeline-column-count')?.textContent);
      // docs/design/Chautauqua Contacts.dc.html:327-330 -- the `sc-for`
      // template draws each `{{ col.name }}` / `{{ col.count }}` pair as a
      // grid of 5 (`grid-template-columns:repeat(5, 1fr)`, :324).
      verbatimLine(328, '              <span style="font-family:\'Familjen Grotesk\', sans-serif; font-size:11px; font-weight:700; letter-spacing:0.1em; text-transform:uppercase">{{ col.name }}</span>');
      expect(names).toEqual(Object.values(PIPELINE_STAGE_LABELS));
      expect(counts).toEqual(['2', '0', '0', '0', '0']);
    });

    it('MATCHES: a card renders name / company / fit-and-rationale / age, in that order', async () => {
      renderBoard([
        pipelineEntry({
          id: 'e1',
          contactId: 'ct1',
          firstName: 'Priya',
          lastName: 'Raman',
          stage: 'identified',
          company: 'Latticework Systems',
          fitScore: 4,
          rationale: 'Runs the build team',
        }),
      ]);
      await screen.findByRole('heading', { level: 1, name: 'Pipeline' });
      const card = document.querySelector('.chq-contacts-pipeline-card');
      const parts = [...(card?.children ?? [])].map((el) => el.className);
      // docs/design/Chautauqua Contacts.dc.html:332-339 -- the card
      // template draws `{{ card.name }}` / `{{ card.company }}` / a row
      // holding `{{ card.score }}` and `{{ card.note }}` / `{{ card.age }}`,
      // in that order.
      verbatimLine(332, '              <div style="border:1px solid #D3CFC0; border-radius:5px; background:#FAF8F2; padding:12px; display:flex; flex-direction:column; gap:3px">');
      expect(parts).toEqual([
        'chq-contacts-pipeline-card-name',
        'chq-contacts-pipeline-card-company',
        'chq-contacts-pipeline-card-fit-row',
        'chq-contacts-pipeline-card-age',
      ]);
      expect(within(card as HTMLElement).getByText('Fit 4')).toBeInTheDocument();
    });

    it('DIVERGES (additive): the frame draws no control in the head band besides the back-link/title/caption; the tree adds a secondary "Add to the pipeline" button there', async () => {
      renderBoard([]);
      await screen.findByRole('heading', { level: 1, name: 'Pipeline' });
      const head = document.querySelector('.chq-contacts-pipeline-head');
      // docs/design/Chautauqua Contacts.dc.html:321 -- `<span style="font-size:13px; color:#565A4B">20 people · drag between columns</span>`
      // -- the head band's flex row (:316-322) holds exactly two children.
      verbatimLine(321, '        <span style="font-size:13px; color:#565A4B">20 people · drag between columns</span>');
      const headButton = within(head as HTMLElement).getByRole('button', { name: 'Add to the pipeline' });
      expect(headButton).toBeInTheDocument();
    });
  });

  // ---------------------------------------------------------------------
  // Frame :720 "Pipeline · an empty stage" -- roughly lines 717-761 of the
  // same sheet (each assertion below cites its own exact line). An EMPTY
  // state, produced via an empty per-stage API envelope through mockApi,
  // never by mounting an empty-state component directly.
  // ---------------------------------------------------------------------
  describe('frame :720 "Pipeline · an empty stage"', () => {
    function renderBoardWithEmptyConfirmed() {
      // 7 identified + 5 contacted + 4 interested + 0 confirmed + 2
      // declined = 18, matching the frame's own "18 people across five
      // stages" caption exactly, and its "Contacted · 5"/"Interested · 4"
      // pill counts.
      const entries: PipelineEntry[] = [
        ...Array.from({ length: 7 }, (_, i) =>
          pipelineEntry({ id: `id-${i}`, contactId: `c-id-${i}`, firstName: 'A', lastName: `Identified${i}`, stage: 'identified' }),
        ),
        ...Array.from({ length: 5 }, (_, i) =>
          pipelineEntry({ id: `co-${i}`, contactId: `c-co-${i}`, firstName: 'B', lastName: `Contacted${i}`, stage: 'contacted' }),
        ),
        ...Array.from({ length: 4 }, (_, i) =>
          pipelineEntry({ id: `in-${i}`, contactId: `c-in-${i}`, firstName: 'C', lastName: `Interested${i}`, stage: 'interested' }),
        ),
        ...Array.from({ length: 2 }, (_, i) =>
          pipelineEntry({ id: `de-${i}`, contactId: `c-de-${i}`, firstName: 'D', lastName: `Declined${i}`, stage: 'declined', declineReason: 'Timing' }),
        ),
      ];
      mockContactsBase({ 'GET /api/v1/pipeline': listEnvelope(entries) });
      return render(
        <MemoryRouter initialEntries={['/contacts?tab=pipeline']}>
          <ContactsPage />
        </MemoryRouter>,
      );
    }

    it('DIVERGES (structural): the frame draws a full-page chrome with a single-stage pill nav and one big empty block; the real empty stage is one column among five always-visible ones, inside the same persistent kanban board', async () => {
      renderBoardWithEmptyConfirmed();
      await screen.findByRole('heading', { level: 1, name: 'Pipeline' });
      // docs/design/Chautauqua Contacts.dc.html:750 -- `<a href="#" style="border:1px solid #BAB6A6; border-radius:99px; padding:6px 14px; font-size:13px; font-weight:500; color:#3F4237">Identified · 7</a>`
      // -- one of the :749-755 pill-nav row, page-level single-stage-at-a-time nav; the tree has no counterpart (all 5 stages render as permanent columns).
      verbatimLine(750, '          <a href="#" style="border:1px solid #BAB6A6; border-radius:99px; padding:6px 14px; font-size:13px; font-weight:500; color:#3F4237">Identified · 7</a>');
      const singleStagePillNav = document.querySelector('.chq-contacts-pipeline-phone-stages');
      expect(document.querySelectorAll('.chq-contacts-pipeline-column').length).toBe(5);
      // The frame's single-stage pill filter DOES exist in the tree, but
      // only as the PHONE fallback strip -- confirming it is not the
      // desktop board's own navigation.
      expect(singleStagePillNav).not.toBeNull();
    });

    it('MATCHES: the empty Confirmed column carries the frame\'s own heading text "Nobody has said yes yet" and a tertiary "Add someone to Confirmed ›" action', async () => {
      renderBoardWithEmptyConfirmed();
      await screen.findByRole('heading', { level: 1, name: 'Pipeline' });
      const confirmedColumn = document.querySelector('.chq-contacts-pipeline-column[data-stage="confirmed"]');
      const emptyHeading = within(confirmedColumn as HTMLElement).getByText('Nobody has said yes yet');
      // docs/design/Chautauqua Contacts.dc.html:757 --
      // `<span style="font-family:'Familjen Grotesk', sans-serif; font-size:26px; font-weight:700; letter-spacing:-0.035em; line-height:1.2">Nobody has said yes yet</span>`
      verbatimLine(757, '          <span style="font-family:\'Familjen Grotesk\', sans-serif; font-size:26px; font-weight:700; letter-spacing:-0.035em; line-height:1.2">Nobody has said yes yet</span>');
      expect(emptyHeading).toBeInTheDocument();
      const addLink = within(confirmedColumn as HTMLElement).getByRole('button', { name: 'Add someone to Confirmed ›' });
      expect(addLink).toBeInTheDocument();
    });

    it('DIVERGES (content): the frame\'s empty-stage body names "Contacted" as the prior stage; the tree names the STRUCTURALLY previous stage, "Interested"', async () => {
      renderBoardWithEmptyConfirmed();
      await screen.findByRole('heading', { level: 1, name: 'Pipeline' });
      const confirmedColumn = document.querySelector('.chq-contacts-pipeline-column[data-stage="confirmed"]');
      const body = confirmedColumn?.querySelector('.chq-empty-reason')?.textContent;
      // docs/design/Chautauqua Contacts.dc.html:758 -- `<span style="font-size:16px; line-height:1.65; color:#3F4237; max-width:52ch">Five people are in Contacted. Cards land here when you move them, or you can add someone straight to this stage.</span>`
      // -- the frame counts back to Contacted (5, two stages prior); PipelineBoard.tsx's stageEmptyBody() reports the immediately preceding stage instead (Interested, 4 here).
      verbatimLine(758, '          <span style="font-size:16px; line-height:1.65; color:#3F4237; max-width:52ch">Five people are in Contacted. Cards land here when you move them, or you can add someone straight to this stage.</span>');
      expect(body).toBe('Four people are in Interested. Cards land here when you move them, or you can add someone straight to this stage.');
    });
  });

  // ---------------------------------------------------------------------
  // Frame :617 "Add to the pipeline" -- roughly lines 614-661 of the same
  // sheet (each assertion below cites its own exact line). A dialog,
  // opened through the real PipelineBoard header control that opens it.
  // ---------------------------------------------------------------------
  describe('frame :617 "Add to the pipeline"', () => {
    async function openEnrollDialog() {
      mockContactsBase({ 'GET /api/v1/pipeline': listEnvelope([]) });
      render(
        <MemoryRouter initialEntries={['/contacts?tab=pipeline']}>
          <ContactsPage />
        </MemoryRouter>,
      );
      const trigger = await screen.findByRole('button', { name: 'Add to the pipeline' });
      fireEvent.click(trigger);
      return screen.findByRole('dialog', { name: 'Add to the pipeline' });
    }

    it('MATCHES: the dialog title is "Add to the pipeline"', async () => {
      const dialog = await openEnrollDialog();
      const title = within(dialog).getByRole('heading', { level: 2, name: 'Add to the pipeline' });
      // docs/design/Chautauqua Contacts.dc.html:624 --
      // `<span style="font-family:'Familjen Grotesk', sans-serif; font-size:23px; font-weight:700; letter-spacing:-0.035em; line-height:1">Add to the pipeline</span>`
      verbatimLine(624, '          <span style="font-family:\'Familjen Grotesk\', sans-serif; font-size:23px; font-weight:700; letter-spacing:-0.035em; line-height:1">Add to the pipeline</span>');
      expect(title).toBeInTheDocument();
    });

    it('DIVERGES: the frame draws a per-contact subtitle ("Aisha Karim · Vector Foundry") under the title; this board-header trigger opens with no subtitle at all -- there is no contact context to name', async () => {
      const dialog = await openEnrollDialog();
      const subtitle = dialog.querySelector('.chq-modal-sub');
      // docs/design/Chautauqua Contacts.dc.html:625 --
      // `<span style="font-size:13px; color:#565A4B">Aisha Karim · Vector Foundry</span>`
      verbatimLine(625, '          <span style="font-size:13px; color:#565A4B">Aisha Karim · Vector Foundry</span>');
      expect(subtitle).toBeNull();
    });

    it('MATCHES: the Stage row renders every PIPELINE_STAGE as a chip, and the Fit row renders 1-5 with the "Ranks people within a stage · optional" helper', async () => {
      const dialog = await openEnrollDialog();
      const stageGroup = within(dialog).getByRole('group', { name: 'Starting stage' });
      const stageLabels = within(stageGroup).getAllByRole('button').map((b) => b.textContent);
      const fitHelper = within(dialog).getByText('Ranks people within a stage · optional');
      const fitGroup = within(dialog).getByRole('group', { name: 'Fit' });
      // docs/design/Chautauqua Contacts.dc.html:643 --
      // `<span style="font-size:12px; color:#565A4B">Ranks people within a stage · optional</span>`
      verbatimLine(643, '            <span style="font-size:12px; color:#565A4B">Ranks people within a stage · optional</span>');
      expect(stageLabels).toEqual(Object.values(PIPELINE_STAGE_LABELS));
      expect(within(fitGroup).getAllByRole('button')).toHaveLength(5);
      expect(fitHelper).toBeInTheDocument();
    });

    it('DIVERGES (content): the frame\'s footer primary reads "Add to pipeline" (no "the"); the tree\'s button reads "Add to the pipeline", matching the title/trigger instead -- "Cancel" and the no-email consequence line otherwise MATCH', async () => {
      const dialog = await openEnrollDialog();
      const cancelButton = within(dialog).getByRole('button', { name: 'Cancel' });
      const consequence = within(dialog).getByText('Adding writes a move to the activity feed · no email is sent');
      // docs/design/Chautauqua Contacts.dc.html:661 -- `<span style="background:#4E5C31; color:#F7F9F0; border-radius:4px; min-height:46px; display:flex; align-items:center; padding:0 18px; font-size:14px; font-weight:700">Add to pipeline</span>`
      // -- three words, not four; the tree's real primary reads "Add to the pipeline" (matching the title above).
      verbatimLine(661, '          <span style="background:#4E5C31; color:#F7F9F0; border-radius:4px; min-height:46px; display:flex; align-items:center; padding:0 18px; font-size:14px; font-weight:700">Add to pipeline</span>');
      const primaryButtons = within(dialog).getAllByRole('button', { name: /Add to (the )?pipeline/ });
      expect(primaryButtons).toHaveLength(1);
      expect(primaryButtons[0]).toHaveTextContent('Add to the pipeline');
      expect(cancelButton).toBeInTheDocument();
      // docs/design/Chautauqua Contacts.dc.html:663 -- `<span style="font-size:12px; color:#565A4B; line-height:1.5">Adding writes a move to the activity feed · no email is sent</span>`
      verbatimLine(663, '          <span style="font-size:12px; color:#565A4B; line-height:1.5">Adding writes a move to the activity feed · no email is sent</span>');
      expect(consequence).toBeInTheDocument();
    });
  });

  // ---------------------------------------------------------------------
  // Frame :352 "Duplicates · merge" -- roughly lines 349-393 of the same
  // sheet (each assertion below cites its own exact line). Entered by
  // mounting MergePage directly, the established idiom in
  // Contacts.frame-verdicts.render.test.tsx's own
  // "Merge · 390" case (MergePage is itself the leaf route, reached only
  // via URL, never FROM ContactsPage).
  // ---------------------------------------------------------------------
  describe('frame :352 "Duplicates · merge"', () => {
    const cssPath = join(HERE, 'contacts', 'contacts-panels.css');
    const css = readFileSync(cssPath, 'utf-8');

    function renderMerge() {
      const group = {
        contactIds: ['ct1', 'ct2'],
        reason: 'email' as const,
        contacts: [
          { id: 'ct1', firstName: 'Marcus', lastName: 'Okafor', email: 'marcus@example.com', company: 'Acme', title: 'Lead', createdAt: 1000 },
          { id: 'ct2', firstName: 'Marcus', lastName: 'O.', email: 'marcus.o@example.com', company: 'Acme', title: null, createdAt: 2000 },
        ],
      };
      mockApi({
        'GET /api/v1/contacts/duplicates': { items: [group], total: 6, position: 1 },
        'GET /api/v1/contacts/merge/preview': {
          fields: [{ key: 'email', label: 'Email', kept: 'marcus@example.com', discarded: ['marcus.o@example.com'], outcome: 'keep' }],
          impact: { submissions: 3, tasks: 1 },
          blocked: null,
        },
      });
      return render(
        <MemoryRouter initialEntries={['/contacts/merge?ids=ct1,ct2']}>
          <MergePage />
        </MemoryRouter>,
      );
    }

    it('MATCHES (DEC-919 wave-7 amendment): the frame\'s back link is bare "‹ Duplicates" at both widths; the "Contacts · " prefix span was removed entirely, not merely hidden', async () => {
      // The prefix class no longer exists anywhere in the source -- neither
      // top-level nor inside the phone `@media (max-width:700px)` block.
      const topLevelRuleCount = (css.match(/\.chq-contacts-merge-back-prefix\s*\{/g) ?? []).length;
      expect(topLevelRuleCount).toBe(0);
      renderMerge();
      const backLink = await screen.findByRole('link', { name: /Duplicates$/ });
      // docs/design/Chautauqua Contacts.dc.html:359 --
      // `<a href="#" style="font-size:13px; font-weight:700">‹ Duplicates</a>`
      verbatimLine(359, '          <a href="#" style="font-size:13px; font-weight:700">‹ Duplicates</a>');
      expect(backLink.textContent).toBe('‹ Duplicates');
    });

    it('MATCHES: H1 "Merge two records" and the right-flushed "N of M pairs" caption, with no name suffix (that span carries a top-level display:none)', async () => {
      const topLevelRuleCount = (css.match(/\.chq-contacts-merge-pair-count-name\s*,/g) ?? []).length;
      expect(topLevelRuleCount).toBe(1); // the top-level hide-by-default rule, shared with the phone label
      renderMerge();
      const heading = await screen.findByRole('heading', { level: 1, name: 'Merge two records' });
      await waitFor(() => expect(screen.getByText(/of 6 pair/)).toBeInTheDocument());
      const pairCount = document.querySelector('.chq-contacts-merge-pair-count');
      const nameSuffix = pairCount?.querySelector('.chq-contacts-merge-pair-count-name');
      // docs/design/Chautauqua Contacts.dc.html:360, :362 -- H1 `Merge two
      // records` and `<span style="font-size:13px; color:#565A4B">1 of 6
      // pairs</span>`, no trailing name.
      verbatimLine(362, '        <span style="font-size:13px; color:#565A4B">1 of 6 pairs</span>');
      expect(heading).toBeInTheDocument();
      expect(pairCount?.textContent).toBe('1 of 6 pairs · Marcus Okafor');
      expect(nameSuffix).not.toBeNull(); // present in the DOM, hidden by the CSS text confirmed above
    });

    it('MATCHES: the compare-table head is Field / Keeping · <name> · added <date> / Discarding · <name> · added <date>', async () => {
      renderMerge();
      await screen.findByRole('heading', { level: 1, name: 'Merge two records' });
      const head = document.querySelector('.chq-contacts-merge-compare-head');
      await waitFor(() => expect(head?.textContent).toContain('Keeping'));
      // docs/design/Chautauqua Contacts.dc.html:367-376 -- `Field` /
      // `Keeping` + name+date / `Discarding` + name+date, three columns.
      verbatimLine(367, '          <span style="font-size:10px; font-weight:800; letter-spacing:0.1em; text-transform:uppercase; color:#565A4B">Field</span>');
      const spans = head?.querySelectorAll(':scope > span, :scope > div');
      expect(spans?.[0]?.textContent).toBe('Field');
      expect(spans?.[1]?.textContent).toMatch(/^Keeping · Marcus Okafor.*added/);
      expect(spans?.[2]?.textContent).toMatch(/^Discarding · Marcus O\..*added/);
    });

    it('ADJUDICATED, frame-silent addition (same disposition as the "Merge · 390" phone frame, DEC-663 wave-17): the tree draws a "which record to keep" radio-pick list above the compare rows the frame draws no counterpart for', async () => {
      renderMerge();
      await screen.findByRole('heading', { level: 1, name: 'Merge two records' });
      const picks = document.querySelector('.chq-contacts-merge-picks');
      // docs/design/Chautauqua Contacts.dc.html:365 -- `<div style="max-width:820px; margin:0 auto; width:100%; padding:22px 28px 30px; display:flex; flex-direction:column; gap:16px">`
      // -- the head band (:357-362) goes straight into this compare-table wrapper with no picker block between them.
      verbatimLine(365, '      <div style="max-width:820px; margin:0 auto; width:100%; padding:22px 28px 30px; display:flex; flex-direction:column; gap:16px">');
      expect(picks).not.toBeNull();
      expect(within(picks as HTMLElement).getAllByRole('radio')).toHaveLength(2);
    });

    it('DIVERGES (content): the frame\'s consequence line names the kept record generically ("the kept record"); the tree names it directly ("Marcus Okafor") -- the generic span carries a top-level display:none, the named span does not', async () => {
      const namedTopLevelRuleCount = (css.match(/\.chq-contacts-merge-impact-name\s*\{/g) ?? []).length;
      const genericTopLevelRuleCount = (css.match(/\.chq-contacts-merge-impact-generic\s*\{/g) ?? []).length;
      expect(namedTopLevelRuleCount).toBe(1); // the ONE occurrence is inside the phone media block (hides it there only)
      expect(genericTopLevelRuleCount).toBe(2); // one top-level (hides by default) + one inside the phone block (unhides it there)
      renderMerge();
      await screen.findByRole('heading', { level: 1, name: 'Merge two records' });
      const ruleBox = await screen.findByText(/Labels combine, notes are appended/);
      const namedSpan = ruleBox.querySelector('.chq-contacts-merge-impact-name');
      const genericSpan = ruleBox.querySelector('.chq-contacts-merge-impact-generic');
      // docs/design/Chautauqua Contacts.dc.html:388 -- `<span style="font-size:13px; color:#3F4237; line-height:1.55">3 submissions and 1 task move to the kept record. The discarded record is deleted.</span>`
      // -- BOTH sibling spans render in this jsdom tree (no stylesheet), so the CSS-text assertions above prove which one a real browser shows at 1600.
      verbatimLine(388, '          <span style="font-size:13px; color:#3F4237; line-height:1.55">3 submissions and 1 task move to the kept record. The discarded record is deleted.</span>');
      expect(namedSpan).toHaveTextContent('Marcus Okafor');
      expect(genericSpan).toHaveTextContent('the record you keep');
    });

    it('MATCHES: the footer is "Merge into <name>" / "Swap which is kept" / "Not a duplicate"', async () => {
      renderMerge();
      await screen.findByRole('heading', { level: 1, name: 'Merge two records' });
      const mergeButton = await screen.findByRole('button', { name: /^Merge into/ });
      const swapButton = screen.getByRole('button', { name: 'Swap which is kept' });
      const notDup = screen.getByRole('button', { name: 'Not a duplicate' });
      // docs/design/Chautauqua Contacts.dc.html:392-394 -- `Merge into
      // Marcus Okafor` / `Swap which is kept` / `Not a duplicate`.
      verbatimLine(393, '          <span style="border:1px solid #CFC7B7; border-radius:4px; background:#EFEBDF; min-height:46px; display:flex; align-items:center; padding:0 16px; font-size:13px; font-weight:600; color:#2E2A24">Swap which is kept</span>');
      expect(mergeButton).toBeInTheDocument();
      expect(swapButton).toBeInTheDocument();
      expect(notDup).toBeInTheDocument();
    });
  });
});
