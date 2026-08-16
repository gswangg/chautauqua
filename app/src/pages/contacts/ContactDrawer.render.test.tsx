// DEC-616 / A20 (w26-c): the drawer is a record, not a form — a
// component-render smoke test asserting (1) labelled facts render as plain
// values from the fixture ContactDetail, with a blank field printing the
// literal "Nothing recorded" (never an em dash, never a blank cell), (2)
// the record is grouped under four titled group headers in order (Contact,
// Profile, This event, Notes), (3) the four social links occupy exactly ONE
// 'Links' row, (4) the "Across your events" section renders one row per
// history entry across all three history collections, and (5) the sticky
// footer exposes Delete far left and Cancel/Save right-flushed, with
// Delete preceding both in DOM order.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter } from 'react-router-dom';
import { ContactDrawer } from './ContactDrawer';
import { mockApi, errorEnvelope } from '../../test-utils/mockApi';
import { resetEventsCacheForTests } from '../../lib/useCurrentEvent';
import type { ContactDetail } from './types';

const HERE = dirname(fileURLToPath(import.meta.url));
const SHARED_CSS = readFileSync(join(HERE, '../../styles.css'), 'utf-8');
const CONTACTS_CSS = readFileSync(join(HERE, './contacts.css'), 'utf-8');

/** Extracts a top-level (not inside an @media block) rule's declaration
 * body by selector -- same helper as FilterRulesPanel.render.test.tsx. */
function topLevelRuleBody(css: string, selector: string): string {
  const withoutMedia = css.replace(/@media[^{]*\{(?:[^{}]*\{[^{}]*\}[^{}]*)*\}/g, '');
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = withoutMedia.match(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`));
  const body = match?.[1];
  if (body === undefined) throw new Error(`no top-level rule found for ${selector}`);
  return body;
}

const CONTACT: ContactDetail = {
  id: 'ct1',
  firstName: 'Priya',
  lastName: 'Raman',
  email: 'priya@example.com',
  company: 'Latticework Systems',
  title: 'Principal Engineer',
  labels: [],
  phone: null,
  notes: null,
  bio: null,
  headshotUrl: null,
  socialLinks: { twitter: '@priya', linkedin: null, github: null, website: null },
  customFields: {},
  history: {
    submissions: [
      { id: 'sub1', ref: 'SUB-1', title: 'Scaling caches', eventId: 'ev-1', eventName: 'DevCon 2026', status: 'accepted' },
    ],
    submissionsTotal: 1,
    emails: [{ id: 'em1', subject: 'Welcome', toEmail: 'priya@example.com', sentAt: 1735689600000 }],
    emailsTotal: 1,
    events: ['DevCon 2025'],
    eventsTotal: 1,
  },
};

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  window.localStorage.clear();
  resetEventsCacheForTests();
});

describe('ContactDrawer render (DEC-616 record view)', () => {
  it('renders the four titled groups, in order, each with the shared section-head rule', async () => {
    mockApi({ 'GET /api/v1/contacts/ct1': CONTACT });

    render(<ContactDrawer contactId="ct1" onClose={() => {}} onSaved={() => {}} onContactChanged={() => {}} />);

    const dialog = await screen.findByRole('dialog', { name: 'Contact detail' });
    await waitFor(() => {
      expect(within(dialog).getByText('Priya Raman')).toBeInTheDocument();
    });

    const heads = dialog.querySelectorAll('.chq-contacts-record-group-head .chq-section-label');
    expect(Array.from(heads).map((el) => el.textContent)).toEqual(['Contact', 'Profile', 'On this event', 'Notes']);

    // Every group head carries the shared 2px-ink section rule.
    const body = topLevelRuleBody(SHARED_CSS, '.chq-section-head');
    expect(body).toMatch(/border-bottom:\s*2px solid var\(--chq-ink\)/);
  });

  it('renders a blank field as the literal "Nothing recorded", never an em dash or empty cell', async () => {
    mockApi({ 'GET /api/v1/contacts/ct1': CONTACT });

    render(<ContactDrawer contactId="ct1" onClose={() => {}} onSaved={() => {}} onContactChanged={() => {}} />);

    const dialog = await screen.findByRole('dialog', { name: 'Contact detail' });
    await waitFor(() => {
      expect(within(dialog).getByText('Priya Raman')).toBeInTheDocument();
    });

    // Bio is null on the fixture -> its row renders inline (no
    // hide-when-empty disclosure) with the literal empty-value string.
    const bioLabel = within(dialog).getByText('Bio');
    const bioRow = bioLabel.closest('.chq-contacts-record-row');
    expect(bioRow).not.toBeNull();
    const nothingRecorded = within(bioRow as HTMLElement).getByText('Nothing recorded');
    expect(nothingRecorded).toHaveClass('chq-contacts-record-empty');

    // Phone is also null -> same treatment, rendered inline immediately
    // (no disclosure gate to expand first).
    const phoneLabel = within(dialog).getByText('Phone');
    const phoneRow = phoneLabel.closest('.chq-contacts-record-row');
    expect(within(phoneRow as HTMLElement).getByText('Nothing recorded')).toBeInTheDocument();
    expect(within(phoneRow as HTMLElement).queryByText('—')).not.toBeInTheDocument();

    // The muted/disabled ink comes from a CSS variable, never a colour
    // literal, on the class that carries "Nothing recorded".
    const emptyBody = topLevelRuleBody(CONTACTS_CSS, '.chq-contacts-record-empty');
    expect(emptyBody).toMatch(/color:\s*var\(--chq-muted\)/);
    expect(emptyBody).not.toMatch(/#[0-9a-fA-F]{3,6}/);
  });

  it('collapses the four social links into exactly ONE Links row', async () => {
    mockApi({ 'GET /api/v1/contacts/ct1': CONTACT });

    render(<ContactDrawer contactId="ct1" onClose={() => {}} onSaved={() => {}} onContactChanged={() => {}} />);

    const dialog = await screen.findByRole('dialog', { name: 'Contact detail' });
    await waitFor(() => {
      expect(within(dialog).getByText('Priya Raman')).toBeInTheDocument();
    });

    // Exactly one "Links" label row -- never four separate label rows.
    expect(within(dialog).getAllByText('Links')).toHaveLength(1);
    expect(within(dialog).queryByText('Twitter')).not.toBeInTheDocument();
    expect(within(dialog).queryByText('LinkedIn')).not.toBeInTheDocument();
    expect(within(dialog).queryByText('GitHub')).not.toBeInTheDocument();
    expect(within(dialog).queryByText('Website')).not.toBeInTheDocument();

    const linksRow = within(dialog).getByText('Links').closest('.chq-contacts-record-row') as HTMLElement;
    // Non-empty twitter value shows in the collapsed summary.
    expect(within(linksRow).getByText('@priya')).toBeInTheDocument();

    // Clicking the row opens all four inputs inside that SAME row.
    fireEvent.click(within(linksRow).getByText('@priya'));
    expect(within(linksRow).getByPlaceholderText('@handle')).toBeInTheDocument();
    expect(within(linksRow).getByPlaceholderText('in/handle')).toBeInTheDocument();
    expect(within(linksRow).getByPlaceholderText('handle')).toBeInTheDocument();
    expect(within(linksRow).getByPlaceholderText('https://example.com')).toBeInTheDocument();
  });

  it('renders one history row per submission/email/event history entry', async () => {
    mockApi({ 'GET /api/v1/contacts/ct1': CONTACT });

    render(<ContactDrawer contactId="ct1" onClose={() => {}} onSaved={() => {}} onContactChanged={() => {}} />);

    const dialog = await screen.findByRole('dialog', { name: 'Contact detail' });
    const history = await within(dialog).findByRole('region', { name: 'Across your events' });

    await waitFor(() => {
      expect(within(history).getByText('DevCon 2026')).toBeInTheDocument();
    });

    const rows = history.querySelectorAll('.chq-contacts-history-row');
    expect(rows.length).toBe(
      CONTACT.history.submissions.length + CONTACT.history.emails.length + CONTACT.history.events.length,
    );

    expect(within(history).getByText(/Scaling caches \(SUB-1\) — accepted/)).toBeInTheDocument();
    expect(within(history).getByText(/Welcome → priya@example.com/)).toBeInTheDocument();
    expect(within(history).getByText('DevCon 2025')).toBeInTheDocument();
  });

  it('states the emails bound above the cap, mirroring the submissions line (w52-f)', async () => {
    const CAPPED_CONTACT: ContactDetail = {
      ...CONTACT,
      history: { ...CONTACT.history, emailsTotal: 300 },
    };
    mockApi({ 'GET /api/v1/contacts/ct1': CAPPED_CONTACT });

    render(<ContactDrawer contactId="ct1" onClose={() => {}} onSaved={() => {}} onContactChanged={() => {}} />);

    const dialog = await screen.findByRole('dialog', { name: 'Contact detail' });
    const history = await within(dialog).findByRole('region', { name: 'Across your events' });

    await waitFor(() => {
      expect(within(history).getByText('Showing 1 of 300 emails')).toBeInTheDocument();
    });
  });

  it('is silent about the emails bound when emailsTotal is at or below emails.length', async () => {
    mockApi({ 'GET /api/v1/contacts/ct1': CONTACT });

    render(<ContactDrawer contactId="ct1" onClose={() => {}} onSaved={() => {}} onContactChanged={() => {}} />);

    const dialog = await screen.findByRole('dialog', { name: 'Contact detail' });
    const history = await within(dialog).findByRole('region', { name: 'Across your events' });

    await waitFor(() => {
      expect(within(history).getByText('DevCon 2026')).toBeInTheDocument();
    });

    expect(within(history).queryByText(/of .* emails?$/)).not.toBeInTheDocument();
  });

  it('states the events bound above the cap, mirroring the emails line (w47-f)', async () => {
    const CAPPED_CONTACT: ContactDetail = {
      ...CONTACT,
      history: { ...CONTACT.history, eventsTotal: 50 },
    };
    mockApi({ 'GET /api/v1/contacts/ct1': CAPPED_CONTACT });

    render(<ContactDrawer contactId="ct1" onClose={() => {}} onSaved={() => {}} onContactChanged={() => {}} />);

    const dialog = await screen.findByRole('dialog', { name: 'Contact detail' });
    const history = await within(dialog).findByRole('region', { name: 'Across your events' });

    await waitFor(() => {
      expect(within(history).getByText('Showing 1 of 50 events')).toBeInTheDocument();
    });
  });

  it('is silent about the events bound when eventsTotal is at or below events.length', async () => {
    mockApi({ 'GET /api/v1/contacts/ct1': CONTACT });

    render(<ContactDrawer contactId="ct1" onClose={() => {}} onSaved={() => {}} onContactChanged={() => {}} />);

    const dialog = await screen.findByRole('dialog', { name: 'Contact detail' });
    const history = await within(dialog).findByRole('region', { name: 'Across your events' });

    await waitFor(() => {
      expect(within(history).getByText('DevCon 2026')).toBeInTheDocument();
    });

    expect(within(history).queryByText(/of .* events?$/)).not.toBeInTheDocument();
  });

  it('exposes Save / Email / Add to event / Cancel as real buttons in one action bar', async () => {
    mockApi({ 'GET /api/v1/contacts/ct1': CONTACT });

    render(<ContactDrawer contactId="ct1" onClose={() => {}} onSaved={() => {}} onContactChanged={() => {}} />);

    const dialog = await screen.findByRole('dialog', { name: 'Contact detail' });
    await waitFor(() => {
      expect(within(dialog).getByText('Priya Raman')).toBeInTheDocument();
    });

    const saveButton = within(dialog).getByRole('button', { name: 'Save' });
    const cancelButton = within(dialog).getByRole('button', { name: 'Cancel' });
    const emailButton = within(dialog).getByRole('button', { name: 'Email' });
    const addToEventButton = within(dialog).getByRole('button', { name: 'Add to event' });

    expect(saveButton.tagName).toBe('BUTTON');
    expect(cancelButton.tagName).toBe('BUTTON');
    expect(emailButton.tagName).toBe('BUTTON');
    expect(addToEventButton.tagName).toBe('BUTTON');

    const actionBar = saveButton.closest('.chq-contacts-drawer-actions');
    expect(actionBar).not.toBeNull();
    expect(actionBar).toContainElement(cancelButton);
    expect(actionBar).toContainElement(emailButton);
    expect(actionBar).toContainElement(addToEventButton);
  });

  // A20 (w26-c): 'Delete this contact' sits far left as a tertiary link;
  // Cancel and Save are right-flushed. Delete must precede both in DOM
  // order and must never be the element immediately adjacent to Save.
  it('places Delete far left, ahead of Cancel and Save, and never adjacent to Save', async () => {
    mockApi({ 'GET /api/v1/contacts/ct1': CONTACT });

    render(<ContactDrawer contactId="ct1" onClose={() => {}} onSaved={() => {}} onContactChanged={() => {}} />);

    const dialog = await screen.findByRole('dialog', { name: 'Contact detail' });
    await waitFor(() => {
      expect(within(dialog).getByText('Priya Raman')).toBeInTheDocument();
    });

    const actionBar = within(dialog).getByRole('button', { name: 'Save' }).closest('.chq-contacts-drawer-actions') as HTMLElement;
    const buttons = Array.from(actionBar.querySelectorAll('button')).map((b) => b.textContent);

    const deleteIndex = buttons.indexOf('Delete this contact');
    const cancelIndex = buttons.indexOf('Cancel');
    const saveIndex = buttons.indexOf('Save');

    expect(deleteIndex).toBeGreaterThanOrEqual(0);
    expect(deleteIndex).toBeLessThan(cancelIndex);
    expect(deleteIndex).toBeLessThan(saveIndex);

    // Delete's own DOM sibling is never the Save button.
    const deleteEl = within(dialog).getByRole('button', { name: 'Delete this contact' });
    const saveEl = within(dialog).getByRole('button', { name: 'Save' });
    expect(deleteEl.nextElementSibling).not.toBe(saveEl);
  });

  // DEC-894: the headshot file input uses the shared .chq-file control
  // (not the generic .chq-input, which overflows the panel), and the
  // drawer prints the stored file's filename and upload date beside the
  // image so an uploaded headshot reads as a record, not decoration.
  it('gives the headshot input the shared .chq-file class and prints stored file metadata', async () => {
    const contactWithHeadshot: ContactDetail = {
      ...CONTACT,
      headshotUrl: '/headshots/file1',
      headshotFile: { filename: 'priya-headshot.jpg', uploadedAt: 1735689600000 },
    };
    mockApi({ 'GET /api/v1/contacts/ct1': contactWithHeadshot });

    render(<ContactDrawer contactId="ct1" onClose={() => {}} onSaved={() => {}} onContactChanged={() => {}} />);

    const dialog = await screen.findByRole('dialog', { name: 'Contact detail' });
    await waitFor(() => {
      expect(within(dialog).getByText('Priya Raman')).toBeInTheDocument();
    });

    const fileInput = dialog.querySelector('input[type="file"]');
    expect(fileInput).not.toBeNull();
    expect(fileInput).toHaveClass('chq-file');
    expect(fileInput).not.toHaveClass('chq-input');

    expect(within(dialog).getByText(/priya-headshot\.jpg/)).toBeInTheDocument();
  });

  // DEC-894 amendment (wave 53): .chq-file had no width bound at all, so
  // the UA's intrinsic file-input width won and pushed the control's right
  // edge past the drawer's viewport (~38px of horizontal scroll). The rule
  // must bound the control to its container.
  it('bounds .chq-file to its container so the drawer never scrolls horizontally', () => {
    const body = topLevelRuleBody(SHARED_CSS, '.chq-file');
    expect(body).toMatch(/max-width:\s*100%/);
  });

  it('renders no headshot metadata line when there is no stored headshot', async () => {
    mockApi({ 'GET /api/v1/contacts/ct1': CONTACT });

    render(<ContactDrawer contactId="ct1" onClose={() => {}} onSaved={() => {}} onContactChanged={() => {}} />);

    const dialog = await screen.findByRole('dialog', { name: 'Contact detail' });
    await waitFor(() => {
      expect(within(dialog).getByText('Priya Raman')).toBeInTheDocument();
    });

    expect(dialog.querySelector('.chq-contacts-headshot-meta')).toBeNull();
  });

  // DEC-616 amendment (wave 4): frame width is 520px, not 420.
  it('is 520px wide, not 420', () => {
    const body = topLevelRuleBody(SHARED_CSS, '.chq-drawer');
    expect(body).toMatch(/width:\s*min\(520px, 100vw\)/);
    expect(body).not.toMatch(/420px/);
  });

  // DEC-616 amendment (wave 4): the record-row grid template
  // (minmax(0,1fr)) is the orchestrator's landed overflow fix (9ba85315)
  // and must survive this task untouched -- the drawer's zero-horizontal-
  // scroll contract at 1440 depends on it.
  it('keeps the record-row grid template that guarantees zero horizontal scroll', () => {
    const body = topLevelRuleBody(CONTACTS_CSS, '.chq-contacts-record-row');
    expect(body).toMatch(/grid-template-columns:\s*130px minmax\(0,\s*1fr\)/);
    const fileBody = topLevelRuleBody(SHARED_CSS, '.chq-file');
    expect(fileBody).toMatch(/max-width:\s*100%/);
  });

  // DEC-616 amendment (wave 4): action-bar buttons never wrap at 520px.
  it('keeps the action bar on one line per button (no wrap)', () => {
    const body = topLevelRuleBody(CONTACTS_CSS, '.chq-contacts-drawer-actions');
    expect(body).toMatch(/flex-wrap:\s*nowrap/);
  });

  // DEC-366: .chq-btn-tertiary already carries the design-system olive
  // focus-visible ring -- locked here since the tertiary "Delete this
  // contact" trigger lives in this drawer's action bar.
  it('gives .chq-btn-tertiary the design-system olive focus-visible ring', () => {
    const body = topLevelRuleBody(SHARED_CSS, '.chq-btn-tertiary:focus-visible');
    expect(body).toMatch(/outline:\s*2px solid var\(--chq-brand\)/);
    expect(body).toMatch(/outline-offset:\s*2px/);
  });

  // DEC-292 amendment (findings wave 5): "This event" records three
  // reserved fields -- Dietary, Travel, Accessibility -- each in its own
  // labelled row; travel_logistics content renders under Travel, never
  // under Dietary.
  it('renders Dietary, Travel, and Accessibility as three distinct rows inside "This event"', async () => {
    mockApi({
      'GET /api/v1/contacts/ct1': {
        ...CONTACT,
        bio: null,
        customFields: { dietary: 'Vegetarian', travel_logistics: 'Arrival May 11, aisle seat' },
      },
    });

    render(<ContactDrawer contactId="ct1" onClose={() => {}} onSaved={() => {}} onContactChanged={() => {}} />);

    const dialog = await screen.findByRole('dialog', { name: 'Contact detail' });
    await waitFor(() => {
      expect(within(dialog).getByText('Priya Raman')).toBeInTheDocument();
    });

    // All three live inside the event-scoped group (falls back to 'On this
    // event' when the drawer has no resolved current-event name).
    const thisEventGroup = within(dialog)
      .getByText('On this event')
      .closest('.chq-contacts-record-group') as HTMLElement;
    expect(within(thisEventGroup).getByText('Dietary')).toBeInTheDocument();
    expect(within(thisEventGroup).getByText('Travel')).toBeInTheDocument();
    expect(within(thisEventGroup).getByText('Accessibility')).toBeInTheDocument();

    // Dietary value renders under Dietary, not Travel.
    const dietaryRow = within(thisEventGroup).getByText('Dietary').closest('.chq-contacts-record-row') as HTMLElement;
    expect(within(dietaryRow).getByText('Vegetarian')).toBeInTheDocument();

    // travel_logistics content renders under Travel, not Dietary.
    const travelRow = within(thisEventGroup).getByText('Travel').closest('.chq-contacts-record-row') as HTMLElement;
    expect(within(travelRow).getByText('Arrival May 11, aisle seat')).toBeInTheDocument();

    // Accessibility has nothing recorded here.
    const accessibilityRow = within(thisEventGroup)
      .getByText('Accessibility')
      .closest('.chq-contacts-record-row') as HTMLElement;
    expect(within(accessibilityRow).getByText('Nothing recorded')).toBeInTheDocument();
  });

  // DEC-616 amendment (wave 15): the drawer states its own save mechanism
  // in the record head, exactly once, in plain words.
  it('states how the drawer saves in one caption in the record head', async () => {
    mockApi({ 'GET /api/v1/contacts/ct1': CONTACT });

    render(<ContactDrawer contactId="ct1" onClose={() => {}} onSaved={() => {}} onContactChanged={() => {}} />);

    const dialog = await screen.findByRole('dialog', { name: 'Contact detail' });
    await waitFor(() => {
      expect(within(dialog).getByText('Priya Raman')).toBeInTheDocument();
    });

    const captions = within(dialog).getAllByText(
      'Click a row to edit it — nothing is saved until you press Save.',
    );
    expect(captions).toHaveLength(1);
    expect(captions[0]).toHaveClass('chq-meta');
  });

  // DEC-616 amendment (wave 15): the action row (where Save lives) is a
  // persistent footer -- a sibling of the scrolling record body inside the
  // drawer, pinned via the sticky class rather than nested under it.
  it('keeps Save in a sticky actions footer, a sibling of the record body', async () => {
    mockApi({ 'GET /api/v1/contacts/ct1': CONTACT });

    render(<ContactDrawer contactId="ct1" onClose={() => {}} onSaved={() => {}} onContactChanged={() => {}} />);

    const dialog = await screen.findByRole('dialog', { name: 'Contact detail' });
    await waitFor(() => {
      expect(within(dialog).getByText('Priya Raman')).toBeInTheDocument();
    });

    const saveButton = within(dialog).getByRole('button', { name: 'Save' });
    const actionsEl = saveButton.closest('.chq-contacts-drawer-actions');
    expect(actionsEl).not.toBeNull();

    const drawerEl = dialog.querySelector('.chq-modal.chq-drawer');
    expect(drawerEl).not.toBeNull();
    expect(actionsEl!.parentElement).toBe(drawerEl);

    const recordEl = dialog.querySelector('.chq-contacts-record');
    expect(recordEl).not.toBeNull();
    expect(recordEl!.parentElement).toBe(drawerEl);
    expect(actionsEl).not.toBe(recordEl);

    // Sticky mechanics live on this same class in styles.css.
    const body = topLevelRuleBody(SHARED_CSS, '.chq-contacts-drawer-actions');
    expect(body).toMatch(/position:\s*sticky/);
    expect(body).toMatch(/bottom:\s*0/);
  });
});

describe('ContactDrawer event-scoped group (DEC-941)', () => {
  it('falls back to "On this event" with a caption naming the split, when no current event resolves', async () => {
    mockApi({ 'GET /api/v1/contacts/ct1': CONTACT });

    render(<ContactDrawer contactId="ct1" onClose={() => {}} onSaved={() => {}} onContactChanged={() => {}} />);

    const dialog = await screen.findByRole('dialog', { name: 'Contact detail' });
    await waitFor(() => {
      expect(within(dialog).getByText('Priya Raman')).toBeInTheDocument();
    });

    const group = within(dialog).getByText('On this event').closest('.chq-contacts-record-group') as HTMLElement;
    expect(
      within(group).getByText(
        "These facts belong to this event only — everything above is this person's org-wide record.",
      ),
    ).toBeInTheDocument();

    expect(
      within(dialog).getByText("Saves both the org-wide record and this event's facts"),
    ).toBeInTheDocument();
  });

  it('titles the group with the resolved current event name', async () => {
    window.localStorage.setItem('chq.currentEventId', 'ev-1');
    mockApi({
      'GET /api/v1/contacts/ct1': CONTACT,
      'GET /api/v1/events': { items: [{ id: 'ev-1', name: 'DevCon 2026' }], total: 1, page: 1, perPage: 50 },
    });

    render(<ContactDrawer contactId="ct1" onClose={() => {}} onSaved={() => {}} onContactChanged={() => {}} />);

    const dialog = await screen.findByRole('dialog', { name: 'Contact detail' });
    await waitFor(() => {
      expect(within(dialog).getByText('Priya Raman')).toBeInTheDocument();
    });

    let groupHead: HTMLElement;
    await waitFor(() => {
      const heads = dialog.querySelectorAll('.chq-contacts-record-group-head .chq-section-label');
      const found = Array.from(heads).find((el) => el.textContent === 'DevCon 2026');
      expect(found).toBeDefined();
      groupHead = found as HTMLElement;
    });
    expect(within(dialog).queryByText('On this event')).not.toBeInTheDocument();

    const group = groupHead!.closest('.chq-contacts-record-group') as HTMLElement;
    expect(
      within(group).getByText(
        "These facts belong to this event only — everything above is this person's org-wide record.",
      ),
    ).toBeInTheDocument();

    expect(
      within(dialog).getByText("Saves both the org-wide record and DevCon 2026's facts"),
    ).toBeInTheDocument();
  });
});

describe('ContactDrawer delete (DEC-758)', () => {
  it('offers a quiet tertiary "Delete this contact" control, and confirming names the record', async () => {
    mockApi({ 'GET /api/v1/contacts/ct1': CONTACT });

    render(
      <MemoryRouter>
        <ContactDrawer contactId="ct1" onClose={() => {}} onSaved={() => {}} onContactChanged={() => {}} />
      </MemoryRouter>,
    );

    const dialog = await screen.findByRole('dialog', { name: 'Contact detail' });
    await waitFor(() => {
      expect(within(dialog).getByText('Priya Raman')).toBeInTheDocument();
    });

    const deleteTrigger = within(dialog).getByRole('button', { name: 'Delete this contact' });
    expect(deleteTrigger.tagName).toBe('BUTTON');
    expect(deleteTrigger.className).toContain('chq-btn');
    expect(deleteTrigger.className).toContain('chq-btn-destructive-tertiary');

    fireEvent.click(deleteTrigger);

    const confirmDialog = await screen.findByRole('dialog', { name: 'Delete this contact' });
    expect(
      within(confirmDialog).getByText(
        'Delete Priya Raman? Any task assignments and sourcing-pipeline history for this person are removed with them. This cannot be undone.',
      ),
    ).toBeInTheDocument();
    expect(within(confirmDialog).getByRole('button', { name: 'Delete' })).toBeInTheDocument();
    expect(within(confirmDialog).getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
  });

  it('closes the drawer and refetches on a successful delete', async () => {
    const onSaved = vi.fn();
    mockApi({
      'GET /api/v1/contacts/ct1': CONTACT,
      // mockApi's Response constructor can't carry a 204 + body (per the
      // Fetch spec) -- 200 exercises the same res.ok success path apiDelete
      // reads (the route itself returns a real, bodyless 204).
      'DELETE /api/v1/contacts/ct1': { status: 200, body: { ok: true } },
    });

    render(
      <MemoryRouter>
        <ContactDrawer contactId="ct1" onClose={() => {}} onSaved={onSaved} onContactChanged={() => {}} />
      </MemoryRouter>,
    );

    const dialog = await screen.findByRole('dialog', { name: 'Contact detail' });
    await waitFor(() => expect(within(dialog).getByText('Priya Raman')).toBeInTheDocument());

    fireEvent.click(within(dialog).getByRole('button', { name: 'Delete this contact' }));
    const confirmDialog = await screen.findByRole('dialog', { name: 'Delete this contact' });
    fireEvent.click(within(confirmDialog).getByRole('button', { name: 'Delete' }));

    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
  });

  it('on a 409, shows the server message with a Duplicates-tab link and keeps the drawer open', async () => {
    const onSaved = vi.fn();
    mockApi({
      'GET /api/v1/contacts/ct1': CONTACT,
      'DELETE /api/v1/contacts/ct1': {
        status: 409,
        body: errorEnvelope('conflict', 'This contact is on 3 submissions and 1 task. Merge it into another record instead of deleting it.', {
          participants: '3',
          taskAssignments: '1',
        }),
      },
    });

    render(
      <MemoryRouter>
        <ContactDrawer contactId="ct1" onClose={() => {}} onSaved={onSaved} onContactChanged={() => {}} />
      </MemoryRouter>,
    );

    const dialog = await screen.findByRole('dialog', { name: 'Contact detail' });
    await waitFor(() => expect(within(dialog).getByText('Priya Raman')).toBeInTheDocument());

    fireEvent.click(within(dialog).getByRole('button', { name: 'Delete this contact' }));
    const confirmDialog = await screen.findByRole('dialog', { name: 'Delete this contact' });
    fireEvent.click(within(confirmDialog).getByRole('button', { name: 'Delete' }));

    await waitFor(() => {
      expect(
        within(confirmDialog).getByText(
          'This contact is on 3 submissions and 1 task. Merge it into another record instead of deleting it.',
        ),
      ).toBeInTheDocument();
    });
    expect(within(confirmDialog).getByRole('link', { name: 'Go to the Duplicates tab' })).toHaveAttribute(
      'href',
      '/contacts?tab=duplicates',
    );

    // Neither onSaved (which would close+refetch) nor the confirm dialog's
    // own dismissal fired -- the drawer and its confirm step stay open.
    expect(onSaved).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog', { name: 'Contact detail' })).toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: 'Delete this contact' })).toBeInTheDocument();
  });
});
