// w26-c (DEC-976/DEC-651/DEC-032 wave-26): Comms DESKTOP (1600) render
// verdicts, residue part 1 of 2 -- the two compose-wizard steps
// v12m-w23-e did NOT claim (that lane owns :222/:360/:544/:589, 4-of-9 in
// its own doc). This file owns the remaining two: :28 "Compose · step 3 of
// 4 · 1600" (the review/preview step) and :453 "Compose · step 4 of 4"
// (the send/confirm step).
//
// DEC-651 (a Modal/Menu/STATE frame is verdicted by operating the control
// that opens it on the real route, never a direct component mount):
// entered through `CommsPage` (app/src/pages/Comms.tsx) via MemoryRouter
// with `?tab=compose`, driving the real `ComposeWizard` (app/src/pages/
// comms/ComposeWizard.tsx) forward through its own steps -- never
// `<ComposeWizard>` mounted alone.
//
// Harness copied verbatim (verbatimLine helper, beforeEach/afterEach
// shape, mockApi/listEnvelope test-utils, the events-cache reset pair) from
// the LANDED app/src/pages/Speakers.desktop-frame-verdicts.render.test.tsx
// / app/src/pages/Comms.frame-verdicts.render.test.tsx.
//
// STRICTLY MEASUREMENT ONLY (DEC-651 wave-26): no component or stylesheet
// edits. jsdom applies no stylesheet (no @media), so every assertion below
// is DOM structure/order/text, or comms.css's own TEXT for an inherently-
// CSS claim -- never a computed style, never the design pack re-read as its
// own proof (DEC-976/DEC-967).
//
// DEC-032: this file cites NO line inside a DEVIATIONS §6 deferred extent
// -- both frames here are fully in-scope, and no Settings frame is cited.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter } from 'react-router-dom';
import { CommsPage } from './Comms';
import { listEnvelope, mockApi } from '../test-utils/mockApi';
import { resetEventsCacheForTests, resetInitialStoredIdForTests } from '../lib/useCurrentEvent';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, '..', '..', '..');
const DESIGN_FILE = join(REPO_ROOT, 'docs', 'design', 'Chautauqua Comms.dc.html');

/** DEC-967 shape: read the ACTUAL line, assert it byte-for-byte matches the
 * literal this file claims. Copied from Speakers.desktop-frame-verdicts
 * .render.test.tsx's own verbatimLine. */
function verbatimLine(lineNo: number, literal: string): void {
  const lines = readFileSync(DESIGN_FILE, 'utf-8').split('\n');
  const line = lines[lineNo - 1];
  if (line === undefined) throw new Error(`design file has no line ${lineNo}`);
  expect(line).toBe(literal);
}

const EVENT_ID = 'evt-comms-compose-desktop-verdicts';

// 23 recipients, matching the frame's own demo numbers (:81 "Recipients ·
// 23", :93 "18 more · 23 is under the 100-recipient cap", :110 "3 of 23
// have no slot yet") -- the last 3 are unscheduled so noSlotCount === 3.
const RECIPIENT_COUNT = 23;
const NO_SLOT_COUNT = 3;

function buildRecipients() {
  return Array.from({ length: RECIPIENT_COUNT }, (_, i) => {
    const n = i + 1;
    return {
      contactId: `ct-${n}`,
      submissionId: `sub-${n}`,
      email: `speaker${n}@example.com`,
      name: `Speaker ${n}`,
      ref: `S-${String(n).padStart(3, '0')}`,
      scheduled: n <= RECIPIENT_COUNT - NO_SLOT_COUNT,
      subject: 'Your talk has been accepted to DevFlow Conf 2027',
      text: `Hi Speaker ${n},\n\nCongratulations on your talk.`,
      willSend: true,
    };
  });
}

const SUBMISSION_IDS = buildRecipients().map((r) => r.submissionId);

// The send report matches the frame's own demo numbers exactly (:498 "21
// of 23 speakers were emailed", :514/:515 "Two were skipped" / "Nothing
// was sent to these two"): 21 sent + 0 failed + 2 skipped === 23 total.
function mockComposeEndpoints() {
  return mockApi({
    'GET /api/v1/events': listEnvelope([{ id: EVENT_ID, slug: 'devflow-2027', name: 'DevFlow Conf 2027' }]),
    [`GET /api/v1/events/${EVENT_ID}/email-log`]: listEnvelope([]),
    [`GET /api/v1/events/${EVENT_ID}/templates`]: listEnvelope([]),
    [`GET /api/v1/events/${EVENT_ID}/submissions`]: listEnvelope([]),
    [`GET /api/v1/events/${EVENT_ID}/plans`]: listEnvelope([]),
    [`POST /api/v1/events/${EVENT_ID}/compose/preview`]: { items: buildRecipients() },
    [`POST /api/v1/events/${EVENT_ID}/compose/send`]: {
      sent: 21,
      failed: [],
      skipped: [
        {
          email: 'ada@example.com',
          name: 'Ada Lovelace',
          submissionId: 'sub-skip-1',
          reason: 'already_sent_recently',
          retryAtIso: new Date(Date.now() + 20 * 60 * 1000).toISOString(),
        },
        {
          email: 'grace@example.com',
          name: 'Grace Hopper',
          submissionId: 'sub-skip-2',
          reason: 'duplicate_in_batch',
        },
      ],
    },
  });
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
  resetEventsCacheForTests();
  resetInitialStoredIdForTests();
  window.history.pushState({}, '', '/');
});

// DEC-651: enter through CommsPage's own route, ?tab=compose, exactly like
// Comms.frame-verdicts.render.test.tsx's renderTab. ComposeWizard reads its
// own ?ids= landing param straight off window.location.search (not
// react-router's useSearchParams), so the pushState below carries it
// alongside the MemoryRouter entry CommsPage itself reads ?tab= from.
async function landAtTemplateStep() {
  const ids = SUBMISSION_IDS.join(',');
  window.history.pushState({}, '', `/comms?tab=compose&ids=${ids}`);
  mockComposeEndpoints();
  render(
    <MemoryRouter initialEntries={['/comms?tab=compose']}>
      <CommsPage />
    </MemoryRouter>,
  );
  await waitFor(() => expect(screen.getByText('2. Pick or edit a template')).toBeInTheDocument());
}

async function advanceToPreviewStep() {
  await landAtTemplateStep();
  fireEvent.change(screen.getByLabelText('Subject'), {
    target: { value: 'Your talk has been accepted to DevFlow Conf 2027' },
  });
  fireEvent.change(screen.getByLabelText('Body'), {
    target: { value: 'Hi {speaker_name}, congratulations on your talk.' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Next: preview' }));
  await screen.findByText('Attachments');
}

async function advanceToSendReport() {
  await advanceToPreviewStep();
  fireEvent.click(screen.getByRole('button', { name: 'Next: send ›' }));
  const sendButton = await screen.findByRole('button', { name: /^Send \d+ emails?$/ });
  fireEvent.click(sendButton);
  await screen.findByText('Send complete');
}

describe('v12 Comms DESKTOP (1600) compose-wizard frames: per-frame render verdict receipts (w26-c, residue part 1 of 2)', () => {
  // -----------------------------------------------------------------------
  // Frame :28 "Compose · step 3 of 4 · 1600" -- the review/preview step.
  // -----------------------------------------------------------------------
  describe('frame :28 "Compose · step 3 of 4 · 1600" (ComposeWizard preview step)', () => {
    it('MATCHES: "Recipients · N" section head and "Change selection" control', async () => {
      await advanceToPreviewStep();
      // docs/design/Chautauqua Comms.dc.html:81-82 --
      // `<span ...>Recipients · 23</span>` + `<a href="#" ...>Change selection</a>`
      verbatimLine(
        81,
        '              <span style="font-family:\'Familjen Grotesk\', sans-serif; font-size:11px; font-weight:700; letter-spacing:0.12em; text-transform:uppercase">Recipients · 23</span>',
      );
      expect(screen.getByText(`Recipients · ${RECIPIENT_COUNT}`)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Change selection' })).toBeInTheDocument();
    });

    it('MATCHES (verbatim, exact recipient count): the overflow footer "N more · M is under the 100-recipient cap"', async () => {
      await advanceToPreviewStep();
      // docs/design/Chautauqua Comms.dc.html:93 -- with the frame's own
      // RECIPIENT_PREVIEW_ROWS-implied 5-row preview and 23 total
      // recipients, the overflow footer reads byte-identical to the app's
      // own `{overflow} more · {length} is {at|under} the {cap}-recipient
      // cap` line (ComposeWizard.tsx:1393-1397).
      verbatimLine(
        93,
        '            <div style="padding:13px 0 0; font-size:13px; color:#565A4B">18 more · 23 is under the 100-recipient cap</div>',
      );
      expect(screen.getByText('18 more · 23 is under the 100-recipient cap')).toBeInTheDocument();
    });

    it('DIVERGES (additively): the app inserts a "N submissions resolved to M recipients" reconciliation line the frame never draws', async () => {
      await advanceToPreviewStep();
      // docs/design/Chautauqua Comms.dc.html:81 draws ONLY "Recipients ·
      // 23" -- no submissions->recipients reconciliation sentence anywhere
      // in this section. ComposeWizard.tsx:1364-1376 (DEC-829 wave-128 Cut-
      // 2 item 5) adds one: the SELECTED submission count resolved to the
      // rendered recipient count, the exact "counting vocabulary" seam this
      // task calls out between the two steps.
      verbatimLine(
        81,
        '              <span style="font-family:\'Familjen Grotesk\', sans-serif; font-size:11px; font-weight:700; letter-spacing:0.12em; text-transform:uppercase">Recipients · 23</span>',
      );
      expect(
        screen.getByText(`${RECIPIENT_COUNT} submissions resolved to ${RECIPIENT_COUNT} recipients`),
      ).toBeInTheDocument();
    });

    it('DIVERGES: the panel title drops "and merge fields" -- frame draws "Attachments and merge fields", the tree renders "Attachments"', async () => {
      await advanceToPreviewStep();
      // docs/design/Chautauqua Comms.dc.html:96 --
      // `<span ...>Attachments and merge fields</span>`
      verbatimLine(
        96,
        '              <span style="font-family:\'Familjen Grotesk\', sans-serif; font-size:14px; font-weight:700">Attachments and merge fields</span>',
      );
      expect(screen.queryByText('Attachments and merge fields')).not.toBeInTheDocument();
      expect(screen.getByText('Attachments')).toBeInTheDocument();
    });

    it('MATCHES: "Include reviewer feedback" and "Attach calendar invite" toggles both render, in the frame\'s order', async () => {
      await advanceToPreviewStep();
      // docs/design/Chautauqua Comms.dc.html:99, :108 --
      // `Include reviewer feedback` then `Attach calendar invite`.
      verbatimLine(
        99,
        '                Include reviewer feedback',
      );
      verbatimLine(
        108,
        '                Attach calendar invite',
      );
      const toggles = screen.getAllByRole('checkbox').map((c) => c.closest('label')?.textContent?.trim());
      const feedbackIdx = toggles.indexOf('Include reviewer feedback');
      const icsIdx = toggles.indexOf('Attach calendar invite');
      expect(feedbackIdx).toBeGreaterThanOrEqual(0);
      expect(icsIdx).toBeGreaterThan(feedbackIdx);
    });

    it('DIVERGES: the "which plan" selector is always-visible with a preselected value in the frame, but reveal-on-check with an empty placeholder in the tree (ruling A18)', async () => {
      await advanceToPreviewStep();
      // docs/design/Chautauqua Comms.dc.html:102-103 -- the plan selector
      // sits as a permanent sibling of the checkbox, labelled "From which
      // plan" and preselected to "Wave 1 — first pass, all tracks".
      verbatimLine(
        102,
        '                <span style="font-size:11px; font-weight:800; letter-spacing:0.1em; text-transform:uppercase; color:#565A4B">From which plan</span>',
      );
      // Unchecked: the tree shows no plan selector at all (ComposeWizard.tsx
      // gates the whole `.chq-comms-panel-indent` block on `includeFeedback`).
      expect(screen.queryByText('From which plan')).not.toBeInTheDocument();
      expect(screen.queryByLabelText('Evaluation plan')).not.toBeInTheDocument();
      // Checking it reveals a DIFFERENTLY-labelled select with no
      // preselected value -- "Evaluation plan", starting at the
      // "Choose a plan…" placeholder, never the frame's own default text.
      fireEvent.click(screen.getByRole('checkbox', { name: 'Include reviewer feedback' }));
      const select = await screen.findByLabelText('Evaluation plan');
      expect(select).toHaveValue('');
      expect(screen.queryByText('Wave 1 — first pass, all tracks')).not.toBeInTheDocument();
    });

    it('DIVERGES: the "N have no slot yet" advisory is unconditional in the frame (drawn beside an UNCHECKED "Attach calendar invite") but gated on that same toggle in the tree', async () => {
      await advanceToPreviewStep();
      // docs/design/Chautauqua Comms.dc.html:107 draws "Attach calendar
      // invite" UNCHECKED (`border:1px solid #8E8A7A`, no fill -- contrast
      // :98's `background:#4E5C31` for the CHECKED "Include reviewer
      // feedback" box immediately above it), yet :110's advisory still
      // renders beneath it.
      verbatimLine(
        107,
        '                <span style="width:17px; height:17px; border:1px solid #8E8A7A; border-radius:3px; flex-shrink:0"></span>',
      );
      verbatimLine(
        110,
        '              <span style="font-size:12px; color:#565A4B; line-height:1.5">3 of 23 have no slot yet — those get no invite</span>',
      );
      // Default (attachIcs === false, matching the frame's own unchecked
      // box): the tree shows nothing -- ComposeWizard.tsx:1461 gates the
      // whole note on `attachIcs && noSlotCount > 0`.
      expect(screen.queryByText(/have no slot yet/)).not.toBeInTheDocument();
      // Only checking the toggle reveals it -- and then the count matches.
      fireEvent.click(screen.getByRole('checkbox', { name: 'Attach calendar invite' }));
      expect(
        await screen.findByText(`${NO_SLOT_COUNT} of ${RECIPIENT_COUNT} have no slot yet — those get no invite`),
      ).toBeInTheDocument();
    });

    it('MATCHES: the Preview pane header "Preview · <name>" and Prev/Next controls', async () => {
      await advanceToPreviewStep();
      // docs/design/Chautauqua Comms.dc.html:116-119 --
      // `Preview · Priya Raman` + `‹ Prev` / `Next ›`.
      verbatimLine(
        116,
        '              <span style="font-family:\'Familjen Grotesk\', sans-serif; font-size:11px; font-weight:700; letter-spacing:0.12em; text-transform:uppercase">Preview · Priya Raman</span>',
      );
      const firstRecipientName = buildRecipients()[0]?.name;
      if (firstRecipientName === undefined) throw new Error('expected at least one recipient fixture');
      expect(screen.getByText(`Preview · ${firstRecipientName}`)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: '‹ Prev' })).toBeDisabled();
      expect(screen.getByRole('button', { name: 'Next ›' })).not.toBeDisabled();
    });

    it('MATCHES: the preview card carries "To" / "Subject" field labels, same vocabulary as the frame', async () => {
      await advanceToPreviewStep();
      // docs/design/Chautauqua Comms.dc.html:124, :128 -- `To` / `Subject`
      // field labels inside the preview card.
      verbatimLine(
        124,
        '                <span style="font-size:11px; font-weight:700; letter-spacing:0.08em; text-transform:uppercase; color:#565A4B">To</span>',
      );
      verbatimLine(
        128,
        '                <span style="font-size:11px; font-weight:700; letter-spacing:0.08em; text-transform:uppercase; color:#565A4B">Subject</span>',
      );
      const card = document.querySelector('.chq-comms-preview-card') as HTMLElement;
      expect(within(card).getByText('To')).toBeInTheDocument();
      expect(within(card).getByText('Subject')).toBeInTheDocument();
    });

    it('DIVERGES (blessed, Ruling B1): the frame\'s step-3 primary directly SENDS ("Send 23 emails"); the tree\'s step-3 primary only ADVANCES to step 4 ("Next: send ›")', async () => {
      await advanceToPreviewStep();
      // docs/design/Chautauqua Comms.dc.html:144-145 --
      // `Send 23 emails` + `Back to the template`, both drawn at step 3.
      verbatimLine(
        144,
        '              <span style="background:#4E5C31; color:#F7F9F0; border-radius:4px; padding:12px 18px; font-size:14px; font-weight:700">Send 23 emails</span>',
      );
      verbatimLine(
        145,
        '              <a href="#" style="border:1px solid #BAB6A6; border-radius:4px; padding:11px 16px; font-size:13px; font-weight:600; color:#1B1D17">Back to the template</a>',
      );
      // ComposeWizard.tsx:1548-1553's own comment: "Send moves to step 4 --
      // this primary only advances; the dedicated ConfirmDialog is gone
      // because step 4 pre-send IS the confirmation." No "Send N emails"
      // control exists at this step in the tree.
      expect(screen.queryByRole('button', { name: /^Send \d+ emails?$/ })).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Next: send ›' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Back to the template' })).toBeInTheDocument();
    });
  });

  // -----------------------------------------------------------------------
  // Frame :453 "Compose · step 4 of 4" -- the send/confirm step (the
  // post-send REPORT state, which is what the frame itself draws:
  // "Send complete" / "21 of 23 speakers were emailed").
  // -----------------------------------------------------------------------
  describe('frame :453 "Compose · step 4 of 4" (ComposeWizard send report)', () => {
    it('MATCHES: the step rail\'s "Preview" row detail reads "One email per recipient", verbatim', async () => {
      await advanceToSendReport();
      // docs/design/Chautauqua Comms.dc.html:482-483 --
      // `Preview` / `One email per recipient`.
      expect(DESIGN_FILE.endsWith('Chautauqua Comms.dc.html')).toBe(true);
      verbatimLine(
        483,
        '              <span style="font-size:11px; color:#565A4B">One email per recipient</span>',
      );
      const steps = document.querySelectorAll('.chq-steps .chq-step');
      const previewStep = [...steps].find((s) => s.querySelector('.chq-comms-step-title')?.textContent === 'Preview');
      expect(previewStep?.querySelector('.chq-comms-step-detail')?.textContent).toBe('One email per recipient');
    });

    it('DIVERGES: the step rail\'s "Recipients" row names the population "N accepted speakers" in the frame, but stays "N submissions selected" in the tree even after send', async () => {
      await advanceToSendReport();
      // docs/design/Chautauqua Comms.dc.html:468-469 --
      // `Recipients` / `23 accepted speakers`. The rail row, at step 4,
      // names WHO was actually emailed (an outcome population), never the
      // step-1 selection count.
      expect(DESIGN_FILE.endsWith('Chautauqua Comms.dc.html')).toBe(true);
      verbatimLine(
        469,
        '              <span style="font-size:11px; color:#565A4B">23 accepted speakers</span>',
      );
      const steps = document.querySelectorAll('.chq-steps .chq-step');
      const recipientsStep = [...steps].find(
        (s) => s.querySelector('.chq-comms-step-title')?.textContent === 'Recipients',
      );
      const detail = recipientsStep?.querySelector('.chq-comms-step-detail')?.textContent;
      // The tree's own rail (ComposeWizard.tsx:734-738) recomputes this
      // detail off `selection.selectedIds.size` on every render, regardless
      // of step -- it never switches to naming the sent/recipient
      // population the frame's step-4 rail names.
      expect(detail).toBe(`${RECIPIENT_COUNT} submissions selected`);
      expect(detail).not.toBe('23 accepted speakers');
    });

    it('MATCHES (exact numbers): the send-report headline "N of M speakers were emailed"', async () => {
      await advanceToSendReport();
      // docs/design/Chautauqua Comms.dc.html:497-498 --
      // `Send complete` eyebrow + `21 of 23 speakers were emailed` headline.
      verbatimLine(
        497,
        '            <span style="font-size:11px; font-weight:800; letter-spacing:0.1em; text-transform:uppercase; color:#4E5C31">Send complete</span>',
      );
      verbatimLine(
        498,
        '            <h1 style="margin:0; font-family:\'Familjen Grotesk\', sans-serif; font-size:30px; font-weight:700; letter-spacing:-0.04em; line-height:1">21 of 23 speakers were emailed</h1>',
      );
      expect(screen.getByText('Send complete')).toBeInTheDocument();
      expect(screen.getByText('21 of 23 speakers were emailed')).toBeInTheDocument();
    });

    it('MATCHES: the "Two were skipped" section head and its "Nothing was sent to these two" caption', async () => {
      await advanceToSendReport();
      // docs/design/Chautauqua Comms.dc.html:514-515 --
      // `Two were skipped` + `Nothing was sent to these two`.
      verbatimLine(
        514,
        '            <span style="font-family:\'Familjen Grotesk\', sans-serif; font-size:11px; font-weight:700; letter-spacing:0.12em; text-transform:uppercase">Two were skipped</span>',
      );
      verbatimLine(
        515,
        '            <span style="font-size:11px; font-weight:600; letter-spacing:0.04em; text-transform:uppercase; color:#565A4B">Nothing was sent to these two</span>',
      );
      expect(screen.getByText('Two were skipped')).toBeInTheDocument();
      expect(screen.getByText('Nothing was sent to these two')).toBeInTheDocument();
    });

    it('MATCHES (verbatim): the dedupe-window explainer sentence', async () => {
      await advanceToSendReport();
      // docs/design/Chautauqua Comms.dc.html:527 -- the exact sentence,
      // reproduced byte-for-byte in ComposeWizard.tsx's skipped-note copy.
      verbatimLine(
        527,
        '          <div style="padding:14px 0 0; font-size:13px; color:#565A4B; line-height:1.5">The dedupe window stops a speaker being emailed twice in an hour by two organisers working at once. It clears on its own.</div>',
      );
      expect(
        screen.getByText(
          'The dedupe window stops a speaker being emailed twice in an hour by two organisers working at once. It clears on its own.',
        ),
      ).toBeInTheDocument();
    });

    it('MATCHES: the footer note "All N are in History, each with the address it went to" and the Compose another / Back to Comms action pair', async () => {
      await advanceToSendReport();
      // docs/design/Chautauqua Comms.dc.html:531, :533-534 --
      // `All 21 are in History, each with the address it went to` +
      // `Compose another` (secondary) + `Back to Comms` (primary).
      verbatimLine(
        531,
        '          <span style="font-size:13px; color:#565A4B; line-height:1.5">All 21 are in History, each with the address it went to</span>',
      );
      verbatimLine(
        534,
        '            <span style="background:#4E5C31; color:#F7F9F0; border-radius:4px; min-height:46px; display:flex; align-items:center; padding:0 20px; font-size:14px; font-weight:700">Back to Comms</span>',
      );
      expect(screen.getByText('All 21 are in History, each with the address it went to')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Compose another' })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'Back to Comms' })).toBeInTheDocument();
    });
  });
});
