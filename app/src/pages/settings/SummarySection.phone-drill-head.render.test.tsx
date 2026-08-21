// w17-d/DEC-919 (wave 17 ruling): a drilled Settings section at 390 shows
// ONE title, and the head action stands down only on Event. Receipts for
// the two rules appended at the end of settings.css's TERMINAL
// `@media (max-width: 700px)` block:
//   (a) `.chq-settings-panel > .chq-settings-section-head > h2` --
//       de-duplicates SummarySection's own head label against the
//       `.chq-settings-drill-title` H1 twin Settings.tsx already renders
//       (:398-403), scoped by a direct-child chain so nested sub-heads a
//       panel renders deeper inside its own content (TracksRoomsPanel's
//       "Tracks · N"/"Rooms · N" `h3`s, PeopleRolesPanel's edit-view
//       "People · N" `h2`) survive.
//   (b) `.chq-settings-panel[data-chq-section='event'] > .chq-settings-
//       section-head > .chq-settings-section-action` -- stands the head
//       action down on Event ONLY, since Event's own read-drill footer
//       primary (`.chq-settings-drillrow-footer-primary`, "Save") already
//       opens the identical `?section=event&edit=1` drill.
//
// jsdom applies no stylesheet (no @media), so the render assertions below
// query the DOM with the rules' own selector strings directly -- proof the
// selector reaches exactly the elements it's supposed to and none other --
// rather than relying on grep or on jsdom evaluating the CSS itself. This
// mirrors every other render-test file in this cluster (see
// Settings.frame-verdicts.render.test.tsx's own header comment).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, cleanup, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MemoryRouter } from 'react-router-dom';
import { SettingsPage } from '../Settings';
import { listEnvelope, mockApi } from '../../test-utils/mockApi';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, '..', '..', '..', '..');
const DESIGN_FILE = join(REPO_ROOT, 'docs', 'design', 'Chautauqua Settings.dc.html');
const SETTINGS_CSS_FILE = join(HERE, 'settings.css');

/** DEC-967 shape: read the ACTUAL line, assert it byte-for-byte matches the
 * literal this file claims. Copied from Settings.frame-verdicts.render
 * .test.tsx's own `verbatimLine`. */
function verbatimLine(lineNo: number, literal: string): void {
  const lines = readFileSync(DESIGN_FILE, 'utf-8').split('\n');
  const line = lines[lineNo - 1];
  if (line === undefined) throw new Error(`design file has no line ${lineNo}`);
  expect(line).toBe(literal);
}

const EVENT_ID = 'evt-w17-d-summary-head-dedup';

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

function mockAllSections() {
  mockApi({
    [`GET /api/v1/events/${EVENT_ID}`]: {
      id: EVENT_ID,
      slug: 'devcon-2026',
      name: 'DevCon 2026',
      startDate: '2026-09-01',
      endDate: '2026-09-03',
      location: 'Austin, TX',
      timezone: 'America/Chicago',
      recordPrefix: 'DC26',
      branding: { logoUrl: '', accentColor: '' },
    },
    [`GET /api/v1/events/${EVENT_ID}/tracks`]: listEnvelope([{ id: 'trk1', name: 'Keynotes', color: '#4f46e5' }]),
    [`GET /api/v1/events/${EVENT_ID}/rooms`]: listEnvelope([{ id: 'rm1', name: 'Main Hall', capacity: 500 }]),
    'GET /api/v1/me': { userId: 'u-self', email: 'self@example.com', name: null, role: 'organizer', orgId: 'org1' },
    'GET /api/v1/users': listEnvelope([{ id: 'u-self', email: 'self@example.com', role: 'organizer' }]),
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

describe('w17-d/DEC-919: settings.css terminal-block source (settings.css append)', () => {
  it('the file has exactly one @media (max-width: 700px) block, and both new rules live inside it, at its end', () => {
    const css = readFileSync(SETTINGS_CSS_FILE, 'utf-8');
    const mediaOpens = css.match(/@media \(max-width: 700px\) \{/g) ?? [];
    expect(mediaOpens).toHaveLength(1);

    const openIdx = css.indexOf('@media (max-width: 700px) {');
    expect(openIdx).toBeGreaterThan(-1);

    const hRuleIdx = css.indexOf('.chq-settings-panel > .chq-settings-section-head > h2 {');
    const actionRuleIdx = css.indexOf(
      ".chq-settings-panel[data-chq-section='event'] > .chq-settings-section-head > .chq-settings-section-action {",
    );
    expect(hRuleIdx).toBeGreaterThan(openIdx);
    expect(actionRuleIdx).toBeGreaterThan(hRuleIdx);

    // both rules declare display: none and nothing else -- a pure hide.
    const hRuleBody = css.slice(hRuleIdx, css.indexOf('}', hRuleIdx));
    expect(hRuleBody).toContain('display: none;');
    const actionRuleBody = css.slice(actionRuleIdx, css.indexOf('}', actionRuleIdx));
    expect(actionRuleBody).toContain('display: none;');

    // both rules are the LAST two rules in the file, i.e. appended at the
    // terminal block's end, ahead only of its closing brace.
    const afterActionRule = css.slice(css.indexOf('}', actionRuleIdx) + 1);
    // only whitespace and the two closing braces (block, then file) remain.
    expect(afterActionRule.replace(/[\s}]/g, '')).toBe('');
  });
});

describe('w17-d/DEC-919: frame evidence (byte-for-byte)', () => {
  it('Event :313/:316, Tracks and rooms :344/:347, People and roles :549/:552 each draw ONE title and nothing else in the head band', () => {
    verbatimLine(
      313,
      "      <span style=\"font-family:'Familjen Grotesk', sans-serif; font-size:19px; font-weight:600\">Settings · Event</span>",
    );
    verbatimLine(
      319,
      '        <h1 style="margin:0; font-family:\'Familjen Grotesk\', sans-serif; font-size:26px; font-weight:700; letter-spacing:-0.04em; line-height:1">Event</h1>',
    );
    verbatimLine(
      344,
      "      <span style=\"font-family:'Familjen Grotesk', sans-serif; font-size:19px; font-weight:600\">Settings · Tracks and rooms</span>",
    );
    verbatimLine(
      350,
      '        <h1 style="margin:0; font-family:\'Familjen Grotesk\', sans-serif; font-size:26px; font-weight:700; letter-spacing:-0.04em; line-height:1">Tracks and rooms</h1>',
    );
    verbatimLine(
      549,
      "      <span style=\"font-family:'Familjen Grotesk', sans-serif; font-size:19px; font-weight:600\">Settings · People and roles</span>",
    );
    verbatimLine(
      555,
      '        <h1 style="margin:0; font-family:\'Familjen Grotesk\', sans-serif; font-size:26px; font-weight:700; letter-spacing:-0.04em; line-height:1">People and roles</h1>',
    );
  });
});

describe('w17-d/DEC-919: real render receipts', () => {
  it('Tracks and rooms (read): SummarySection\'s own h2 is the only node the dedup selector reaches', async () => {
    renderDrilled('tracks-rooms');
    const section = screen.getByRole('region', { name: 'Tracks and rooms' });
    await waitFor(() => expect(within(section).getByText('Keynotes')).toBeInTheDocument());

    // the panel's OWN head (SummarySection.tsx) is a direct child of the
    // `.chq-settings-panel` <section>, only rendered in the read (non-
    // editing) branch.
    const ownHead = section.querySelector(':scope > .chq-settings-section-head');
    expect(ownHead).not.toBeNull();
    expect(ownHead!.querySelector('h2')).not.toBeNull();
    expect(ownHead!.querySelector('h2')!.textContent).toBe('Tracks and rooms');

    // the dedup rule's exact selector reaches ONLY that h2.
    const dedupMatches = section.querySelectorAll('.chq-settings-panel > .chq-settings-section-head > h2');
    expect(dedupMatches).toHaveLength(1);
    expect(dedupMatches[0]).toBe(ownHead!.querySelector('h2'));

    // the read view's own nested caption ("Tracks"/"Rooms", frame :353's
    // 2px-ruled label) uses a different class entirely, not
    // `.chq-settings-section-head` -- untouched by construction.
    expect(within(section).getByText('Tracks')).toBeInTheDocument();
    expect(within(section).getByText('Rooms')).toBeInTheDocument();
  });

  it('Tracks and rooms (edit drill): the nested "Tracks"/"Rooms" h3 sub-heads survive -- dedup selector reaches none of them (SummarySection\'s own head does not render while editing)', async () => {
    renderDrilled('tracks-rooms&edit=1');
    const section = screen.getByRole('region', { name: 'Tracks and rooms' });
    await waitFor(() => expect(within(section).getByText('Tracks · 1')).toBeInTheDocument());

    // SummarySection's own head is absent while editing (SummarySection.tsx
    // `editing ? null : ...`) -- nothing for the dedup rule to reach here.
    expect(section.querySelectorAll('.chq-settings-panel > .chq-settings-section-head > h2')).toHaveLength(0);

    // the nested edit-view sub-heads still mount, verified by rendering:
    // "Tracks · N" / "Rooms · N" h3s, each inside their own
    // `.chq-settings-section-head` rendered as SummarySection's `children`.
    const subHeads = section.querySelectorAll('.chq-settings-section-head h3');
    const subHeadTexts = Array.from(subHeads).map((n) => n.textContent);
    expect(subHeadTexts).toContain('Tracks · 1');
    expect(subHeadTexts).toContain('Rooms · 1');
    // and none of those h3 parents is itself a DIRECT child of the panel
    // (the dedup selector's `.chq-settings-panel > .chq-settings-section-
    // head` half would otherwise also match them).
    for (const h3 of subHeads) {
      expect(h3.parentElement!.parentElement).not.toBe(section);
    }
  });

  it('People and roles: head action "Change" still mounts (DEVIATIONS §6 -- head is the only route to role editing at 390)', async () => {
    renderDrilled('people');
    const section = screen.getByRole('region', { name: 'People and roles' });
    await waitFor(() => expect(within(section).getByText('self@example.com')).toBeInTheDocument());

    const ownHead = section.querySelector(':scope > .chq-settings-section-head');
    expect(ownHead).not.toBeNull();
    const actionBtn = within(ownHead as HTMLElement).getByRole('button', { name: 'Change' });
    expect(actionBtn).toHaveClass('chq-settings-section-action');

    // the standdown rule is scoped to data-chq-section="event" only --
    // People's <section> root must not carry that attribute value.
    expect(section.getAttribute('data-chq-section')).toBe('people');
    const standdownMatches = section.querySelectorAll(
      ".chq-settings-panel[data-chq-section='event'] > .chq-settings-section-head > .chq-settings-section-action",
    );
    expect(standdownMatches).toHaveLength(0);
  });

  it('Event: head carries data-chq-section="event" so the standdown rule\'s selector reaches its head action (re-lined onto the footer Save, DEC-919)', async () => {
    renderDrilled('event');
    const section = screen.getByRole('region', { name: 'Event' });
    await waitFor(() => expect(within(section).getByText('DevCon 2026')).toBeInTheDocument());

    expect(section.getAttribute('data-chq-section')).toBe('event');
    const standdownMatches = section.querySelectorAll(
      ".chq-settings-panel[data-chq-section='event'] > .chq-settings-section-head > .chq-settings-section-action",
    );
    expect(standdownMatches).toHaveLength(1);
    expect(standdownMatches[0]!.textContent).toBe('Change');

    // Event's own frame-drawn footer primary is still the on-screen route
    // to the same edit drill (DEC-919 wave-156, unchanged by this task).
    const saveBtn = within(section).getByRole('button', { name: 'Save' });
    expect(saveBtn).toHaveClass('chq-settings-drillrow-footer-primary');
  });
});
