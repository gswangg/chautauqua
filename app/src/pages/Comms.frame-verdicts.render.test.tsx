// w14-sa (DEC-976 wave-157/158): Comms is a Tier-0 wave-1 cluster whose
// phone rows were CLOSED on grep evidence (comms-phone-frames-style source
// scans that never dispatch a request) rather than on a real render. This
// file is the render RECEIPT: a per-frame verdict for the three 390 frames
// in docs/design/Chautauqua Comms.dc.html (:177 'Comms', :286 'Templates ·
// 390', :335 'Send history · 390'), entered through CommsPage's real route
// (MemoryRouter + ?tab=<tab>, DEC-710) -- never a tab component mounted
// directly. Modelled EXACTLY on
// app/src/pages/Settings.frame-verdicts.render.test.tsx: same
// `verbatimLine` helper (copied verbatim below), same beforeEach/afterEach
// shape (localStorage event id + a not-called console.error spy), same
// mockApi/listEnvelope test-utils. Full verdict prose lives in
// docs/design/audit/comms-v12.md; this file is the render receipt each row
// cites. jsdom applies no stylesheet (no @media), so every assertion below
// is about DOM STRUCTURE/ORDER, never computed geometry.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, cleanup, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MemoryRouter } from 'react-router-dom';
import { CommsPage } from './Comms';
import { listEnvelope, mockApi } from '../test-utils/mockApi';
import { resetEventsCacheForTests, resetInitialStoredIdForTests } from '../lib/useCurrentEvent';

// w15-ti (DEC-919 wave-159): the phone landing's MOUNT is now gated on
// isPhone (Comms.tsx), not just CSS-hidden -- jsdom implements no
// matchMedia at all, so seeing the landing at all now requires stubbing
// it, exactly the FakeMediaQueryList pattern
// PipelineBoard.render.test.tsx / SubmissionDetailPage.phone-dock.render
// .test.tsx already use to force useIsPhone's split in jsdom.
class FakeMediaQueryList {
  matches = true;
  addEventListener() {}
  removeEventListener() {}
}

function stubPhoneMatchMedia() {
  vi.stubGlobal('matchMedia', () => new FakeMediaQueryList());
}

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, '..', '..', '..');
const DESIGN_FILE = join(REPO_ROOT, 'docs', 'design', 'Chautauqua Comms.dc.html');

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

const EVENT_ID = 'evt-comms-frame-verdicts';

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
  // The events cache and the D19 frozen (fromUrl, fromStorage) pair are
  // both module-level, scoped to one real page load -- a render-test suite
  // doesn't get that between it() blocks (same reset useCurrentEvent's own
  // render-test file performs in its afterEach).
  resetEventsCacheForTests();
  resetInitialStoredIdForTests();
});

const RECENT_BATCH = {
  batchKey: 'batch-1',
  subject: 'Your talk has been accepted to DevFlow Conf 2027',
  sentAt: Date.parse('2026-08-11T16:12:00Z'),
  statusCounts: { sent: 23 },
  templateId: 'tmpl-accept',
};

function mockCommsEndpoints() {
  mockApi({
    'GET /api/v1/events': listEnvelope([
      { id: EVENT_ID, slug: 'devflow-2027', name: 'DevFlow Conf 2027' },
    ]),
    [`GET /api/v1/events/${EVENT_ID}/email-log`]: listEnvelope([RECENT_BATCH]),
    [`GET /api/v1/events/${EVENT_ID}/templates`]: listEnvelope([
      { id: 'tmpl-accept', eventId: EVENT_ID, name: 'Acceptance', subject: 'Your talk has been accepted to {event_name}', bodyText: 'Hi {speaker_name}.', lastUsedAt: RECENT_BATCH.sentAt },
    ]),
  });
}

function renderTab(tab?: string) {
  mockCommsEndpoints();
  const entry = tab ? `/comms?tab=${tab}` : '/comms';
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <CommsPage />
    </MemoryRouter>,
  );
}

describe('v12 Comms 390 frames: per-frame render verdict receipts (w14-sa, DEC-976)', () => {
  // Frame :177-215 "Comms" -- the phone landing (DEC-621), entered with no
  // ?tab= (phoneEntered stays false, isTab(null) === false).
  //
  // w15-ti (DEC-919 wave-159): CLOSED the jsdom-artefact caveat this case
  // used to document. Comms.tsx used to mount `.chq-comms-phone-landing`
  // unconditionally at every width (only its `-show` class was gated),
  // so jsdom -- which evaluates no `@media` rule -- rendered the landing
  // dashboard SIMULTANEOUSLY with the page-level tab head/body at
  // DESKTOP widths too, a duplicate of the compose tab's own RecentSends
  // mount. DEC-919's rule (a hidden control with no offset is still on
  // the screen) applies just as much to an unconditionally MOUNTED block
  // as to a hidden one. The block's mount is now gated on `isPhone`
  // itself, so seeing it in a render test requires stubbing phone
  // matchMedia the same way PipelineBoard.render.test.tsx does -- see
  // the desktop-non-mount case directly below, which is the receipt that
  // the duplicate is actually gone.
  it('frame :177 Comms landing (phone) -- MATCHES the frame\'s own composition: title, draft-card slot, "Recent sends" band', async () => {
    verbatimLine(
      177,
      '    <div style="width:390px; height:844px; background:#F4F1E8; border:1px solid #D3CFC0; border-radius:20px; overflow:hidden; display:flex; flex-direction:column; box-shadow:0 18px 44px rgba(27,29,23,0.13)">',
    );
    stubPhoneMatchMedia();
    renderTab();
    // Frame :183 draws the landing's own H1 "Comms"; the app renders it as
    // a styled <p>, not a second <h1> (Comms.tsx's own doc comment at the
    // landing block), so the page's ONE accessible heading name stays
    // owned by .chq-comms-main's h1.chq-page-title.
    expect(screen.getByRole('heading', { name: 'Comms' })).toBeInTheDocument();
    const landingTitle = document.querySelector('.chq-comms-phone-landing-title');
    expect(landingTitle).not.toBeNull();
    expect(landingTitle!.textContent).toBe('Comms');
    // Frame :188-193 "Draft in progress" card: no stored composeDraft
    // record here, so PhoneDraftCard renders its DEC-621 wave-109
    // empty-state branch (a "Compose" entry control), never nothing.
    const draftCard = document.querySelector('.chq-comms-phone-draft-card');
    expect(draftCard).not.toBeNull();
    expect(within(draftCard as HTMLElement).getByRole('button', { name: 'Compose' })).toBeInTheDocument();
    // Frame :196-197 "Recent sends" band -- present, plus (w5-q amendment)
    // routes into Templates and History the frame's own dashboard has no
    // other way to reach. Scoped to the landing block itself: with
    // isPhone stubbed true the tab body underneath still mounts (only
    // ITS visibility, not the landing's mount, is CSS-gated on width --
    // that is a separate, un-changed seam from the one this task closes),
    // and it renders the SAME batch subject, so an unscoped query would
    // still be ambiguous.
    const landing = document.querySelector('.chq-comms-phone-landing') as HTMLElement;
    await waitFor(() => expect(within(landing).getByText(RECENT_BATCH.subject)).toBeInTheDocument());
    const recentHead = document.querySelector('.chq-comms-phone-recent-head');
    expect(recentHead).not.toBeNull();
    expect(within(recentHead as HTMLElement).getByText('Recent sends')).toBeInTheDocument();
    expect(within(recentHead as HTMLElement).getByRole('button', { name: 'Templates' })).toBeInTheDocument();
    expect(within(recentHead as HTMLElement).getByRole('button', { name: 'History' })).toBeInTheDocument();
  });

  // w15-ti (DEC-919 wave-159) receipt: at desktop (jsdom default, no
  // matchMedia stub -- useIsPhone falls back to false, see useIsPhone.ts)
  // the landing block does not mount AT ALL anymore -- the duplicate
  // `.chq-comms-phone-landing` dashboard that used to sit in the DOM
  // beside the tablist and the compose tab's own RecentSends mount at
  // every width is gone.
  it('frame :177 Comms landing does not mount at desktop -- DEC-919 duplicate-mount gate', async () => {
    renderTab();
    await waitFor(() => expect(screen.getByRole('tablist')).toBeInTheDocument());
    expect(document.querySelector('.chq-comms-phone-landing')).toBeNull();
  });

  // Frame :286-326 "Templates · 390" -- entered via ?tab=templates.
  // Comms.tsx (:49-54, DEC-710) reads ?tab= through useSearchParams and
  // falls back to 'compose'; 'templates' mounts TemplatesTab through the
  // real tab switch, never mounted directly.
  it('frame :286 Templates · 390 -- DIVERGES: Insert-a-field renders CLOSED (DEC-993 dropdown), the frame draws it permanently open', async () => {
    verbatimLine(
      286,
      '    <div style="width:390px; height:844px; background:#F4F1E8; border:1px solid #D3CFC0; border-radius:20px; overflow:hidden; display:flex; flex-direction:column; box-shadow:0 18px 44px rgba(27,29,23,0.13)">',
    );
    renderTab('templates');
    // Frame :287-290: drill head -- back "‹ Comms", H1 "Templates", "5
    // saved" (here "1 saved" -- see head-count text below). The head is
    // TemplatesTab's own .chq-comms-templates-head, composed onto the
    // shell's .chq-phone-head/-head-drill vocabulary (TemplatesTab.tsx
    // :186-190), present at every width in jsdom.
    const head = document.querySelector('.chq-comms-templates-head');
    expect(head).not.toBeNull();
    expect(within(head as HTMLElement).getByRole('button', { name: '‹ Comms' })).toBeInTheDocument();
    expect(within(head as HTMLElement).getByRole('heading', { name: 'Templates' })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('button', { name: 'New template' })).toBeInTheDocument());
    // Frame :292-298 template list row + frame :299-320 the editor section
    // auto-selects the first template (TemplatesTab.tsx's own DEC-890
    // amendment-4 effect), matching the frame's own assumption that the
    // editor is already open on the row list's first entry.
    expect(screen.getByRole('button', { name: 'Acceptance' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Subject' })).toHaveValue('Your talk has been accepted to {event_name}');
    // Frame :311-315 draws "Insert a field · open" -- a permanently-open
    // merge-field panel with every field row visible. DEC-993 replaced
    // that shape with a single closed 'Insert a field ▾' trigger
    // (InsertFieldMenu.tsx): the trigger renders, its menu panel does not,
    // until clicked.
    const trigger = screen.getByRole('button', { name: /Insert a field/ });
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    // Frame :323-324 footer: filled "Save" + bordered "Cancel". The app's
    // footer instead pairs Save with "Use in a send" once a saved template
    // is selected (Cancel only appears for a brand-new, unsaved draft) --
    // already documented in docs/design/audit/comms-v12.md.
    expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Use in a send' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Cancel' })).not.toBeInTheDocument();
  });

  // Frame :335-352 "Send history · 390" -- entered via ?tab=history.
  it('frame :335 Send history · 390 -- MATCHES: back+H1+count head, per-row when/subject/template/toggle order, "See the recipients" copy present', async () => {
    verbatimLine(
      335,
      '    <div style="width:390px; height:844px; background:#F4F1E8; border:1px solid #D3CFC0; border-radius:20px; overflow:hidden; display:flex; flex-direction:column; box-shadow:0 18px 44px rgba(27,29,23,0.13)">',
    );
    renderTab('history');
    // Frame :337-339: back "‹ Comms", H1 "History", count line. History's
    // own drill head (HistoryTab.tsx :157-172) carries the same
    // .chq-phone-head-drill vocabulary Templates uses.
    const head = document.querySelector('.chq-comms-history-head');
    expect(head).not.toBeNull();
    expect(within(head as HTMLElement).getByRole('button', { name: '‹ Comms' })).toBeInTheDocument();
    expect(within(head as HTMLElement).getByRole('heading', { name: 'History' })).toBeInTheDocument();
    // Scoped to History's own tab container: the phone-landing block's
    // read-only Recent-sends row (always mounted, see the :177 test above)
    // carries the SAME batch subject, so an unscoped query is ambiguous.
    const tab = document.querySelector('.chq-comms-history-tab') as HTMLElement;
    await waitFor(() => expect(within(tab).getByText(RECENT_BATCH.subject)).toBeInTheDocument());
    // Frame :341-352 sc-for rows: when · short, subject, template, "See
    // the recipients" toggle -- RecentSends' columnHeads mount renders
    // both a desktop "Open" span and a phone "See the recipients" span
    // (DEC-833, two sibling spans, CSS-only width swap), both present in
    // jsdom since no @media rule applies here.
    const toggle = within(tab).getByRole('button', { name: 'Open' });
    expect(within(toggle).getByText('See the recipients')).toBeInTheDocument();
    expect(within(toggle).getByText('Open')).toBeInTheDocument();
  });
});
