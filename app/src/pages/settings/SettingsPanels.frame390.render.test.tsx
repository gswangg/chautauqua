// w31-f (DEC-976/DEC-576/DEC-385/DEC-967): per-literal frame verdict for
// the two Settings 390 frames tied for the worst unclaimed coverage before
// this file -- `docs/design/Chautauqua Settings.dc.html:316-338`
// ("Settings · Event", 4 of 7 drawn literals claimed) and `:552-569`
// ("Settings · People and roles", 4 of 7 claimed). This file closes the
// gap: every drawn literal gets its own `verbatimLine` receipt (DEC-967 --
// a bare `:line` reference rots silently, a byte-for-byte read of the
// design file cannot) and a render assertion against the REAL panels.
//
// Two mount strategies, matched to what each literal actually belongs to
// (DEC-976 wave-31 "fix-capability is file-scoped"):
//  - the '‹ Settings' back link and drill H1 are Settings.tsx SHELL chrome
//    (SummarySection/EventSettingsPanel/PeopleRolesPanel render neither),
//    so those two literals are asserted through the SAME real-route mount
//    Settings.frame-verdicts.render.test.tsx already established
//    (SettingsPage + mockApi -- the one mock stack this cluster uses,
//    reused here rather than invented a second time, DEC-976 wave-29).
//  - every other literal (per-field rows, footer primaries) is asserted
//    through the PANEL-DIRECT mounts EventSettingsPanel.render.test.tsx
//    and PeopleRolesPanel.summary.render.test.tsx / .readDrill.render
//    .test.tsx already use -- reused verbatim, never a second mock stack.
//
// DEC-967 (sample data is SHAPE, not a pin): `{{ f.label }}` / `{{ f.value
// }}` / `{{ p.name }}` / `{{ p.email }}` / `{{ p.role }}` are graded by
// shape (a label span, a value box, an optional note) -- the fixture's own
// strings ("Narrow Con", "self@example.com") are never asserted to equal
// the frame's own placeholder tokens.
//
// DEC-576 (the later ruling wins, ties broken by citing it, never
// relitigated): DEVIATIONS.md §6 blesses the omission of the per-person
// `{{ p.scope }}` half of the People eyebrow and the read-view per-row
// "Change" (users are org-scoped) -- verdicted DIVERGES below, not built.
// DEC-919 wave-156 (SummarySection.tsx/EventSettingsPanel.tsx/settings-
// drill-rows.css comments) already narrowed the Event frame's footer to
// Save-only in the READ drill -- "Cancel" has nothing to cancel there, so
// the frame's Cancel literal is a second, separate DIVERGES row, verdicted
// here rather than re-litigated.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter } from 'react-router-dom';
import { SettingsPage } from '../Settings';
import { EventSettingsPanel } from './EventSettingsPanel';
import { listEnvelope, mockApi } from '../../test-utils/mockApi';
import { OTHER, SELF, mockPeople, renderPanel as renderPeoplePanel } from './PeopleRolesPanel.test-helpers';
import { DEC_385, DEC_576, DEC_919, DEC_967, DEC_976 } from '../../../../src/decisions';
import { stripCssComments } from '../../../../test/helpers/strip-css-comments';

void DEC_385; // settings.css read-only below: an in-flight lane owns edits to it this wave
void DEC_576; // the later DEVIATIONS entry / later ruling is the contract, never relitigated
void DEC_919; // Event read-footer narrowed to Save-only; wave-156 amendment
void DEC_967; // sample data graded by SHAPE, structural literals by verbatim citation
void DEC_976; // frame verdicts grade the drawn extent, not a citation count

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, '..', '..', '..', '..');
const DESIGN_FILE = join(REPO_ROOT, 'docs', 'design', 'Chautauqua Settings.dc.html');
const SETTINGS_CSS = stripCssComments(readFileSync(join(HERE, 'settings.css'), 'utf-8'));

/** DEC-967: a citation that can never silently rot to a wrong line -- read
 * the ACTUAL design-file line and assert it byte-for-byte matches the
 * literal this file claims. Copied verbatim from
 * Settings.frame-verdicts.render.test.tsx's own `verbatimLine`. */
function verbatimLine(lineNo: number, literal: string): void {
  const lines = readFileSync(DESIGN_FILE, 'utf-8').split('\n');
  const line = lines[lineNo - 1];
  if (line === undefined) throw new Error(`design file has no line ${lineNo}`);
  expect(line).toBe(literal);
}

afterEach(() => {
  cleanup();
});

const EVENT_ID = 'evt-settings-panels-390';

function mockAllSections() {
  mockApi({
    [`GET /api/v1/events/${EVENT_ID}`]: {
      id: EVENT_ID,
      slug: 'panelcon-2026',
      name: 'PanelCon 2026',
      startDate: '2026-09-01',
      endDate: '2026-09-03',
      location: 'Austin, TX',
      timezone: 'America/Chicago',
      recordPrefix: 'PC26',
      branding: { logoUrl: '', accentColor: '' },
    },
    [`GET /api/v1/events/${EVENT_ID}/tracks`]: listEnvelope([{ id: 'trk1', name: 'Keynotes', color: '#4f46e5' }]),
    [`GET /api/v1/events/${EVENT_ID}/rooms`]: listEnvelope([{ id: 'rm1', name: 'Main Hall', capacity: 500 }]),
    [`GET /api/v1/events/${EVENT_ID}/portal-settings`]: {
      logoUrl: null,
      accentColor: null,
      welcomeMessage: 'Welcome, speakers!',
      showResources: true,
    },
    [`GET /api/v1/events/${EVENT_ID}/resources`]: listEnvelope([]),
    [`GET /api/v1/events/${EVENT_ID}/forms`]: {
      id: 'form1',
      eventId: EVENT_ID,
      intro: 'Tell us about your talk.',
      openDate: null,
      closeDate: null,
      tracks: [],
      fields: [{ id: 'f1', label: 'Title', locked: true }],
    },
    [`GET /api/v1/events/${EVENT_ID}/submissions`]: listEnvelope([]),
    [`GET /api/v1/events/${EVENT_ID}/public-surfaces`]: { sessions: 3, speakers: 2, scheduled: 1 },
    [`GET /api/v1/events/${EVENT_ID}/embeds`]: listEnvelope([]),
    [`GET /api/v1/events/${EVENT_ID}/onboarding`]: { tasks: [], rows: [], total: 0, page: 1, perPage: 1, counts: {} },
    'GET /api/v1/me': { userId: SELF.id, email: SELF.email, name: null, role: 'organizer', orgId: 'org1' },
    'GET /api/v1/users': listEnvelope([SELF, OTHER]),
    'GET /api/v1/tokens': listEnvelope([]),
  });
}

function renderDrilled(section: string) {
  mockAllSections();
  return render(
    <MemoryRouter initialEntries={[`/settings?section=${section}`]}>
      <SettingsPage />
    </MemoryRouter>,
  );
}

let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  expect(consoleErrorSpy).not.toHaveBeenCalled();
  consoleErrorSpy.mockRestore();
  vi.unstubAllGlobals();
});

describe('frame :316-338 "Settings · Event" (390) -- SHELL chrome via the real route', () => {
  it('renders the back-above-H1 shell literals: "‹ Settings" (44px) then "Event"', async () => {
    // docs/design/Chautauqua Settings.dc.html:318
    verbatimLine(
      318,
      '        <a href="#" style="font-size:13px; font-weight:700; min-height:44px; display:flex; align-items:center">‹ Settings</a>',
    );
    // docs/design/Chautauqua Settings.dc.html:319
    verbatimLine(
      319,
      '        <h1 style="margin:0; font-family:\'Familjen Grotesk\', sans-serif; font-size:26px; font-weight:700; letter-spacing:-0.04em; line-height:1">Event</h1>',
    );
    renderDrilled('event');
    const backBtn = await screen.findByRole('button', { name: '‹ Settings' });
    expect(backBtn).toHaveClass('chq-settings-back');
    const drillTitle = document.querySelector('.chq-settings-drill-title');
    expect(drillTitle).not.toBeNull();
    expect(drillTitle!.textContent).toBe('Event');
    // back-above-H1 register (frame draws back, then H1, in that order).
    expect(backBtn.compareDocumentPosition(drillTitle!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});

describe('frame :552-569 "Settings · People and roles" (390) -- SHELL chrome via the real route', () => {
  it('renders the back-above-H1 shell literals: "‹ Settings" (44px) then "People and roles"', async () => {
    // docs/design/Chautauqua Settings.dc.html:554
    verbatimLine(
      554,
      '        <a href="#" style="font-size:13px; font-weight:700; min-height:44px; display:flex; align-items:center">‹ Settings</a>',
    );
    // docs/design/Chautauqua Settings.dc.html:555
    verbatimLine(
      555,
      '        <h1 style="margin:0; font-family:\'Familjen Grotesk\', sans-serif; font-size:26px; font-weight:700; letter-spacing:-0.04em; line-height:1">People and roles</h1>',
    );
    renderDrilled('people');
    const backBtn = await screen.findByRole('button', { name: '‹ Settings' });
    expect(backBtn).toHaveClass('chq-settings-back');
    const drillTitle = document.querySelector('.chq-settings-drill-title');
    expect(drillTitle).not.toBeNull();
    expect(drillTitle!.textContent).toBe('People and roles');
    expect(backBtn.compareDocumentPosition(drillTitle!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});

describe('frame :316 Event -- per-field rows and footer, real panel mount (EventSettingsPanel.render.test.tsx pattern)', () => {
  const eventDetail = {
    id: EVENT_ID,
    name: 'Narrow Con',
    slug: 'narrow-con',
    startDate: '2026-06-01',
    endDate: '2026-06-10',
    location: 'Big Hall',
    timezone: 'UTC',
    recordPrefix: 'EV',
    branding: {},
  };

  beforeEach(() => {
    window.localStorage.setItem('chq.currentEventId', EVENT_ID);
  });

  afterEach(() => {
    window.localStorage.clear();
  });

  function renderSummary() {
    return render(
      <MemoryRouter initialEntries={['/settings']}>
        <EventSettingsPanel />
      </MemoryRouter>,
    );
  }

  it('renders the per-field label-eyebrow / value-box / optional-note stack by SHAPE (DEC-967)', async () => {
    // docs/design/Chautauqua Settings.dc.html:325 -- the label eyebrow
    verbatimLine(
      325,
      '            <span style="font-size:11px; font-weight:800; letter-spacing:0.1em; text-transform:uppercase; color:#565A4B">{{ f.label }}</span>',
    );
    // docs/design/Chautauqua Settings.dc.html:326 -- the 46px value box
    verbatimLine(
      326,
      '            <div style="border:1px solid #BAB6A6; border-radius:6px; background:#FAF8F2; min-height:46px; display:flex; align-items:center; padding:0 13px; font-size:15px">{{ f.value }}</div>',
    );
    // docs/design/Chautauqua Settings.dc.html:328 -- the optional note
    verbatimLine(328, '              <span style="font-size:12px; color:#565A4B">{{ f.note }}</span>');

    mockApi({
      [`GET /api/v1/events/${EVENT_ID}`]: eventDetail,
      'GET /api/v1/mail-status': { provider: 'none', configured: false, fromEmail: null },
    });
    renderSummary();

    const region = await screen.findByRole('region', { name: 'Event' });
    await waitFor(() => expect(within(region).getByText('Narrow Con')).toBeInTheDocument());

    // SHAPE, not the fixture's own strings: every row is a
    // .chq-settings-row-label eyebrow beside a .chq-settings-row-value box.
    const nameRow = within(region).getByText('Name').closest('.chq-settings-row') as HTMLElement;
    expect(nameRow.querySelector('.chq-settings-row-label')?.textContent).toBe('Name');
    expect(nameRow.querySelector('.chq-settings-row-value')).not.toBeNull();

    // The Slug row carries the frame's third, optional stack element -- a
    // note under the value ('Used in every public URL'), rendered through
    // the same .chq-settings-row-hint slot the note maps to.
    const slugRow = within(region).getByText('Slug').closest('.chq-settings-row') as HTMLElement;
    expect(slugRow.querySelector('.chq-settings-row-hint')).not.toBeNull();
  });

  it('renders the footer dock: "Save" (flex:1, filled, min-height:46px) in the READ drill; "Cancel" is DIVERGES (DEC-919 wave-156, no form to cancel in a read view)', async () => {
    // docs/design/Chautauqua Settings.dc.html:335
    verbatimLine(
      335,
      '        <span style="flex:1; background:#4E5C31; color:#F7F9F0; border-radius:6px; min-height:46px; display:flex; align-items:center; justify-content:center; font-size:14px; font-weight:700">Save</span>',
    );
    // docs/design/Chautauqua Settings.dc.html:336 -- the DIVERGES half
    verbatimLine(
      336,
      '        <span style="border:1px solid #BAB6A6; border-radius:6px; min-height:46px; display:flex; align-items:center; padding:0 16px; font-size:13px; font-weight:600">Cancel</span>',
    );

    mockApi({
      [`GET /api/v1/events/${EVENT_ID}`]: eventDetail,
      'GET /api/v1/mail-status': { provider: 'none', configured: false, fromEmail: null },
    });
    renderSummary();

    const region = await screen.findByRole('region', { name: 'Event' });
    await waitFor(() => expect(within(region).getByText('Narrow Con')).toBeInTheDocument());

    const saveBtn = within(region).getByRole('button', { name: 'Save' });
    expect(saveBtn).toHaveClass('chq-settings-drillrow-footer-primary');
    // DIVERGES: the frame's own "Cancel" span never renders in the READ
    // drill -- DEC-919 wave-156 (SummarySection.tsx/EventSettingsPanel.tsx)
    // already narrowed the footer to Save-only there; the frame's Cancel
    // literal only realizes in the EDIT drill's own footer
    // (SettingsEditForm.tsx, verified below).
    expect(within(region).queryByText('Cancel')).not.toBeInTheDocument();
  });

  it('DIVERGES companion: the frame\'s Save+Cancel PAIR does both render, but only in the EDIT drill -- the shared .chq-settings-edit-footer, not this READ frame\'s own footer. The primary\'s copy is "Save changes" (SettingsEditForm.tsx\'s shared SettingsSaveButton), not the frame\'s bare "Save" -- a second, separate DIVERGES of wording only, not shape.', async () => {
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}`]: eventDetail,
      'GET /api/v1/mail-status': { provider: 'none', configured: false, fromEmail: null },
    });
    render(
      <MemoryRouter initialEntries={['/settings?section=event&edit=1']}>
        <EventSettingsPanel />
      </MemoryRouter>,
    );

    expect(await screen.findByLabelText('Name')).toBeInTheDocument();
    const saveBtn = screen.getByRole('button', { name: 'Save changes' });
    const cancelBtn = screen.getByRole('button', { name: 'Cancel' });
    expect(saveBtn.closest('.chq-settings-edit-footer')).not.toBeNull();
    expect(cancelBtn.closest('.chq-settings-edit-footer')).not.toBeNull();
  });
});

describe('frame :552 People and roles -- per-person rows and footer, real panel mount (PeopleRolesPanel.summary/.readDrill pattern)', () => {
  it('renders the per-person name / role eyebrow stack by SHAPE (DEC-967); the scope half is DEVIATIONS §6-blessed omitted', async () => {
    // docs/design/Chautauqua Settings.dc.html:561
    verbatimLine(
      561,
      '              <span style="font-family:\'Familjen Grotesk\', sans-serif; font-size:16px; font-weight:600; letter-spacing:-0.015em">{{ p.name }}</span>',
    );
    // docs/design/Chautauqua Settings.dc.html:562 -- ellipsised email
    verbatimLine(
      562,
      '              <span style="font-size:12px; color:#565A4B; white-space:nowrap; overflow:hidden; text-overflow:ellipsis">{{ p.email }}</span>',
    );
    // docs/design/Chautauqua Settings.dc.html:563 -- role · scope eyebrow
    verbatimLine(
      563,
      '              <span style="font-size:11px; font-weight:700; letter-spacing:0.06em; text-transform:uppercase; color:#565A4B">{{ p.role }} · {{ p.scope }}</span>',
    );

    mockPeople();
    renderPeoplePanel(['/settings?section=people']);

    await waitFor(() => expect(screen.getByText(OTHER.email)).toBeInTheDocument());
    const region = screen.getByRole('region', { name: 'People and roles' });
    // SELF has a name (SHAPE: label = name); OTHER carries no name, so its
    // row label falls back to its own email -- both are the SAME
    // .chq-settings-row-label/.chq-settings-row-value primitive Event uses.
    const selfRow = within(region).getByText(SELF.name).closest('.chq-settings-row') as HTMLElement;
    expect(selfRow.querySelector('.chq-settings-row-label')?.textContent).toBe(SELF.name);
    expect(selfRow.querySelector('.chq-settings-row-value')).not.toBeNull();

    // DEVIATIONS.md §6 ("Per-person scope column and per-row Change on
    // people-and-roles read view — users are org-scoped (09--02/--14)"):
    // the frame's `{{ p.scope }}` half of the eyebrow is a blessed
    // omission, never built -- verdicted here, not re-litigated.
    expect(region.textContent).not.toMatch(/·\s*Org-wide|·\s*Scope/);
  });

  it('per-row "Change" (:565) is DIVERGES, DEVIATIONS §6-blessed (users are org-scoped) -- never built at 390', async () => {
    // docs/design/Chautauqua Settings.dc.html:565
    verbatimLine(
      565,
      '            <span style="border:1px solid #BAB6A6; border-radius:6px; background:#EFEBDF; min-height:44px; display:flex; align-items:center; padding:0 14px; font-size:13px; font-weight:600">Change</span>',
    );
    mockPeople();
    renderPeoplePanel(['/settings?section=people']);

    await waitFor(() => expect(screen.getByText(OTHER.email)).toBeInTheDocument());
    const region = screen.getByRole('region', { name: 'People and roles' });
    // The read drill's ONLY "Change" is the section head action (drills
    // into the edit view, where per-row role controls live); no per-row
    // "Change" button renders beside a person on the read drill itself.
    const rows = within(region).queryAllByRole('button', { name: 'Change' });
    expect(rows.length).toBe(1); // the section head action, not a per-row one
  });

  it('renders the footer dock: "Invite someone" (full-width, filled, min-height:46px), hoisted below the list so the READ drill opens the invite dialog in place (DEC-919 wave-156)', async () => {
    // docs/design/Chautauqua Settings.dc.html:568
    verbatimLine(
      568,
      '        <span style="display:flex; align-items:center; justify-content:center; margin-top:14px; background:#4E5C31; color:#F7F9F0; border-radius:6px; min-height:46px; font-size:14px; font-weight:700">Invite someone</span></div>',
    );
    mockPeople();
    renderPeoplePanel(['/settings?section=people']);

    await waitFor(() => expect(screen.getByText(OTHER.email)).toBeInTheDocument());
    const region = screen.getByRole('region', { name: 'People and roles' });
    const invitePrimary = within(region).getByRole('button', { name: 'Invite someone' });
    expect(invitePrimary).toHaveClass('chq-settings-drillrow-footer-primary');

    // "BELOW the list" (DEC-919 wave-156, hoisted out of the edit-gated
    // children): the last person row precedes the footer primary in
    // document order.
    const lastRow = within(region).getByText(OTHER.email);
    expect(lastRow.compareDocumentPosition(invitePrimary) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    // Opens the invite dialog IN PLACE on the read drill -- never a
    // navigation into the edit drill first.
    invitePrimary.click();
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByLabelText('Email')).toBeInTheDocument();
    expect(within(region).queryByRole('columnheader', { name: 'Person' })).not.toBeInTheDocument();
  });
});

describe('companion half: settings.css terminal @media(max-width:700px) block, pinned by source text (read-only -- HARD BAN, an in-flight lane owns edits this wave, DEC-385)', () => {
  it('declares exactly one terminal @media (max-width: 700px) block, as the file\'s last construct', () => {
    const opens = SETTINGS_CSS.match(/@media \(max-width: 700px\) \{/g) ?? [];
    expect(opens.length).toBe(1);
    const idx = SETTINGS_CSS.indexOf('@media (max-width: 700px) {');
    expect(idx).toBeGreaterThan(-1);
    // Nothing but whitespace/comments follow the block's final closing brace.
    const tail = SETTINGS_CSS.slice(SETTINGS_CSS.lastIndexOf('}') + 1);
    expect(tail.trim()).toBe('');
  });

  it('pins the phone-only row-label eyebrow rule that realizes Event\'s frame :325 label, byte-for-byte', () => {
    expect(SETTINGS_CSS).toMatch(
      /\.chq-settings-row-label \{\s*\n\s*font-size: 11px;\s*\n\s*font-weight: 800;\s*\n\s*letter-spacing: 0\.1em;\s*\n\s*text-transform: uppercase;\s*\n\s*color: var\(--chq-muted\);\s*\n\s*\}/,
    );
  });

  it('pins the phone-only 46px readout box rule (the frame\'s value-box register), byte-for-byte', () => {
    expect(SETTINGS_CSS).toMatch(
      /\.chq-settings-readout \{\s*\n\s*display: flex;\s*\n\s*align-items: center;\s*\n\s*min-height: 46px;/,
    );
  });
});
