// @vitest-environment jsdom
//
// v12 design pack — the two width:390 PHONE frames in
// docs/design/Chautauqua Comms.dc.html that this wave (v12m-w7-d) claims:
//
//   "Templates · 390"    (line 281) — read, tweak the wording, save
//   "Send history · 390" (line 334) — every send, with its recipients
//
// Both frames draw the shell's own drill-head band (border-bottom hairline,
// `‹ Comms` back link at min-height:44px, an <h1> at 25px/700/-0.04em/1.05,
// a 13px count line) -- the same anatomy app/src/styles.css has declared as
// `.chq-phone-head` / `.chq-phone-head-drill` / `.chq-phone-back` since v12
// mobile wave 1 (2190-2256) with zero renderers before this wave. DEC-576's
// wave-7 amendment requires MOUNTING that vocabulary, never declaring a
// second one -- these tests assert the mount, not a hand-rolled equivalent.
//
// DEC-976: a citation is an assertion, not a comment -- each `it` below
// quotes the frame's own line verbatim and then asserts against it, rather
// than merely mentioning the line number in prose.
//
// This file is plain .ts (not .render.test.tsx or .tsx), matching this
// task's own filename mandate and this branch's file-scope limit (never
// touch anything outside app/src/pages/comms/**, so vitest.config.ts's
// environmentMatchGlobs list -- the campaign's usual way to opt a file into
// jsdom -- is off-limits). React.createElement stands in for JSX so the
// file stays valid plain TypeScript; the `@vitest-environment jsdom` file
// docblock above opts this one file into a real DOM.
import { createElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter } from 'react-router-dom';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { TemplatesTab } from './TemplatesTab';
import { HistoryTab } from './HistoryTab';
import { listEnvelope, mockApi } from '../../test-utils/mockApi';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, '..', '..', '..', '..');
const FRAME = readFileSync(join(REPO_ROOT, 'docs/design/Chautauqua Comms.dc.html'), 'utf-8');
const FRAME_LINES = FRAME.split('\n');

// Frame :281-333 is the "Templates · 390" frame's extent (390 label at 281
// through the line before "Send history · 390" begins at 334).
const TEMPLATES_FRAME_CITED_LINE = 288;
// Frame :334-... is "Send history · 390"'s extent.
const HISTORY_FRAME_CITED_LINE = 337;

const STYLES_CSS = readFileSync(join(HERE, '..', '..', 'styles.css'), 'utf-8');

const EVENT_ID = 'evt-comms-drill-phone';

let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
    throw new Error(`console.error called during render: ${args.map(String).join(' ')}`);
  });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  consoleErrorSpy.mockRestore();
});

describe('the shared drill-head vocabulary resolves the 25px phone token', () => {
  it('.chq-phone-head-drill .chq-page-title sets font-size to --chq-type-page-title-phone-drill (25px)', () => {
    expect(STYLES_CSS).toMatch(/--chq-type-page-title-phone-drill:\s*25px/);
    const rule = /\.chq-phone-head-drill\s+\.chq-page-title\s*\{([^}]*)\}/.exec(STYLES_CSS);
    expect(rule, '.chq-phone-head-drill .chq-page-title rule not found').not.toBeNull();
    expect(rule![1]).toMatch(/font-size:\s*var\(--chq-type-page-title-phone-drill\)/);
  });
});

describe('v12 phone frame "Templates · 390"', () => {
  it(
    `docs/design/Chautauqua Comms.dc.html:${TEMPLATES_FRAME_CITED_LINE} draws ` +
      `'<a href="#" style="font-size:13px; font-weight:700; min-height:44px; display:flex; align-items:center">‹ Comms</a>'`,
    () => {
      const cited = FRAME_LINES[TEMPLATES_FRAME_CITED_LINE - 1] ?? '';
      expect(cited).toContain('‹ Comms</a>');
      expect(cited).toContain('min-height:44px');
    },
  );

  it('TemplatesTab mounts .chq-phone-head-drill around the breadcrumb + one <h1>.chq-page-title', async () => {
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/templates`]: listEnvelope([]),
    });

    render(createElement(MemoryRouter, null, createElement(TemplatesTab, { eventId: EVENT_ID })));

    const back = await screen.findByRole('button', { name: '‹ Comms' });
    expect(back.className).toMatch(/\bchq-phone-back\b/);

    const wrapper = back.closest('.chq-phone-head-drill');
    expect(wrapper, '.chq-phone-head-drill wrapper not found around the breadcrumb').not.toBeNull();
    expect(wrapper!.className).toMatch(/\bchq-phone-head\b/);
    expect(wrapper!.contains(back)).toBe(true);

    const titles = wrapper!.querySelectorAll('.chq-page-title');
    expect(titles.length).toBe(1);
    expect(titles[0]!.tagName).toBe('H1');
    expect(titles[0]!.textContent).toBe('Templates');
  });

  it('the breadcrumb returns to the Comms phone landing via onBack, not only to the Compose tab', async () => {
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/templates`]: listEnvelope([]),
    });
    const onBack = vi.fn();

    render(
      createElement(MemoryRouter, null, createElement(TemplatesTab, { eventId: EVENT_ID, onBack })),
    );

    const back = await screen.findByRole('button', { name: '‹ Comms' });
    back.click();
    expect(onBack).toHaveBeenCalledTimes(1);
  });
});

describe('v12 phone frame "Send history · 390"', () => {
  it(
    `docs/design/Chautauqua Comms.dc.html:${HISTORY_FRAME_CITED_LINE} draws ` +
      `'<a href="#" style="font-size:13px; font-weight:700; min-height:44px; display:flex; align-items:center">‹ Comms</a>'`,
    () => {
      const cited = FRAME_LINES[HISTORY_FRAME_CITED_LINE - 1] ?? '';
      expect(cited).toContain('‹ Comms</a>');
      expect(cited).toContain('min-height:44px');
    },
  );

  it('HistoryTab mounts .chq-phone-head-drill around the breadcrumb + one <h1>.chq-page-title', async () => {
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/email-log`]: listEnvelope([], { total: 0 }),
    });

    render(
      createElement(
        MemoryRouter,
        null,
        createElement(HistoryTab, { eventId: EVENT_ID, templatesById: {}, rhythm: null }),
      ),
    );

    const back = await screen.findByRole('button', { name: '‹ Comms' });
    expect(back.className).toMatch(/\bchq-phone-back\b/);

    const wrapper = back.closest('.chq-phone-head-drill');
    expect(wrapper, '.chq-phone-head-drill wrapper not found around the breadcrumb').not.toBeNull();
    expect(wrapper!.className).toMatch(/\bchq-phone-head\b/);
    expect(wrapper!.contains(back)).toBe(true);

    const titles = wrapper!.querySelectorAll('.chq-page-title');
    expect(titles.length).toBe(1);
    expect(titles[0]!.tagName).toBe('H1');
    expect(titles[0]!.textContent).toBe('History');
  });

  it('the breadcrumb returns to the Comms phone landing via onBack, not only to the Compose tab', async () => {
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/email-log`]: listEnvelope([], { total: 0 }),
    });
    const onBack = vi.fn();

    render(
      createElement(
        MemoryRouter,
        null,
        createElement(HistoryTab, { eventId: EVENT_ID, templatesById: {}, rhythm: null, onBack }),
      ),
    );

    const back = await screen.findByRole('button', { name: '‹ Comms' });
    back.click();
    expect(onBack).toHaveBeenCalledTimes(1);
  });
});
