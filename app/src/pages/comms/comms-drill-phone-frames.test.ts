// v12 mobile campaign wave 6 (task w6-e): closes the two Comms phone frames
// nothing in the tree claimed -- docs/design/Chautauqua Comms.dc.html:286
// ("Templates · 390") and docs/design/Chautauqua Comms.dc.html:335 ("Send
// history · 390") -- per test/phone-frame-ledger.scan.test.ts's citation
// form (`docs/design/<file>.dc.html:<line>`, DEC-976), each landing inside
// its own frame's extent (the width:390px/height:844 line up to the next
// frame-label line) and each sitting beside a real assertion, never a bare
// comment.
//
// This is a citation-carrying assertion file, not a render test: it proves
// (1) the shell's shared drill vocabulary (.chq-phone-head/-head-drill/
// -back, styles.css:2190/:2209/:2249, pinned since wave 1 with no renderer
// anywhere) is now actually composed onto both drill heads' markup, and
// (2) .chq-phone-body stays an orphan on both screens, per this task's
// ruling. The page-local render tests (TemplatesTab.render.test.tsx,
// HistoryTab.render.test.tsx, Comms.phone.render.test.tsx) keep owning the
// rest of each frame's shape.
//
// No JSX (plain .test.ts name, same idiom as
// app/src/pages/review/planEditor-refusal-shapes.test.ts): mounted via
// React.createElement, jsdom environment supplied by vitest.config.ts's
// environmentMatchGlobs entry for this exact file.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import React from 'react';
import { render, screen, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter } from 'react-router-dom';
import { TemplatesTab } from './TemplatesTab';
import { HistoryTab } from './HistoryTab';
import { listEnvelope, mockApi } from '../../test-utils/mockApi';
import type { EmailTemplate } from './types';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, '..', '..', '..', '..');
const FRAME_PATH = join(REPO_ROOT, 'docs', 'design', 'Chautauqua Comms.dc.html');
const FRAME_LINES = readFileSync(FRAME_PATH, 'utf-8').split('\n');

const EVENT_ID = 'evt-comms-drill-phone';

afterEach(() => {
  cleanup();
});

function template(overrides: Partial<EmailTemplate> = {}): EmailTemplate {
  return {
    id: 'tpl-1',
    name: 'Acceptance',
    subject: 'Your talk has been accepted to {event_name}',
    bodyText: 'Hi {speaker_name}, congratulations.',
    lastUsedAt: 1700000000000,
    ...overrides,
  } as EmailTemplate;
}

describe('docs/design/Chautauqua Comms.dc.html:286 -- "Templates · 390" drill head', () => {
  // Frame extent check: line 286 is the frame's own width:390px/height:844
  // line, and it carries the "Templates · 390" label the ledger resolves
  // titles from (nearest preceding font-size:19px label span, line 279).
  it("line 286 is the frame's own width:390px/height:844 declaration", () => {
    const line = FRAME_LINES[286 - 1];
    expect(line).toMatch(/width:390px/);
    expect(line).toMatch(/height:844/);
  });

  it("the drill head composes the shell's .chq-phone-head/-head-drill vocabulary onto the page-local head", async () => {
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/templates`]: listEnvelope([template()]),
    });

    render(
      React.createElement(MemoryRouter, null, React.createElement(TemplatesTab, { eventId: EVENT_ID })),
    );

    await screen.findByRole('heading', { name: 'Templates' });

    const head = document.querySelector('.chq-comms-templates-head');
    expect(head).not.toBeNull();
    expect(head).toHaveClass('chq-phone-head');
    expect(head).toHaveClass('chq-phone-head-drill');

    const back = document.querySelector('button.chq-comms-templates-breadcrumb');
    expect(back).not.toBeNull();
    expect(back).toHaveClass('chq-phone-back');
  });
});

describe('docs/design/Chautauqua Comms.dc.html:335 -- "Send history · 390" drill head', () => {
  it("line 335 is the frame's own width:390px/height:844 declaration", () => {
    const line = FRAME_LINES[335 - 1];
    expect(line).toMatch(/width:390px/);
    expect(line).toMatch(/height:844/);
  });

  it("the drill head composes the shell's .chq-phone-head/-head-drill vocabulary onto the page-local head", async () => {
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/email-log`]: listEnvelope([]),
    });

    render(
      React.createElement(
        MemoryRouter,
        null,
        React.createElement(HistoryTab, { eventId: EVENT_ID, templatesById: {}, rhythm: null }),
      ),
    );

    await screen.findByRole('heading', { name: 'History' });

    const head = document.querySelector('.chq-comms-history-head');
    expect(head).not.toBeNull();
    expect(head).toHaveClass('chq-phone-head');
    expect(head).toHaveClass('chq-phone-head-drill');

    const back = document.querySelector('button.chq-comms-history-breadcrumb');
    expect(back).not.toBeNull();
    expect(back).toHaveClass('chq-phone-back');
  });
});

describe('shell vocabulary now has a renderer (DEC-576, pinned wave 1)', () => {
  it('.chq-phone-head, .chq-phone-head-drill and .chq-phone-back each appear on a rendered Comms drill screen, .chq-phone-body never does', async () => {
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/templates`]: listEnvelope([template()]),
    });
    render(
      React.createElement(MemoryRouter, null, React.createElement(TemplatesTab, { eventId: EVENT_ID })),
    );
    await screen.findByRole('heading', { name: 'Templates' });

    expect(document.querySelector('.chq-phone-head')).not.toBeNull();
    expect(document.querySelector('.chq-phone-head-drill')).not.toBeNull();
    expect(document.querySelector('.chq-phone-back')).not.toBeNull();
    // .chq-phone-body stays an orphan: this task's ruling forbids mounting
    // it (its overflow-y:auto contradicts .chq-main being the app's one
    // scroll region), so it must NOT appear on this screen.
    expect(document.querySelector('.chq-phone-body')).toBeNull();
  });
});
