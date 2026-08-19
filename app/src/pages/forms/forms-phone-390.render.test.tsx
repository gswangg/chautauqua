// v12 mobile campaign, task w2-h: CFP form builder at 390 (Tier 1, SPA).
// Frame 03--06 "CFP form · 390" (citation lands on the first `it` below,
// beside its own assertion): head "‹ Submissions" + "CFP form" + "Closes …
// · N received", body one row per question with a ⋮⋮ drag handle and a
// right-flushed Edit, dock filled "Save the form" over bordered "Preview".
//
// jsdom applies no @media rule, so this asserts the phone-only markup is
// PRESENT (real content, real data), not that it is visually shown --
// forms.css's own @media(max-width:700px) block (a source-scanned CSS
// contract, not exercised here) owns the display toggle. Mirrors the
// existing FormsPage.render.test.tsx harness (real GET .../forms envelope).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import '@testing-library/jest-dom/vitest';
import { FormsPage } from './FormsPage';
import { listEnvelope, mockApi } from '../../test-utils/mockApi';
import type { CfpForm } from './types';

const EVENT_ID = 'evt-forms-phone-390';

const FORM: CfpForm = {
  id: 'form-390',
  eventId: EVENT_ID,
  title: 'DevCon 2026 CFP',
  intro: 'Submit your talk!',
  isDefault: true,
  openDate: Date.UTC(2026, 0, 1),
  closeDate: Date.UTC(2026, 7, 16),
  tracks: [],
  fields: [
    { id: 'f1', section: 'session', kind: 'text', label: 'Title', required: true, position: 0, locked: true },
    {
      id: 'form-390:description',
      section: 'session',
      kind: 'long_text',
      label: 'Abstract',
      required: true,
      position: 1,
      locked: true,
    },
  ],
};

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
});

describe('FormsPage phone drill head + dock (frame 03--06, task w2-h)', () => {
  it('renders the back link, drill h1, "Closes … · N received" meta, and a filled Save the form / bordered Preview dock', async () => {
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}`]: { id: EVENT_ID, slug: 'devcon-2026', timezone: 'UTC' },
      [`GET /api/v1/events/${EVENT_ID}/forms`]: FORM,
      [`GET /api/v1/events/${EVENT_ID}/tracks`]: listEnvelope([]),
      [`GET /api/v1/events/${EVENT_ID}/submissions`]: listEnvelope([], { total: 47 }),
    });

    render(
      <MemoryRouter>
        <FormsPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText('Closes 16 Aug 2026 · 47 received')).toBeInTheDocument();
    });

    // Head: back link + drill H1 + the real closes-date/received meta line,
    // carried by the SAME markup as the desktop header (no duplicate
    // heading), tagged with the landed v12 scaffold classes.
    // docs/design/Chautauqua Submissions.dc.html:468 `width:390px; height:844px; background:#F4F1E8` -- frame 03--06 "CFP form · 390".
    const header = document.querySelector('.chq-forms-header') as HTMLElement;
    expect(header).toHaveClass('chq-phone-head', 'chq-phone-head-drill');
    const backLink = within(header).getByRole('link', { name: /Submissions/ });
    expect(backLink).toHaveClass('chq-phone-back');
    const heading = within(header).getByRole('heading', { name: 'CFP form' });
    expect(heading).toHaveClass('chq-page-title');
    expect(within(header).getByText('Closes 16 Aug 2026 · 47 received')).toBeInTheDocument();

    // Dock: "Save the form" (filled/primary, dirty-gated like the desktop
    // header's Save) over a bordered (secondary) "Preview" -- second
    // markup, not a text swap over the desktop header actions.
    const dock = document.querySelector('.chq-forms-phone-footer') as HTMLElement;
    expect(dock).toHaveClass('chq-phone-dock');
    const dockSave = within(dock).getByRole('button', { name: 'Save the form' });
    expect(dockSave).toHaveClass('chq-btn', 'chq-btn-primary');
    expect(dockSave).toBeDisabled();
    const dockPreview = within(dock).getByRole('link', { name: 'Preview' });
    expect(dockPreview).toHaveClass('chq-btn', 'chq-btn-secondary');

    // Reorder handle: the ONE reorder affordance stays a real button (DEC-715).
    expect(screen.getByRole('button', { name: 'Reorder Title (position 1 of 2)' })).toBeInTheDocument();
  });

  it('shows a "no date set" fallback and "—" received count while the submissions total has not loaded, never a fabricated number', async () => {
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}`]: { id: EVENT_ID, slug: 'devcon-2026', timezone: 'UTC' },
      [`GET /api/v1/events/${EVENT_ID}/forms`]: { ...FORM, closeDate: null },
      [`GET /api/v1/events/${EVENT_ID}/tracks`]: listEnvelope([]),
      [`GET /api/v1/events/${EVENT_ID}/submissions`]: { status: 500, body: { error: { code: 'server_error', message: 'boom' } } },
    });

    render(
      <MemoryRouter>
        <FormsPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText('Closes No close date set · — received')).toBeInTheDocument();
    });
  });
});
