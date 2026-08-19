// Shared fixtures/helpers for the TracksRoomsPanel.render.test.tsx family
// (custodian decomposition, contention hotspot). Kept as a plain .ts module
// (not matching the *.test.ts / *.render.test.tsx include globs in
// vitest.config.ts) so it is never itself picked up as a test suite --
// import it from the split test files instead of duplicating fixtures.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect } from 'vitest';
import { screen, waitFor, fireEvent, within } from '@testing-library/react';
import { listEnvelope, mockApi } from '../../test-utils/mockApi';

const HERE = dirname(fileURLToPath(import.meta.url));
export const SETTINGS_CSS = readFileSync(join(HERE, 'settings.css'), 'utf-8');

/** Extracts a top-level (not inside an @media block) rule's declaration
 * body by selector -- same helper as FilterRulesPanel.render.test.tsx. */
export function topLevelRuleBody(css: string, selector: string): string {
  const withoutMedia = css.replace(/@media[^{]*\{(?=((?:[^{}]*\{[^{}]*\}[^{}]*)*))\1\}/g, '');
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = withoutMedia.match(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`));
  const body = match?.[1];
  if (body === undefined) throw new Error(`no top-level rule found for ${selector}`);
  return body;
}

export const EVENT_ID = 'evt-tracks-rooms';

export function mockTracksRooms(overrides: Record<string, unknown> = {}) {
  return mockApi({
    [`GET /api/v1/events/${EVENT_ID}/tracks`]: listEnvelope([
      { id: 'trk1', name: 'AI Engineering', color: '#4f46e5', submissionCount: 18 },
      { id: 'trk2', name: 'Platform', color: null, submissionCount: 18 },
    ]),
    [`GET /api/v1/events/${EVENT_ID}/rooms`]: listEnvelope([
      { id: 'rm1', name: 'Main Stage', capacity: 900, sessionCount: 0 },
      { id: 'rm2', name: 'Workshop Lab', capacity: null, sessionCount: 0 },
    ]),
    ...overrides,
  });
}

export async function openEdit() {
  const section = await screen.findByRole('region', { name: 'Tracks and rooms' });
  fireEvent.click(within(section).getByRole('button', { name: 'Add' }));
  await waitFor(() => {
    expect(within(section).getByDisplayValue('AI Engineering')).toBeInTheDocument();
  });
  return section;
}
