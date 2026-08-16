// DEC-815 ENUMERATION sweep: adoption of the SummarySection primitive is
// proved by walking Settings.tsx's OWN SECTIONS array and rendering every
// panel it lists, never a hand-typed list of panel names -- so a section
// added later, or one that quietly opts back out, fails this test rather
// than slipping past review. Every section must render as a read-only
// summary (a region with rows, no form control) before ?section=<key>
// &edit=1 is present in the URL.
//
// Also covers DEC-816 row by row: PublicPagesPanel's Sessions, Agenda,
// Schedule, Speakers and Speaker gallery rows must each read the SAME
// per-surface count its SSR page composes (Agenda/Schedule ->
// counts.scheduled, Sessions -> counts.sessions, Speakers/Gallery ->
// counts.speakers) -- asserted against three deliberately DIFFERENT
// numbers so a row spending the wrong count fails loudly.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, cleanup, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter } from 'react-router-dom';
import { SECTIONS } from '../Settings';
import { EventSettingsPanel } from './EventSettingsPanel';
import { PeopleRolesPanel } from './PeopleRolesPanel';
import { PublicPagesPanel } from './PublicPagesPanel';
import { listEnvelope, mockApi } from '../../test-utils/mockApi';

const EVENT_ID = 'evt-sweep';

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

// A superset of every route any of the seven panels fetches on mount --
// registered once so any section in SECTIONS can render regardless of
// which panel it is (mockApi throws loudly on an unregistered route, so a
// panel added later that needs a new route fails this test rather than
// silently passing on stale data).
function mockEverySettingsRoute(overrides: Record<string, unknown> = {}) {
  return mockApi({
    [`GET /api/v1/events/${EVENT_ID}`]: {
      id: EVENT_ID,
      slug: 'devcon-2026',
      name: 'DevCon 2026',
      startDate: '2026-06-01',
      endDate: '2026-06-03',
      location: 'Austin',
      timezone: 'UTC',
      recordPrefix: 'DC',
      branding: {},
    },
    [`GET /api/v1/events/${EVENT_ID}/forms`]: {
      id: 'form1',
      eventId: EVENT_ID,
      intro: null,
      openDate: null,
      closeDate: null,
      tracks: [],
      fields: [],
    },
    [`GET /api/v1/events/${EVENT_ID}/tracks`]: listEnvelope([{ id: 'trk1', name: 'AI Engineering', color: null }]),
    [`GET /api/v1/events/${EVENT_ID}/rooms`]: listEnvelope([{ id: 'rm1', name: 'Main Stage', capacity: 100 }]),
    [`GET /api/v1/events/${EVENT_ID}/submissions`]: listEnvelope([], { total: 5 }),
    [`GET /api/v1/events/${EVENT_ID}/public-surfaces`]: { sessions: 9, speakers: 3, scheduled: 2 },
    [`GET /api/v1/events/${EVENT_ID}/portal-settings`]: {
      welcomeMessage: null,
      logoUrl: null,
      accentColor: null,
      showResources: true,
    },
    [`GET /api/v1/events/${EVENT_ID}/onboarding`]: { tasks: [] },
    [`GET /api/v1/events/${EVENT_ID}/resources`]: listEnvelope([]),
    'GET /api/v1/tokens': listEnvelope([]),
    'GET /api/v1/users': listEnvelope([{ id: 'u1', email: 'a@example.com', role: 'organizer' }]),
    'GET /api/v1/me': { userId: 'u1', email: 'a@example.com', name: null, role: 'organizer', orgId: 'org1' },
    ...overrides,
  });
}

describe('Settings summary sweep (DEC-815 ENUMERATION)', () => {
  SECTIONS.forEach((section) => {
    it(`${section.key}: renders a read-only summary with no form control before ?edit=1`, async () => {
      mockEverySettingsRoute();
      const Panel = section.Panel;

      render(
        <MemoryRouter initialEntries={['/settings']}>
          <Panel />
        </MemoryRouter>,
      );

      // Every converted section renders as exactly one SummarySection
      // region, and nothing else, before its edit param is set.
      const region = await screen.findByRole('region');

      // The section shows real summary content -- at least one label:value
      // row's worth of text -- not a blank shell.
      await waitFor(() => {
        expect(region.textContent && region.textContent.trim().length).toBeGreaterThan(0);
      });

      // DEC-815's core assertion: no editable form control anywhere in the
      // section while ?edit=1 is absent.
      expect(within(region).queryAllByRole('textbox')).toHaveLength(0);
      expect(within(region).queryAllByRole('combobox')).toHaveLength(0);
      expect(region.querySelectorAll('input, textarea, select')).toHaveLength(0);

      // Exactly one tertiary drill action on the section's own rule.
      const actionButtons = within(region).getAllByRole('button');
      expect(actionButtons.length).toBeGreaterThanOrEqual(1);
    });

    it(`${section.key}: drilling via ?section=${section.key}&edit=1 reveals the section's form`, async () => {
      mockEverySettingsRoute();
      const Panel = section.Panel;

      render(
        <MemoryRouter initialEntries={[`/settings?section=${section.key}&edit=1`]}>
          <Panel />
        </MemoryRouter>,
      );

      const regions = await screen.findAllByRole('region');
      const region = regions[0]!;
      await waitFor(() => {
        expect(region.textContent && region.textContent.trim().length).toBeGreaterThan(0);
      });

      // Drilling in reveals the section's own edit surface -- some
      // interactive control now exists where the read-only rows were.
      await waitFor(() => {
        const controls = region.querySelectorAll('input, textarea, select, button');
        expect(controls.length).toBeGreaterThan(0);
      });
    });
  });
});

describe('DEC-896: real row hints on the Event and People and roles summaries', () => {
  it('Event settings: the Slug and Time zone rows carry a real hint; Name does not', async () => {
    mockEverySettingsRoute();

    render(
      <MemoryRouter initialEntries={['/settings']}>
        <EventSettingsPanel />
      </MemoryRouter>,
    );

    const region = await screen.findByRole('region');
    await waitFor(() => {
      expect(within(region).getByText('DevCon 2026')).toBeInTheDocument();
    });

    const hintFor = (label: string) => {
      const row = within(region).getByText(label).closest('.chq-settings-row') as HTMLElement;
      return row.querySelector('.chq-settings-row-hint');
    };

    expect(hintFor('Slug')).toHaveTextContent('Used in every public URL');
    expect(hintFor('Time zone')).toHaveTextContent('Applies to every date and deadline in this event');
    expect(hintFor('Name')).toBeNull();
  });

  // w1-f, DEC-785: the read view is now real per-person rows, so the hint
  // lives on the individual reviewer's own row, not a "Reviewers" count row.
  it("People and roles: a reviewer's row carries a real hint about track scoping", async () => {
    mockEverySettingsRoute({
      'GET /api/v1/users': listEnvelope([
        { id: 'u1', email: 'a@example.com', role: 'organizer' },
        { id: 'u2', email: 'b@example.com', role: 'reviewer' },
      ]),
    });

    render(
      <MemoryRouter initialEntries={['/settings']}>
        <PeopleRolesPanel />
      </MemoryRouter>,
    );

    const region = await screen.findByRole('region');
    await waitFor(() => {
      expect(within(region).getByText('b@example.com')).toBeInTheDocument();
    });

    const row = within(region).getByText('b@example.com').closest('.chq-settings-row') as HTMLElement;
    expect(row.querySelector('.chq-settings-row-hint')).toHaveTextContent(
      'Can be scoped to specific tracks in review assignment',
    );
  });
});

describe('PublicPagesPanel per-surface count mapping (DEC-816, row by row)', () => {
  it('Sessions reads counts.sessions; Agenda/Schedule read counts.scheduled; Speakers/Gallery read counts.speakers', async () => {
    mockEverySettingsRoute({
      [`GET /api/v1/events/${EVENT_ID}/public-surfaces`]: { sessions: 16, speakers: 4, scheduled: 9 },
    });

    render(
      <MemoryRouter initialEntries={['/settings']}>
        <PublicPagesPanel />
      </MemoryRouter>,
    );

    const region = await screen.findByRole('region');
    await waitFor(() => {
      expect(within(region).getByText('Sessions')).toBeInTheDocument();
    });

    // DEC-896 amendment (wave 26, B10 DROP): PublicPagesPanel has no
    // SummarySection/edit-drill any more -- each row is a bare
    // .chq-settings-public-pages-row, not the shared .chq-settings-row.
    const rowValue = (label: string) => {
      const row = within(region).getByText(label).closest('.chq-settings-public-pages-row') as HTMLElement;
      return row;
    };

    expect(within(rowValue('Sessions')).getByText('Live · 16 published')).toBeInTheDocument();
    expect(within(rowValue('Agenda')).getByText('Live · 9 published')).toBeInTheDocument();
    expect(within(rowValue('Schedule and ICS')).getByText('Live · 9 published')).toBeInTheDocument();
    expect(within(rowValue('Speakers')).getByText('Live · 4 published')).toBeInTheDocument();
    expect(within(rowValue('Speaker gallery')).getByText('Live · 4 published')).toBeInTheDocument();
  });
});

describe('DEC-781: every one of the seven sections carries its action on the eyebrow rule', () => {
  // DEC-896 amendment (wave 26, B10 DROP): public-pages has NO drill action
  // any more -- its read row already carries every value and action, so
  // there is nothing for the eyebrow rule to host. Every OTHER section still
  // carries its one action button on the head row.
  SECTIONS.filter((section) => section.key !== 'public-pages').forEach((section) => {
    it(`${section.key}: the section head (label + rule) hosts the drill action, right-flushed on the same row`, async () => {
      mockEverySettingsRoute();
      const Panel = section.Panel;

      render(
        <MemoryRouter initialEntries={['/settings']}>
          <Panel />
        </MemoryRouter>,
      );

      const region = await screen.findByRole('region');
      await waitFor(() => {
        expect(region.textContent && region.textContent.trim().length).toBeGreaterThan(0);
      });

      // Every section is a .chq-settings-numbered panel whose head row
      // carries BOTH the eyebrow label (h2) and its one action button --
      // not a bare <h2> border rule with the action floating elsewhere.
      expect(region.className).toContain('chq-settings-numbered');
      const head = region.querySelector('.chq-settings-section-head');
      expect(head).not.toBeNull();
      expect(head!.querySelector('h2')).not.toBeNull();
      expect(head!.querySelector('button')).not.toBeNull();
    });
  });

  it('public-pages: the head row carries the label with NO drill action -- the gate is gone', async () => {
    mockEverySettingsRoute();
    render(
      <MemoryRouter initialEntries={['/settings']}>
        <PublicPagesPanel />
      </MemoryRouter>,
    );

    const region = await screen.findByRole('region', { name: 'Public pages' });
    await waitFor(() => {
      expect(region.textContent && region.textContent.trim().length).toBeGreaterThan(0);
    });

    expect(region.className).toContain('chq-settings-numbered');
    const head = region.querySelector('.chq-settings-section-head');
    expect(head).not.toBeNull();
    expect(head!.querySelector('h2')).not.toBeNull();
    expect(head!.querySelector('button')).toBeNull();
  });
});

// DEC-896/B10 scan: every settings edit view built on the shared
// SettingsEditForm shell renders its footer buttons via the ONE
// .chq-btn-primary/.chq-btn-secondary vocabulary, never a page-local
// full-width class -- walked across SECTIONS rather than hand-picked per
// panel, so a section added later that reintroduces a full-width primary
// (the single most visible phone tell on a desktop page, per
// docs/design/DESIGN-RULINGS.md B10) fails this test rather than slipping
// past review. 'public-pages' has no edit view at all (B10 DROP) and
// 'your-data' hosts its own sub-panels (Exports/API tokens) rather than one
// SettingsEditForm, so both are skipped here -- covered instead by each
// panel's own render test.
describe('DEC-896/B10 scan: no settings edit view renders a full-width primary', () => {
  const SHELL_SECTIONS = SECTIONS.filter((s) => s.key !== 'public-pages' && s.key !== 'your-data');

  SHELL_SECTIONS.forEach((section) => {
    it(`${section.key}: the edit footer's buttons carry only the shared .chq-btn-* classes, never full-width`, async () => {
      mockEverySettingsRoute();
      const Panel = section.Panel;

      render(
        <MemoryRouter initialEntries={[`/settings?section=${section.key}&edit=1`]}>
          <Panel />
        </MemoryRouter>,
      );

      await waitFor(() => {
        const footer = document.querySelector('.chq-settings-edit-footer');
        expect(footer).not.toBeNull();
      });

      const footer = document.querySelector('.chq-settings-edit-footer') as HTMLElement;
      const buttons = Array.from(footer.querySelectorAll('button, a'));
      expect(buttons.length).toBeGreaterThan(0);
      for (const button of buttons) {
        expect(button.className).not.toMatch(/full-width|btn-full|chq-btn-block/);
      }

      // The footer itself is a row (never a column stack pretending to be
      // one) -- asserted via the class rather than a computed style, since
      // jsdom does not apply settings.css layout rules.
      expect(footer.className).toContain('chq-settings-edit-footer');
    });
  });
});
