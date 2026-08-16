// DEC-422 (wave-67 amendment): MAX_BREAKS_PER_EVENT is a pure-core product
// cap (src/domain/schedule.ts) that the add-break control must disclose,
// imported through app/src/lib/batch-caps.ts (never a raw
// ../../../src/domain path -- same crossing-module discipline as
// merge-fields.ts/file-caps.ts). Separate file from BreaksPanel.render.test
// to avoid colliding with sibling wave-67 tasks touching that file.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { BreaksPanel } from './BreaksPanel';
import { MAX_BREAKS_PER_EVENT } from '../../lib/batch-caps';

const EVENT_ID = 'evt-breaks-cap-render';
const DAY = '2026-03-02';

const apiGetMock = vi.fn();
const apiPostMock = vi.fn();
const apiPatchMock = vi.fn();
const apiDeleteMock = vi.fn();

vi.mock('../../lib/api', async () => {
  const actual = await vi.importActual<typeof import('../../lib/api')>('../../lib/api');
  return {
    ...actual,
    apiGet: (...args: unknown[]) => apiGetMock(...args),
    apiPost: (...args: unknown[]) => apiPostMock(...args),
    apiPatch: (...args: unknown[]) => apiPatchMock(...args),
    apiDelete: (...args: unknown[]) => apiDeleteMock(...args),
  };
});

beforeEach(() => {
  apiGetMock.mockReset();
  apiPostMock.mockReset();
  apiPatchMock.mockReset();
  apiDeleteMock.mockReset();
});

afterEach(() => cleanup());

describe('BreaksPanel discloses the real MAX_BREAKS_PER_EVENT ceiling at its add form', () => {
  it('prints the imported cap constant, not a hand-typed number', () => {
    render(<BreaksPanel eventId={EVENT_ID} day={DAY} breaks={[]} outsideWindow={[]} onChanged={() => {}} onDone={() => {}} />);

    expect(screen.getByText(`Up to ${MAX_BREAKS_PER_EVENT} breaks per event`)).toBeInTheDocument();
    expect(MAX_BREAKS_PER_EVENT).toBe(200);
  });
});
