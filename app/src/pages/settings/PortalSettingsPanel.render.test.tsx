// w3-c/DEC-747 render smoke test: PortalSettingsPanel is the whole
// 'Speaker portal' read view -- Welcome note, Speakers can edit (pills),
// Onboarding tasks, Resources (delegated to ResourcesPanel, unchanged
// endpoints) and Access -- with 'Open as a speaker' as the section's ONE
// action, a real link rather than an edit-drill toggle.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, fireEvent, cleanup, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { PortalSettingsPanel } from './PortalSettingsPanel';
import { listEnvelope, mockApi } from '../../test-utils/mockApi';

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
    [`GET /api/v1/events/${EVENT_ID}/portal-settings`]: {
      logoUrl: null,
      accentColor: null,
      welcomeMessage: 'Welcome, speakers!\n\nWe cannot wait to see you.',
      showResources: true,
    },
    [`GET /api/v1/events/${EVENT_ID}/onboarding`]: {
      tasks: [{ id: 't1' }, { id: 't2' }, { id: 't3' }],
      rows: [],
      total: 0,
      page: 1,
      perPage: 1,
      counts: { speakers: 0, outstandingRequired: 0, overdue: 0, outstandingContacts: 0 },
    },
    [`GET /api/v1/events/${EVENT_ID}/resources`]: listEnvelope([
      { id: 'res1', kind: 'wiki', title: 'Travel info', content: 'Fly into AUS. Rideshare is easiest.', fileId: null, position: 0 },
      { id: 'res2', kind: 'file', title: 'Slide template', content: null, fileId: 'file1', position: 1 },
    ]),
    ...overrides,
  });
}

describe('PortalSettingsPanel (Speaker portal read view)', () => {
  it('renders every row of the read view from real data, with Open as a speaker as the one rule action', async () => {
    mockPortal();
    render(<PortalSettingsPanel />);

    expect(screen.getByRole('heading', { name: 'Speaker portal' })).toBeInTheDocument();
    const openAsSpeaker = screen.getByRole('link', { name: 'Open as a speaker' });
    expect(openAsSpeaker).toHaveAttribute('href', '/portal');

    await waitFor(() => {
      expect(screen.getByText('Shown above the task list · 2 paragraphs')).toBeInTheDocument();
    });
    expect(screen.getByText('3 tasks · created when a submission is accepted')).toBeInTheDocument();
    expect(screen.getByText('Speakers claim their portal from a link in their acceptance email')).toBeInTheDocument();

    // Speakers-can-edit pills: filled for the always-editable profile
    // fields, outline for the gated session fields.
    expect(screen.getByText('Bio')).toHaveClass('is-active');
    expect(screen.getByText('Headshot')).toHaveClass('is-active');
    expect(screen.getByText('Links')).toHaveClass('is-active');
    expect(screen.getByText('Session title')).not.toHaveClass('is-active');
    expect(screen.getByText('Abstract')).not.toHaveClass('is-active');

    // Resources row: name + size (never raw markdown body) + Replace, plus
    // 'Add a resource'.
    await waitFor(() => {
      expect(screen.getByText('Travel info')).toBeInTheDocument();
    });
    expect(screen.getByText('6 words')).toBeInTheDocument();
    expect(screen.queryByText(/Fly into AUS/)).not.toBeInTheDocument();
    expect(screen.getByText('Slide template')).toBeInTheDocument();
    expect(screen.getByText('File')).toBeInTheDocument();
    // Wiki gets Replace; file has no replace control (no such endpoint).
    const travelRow = screen.getByText('Travel info').closest('li')!;
    expect(within(travelRow).getByRole('button', { name: 'Replace' })).toBeInTheDocument();
    const slideRow = screen.getByText('Slide template').closest('li')!;
    expect(within(slideRow).queryByRole('button', { name: 'Replace' })).not.toBeInTheDocument();

    expect(screen.getByRole('button', { name: 'Add a resource' })).toBeInTheDocument();
  });

  it('adds a resource and edits a wiki resource inline via Replace, without a separate URL drill', async () => {
    const fetchMock = mockPortal({
      'POST /api/v1/events/evt-portal/resources': {
        status: 201,
        body: { id: 'res3', kind: 'wiki', title: 'New page', content: 'Hello there', fileId: null, position: 2 },
      },
      'PATCH /api/v1/resources/res1': {
        id: 'res1',
        kind: 'wiki',
        title: 'Travel info',
        content: 'Updated content here',
        fileId: null,
        position: 0,
      },
    });
    render(<PortalSettingsPanel />);

    await waitFor(() => {
      expect(screen.getByText('Travel info')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Add a resource' }));
    fireEvent.change(screen.getAllByPlaceholderText('Title')[0]!, { target: { value: 'New page' } });
    fireEvent.change(screen.getByPlaceholderText('Content'), { target: { value: 'Hello there' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add wiki page' }));

    await waitFor(() => {
      const postCalls = fetchMock.mock.calls.filter(
        ([, init]) => (init as RequestInit | undefined)?.method === 'POST',
      );
      expect(postCalls.length).toBe(1);
    });

    const travelRow = screen.getByText('Travel info').closest('li')!;
    fireEvent.click(within(travelRow).getByRole('button', { name: 'Replace' }));
    await waitFor(() => {
      expect(within(travelRow).getByDisplayValue('Travel info')).toBeInTheDocument();
    });
  });
});
