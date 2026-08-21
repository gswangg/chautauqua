// w26-d (DEC-976/DEC-651/DEC-032): the per-frame DESKTOP (1600) render
// verdict for Comms' residue part 2 of 2 -- the send-blocked state and the
// two template-render reference panels. Sibling to
// Speakers.desktop-frame-verdicts.render.test.tsx (the harness this file is
// copied from verbatim) and to Comms.desktop-frame-verdicts.render.test.tsx
// (residue part 1, FORBIDDEN to this task -- do not touch).
//
// STRICTLY MEASUREMENT ONLY (DEC-651 wave-26): desktop is frozen by the
// mandate, so this file moves no desktop byte and edits no
// component/stylesheet -- it renders the real route, verdicts what the
// tree actually produces, and files divergences in prose. jsdom applies no
// stylesheet (no @media, no computed grid-template-columns), so every
// assertion here is DOM structure/order/text, or a readFileSync of the
// APP's own stylesheet/source TEXT for a claim that is inherently a CSS or
// vocabulary fact -- the design pack is never re-read as its own proof
// (DEC-976/DEC-967). Every DOM/CSS/source lookup runs BEFORE its citation
// comment so the citation sits immediately beside the `expect(` that
// receipts it.
//
// CONTRACT: exactly one it() per frame, titled MATCHES or DIVERGES with the
// divergence named.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter } from 'react-router-dom';
import { ComposeWizard } from './comms/ComposeWizard';
import { listEnvelope, mockApi } from '../test-utils/mockApi';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, '..', '..', '..');
const DESIGN_FILE = join(REPO_ROOT, 'docs', 'design', 'Chautauqua Comms.dc.html');
const COMMS_DIR = join(HERE, 'comms');

/** DEC-967 shape: read the ACTUAL line, assert it byte-for-byte matches the
 * literal this file claims. Copied from Speakers.desktop-frame-verdicts.render.test.tsx's
 * own verbatimLine. */
function verbatimLine(lineNo: number, literal: string): void {
  const lines = readFileSync(DESIGN_FILE, 'utf-8').split('\n');
  const line = lines[lineNo - 1];
  if (line === undefined) throw new Error(`design file has no line ${lineNo}`);
  expect(line).toBe(literal);
}

const EVENT_ID = 'evt-comms-blocked-desktop-verdicts';

let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
    throw new Error(`console.error called during render: ${args.map(String).join(' ')}`);
  });
});

afterEach(() => {
  cleanup();
  consoleErrorSpy.mockRestore();
  vi.unstubAllGlobals();
});

function submission(n: number) {
  return {
    id: `sub-${n}`,
    ref: `S-${String(n).padStart(3, '0')}`,
    title: `Talk number ${n}`,
    status: 'accepted',
    contentStatus: 'approved',
    speakers: [{ contactId: `c${n}`, name: `Speaker ${n}` }],
    trackIds: [],
    submittedAt: null,
    createdAt: 1700000000000,
  };
}

describe('v12 Comms DESKTOP (1600) frames, residue part 2 of 2: send-blocked state + template-render reference panels (w26-d, DEC-976/DEC-651/DEC-032)', () => {
  // -------------------------------------------------------------------
  // Frame :750 "Compose · send blocked" (extent 750-983)
  // -------------------------------------------------------------------
  describe('frame :750 "Compose · send blocked"', () => {
    it('DIVERGES: the frame draws a page-level h1 "Check before sending" over a Recipient/Missing GRID TABLE; the tree renders the refusal inline as a plain paragraph + <ul> list, with no h1 and no table role anywhere on the page (the 3-button action row and its caption DO match, in order)', async () => {
      mockApi({
        [`GET /api/v1/events/${EVENT_ID}/submissions`]: listEnvelope(
          [submission(1), submission(2), submission(3)],
          { total: 3, page: 1, perPage: 50 },
        ),
        [`GET /api/v1/events/${EVENT_ID}/templates`]: listEnvelope([]),
        [`POST /api/v1/events/${EVENT_ID}/compose/preview`]: (() => {
          let call = 0;
          return () => {
            call += 1;
            // First call (attachIcs off, reaches step 'preview') succeeds
            // for all three; the second call (attachIcs flipped on) is the
            // DEC-051 preflight, rejecting two of the three as unscheduled
            // -- the send-blocked refusal this frame draws.
            if (call === 1) {
              return {
                items: [1, 2, 3].map((n) => ({
                  contactId: `c${n}`,
                  submissionId: `sub-${n}`,
                  email: `c${n}@example.com`,
                  name: `Speaker ${n}`,
                  ref: `S-${String(n).padStart(3, '0')}`,
                  scheduled: n === 1,
                  subject: 'Hi',
                  text: 'Body',
                })),
              };
            }
            return {
              status: 400,
              body: {
                error: {
                  code: 'invalid',
                  message: 'Some submissions are not scheduled',
                  fields: { 'sub-2': 'not scheduled', 'sub-3': 'not scheduled' },
                },
              },
            };
          };
        })(),
      });

      render(
        <MemoryRouter>
          <ComposeWizard eventId={EVENT_ID} />
        </MemoryRouter>,
      );

      await screen.findByText('Talk number 1');
      fireEvent.click(screen.getByLabelText('Select Talk number 1'));
      fireEvent.click(screen.getByLabelText('Select Talk number 2'));
      fireEvent.click(screen.getByLabelText('Select Talk number 3'));
      fireEvent.click(screen.getByRole('button', { name: /Next: choose a template/ }));

      await screen.findByLabelText('Subject');
      fireEvent.change(screen.getByLabelText('Subject'), { target: { value: 'Hello' } });
      fireEvent.change(screen.getByLabelText('Body'), { target: { value: 'Body text' } });
      fireEvent.click(screen.getByRole('button', { name: 'Next: preview' }));

      // Reached step 'preview' (attachIcs off, all three succeeded).
      await screen.findByLabelText('Attach calendar invite');
      fireEvent.click(screen.getByLabelText('Attach calendar invite'));

      // The refusal renders inline on the SAME step -- no navigation.
      const banner = await screen.findByRole('alert');
      expect(banner).toHaveClass('chq-comms-refusal-banner');

      // (1) NO page-level h1 "Check before sending" anywhere, and no
      // "N recipients" caption beside a heading -- the frame's own header
      // registers this state as a distinct titled page.
      // docs/design/Chautauqua Comms.dc.html:763-764 --
      // `<h1 ...>Check before sending</h1>` + `<span ...>23 recipients</span>`
      verbatimLine(763, '          <h1 style="margin:0; font-family:\'Familjen Grotesk\', sans-serif; font-size:30px; font-weight:700; letter-spacing:-0.04em; line-height:1">Check before sending</h1>');
      expect(screen.queryByRole('heading', { level: 1 })).toBeNull();
      expect(screen.queryByText('Check before sending')).toBeNull();

      // (2) NO Recipient/Missing GRID TABLE -- the frame draws a two-column
      // grid with a header row (`Recipient` / `Missing`); the tree draws a
      // plain `<ul className="chq-comms-blocked-list">`, confirmed against
      // comms.css's own selector text (jsdom applies no stylesheet, so a
      // computed-style read of a table role would be fiction) rather than
      // any `grid-template-columns:1fr 190px 150px` table.
      // docs/design/Chautauqua Comms.dc.html:773-774 --
      // `<div style="display:grid; grid-template-columns:1fr 190px 150px; ...">`
      // + `<span>Recipient</span><span>Missing</span><span></span>`
      verbatimLine(773, '          <div style="display:grid; grid-template-columns:1fr 190px 150px; gap:18px; padding:0 0 9px; border-bottom:2px solid #1B1D17; font-size:10px; font-weight:800; letter-spacing:0.1em; text-transform:uppercase; color:#565A4B">');
      const cssPath = join(COMMS_DIR, 'comms.css');
      const css = readFileSync(cssPath, 'utf-8');
      expect(css).toMatch(/\.chq-comms-blocked-list\s*\{/);
      expect(screen.queryByRole('table')).toBeNull();
      expect(screen.queryByText('Recipient')).toBeNull();
      expect(screen.queryByText('Missing')).toBeNull();
      const list = banner.querySelector('.chq-comms-blocked-list');
      expect(list?.tagName).toBe('UL');
      expect(within(list as HTMLElement).getAllByRole('listitem')).toHaveLength(2);

      // (3) The two unresolved rows ARE named individually (never a bare
      // count), each with a "Place on the agenda ›" link -- this part of
      // the frame's population-naming DOES hold.
      // docs/design/Chautauqua Comms.dc.html:779-783 --
      // `{{ u.name }}` / `{{ u.ref }}` / `No slot yet` / `Place on the agenda ›`
      verbatimLine(783, '              <a href="#" style="font-size:13px; font-weight:700">Place on the agenda ›</a>');
      expect(within(banner).getAllByRole('link', { name: /Place on the agenda/ })).toHaveLength(2);

      // (4) The 3-button action row MATCHES: order and labels are
      // "Send to the N who have a slot" / "Edit the template" / "Place
      // all N first" -- structurally identical to the frame's footer row,
      // even though the cause (unscheduled submissions, not a merge
      // field) and the element roles (button/link vs. decorative span)
      // differ.
      // docs/design/Chautauqua Comms.dc.html:791-793 --
      // `Send to the 20 who have a slot` / `Edit the template` / `Place all three first`
      verbatimLine(791, '            <span style="border:1px solid #CFC7B7; border-radius:4px; background:#EFEBDF; min-height:46px; display:flex; align-items:center; padding:0 16px; font-size:13px; font-weight:600; color:#2E2A24">Send to the 20 who have a slot</span>');
      const footer = banner.querySelector('.chq-comms-refusal-footer, .chq-comms-refusal-actions')?.closest('div') ?? banner;
      const actionLabels = within(footer as HTMLElement)
        .getAllByRole('button')
        .concat(within(footer as HTMLElement).getAllByRole('link'))
        .map((el) => el.textContent);
      expect(actionLabels).toEqual(['Send to the 1 who have a slot', 'Edit the template', 'Place all two first']);

      // (5) The caption text MATCHES modulo a trailing period the frame
      // omits (frame :789 has no trailing `.`; the tree's
      // `chq-comms-panel-note`/`chq-comms-refusal-caption` text carries
      // one) -- a wording nuance, not a structural divergence.
      // docs/design/Chautauqua Comms.dc.html:789 (no trailing period) --
      // `Sending cannot be undone, so this is the last point at which it is cheap to fix`
      verbatimLine(789, '          <span style="font-size:13px; color:#565A4B; line-height:1.5">Sending cannot be undone, so this is the last point at which it is cheap to fix</span>');
      expect(within(banner).getByText('Sending cannot be undone, so this is the last point at which it is cheap to fix.')).toBeInTheDocument();
    });
  });

  // -------------------------------------------------------------------
  // Frames :686 "What each template renders" (686-694) and :712
  // "DevFlow Conf 2027" (712-749) -- the template-output reference panel.
  // -------------------------------------------------------------------
  describe('frame :686 "What each template renders" (panel header/eyebrow)', () => {
    it('DIVERGES: the frame documents a 4-up template-catalogue REFERENCE PANEL ("One shell · 560px measure · no images"), not a screen the app renders -- no route/component in app/src/pages/comms/ produces this multi-card gallery; recommend a DEVIATIONS entry, per this task\'s desktop-freeze instruction to file the divergence rather than build a new surface', async () => {
      // docs/design/Chautauqua Comms.dc.html:686 --
      // `<span ...>What each template renders</span>`
      verbatimLine(686, '      <span style="font-family:\'Familjen Grotesk\', sans-serif; font-size:19px; font-weight:600">What each template renders</span>');
      // docs/design/Chautauqua Comms.dc.html:687 --
      // `<span ...>One shell · 560px measure · no images</span>`
      verbatimLine(687, '      <span style="font-size:11px; font-weight:600; letter-spacing:0.06em; text-transform:uppercase; color:#565A4B">One shell · 560px measure · no images</span>');

      // The vocabulary this eyebrow announces ("seenIn"/"seenWhy" per-card
      // captions, "One shell") appears NOWHERE in the app's own comms
      // source -- it is design-pack prose describing a reference gallery,
      // never wired to a component.
      const commsSources = readFileSync(join(COMMS_DIR, 'ComposeWizard.tsx'), 'utf-8')
        + readFileSync(join(COMMS_DIR, 'PreviewPane.tsx'), 'utf-8')
        + readFileSync(join(COMMS_DIR, 'TemplatesTab.tsx'), 'utf-8');
      expect(commsSources).not.toMatch(/One shell/);
      expect(commsSources).not.toMatch(/560px measure/);

      // What the app actually renders in this spot is PreviewPane -- ONE
      // recipient's resolved card at a time, reached from ComposeWizard's
      // own step 3, never a multi-template side-by-side gallery.
      mockApi({
        [`GET /api/v1/events/${EVENT_ID}/submissions`]: listEnvelope([submission(1)], { total: 1, page: 1, perPage: 50 }),
        [`GET /api/v1/events/${EVENT_ID}/templates`]: listEnvelope([]),
        [`POST /api/v1/events/${EVENT_ID}/compose/preview`]: {
          items: [{ contactId: 'c1', submissionId: 'sub-1', email: 'c1@example.com', name: 'Speaker 1', ref: 'S-001', scheduled: true, subject: 'Your talk at DevFlow Conf 2027', text: 'Body' }],
        },
      });
      render(
        <MemoryRouter>
          <ComposeWizard eventId={EVENT_ID} />
        </MemoryRouter>,
      );
      await screen.findByText('Talk number 1');
      fireEvent.click(screen.getByLabelText('Select Talk number 1'));
      fireEvent.click(screen.getByRole('button', { name: /Next: choose a template/ }));
      await screen.findByLabelText('Subject');
      fireEvent.change(screen.getByLabelText('Subject'), { target: { value: 'Your talk at {event_name}' } });
      fireEvent.change(screen.getByLabelText('Body'), { target: { value: 'Body' } });
      fireEvent.click(screen.getByRole('button', { name: 'Next: preview' }));
      await screen.findByText('Speaker 1');
      // Exactly one preview card renders -- not the frame's 4-card gallery.
      expect(document.querySelectorAll('.chq-comms-preview-card')).toHaveLength(1);
    });
  });

  describe('frame :712 "DevFlow Conf 2027" (template card body)', () => {
    it('DIVERGES: the event-name interpolation the card demonstrates ("DevFlow Conf 2027" as the fixed masthead of every templated email) DOES match the product\'s real interpolation, but the surrounding 4-up card gallery itself is not a rendered screen -- same DIVERGES verdict as :686, filed once more against this frame\'s own extent per the one-it()-per-frame contract', async () => {
      // docs/design/Chautauqua Comms.dc.html:712 -- the card masthead is a
      // literal event name, not a merge token: `DevFlow Conf 2027`.
      verbatimLine(712, '              <span style="font-family:\'Familjen Grotesk\', sans-serif; font-size:19px; font-weight:700; letter-spacing:-0.025em">DevFlow Conf 2027</span>');
      // docs/design/Chautauqua Comms.dc.html:737 -- the footer repeats the
      // same fixed event name, never a `{{ event.name }}` binding distinct
      // from the masthead.
      verbatimLine(737, '              <span style="font-size:12px; line-height:1.6; color:#565A4B">DevFlow Conf 2027 · sent with <a href="#" style="font-weight:700">Chautauqua</a></span>');

      // The product's own real merge-field vocabulary carries the identical
      // fixed-name token -- `event_name` in src/mail/render.ts, the ONE
      // module app/src/lib/merge-fields.ts re-exports from (DEC-660) --
      // resolved once per send, never per-card -- confirming the ONE
      // interpolation fact this frame demonstrates is real, even though the
      // gallery drawing it is not.
      const renderSource = readFileSync(join(REPO_ROOT, 'src', 'mail', 'render.ts'), 'utf-8');
      expect(renderSource).toMatch(/event_name/);
      expect(renderSource).toMatch(/event_name:\s*"DevFlow Conf 2027"/);

      mockApi({
        [`GET /api/v1/events/${EVENT_ID}/submissions`]: listEnvelope([submission(1)], { total: 1, page: 1, perPage: 50 }),
        [`GET /api/v1/events/${EVENT_ID}/templates`]: listEnvelope([]),
        [`POST /api/v1/events/${EVENT_ID}/compose/preview`]: {
          items: [{ contactId: 'c1', submissionId: 'sub-1', email: 'c1@example.com', name: 'Speaker 1', ref: 'S-001', scheduled: true, subject: 'Your talk at DevFlow Conf 2027', text: 'Body' }],
        },
      });
      render(
        <MemoryRouter>
          <ComposeWizard eventId={EVENT_ID} />
        </MemoryRouter>,
      );
      await screen.findByText('Talk number 1');
      fireEvent.click(screen.getByLabelText('Select Talk number 1'));
      fireEvent.click(screen.getByRole('button', { name: /Next: choose a template/ }));
      await screen.findByLabelText('Subject');
      fireEvent.change(screen.getByLabelText('Subject'), { target: { value: 'Your talk at {event_name}' } });
      fireEvent.change(screen.getByLabelText('Body'), { target: { value: 'Body' } });
      fireEvent.click(screen.getByRole('button', { name: 'Next: preview' }));
      // The resolved subject interpolates the event name where the merge
      // token sat -- matching the frame's own claim that {event_name}
      // resolves to the fixed event name.
      expect(await screen.findByText('Your talk at DevFlow Conf 2027')).toBeInTheDocument();
      // But no 4-up card gallery renders here -- one card, matching :686's
      // finding.
      expect(document.querySelectorAll('.chq-comms-preview-card')).toHaveLength(1);
    });
  });
});
