// DEC-731 (eval-findings 70c): the builder states the call's LIVE state,
// derived from open_date/close_date via the same pure formWindowState the
// public submit route gates on -- never a separate published flag. Covers
// the three window states this panel renders.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { FormSettings } from './FormSettings';
import type { CfpForm } from './types';

const BASE_FORM: CfpForm = {
  id: 'form-1',
  eventId: 'event-1',
  title: 'Speak at Test Conf',
  intro: '',
  isDefault: true,
  openDate: null,
  closeDate: null,
  tracks: [],
  fields: [],
};

// Fixed "now": 2026-06-15T12:00:00Z.
const NOW = Date.UTC(2026, 5, 15, 12, 0, 0);

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

function renderPanel(form: CfpForm) {
  return render(
    <FormSettings
      form={form}
      tracks={[]}
      eventSlug="test-conf"
      timezone="UTC"
      onSave={async () => {}}
    />,
  );
}

describe('FormSettings call-window state (DEC-731)', () => {
  it('renders "Not yet open" before the open date', () => {
    renderPanel({ ...BASE_FORM, openDate: Date.UTC(2026, 6, 1), closeDate: null });
    expect(screen.getByText('Not yet open')).toBeInTheDocument();
  });

  it('renders "Open · closes 16 Aug" while inside the window', () => {
    renderPanel({ ...BASE_FORM, openDate: Date.UTC(2026, 0, 1), closeDate: Date.UTC(2026, 7, 16) });
    expect(screen.getByText('Open · closes 16 Aug')).toBeInTheDocument();
  });

  it('renders "Closed" after the close date', () => {
    renderPanel({ ...BASE_FORM, openDate: Date.UTC(2026, 0, 1), closeDate: Date.UTC(2026, 0, 31) });
    expect(screen.getByText('Closed')).toBeInTheDocument();
  });
});
