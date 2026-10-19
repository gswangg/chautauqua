// Person record (/contacts/:contactId, Portals frame 05) render tests:
// participations with the portals they matched (including one that
// matches no portal, and a declined one), every item and the portal that
// brought it (a merged item, a lock line, a detached item, deferred items
// of an unanswered invitation), reopen, event roles, invite to speak, and
// the empty, 404 and error states. Mocked fetch, the real page.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { PersonRecordPage } from './PersonRecordPage';
import { arrivalLine } from './PersonRecordTables';
import { errorEnvelope, listEnvelope, mockApi } from '../../test-utils/mockApi';
import { msToDateInput } from '../../lib/dates';
import type { ParticipationJson, PersonRecord, ViewItemJson, ViewParticipationJson } from './types';
import type { SubmissionListItem } from '../submissions/types';

const EVENT_ID = 'evt-person-record';
const CONTACT_ID = 'ct-priya';
const RECORD_PATH = `/api/v1/events/${EVENT_ID}/people/${CONTACT_ID}/portal`;
const DAY = (m: number, d: number) => Date.UTC(2027, m - 1, d);

const PROFILE = { id: 'po-profile', name: 'Profile basics' };
const CFP = { id: 'po-cfp', name: 'CFP speakers' };
const INVITED = { id: 'po-invited', name: 'Invited speakers' };
const SPONSORS = { id: 'po-sponsors', name: 'Sponsors' };

function session(
  key: string,
  over: Partial<ParticipationJson> & { ref: string; title: string; status?: string; origin?: string; submissionId: string },
): ParticipationJson {
  return {
    key,
    kind: 'session',
    role: over.role ?? 'speaker',
    participationStatus: over.participationStatus ?? 'accepted',
    session: {
      submissionId: over.submissionId,
      participantId: key.slice(2),
      title: over.title,
      ref: over.ref,
      status: over.status ?? 'accepted',
      origin: over.origin ?? 'cfp',
      format: null,
      trackIds: [],
    },
    company: null,

  };
}

const TALK = session('p:pa-1', { ref: 'DFC-014', title: 'Taming 40-Minute CI', submissionId: 'sub-14' });
const PANEL = session('p:pa-2', { ref: 'DFC-006', title: 'Lunch panel', submissionId: 'sub-6', role: 'panelist', origin: 'organizer' });
const IN_REVIEW = session('p:pa-3', { ref: 'DFC-021', title: 'Ask the Handbook', submissionId: 'sub-21', status: 'pending', participationStatus: 'none' });
const DECLINED = session('p:pa-4', { ref: 'DFC-030', title: 'Closing keynote', submissionId: 'sub-30', origin: 'organizer', participationStatus: 'declined', role: 'moderator' });
const INVITED_TALK = session('p:pa-5', { ref: 'DFC-040', title: 'Edge caching', submissionId: 'sub-40', origin: 'organizer', participationStatus: 'invited' });
const COMPANY: ParticipationJson = {
  key: 'c:sc-1',
  kind: 'company',
  role: 'contact',
  participationStatus: 'none',
  session: null,
  company: { sponsorContactId: 'sc-1', sponsorshipId: 'sp-1', companyName: 'Latticework Systems', tierName: 'Gold', sponsorshipStatus: 'active', isPrimary: true },

};
const PRESS: ParticipationJson = {
  key: 'r:er-1',
  kind: 'event_role',
  role: 'press',
  participationStatus: 'none',
  session: null,
  company: null,

};

function vp(participation: ParticipationJson, label: string, portals: { id: string; name: string }[], extra: Partial<ViewParticipationJson> = {}): ViewParticipationJson {
  return { participation, label, portals, active: true, declined: false, unmatchedReason: null, ...extra };
}

function item(over: Partial<ViewItemJson> & { key: string; title: string }): ViewItemJson {
  return {
    kind: 'general',
    taskId: null,
    assignmentId: null,

    state: 'todo',
    required: true,
    dueDay: null,
    graceDays: 0,
    completedAt: null,
    portals: [],
    direct: false,
    merge: null,
    detached: false,
    statusLine: null,
    statusWord: null,
    openUntil: null,
    ...over,
  };
}

function baseRecord(): PersonRecord {
  return {
    contact: { id: CONTACT_ID, firstName: 'Priya', lastName: 'Raman', email: 'priya@example.com', company: 'Latticework Systems', title: 'Principal Engineer' },
    eventRoles: [{ id: 'er-1', contactId: CONTACT_ID, role: 'press', roleLabel: 'Press', name: 'Priya Raman', email: 'priya@example.com' }],
    view: {
      eventId: EVENT_ID,
      eventName: 'DevFlow Conf 2027',
      timezone: 'America/Los_Angeles',
      contactId: CONTACT_ID,

      participations: [
        vp(TALK, 'Speaker · DFC-014 Taming 40-Minute CI', [PROFILE, CFP]),
        vp(PANEL, 'Panelist · DFC-006 Lunch panel', [PROFILE, INVITED]),
        vp(COMPANY, 'Contact · Latticework Systems', [PROFILE, SPONSORS]),
        vp(IN_REVIEW, 'Speaker · DFC-021 Ask the Handbook', [], { unmatchedReason: 'Session still in review' }),
        vp(DECLINED, 'Moderator · DFC-030 Closing keynote', [], { declined: true, active: false }),
        vp(PRESS, 'Press · no session', [], { unmatchedReason: 'No portal covers press' }),
        vp(INVITED_TALK, 'Speaker · DFC-040 Edge caching', [INVITED], { active: false }),
      ],
      profileFields: {
        bio: { level: 'edit', help: null, lockedBy: null },
        headshot: { level: 'view', help: null, lockedBy: { portalName: 'Invited speakers', participationPhrase: 'your invited panel' } },
      },
      profileItems: [
        item({
          key: 'sys:bio',
          kind: 'bio',
          title: 'Bio',
          dueDay: DAY(4, 3),
          portals: [PROFILE, INVITED],
          merge: { deadlineFrom: 'Invited speakers', requiredFrom: 'Invited speakers' },
        }),
        item({ key: 'sys:headshot', kind: 'headshot', title: 'Headshot', state: 'done', dueDay: DAY(4, 10), portals: [PROFILE], merge: { deadlineFrom: null, requiredFrom: null } }),
        item({ key: 'task-hotel|', title: 'Hotel form', state: 'done', detached: true, assignmentId: 'as-hotel', dueDay: DAY(3, 1) }),
        item({ key: 'task-flight|', title: 'Flight form', state: 'overdue_open', direct: true, assignmentId: 'as-flight', dueDay: DAY(3, 2) }),
      ],
      sections: [
        {
          participation: TALK,
          heading: 'Your talk',
          phrase: 'your talk',
          items: [
            item({ key: 'task-slides|p:pa-1', title: 'Final slides', dueDay: DAY(5, 1), portals: [CFP], assignmentId: 'as-slides' }),
            item({ key: 'task-release|p:pa-1', title: 'Speaker release', state: 'closed', dueDay: DAY(3, 20), portals: [CFP], assignmentId: 'as-release' }),
          ],
        },
        {
          participation: PANEL,
          heading: 'Invited panel',
          phrase: 'your invited panel',
          items: [
            item({ key: 'sys:acceptance:p:pa-2', kind: 'acceptance', title: 'Accept your invitation', state: 'done', statusWord: 'Accepted', dueDay: DAY(3, 15), portals: [INVITED] }),
            item({ key: 'task-prep|p:pa-2', title: 'Panel prep notes', state: 'optional', required: false, dueDay: DAY(5, 1), portals: [INVITED] }),
          ],
        },
        {
          participation: COMPANY,
          heading: 'Gold sponsor',
          phrase: 'your gold sponsor',
          items: [
            item({ key: 'task-logo|c:sc-1', title: 'Logo and booth details', state: 'overdue_open', dueDay: DAY(4, 1), openUntil: DAY(4, 8), portals: [SPONSORS], assignmentId: 'as-logo' }),
            item({
              key: 'sys:sponsor_sessions:c:sc-1',
              kind: 'sponsor_sessions',
              title: 'Design your sessions',
              state: 'waiting',
              statusWord: 'Changes requested',
              statusLine: 'Gold: 1 talk used · 1 workshop available',
              dueDay: DAY(4, 15),
              portals: [SPONSORS],
            }),
          ],
        },
        { participation: IN_REVIEW, heading: 'Your submission', phrase: 'your submission', items: [] },
        { participation: PRESS, heading: 'Press', phrase: 'your press', items: [] },
        {
          participation: INVITED_TALK,
          heading: 'Invitation',
          phrase: 'your invitation',
          items: [item({ key: 'sys:acceptance:p:pa-5', kind: 'acceptance', title: 'Accept your invitation', state: 'waiting', dueDay: DAY(3, 30), portals: [INVITED] })],
          // what accepting brings: the view's deferredItems
          ...{ deferredItems: [{ name: 'Travel form', dueDay: null, relativeDays: 14 }] },
        },
      ],
    },
  };
}

function emptyRecord(): PersonRecord {
  const r = baseRecord();
  return { ...r, eventRoles: [], view: { ...r.view, participations: [], profileItems: [], sections: [] } };
}

function sessionRow(id: string, ref: string, title: string): SubmissionListItem {
  return { id, ref, title, status: 'accepted', contentStatus: 'pending', speakers: [], trackIds: [], submittedAt: null, createdAt: 0, slot: null };
}

let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  window.localStorage.setItem('chq.currentEventId', EVENT_ID);
  consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  cleanup();
  expect(consoleErrorSpy).not.toHaveBeenCalled();
  consoleErrorSpy.mockRestore();
  window.localStorage.clear();
  vi.unstubAllGlobals();
});

function renderPage() {
  render(
    <MemoryRouter initialEntries={[`/contacts/${CONTACT_ID}`]}>
      <Routes>
        <Route path="/contacts/:contactId" element={<PersonRecordPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

function rowOf(text: string): HTMLElement {
  const row = screen.getByText(text).closest('[role="row"]');
  if (!(row instanceof HTMLElement)) throw new Error(`no row for ${text}`);
  return row;
}

function callsTo(fetchMock: ReturnType<typeof mockApi>, method: string, path: string) {
  return fetchMock.mock.calls.filter(([input, init]) => {
    const url = typeof input === 'string' ? input : input.toString();
    return (init?.method ?? 'GET').toUpperCase() === method && url.split('?')[0] === path;
  });
}

function bodyOf(call: unknown[]): unknown {
  const init = call[1] as RequestInit | undefined;
  return JSON.parse(String(init?.body));
}

describe('PersonRecordPage', () => {
  it('heads the page with the person, a back link and a full-page preview link', async () => {
    mockApi({ [`GET ${RECORD_PATH}`]: baseRecord() });
    renderPage();
    expect(await screen.findByRole('heading', { level: 1, name: 'Priya Raman' })).toBeInTheDocument();
    expect(screen.getByText('Latticework Systems · Principal Engineer · priya@example.com')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '‹ Contacts' })).toHaveAttribute('href', '/contacts');
    // a plain anchor to the SSR preview page, never a client route
    expect(screen.getByRole('link', { name: 'Preview as Priya' })).toHaveAttribute('href', `/portal/preview/people/${EVENT_ID}/${CONTACT_ID}`);
    expect(document.querySelector('.chq-person-record-page')).toHaveClass('chq-measure-table');
  });

  it('lists every participation, how it arrived and the portals it matched', async () => {
    mockApi({ [`GET ${RECORD_PATH}`]: baseRecord() });
    renderPage();
    await screen.findByText('Participations · 7');
    const table = screen.getByRole('table', { name: 'Participations' });

    const talk = rowOf('Speaker · DFC-014 Taming 40-Minute CI');
    expect(within(talk).getByText('Through the CFP · accepted')).toBeInTheDocument();
    expect(within(talk).getByRole('link', { name: 'CFP speakers' })).toHaveAttribute('href', '/settings/portals/po-cfp');
    expect(within(talk).getByRole('link', { name: 'Profile basics' })).toHaveAttribute('href', '/settings/portals/po-profile');

    expect(within(rowOf('Panelist · DFC-006 Lunch panel')).getByText('Invited by organizers')).toBeInTheDocument();
    expect(within(rowOf('Contact · Latticework Systems')).getByText('Gold sponsor')).toBeInTheDocument();
    expect(within(rowOf('Speaker · DFC-040 Edge caching')).getByText('Invited by organizers · no reply yet')).toBeInTheDocument();

    // a participation that matches no portal says so, why, and where the coverage list is
    const review = rowOf('Speaker · DFC-021 Ask the Handbook');
    expect(within(review).getByText('Through the CFP · pending')).toBeInTheDocument();
    expect(within(review).getByText('Matches no portal')).toHaveClass('chq-person-record-unmatched');
    expect(within(review).getByText('Session still in review')).toBeInTheDocument();
    expect(within(review).getByRole('link', { name: 'Everyone not in a portal' })).toHaveAttribute('href', '/speakers?portal=none');
    expect(within(rowOf('Press · no session')).getByText('No portal covers press')).toBeInTheDocument();

    // declining ends the participation: it is listed, in no portal
    const declined = rowOf('Moderator · DFC-030 Closing keynote');
    expect(declined).toHaveAttribute('data-declined', 'true');
    expect(within(declined).getByText('Invited by organizers · declined')).toBeInTheDocument();
    expect(within(declined).getByText('Declined, so in no portal')).toBeInTheDocument();
    expect(within(declined).queryByText('Matches no portal')).not.toBeInTheDocument();

    expect(within(table).getAllByRole('row')).toHaveLength(8);
  });

  it('shows every item once, grouped, with the portal that brought it', async () => {
    mockApi({ [`GET ${RECORD_PATH}`]: baseRecord() });
    renderPage();
    // 4 profile + 2 + 2 + 2 + (1 acceptance + 1 deferred)
    await screen.findByText('Every item, and the portal that brought it · 12');
    const table = screen.getByRole('table', { name: 'Every item' });
    const groups = within(table).getAllByRole('rowgroup').map((g) => g.getAttribute('aria-label'));
    expect(groups).toEqual(['Profile — shown once', 'DFC-014 Taming 40-Minute CI', 'DFC-006 Lunch panel', 'Latticework Systems', 'DFC-040 Edge caching']);

    // a merged item: ONE outlined tag naming both portals, each a link, and where the settings came from
    const bio = rowOf('Bio');
    const merged = bio.querySelector('.chq-person-record-merged');
    expect(merged).toHaveTextContent('Profile basics+Invited speakers');
    expect(within(bio).getByRole('link', { name: 'Invited speakers' })).toHaveAttribute('href', '/settings/portals/po-invited');
    expect(within(bio).getByText('Earliest deadline and required flag from Invited speakers')).toBeInTheDocument();
    expect(within(bio).getByText('3 Apr')).toBeInTheDocument();
    expect(within(bio).getByText('To do')).toHaveClass('chq-person-record-status-strong');

    // a profile field a portal locks names the lock and its source
    const headshot = rowOf('Headshot');
    expect(within(headshot).getByText('Locked')).toHaveClass('chq-person-record-lock-word');
    expect(within(headshot).getByText('View only, from Invited speakers')).toBeInTheDocument();
    expect(within(headshot).getByText('Done')).toHaveClass('chq-person-record-status-quiet');
    expect(within(bio).queryByText('Locked')).not.toBeInTheDocument();

    // finished work from a portal they left stays on the record
    expect(within(rowOf('Hotel form')).getByText('No longer in a portal · kept on the record')).toBeInTheDocument();
    expect(within(rowOf('Flight form')).getByText('Assigned directly')).toBeInTheDocument();
    expect(within(rowOf('Flight form')).getByText('Overdue')).toHaveClass('chq-person-record-status-pill');

    // the home's own words: Accepted, Optional, Changes requested, built-in status lines
    expect(within(rowOf('Panel prep notes')).getByText('Optional')).toHaveClass('chq-person-record-status-strong');
    const design = rowOf('Design your sessions');
    expect(within(design).getByText('Gold: 1 talk used · 1 workshop available')).toBeInTheDocument();
    expect(within(design).getByText('Changes requested')).toHaveClass('chq-person-record-status-strong');
    expect(within(rowOf('Logo and booth details')).getByText('Open until 8 Apr')).toBeInTheDocument();
    expect(screen.getAllByText('Accepted')).toHaveLength(1);

    // an unanswered invitation: what accepting brings, relative deadlines not started
    const deferred = rowOf('Travel form');
    expect(within(deferred).getByText('14 days after accepting')).toBeInTheDocument();
    expect(within(deferred).getByText('Arrives when Priya accepts')).toBeInTheDocument();
    expect(within(rowOf('DFC-040 Edge caching')).getByText('DFC-040 Edge caching')).toBeInTheDocument();
  });

  it('reopens a closed item for this person until a chosen day', async () => {
    let reopened = false;
    const fetchMock = mockApi({
      [`GET ${RECORD_PATH}`]: () => {
        const r = baseRecord();
        if (reopened) {
          const talk = r.view.sections[0]!;
          talk.items[1] = { ...talk.items[1]!, state: 'overdue_open', openUntil: DAY(3, 27) };
        }
        return r;
      },
      [`POST /api/v1/events/${EVENT_ID}/people/${CONTACT_ID}/reopen`]: () => {
        reopened = true;
        return { ok: true };
      },
    });
    renderPage();
    await screen.findByText('Speaker release');
    // only a closed item with an assignment offers it
    expect(screen.getAllByRole('button', { name: 'Reopen' })).toHaveLength(1);
    fireEvent.click(within(rowOf('Speaker release')).getByRole('button', { name: 'Reopen' }));

    const dialog = await screen.findByRole('dialog', { name: 'Reopen Speaker release' });
    const until = within(dialog).getByLabelText('Open until');
    fireEvent.change(until, { target: { value: '1 Jan 2020' } });
    fireEvent.blur(until);
    fireEvent.click(within(dialog).getByRole('button', { name: 'Reopen' }));
    expect(await within(dialog).findByText('Choose today or a later day.')).toBeInTheDocument();
    expect(callsTo(fetchMock, 'POST', `/api/v1/events/${EVENT_ID}/people/${CONTACT_ID}/reopen`)).toHaveLength(0);

    const day = msToDateInput(Date.now() + 10 * 24 * 60 * 60 * 1000);
    fireEvent.change(until, { target: { value: day } });
    fireEvent.blur(until);
    fireEvent.click(within(dialog).getByRole('button', { name: 'Reopen' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    const posts = callsTo(fetchMock, 'POST', `/api/v1/events/${EVENT_ID}/people/${CONTACT_ID}/reopen`);
    expect(posts).toHaveLength(1);
    expect(bodyOf(posts[0]!)).toEqual({ assignmentId: 'as-release', until: day });
    expect(await within(rowOf('Speaker release')).findByText('Open until 27 Mar')).toBeInTheDocument();
    expect(within(rowOf('Speaker release')).queryByRole('button', { name: 'Reopen' })).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Speaker release is open for Priya until');
  });

  it('adds and removes an event role, then re-reads the record', async () => {
    let roles = baseRecord().eventRoles;
    const fetchMock = mockApi({
      [`GET ${RECORD_PATH}`]: () => ({ ...baseRecord(), eventRoles: roles }),
      [`POST /api/v1/events/${EVENT_ID}/event-roles`]: () => {
        roles = [...roles, { id: 'er-2', contactId: CONTACT_ID, role: 'volunteer', roleLabel: 'Volunteer', name: 'Priya Raman', email: 'priya@example.com' }];
        return { status: 201, body: { id: 'er-2', created: true } };
      },
      [`DELETE /api/v1/events/${EVENT_ID}/event-roles/er-1`]: () => {
        roles = roles.filter((r) => r.id !== 'er-1');
        return { ok: true };
      },
    });
    renderPage();
    const section = await screen.findByRole('region', { name: 'Event roles' });
    expect(within(section).getByText('Event roles · 1')).toBeInTheDocument();
    // a role she already holds isn't offered again
    const select = within(section).getByLabelText('Role to add');
    expect(within(select).queryByRole('option', { name: 'Press' })).not.toBeInTheDocument();

    fireEvent.change(select, { target: { value: 'volunteer' } });
    fireEvent.click(within(section).getByRole('button', { name: 'Add a role' }));
    expect(await screen.findByText('Priya is now Volunteer. Portals update in a moment.')).toBeInTheDocument();
    const posts = callsTo(fetchMock, 'POST', `/api/v1/events/${EVENT_ID}/event-roles`);
    expect(bodyOf(posts[0]!)).toEqual({ contactId: CONTACT_ID, role: 'volunteer' });
    expect(await within(section).findByText('Event roles · 2')).toBeInTheDocument();

    fireEvent.click(within(section).getByRole('button', { name: 'Remove Press' }));
    // removing a role can take items away, so it asks first
    const confirm = await screen.findByRole('dialog', { name: 'Remove Press from Priya?' });
    expect(callsTo(fetchMock, 'DELETE', `/api/v1/events/${EVENT_ID}/event-roles/er-1`)).toHaveLength(0);
    fireEvent.click(within(confirm).getByRole('button', { name: 'Remove role' }));
    expect(await screen.findByText('Removed Press. Portals update in a moment.')).toBeInTheDocument();
    expect(callsTo(fetchMock, 'DELETE', `/api/v1/events/${EVENT_ID}/event-roles/er-1`)).toHaveLength(1);
    expect(await within(section).findByText('Event roles · 1')).toBeInTheDocument();
    expect(within(section).getByText('Volunteer')).toBeInTheDocument();
  });

  it('invites them to speak on an accepted session they are not on yet', async () => {
    let invited = false;
    const fetchMock = mockApi({
      [`GET ${RECORD_PATH}`]: () => {
        const r = baseRecord();
        if (invited) r.view.participations.push(vp(session('p:pa-9', { ref: 'DFC-050', title: 'Platform day', submissionId: 'sub-50', participationStatus: 'invited', origin: 'organizer' }), 'Panelist · DFC-050 Platform day', [INVITED], { active: false }));
        return r;
      },
      [`GET /api/v1/events/${EVENT_ID}/submissions`]: listEnvelope([
        sessionRow('sub-14', 'DFC-014', 'Taming 40-Minute CI'),
        sessionRow('sub-50', 'DFC-050', 'Platform day'),
      ]),
      [`POST /api/v1/events/${EVENT_ID}/invitations`]: () => {
        invited = true;
        return { status: 201, body: { participantId: 'pa-9', contactId: CONTACT_ID } };
      },
    });
    renderPage();
    await screen.findByRole('heading', { level: 1, name: 'Priya Raman' });
    fireEvent.click(screen.getByRole('button', { name: 'Invite to speak' }));
    const dialog = await screen.findByRole('dialog', { name: 'Invite to speak' });
    const sessionSelect = within(dialog).getByLabelText('Session');
    // the session she already speaks on isn't offered
    await within(sessionSelect).findByRole('option', { name: 'DFC-050 Platform day' });
    expect(within(sessionSelect).queryByRole('option', { name: 'DFC-014 Taming 40-Minute CI' })).not.toBeInTheDocument();
    expect(callsTo(fetchMock, 'GET', `/api/v1/events/${EVENT_ID}/submissions`)[0]![0]).toContain('status=accepted');

    // the session is required
    fireEvent.click(within(dialog).getByRole('button', { name: 'Send invitation' }));
    expect(await within(dialog).findByText('Choose the session to invite them to.')).toBeInTheDocument();

    fireEvent.change(sessionSelect, { target: { value: 'sub-50' } });
    fireEvent.change(within(dialog).getByLabelText('Role'), { target: { value: 'panelist' } });
    const message = within(dialog).getByLabelText(/Personal message/);
    expect(message).toHaveAttribute('maxLength', '1000');
    fireEvent.change(message, { target: { value: 'We would love you on this panel.' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Send invitation' }));

    expect(await screen.findByText('Invitation sent to Priya Raman')).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    const posts = callsTo(fetchMock, 'POST', `/api/v1/events/${EVENT_ID}/invitations`);
    expect(bodyOf(posts[0]!)).toEqual({ submissionId: 'sub-50', contactId: CONTACT_ID, role: 'panelist', message: 'We would love you on this panel.', replyBy: null });
    // the re-read shows the new participation as invited
    expect(await screen.findByText('Panelist · DFC-050 Platform day')).toBeInTheDocument();
    expect(within(rowOf('Panelist · DFC-050 Platform day')).getByText('Invited by organizers · no reply yet')).toBeInTheDocument();
  });

  it('shows the API refusal of an invitation on the field it names', async () => {
    mockApi({
      [`GET ${RECORD_PATH}`]: baseRecord(),
      [`GET /api/v1/events/${EVENT_ID}/submissions`]: listEnvelope([sessionRow('sub-50', 'DFC-050', 'Platform day')]),
      [`POST /api/v1/events/${EVENT_ID}/invitations`]: {
        status: 409,
        body: errorEnvelope('conflict', "They're already on this session.", { contactId: 'Already a participant' }),
      },
    });
    renderPage();
    await screen.findByRole('heading', { level: 1, name: 'Priya Raman' });
    fireEvent.click(screen.getByRole('button', { name: 'Invite to speak' }));
    const dialog = await screen.findByRole('dialog', { name: 'Invite to speak' });
    const sessionSelect = within(dialog).getByLabelText('Session');
    await within(sessionSelect).findByRole('option', { name: 'DFC-050 Platform day' });
    fireEvent.change(sessionSelect, { target: { value: 'sub-50' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Send invitation' }));
    expect(await within(dialog).findByText("They're already on this session.")).toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: 'Invite to speak' })).toBeInTheDocument();
  });

  it('keeps the record for someone with no participations in the event', async () => {
    mockApi({ [`GET ${RECORD_PATH}`]: emptyRecord() });
    renderPage();
    expect(await screen.findByText('Priya has no participations in DevFlow Conf 2027.')).toBeInTheDocument();
    expect(screen.getByText('Participations · 0')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.queryByText(/Every item, and the portal/)).not.toBeInTheDocument();
    // what would give them a portal is still here
    expect(screen.getByRole('button', { name: 'Invite to speak' })).toBeInTheDocument();
    const roles = screen.getByRole('region', { name: 'Event roles' });
    expect(within(roles).getByText('Event roles · 0')).toBeInTheDocument();
    expect(within(roles).getByRole('button', { name: 'Add a role' })).toBeInTheDocument();
  });

  it('says so when the contact is not in this organization', async () => {
    mockApi({ [`GET ${RECORD_PATH}`]: { status: 404, body: errorEnvelope('not_found', 'Contact not found') } });
    renderPage();
    expect(await screen.findByRole('heading', { level: 1, name: 'Contact not found' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to Contacts' })).toHaveAttribute('href', '/contacts');
  });

  it('shows a load failure with a way to try again', async () => {
    let fail = true;
    mockApi({
      [`GET ${RECORD_PATH}`]: () => (fail ? { status: 500, body: errorEnvelope('internal', 'Something broke') } : baseRecord()),
    });
    renderPage();
    expect(await screen.findByRole('alert')).toHaveTextContent('Something broke');
    fail = false;
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Priya Raman' })).toBeInTheDocument();
  });

  it('names an open invitation onto a CFP session as an invitation', () => {
    const cfpInvite = session('p:pa-8', { ref: 'DFC-001', title: 'Monorepo CI', submissionId: 'sub-1', participationStatus: 'invited', role: 'co-presenter' });
    expect(arrivalLine(vp(cfpInvite, 'Co-presenter · DFC-001 Monorepo CI', []))).toBe('Through the CFP · accepted · invited, no reply yet');
    const pending = { ...COMPANY, company: { ...COMPANY.company!, sponsorshipStatus: 'pending' as const, tierName: null } };
    expect(arrivalLine(vp(pending, 'Contact · Latticework Systems', []))).toBe('Sponsor · sponsorship pending');
    expect(arrivalLine(vp(PRESS, 'Press · no session', []))).toBe('Added by organizers');
  });

  it('paints a skeleton while the record loads', () => {
    vi.stubGlobal('fetch', () => new Promise(() => {}));
    renderPage();
    expect(document.querySelector('[class*="chq-skeleton"]')).not.toBeNull();
    expect(document.querySelector('[class*="chq-empty"]')).toBeNull();
  });
});

// Multi-portal decision 77: "Give an item" hands one library task to this
// person directly (POST /tasks/:id/assign), for people on the event's
// roster (an accepted session) only.
describe('PersonRecordPage: Give an item', () => {
  const LIBRARY_PATH = `/api/v1/events/${EVENT_ID}/library`;
  function entry(ref: { taskId: string } | { resourceId: string } | { systemKind: string }, title: string) {
    return { ref, type: 'task', title, scope: 'person', instructions: null, formId: null, acceptedTypes: null, maxSizeMb: null, maxFiles: null, usedBy: [], direct: false, hint: '' };
  }
  const LIBRARY = {
    entries: [
      entry({ taskId: 'task-slides' }, 'Final slides'),
      entry({ taskId: 'task-promo' }, 'Promo video'),
      entry({ resourceId: 'res-1' }, 'Speaker handbook'),
      entry({ systemKind: 'bio' }, 'Bio'),
    ],
    counts: { task: 2, form: 0, file_request: 0, share_kit: 0, resource: 1 },
  };
  function heldRecord(): PersonRecord {
    const r = baseRecord();
    const [talk, ...rest] = r.view.sections;
    const items = talk!.items.map((i) => (i.title === 'Final slides' ? { ...i, taskId: 'task-slides' } : i));
    return { ...r, view: { ...r.view, sections: [{ ...talk!, items }, ...rest] } };
  }

  it('offers library tasks the person does not hold, gives the chosen one, and re-reads the record', async () => {
    const fetchMock = mockApi({
      [`GET ${RECORD_PATH}`]: heldRecord(),
      [`GET ${LIBRARY_PATH}`]: LIBRARY,
      'POST /api/v1/tasks/task-promo/assign': { tasks: [], rows: [], total: 0 },
    });
    renderPage();
    await screen.findByRole('heading', { level: 1, name: 'Priya Raman' });
    fireEvent.click(screen.getByRole('button', { name: 'Give an item' }));
    const dialog = await screen.findByRole('dialog', { name: 'Give an item' });
    const select = within(dialog).getByLabelText('Item');
    await waitFor(() => expect(within(select).getAllByRole('option').map((o) => o.textContent)).toEqual(['Choose an item', 'Promo video']));

    fireEvent.click(within(dialog).getByRole('button', { name: 'Give it' }));
    expect(await within(dialog).findByText('Choose an item to give.')).toBeInTheDocument();
    expect(callsTo(fetchMock, 'POST', '/api/v1/tasks/task-promo/assign')).toHaveLength(0);

    fireEvent.change(select, { target: { value: 'task-promo' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Give it' }));
    expect(await screen.findByText('Promo video given to Priya.')).toBeInTheDocument();
    const posts = callsTo(fetchMock, 'POST', '/api/v1/tasks/task-promo/assign');
    expect(posts.map(bodyOf)).toEqual([{ contactIds: [CONTACT_ID] }]);
    await waitFor(() => expect(callsTo(fetchMock, 'GET', RECORD_PATH).length).toBeGreaterThanOrEqual(2));
  });

  it("shows the assign door's refusal in the dialog", async () => {
    mockApi({
      [`GET ${RECORD_PATH}`]: heldRecord(),
      [`GET ${LIBRARY_PATH}`]: LIBRARY,
      'POST /api/v1/tasks/task-promo/assign': {
        status: 400,
        body: errorEnvelope('invalid', "One or more contacts are not on this event's roster", {
          contactIds: 'the contact must be a participant on an accepted submission of this event',
        }),
      },
    });
    renderPage();
    await screen.findByRole('heading', { level: 1, name: 'Priya Raman' });
    fireEvent.click(screen.getByRole('button', { name: 'Give an item' }));
    const dialog = await screen.findByRole('dialog', { name: 'Give an item' });
    const select = within(dialog).getByLabelText('Item');
    await waitFor(() => expect(within(select).getAllByRole('option')).toHaveLength(2));
    fireEvent.change(select, { target: { value: 'task-promo' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Give it' }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('the contact must be a participant on an accepted submission of this event');
  });

  it('is not offered to someone with no accepted session', async () => {
    const r = baseRecord();
    const notOnRoster: PersonRecord = { ...r, view: { ...r.view, participations: r.view.participations.filter((p) => p.participation.session?.status !== 'accepted') } };
    mockApi({ [`GET ${RECORD_PATH}`]: notOnRoster });
    renderPage();
    await screen.findByRole('heading', { level: 1, name: 'Priya Raman' });
    expect(screen.getByRole('button', { name: 'Invite to speak' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Give an item' })).not.toBeInTheDocument();
  });
});
