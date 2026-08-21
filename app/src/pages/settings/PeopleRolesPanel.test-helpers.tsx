// Shared fixtures/harness for the PeopleRolesPanel render-test suite, split
// wave 12: this file was previously a single 855-line
// PeopleRolesPanel.render.test.tsx that had become a merge-conflict
// hotspot. It is decomposed into cohesive per-feature test files that all
// import this shared setup -- no behavior change, same assertions, same
// mocked wire shapes.
import { afterEach, beforeEach, expect, vi } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { PeopleRolesPanel } from './PeopleRolesPanel';
import { listEnvelope, mockApi } from '../../test-utils/mockApi';

export const SELF = { id: 'u-self', email: 'self@example.com', role: 'organizer', name: 'Selma Fields' };
// OTHER deliberately carries no `name` -- a pre-w35-c legacy row -- so tests
// can assert the email fallback still reads correctly.
export const OTHER = { id: 'u-other', email: 'other@example.com', role: 'reviewer' };

export function mockPeople(extra: Record<string, unknown> = {}) {
  return mockApi({
    'GET /api/v1/me': { userId: SELF.id, email: SELF.email, name: null, role: 'organizer', orgId: 'org1' },
    'GET /api/v1/users': listEnvelope([SELF, OTHER]),
    ...extra,
  });
}

export function renderPanel(initialEntries?: string[]) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <PeopleRolesPanel />
    </MemoryRouter>,
  );
}

function LocationSearchProbe() {
  return <div data-testid="location-search">{useLocation().search}</div>;
}

// DEC-919 wave-156: exposes the resulting `location.search` without reaching
// into MemoryRouter internals. Used to assert that the read drill's "Invite
// someone" footer primary opens the dialog IN PLACE -- it navigates nowhere,
// superseding wave-155's `?edit=1&intent=invite` round trip.
export function renderPanelWithLocation(initialEntries?: string[]) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <PeopleRolesPanel />
      <LocationSearchProbe />
    </MemoryRouter>,
  );
}

/** Installs the console.error-must-not-fire + cleanup hooks shared by every
 * spec file in this suite. Call once at module scope in each spec file:
 * `installConsoleErrorGuard()`. */
export function installConsoleErrorGuard() {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    expect(consoleErrorSpy).not.toHaveBeenCalled();
    consoleErrorSpy.mockRestore();
    vi.unstubAllGlobals();
    cleanup();
  });
}
