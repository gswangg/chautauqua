// w3-c/DEC-747 render smoke test, updated w6-e/DEC-815 and for multi-portal:
// PortalSettingsPanel is the Settings "Portals" section -- a read-only
// summary of the event's portals, coverage, item library and access, whose
// head action links to the Portals sub-page. Multi-portal decision 74
// removed its edit form: the welcome note is Profile basics' note,
// resources are made in the library, the "Show resources" switch and the
// general preview are gone.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, cleanup, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter } from 'react-router-dom';
import { PortalSettingsPanel } from './PortalSettingsPanel';
import { mockApi } from '../../test-utils/mockApi';

const EVENT_ID = 'evt-portal';

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

function mockPortal(overrides: Record<string, unknown> = {}) {
  return mockApi({
    [`GET /api/v1/events/${EVENT_ID}/portals`]: {
      portals: [
        { id: 'p1', name: 'Profile basics', template: 'profile_basics', who: '', participations: 91, items: 2, matchesNobody: false, createdAt: 0 },
        { id: 'p2', name: 'CFP speakers', template: null, who: '', participations: 31, items: 5, matchesNobody: false, createdAt: 0 },
      ],
      covered: 91,
      total: 96,
      notInAny: 5,
      overlap: 38,
      templates: [],
    },
    [`GET /api/v1/events/${EVENT_ID}/library`]: { counts: { task: 2, form: 0, file_request: 1, share_kit: 0, resource: 1 }, entries: [
      { ref: { taskId: 't1' }, type: 'task', title: 'AV needs', scope: 'participation', instructions: null, formId: null, acceptedTypes: null, maxSizeMb: null, maxFiles: null, usedBy: [], direct: false, hint: '' },
      { ref: { taskId: 't2' }, type: 'task', title: 'Speaker release', scope: 'participation', instructions: null, formId: null, acceptedTypes: null, maxSizeMb: null, maxFiles: null, usedBy: [], direct: false, hint: '' },
      { ref: { taskId: 't3' }, type: 'file_request', title: 'Final slides', scope: 'participation', instructions: null, formId: null, acceptedTypes: ['pdf'], maxSizeMb: 200, maxFiles: 1, usedBy: [], direct: false, hint: '' },
      { ref: { resourceId: 'res1' }, type: 'resource', title: 'Travel info', scope: 'person', instructions: null, formId: null, acceptedTypes: null, maxSizeMb: null, maxFiles: null, usedBy: [], direct: false, hint: '' },
      { ref: { systemKind: 'bio' }, type: 'built_in', title: 'Bio', scope: 'person', instructions: null, formId: null, acceptedTypes: null, maxSizeMb: null, maxFiles: null, usedBy: [], direct: false, hint: '' },
    ] },
    ...overrides,
  });
}

describe('PortalSettingsPanel (read-only summary)', () => {
  it('summarises the portals, coverage, library and access, and links to the Portals sub-page', async () => {
    mockPortal();
    render(
      <MemoryRouter>
        <PortalSettingsPanel />
      </MemoryRouter>,
    );

    const section = await screen.findByRole('region', { name: 'Portals' });
    expect(within(section).getByRole('heading', { name: 'Portals' })).toBeInTheDocument();
    expect(within(section).getByRole('button', { name: 'Manage portals' })).toBeInTheDocument();

    expect(await within(section).findByText('2 · Profile basics, CFP speakers')).toBeInTheDocument();
    expect(within(section).getByText('91 of 96 participations covered')).toBeInTheDocument();
    expect(within(section).getByRole('link', { name: '5 not in any portal' })).toHaveAttribute('href', '/speakers?portal=none');
    // built-in items (Bio) aren't counted as the organizer's library
    expect(within(section).getByText('2 tasks · 1 file request · 1 resource')).toBeInTheDocument();
    expect(
      within(section).getByText('Participants claim their portal from a link in their acceptance or invitation email'),
    ).toBeInTheDocument();
  });

  it('has no edit form: no Change, welcome note, Show resources, resource list or general preview (decision 74)', async () => {
    mockPortal();
    render(
      <MemoryRouter initialEntries={['/settings?section=portal&edit=1']}>
        <PortalSettingsPanel />
      </MemoryRouter>,
    );
    const section = await screen.findByRole('region', { name: 'Portals' });
    await within(section).findByText('2 · Profile basics, CFP speakers');
    expect(within(section).queryByRole('button', { name: 'Change' })).not.toBeInTheDocument();
    expect(within(section).queryByText('Welcome note')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Welcome note')).not.toBeInTheDocument();
    expect(screen.queryByRole('checkbox', { name: 'Show resources' })).not.toBeInTheDocument();
    expect(screen.queryByText('Travel info')).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Preview the portal' })).not.toBeInTheDocument();
    expect(screen.queryByText('Branding')).not.toBeInTheDocument();
  });
});
