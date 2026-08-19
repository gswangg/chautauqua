// DEC-621: (1) phone landing screen -- at phone width Comms opens on a
// choice of the three things it does (Compose/Templates/History) instead
// of dropping into compose step 1. jsdom does not evaluate @media rules,
// so — mirroring app/src/shell-geometry.test.ts and
// ContactsApp.newContact.render.test.tsx — the CSS half of this is a
// source-scan of comms.css's own text rather than computed style, and the
// JS half asserts the landing markup exists and names all three
// destinations, with a conformance guard proving it can't render twice
// (no desktop display:none).
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter } from 'react-router-dom';
import { CommsPage } from '../Comms';
import { HistoryTab } from './HistoryTab';
import { TemplatesTab } from './TemplatesTab';
import { listEnvelope, mockApi } from '../../test-utils/mockApi';
import type { EmailBatchRow, EmailTemplate } from './types';

const EVENT_ID = 'evt-comms-phone';
const HERE = dirname(fileURLToPath(import.meta.url));
const CSS = readFileSync(join(HERE, 'comms.css'), 'utf-8');
const TEMPLATES_CSS = readFileSync(join(HERE, 'templates.css'), 'utf-8');

/** Extracts a top-level (not inside an @media block) rule's declaration
 * body by selector — same helper as shell-geometry.test.ts. */
function topLevelRuleBody(css: string, selector: string): string {
  const withoutMedia = css.replace(/@media[^{]*\{(?:[^{}]*\{[^{}]*\}[^{}]*)*\}/g, '');
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = withoutMedia.match(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`));
  const body = match?.[1];
  if (body === undefined) throw new Error(`no top-level rule found for ${selector}`);
  return body;
}

/** The concatenated bodies of EVERY `@media (max-width: <=700px)` block in
 * `css`, brace-matched so a nested rule can't truncate one. comms.css now
 * carries TWO such blocks: the original, and a trailing one for the classes
 * whose desktop base rules are declared BELOW the first query (a phone rule
 * for those written in the earlier block loses the cascade at equal
 * specificity and is silently dead -- measured at 390, it right-flushed the
 * History back link). Mirrors phone-tap-target.scan.test.ts's helper. */
function phoneBlocks(css: string): string {
  const stripped = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const out: string[] = [];
  const mediaRe = /@media[^{]*max-width:\s*(\d+)px[^{]*\{/g;
  let mm: RegExpExecArray | null;
  while ((mm = mediaRe.exec(stripped)) !== null) {
    const width = Number(mm[1]);
    const bodyStart = mm.index + mm[0].length;
    let depth = 1;
    let i = bodyStart;
    for (; i < stripped.length && depth > 0; i++) {
      if (stripped[i] === '{') depth++;
      else if (stripped[i] === '}') depth--;
    }
    if (width > 700) continue;
    out.push(stripped.slice(bodyStart, i - 1));
  }
  return out.join('\n');
}

/** A single rule's declaration body inside the phone blocks, by exact
 * selector text. */
function phoneRuleBody(css: string, selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = phoneBlocks(css).match(new RegExp(`(?:^|[},])\\s*${escaped}\\s*\\{([^}]*)\\}`, 'm'));
  const body = match?.[1];
  if (body === undefined) throw new Error(`no <=700px rule found for ${selector}`);
  return body;
}

function batchRow(overrides: Partial<EmailBatchRow> = {}): EmailBatchRow {
  return {
    batchKey: 'batch-1',
    subject: 'Your talk has been accepted to DevFlow Conf 2027',
    sentAt: 1700000000000,
    statusCounts: { sent: 21, skipped: 2 },
    templateId: null,
    ...overrides,
  };
}

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

beforeEach(() => {
  window.localStorage.setItem('chq.currentEventId', EVENT_ID);
});

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

describe('comms.css: phone landing hidden at desktop width', () => {
  it('.chq-comms-phone-landing is display:none outside the 700px media query', () => {
    const body = topLevelRuleBody(CSS, '.chq-comms-phone-landing');
    expect(body).toMatch(/display:\s*none/);
  });

  it('.chq-comms-editor input.chq-input is width:100%/min-width:0 (no clip inside the flex editor)', () => {
    const body = topLevelRuleBody(CSS, '.chq-comms-editor input.chq-input');
    expect(body).toMatch(/width:\s*100%/);
    expect(body).toMatch(/min-width:\s*0/);
  });
});

describe('CommsPage: phone landing (DEC-621)', () => {
  it('renders a landing block naming all three destinations, hidden by default (JS-state class, not width check)', async () => {
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/submissions`]: listEnvelope([]),
      [`GET /api/v1/events/${EVENT_ID}/templates`]: listEnvelope([]),
    });

    render(
      <MemoryRouter>
        <CommsPage />
      </MemoryRouter>,
    );

    await screen.findByRole('heading', { name: 'Comms' });

    const landing = document.querySelector('.chq-comms-phone-landing');
    expect(landing).not.toBeNull();
    expect(landing).toHaveClass('chq-comms-phone-landing-show');

    const choices = landing!.querySelectorAll('.chq-comms-phone-landing-choice');
    const labels = Array.from(choices).map((el) => el.textContent);
    expect(labels).toEqual(['Compose', 'Templates', 'History']);

    // Regular head+tab content is present too (always rendered; CSS -- not
    // JS -- decides which one is visible at a given width).
    const main = document.querySelector('.chq-comms-main');
    expect(main).not.toBeNull();
    expect(main).toHaveClass('chq-comms-main-landing');
  });

  it('picking a landing destination sets the tab and drops the landing-active modifier classes', async () => {
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/submissions`]: listEnvelope([]),
      [`GET /api/v1/events/${EVENT_ID}/templates`]: listEnvelope([]),
    });

    render(
      <MemoryRouter>
        <CommsPage />
      </MemoryRouter>,
    );
    await screen.findByRole('heading', { name: 'Comms' });

    const landing = document.querySelector('.chq-comms-phone-landing')!;
    const templatesChoice = Array.from(landing.querySelectorAll('.chq-comms-phone-landing-choice')).find(
      (el) => el.textContent === 'Templates',
    ) as HTMLElement;
    fireEvent.click(templatesChoice);

    expect(screen.getByRole('tab', { name: 'Templates', selected: true })).toBeInTheDocument();

    const mainAfter = document.querySelector('.chq-comms-main')!;
    expect(mainAfter).not.toHaveClass('chq-comms-main-landing');
    expect(landing).not.toHaveClass('chq-comms-phone-landing-show');
  });
});

// ---------------------------------------------------------------------------
// v12 design pack, PHONE frames (docs/design/Chautauqua Comms.dc.html):
// "Comms" (390), "Templates · 390" and "Send history · 390". jsdom evaluates
// no @media rules, so — same idiom as the landing pins above — the CSS half
// is a source-scan of the two lane stylesheets and the JS half pins the
// markup shape the phone selectors depend on.
//
// Every assertion below is scoped to a `<=700px` block, so none of them can
// pass by changing desktop: the desktop pins in this file, RecentSends
// .render.test.tsx (the batch/recipient grid) and TemplatesTable.columns
// .test.ts (the column allocation) still hold unchanged.
// ---------------------------------------------------------------------------

describe('DESIGN-RULINGS 44px floor: no sub-floor min-height is authored on phone', () => {
  it.each([
    ['comms.css', CSS],
    ['templates.css', TEMPLATES_CSS],
  ])('%s declares no min-height/height below 44px inside any <=700px block', (_name, css) => {
    const offenders = [...phoneBlocks(css).matchAll(/(?:min-height|height)\s*:\s*(\d+(?:\.\d+)?)px/g)]
      .map((m) => Number(m[1]))
      .filter((px) => px < 44);
    expect(offenders).toEqual([]);
  });
});

describe('v12 phone frame "Send history · 390" (comms.css)', () => {
  it('the batch row becomes the frame\'s two-track card, not a flat stack', () => {
    const body = phoneRuleBody(CSS, '.chq-comms-batch-row');
    expect(body).toMatch(/display:\s*grid/);
    expect(body).toMatch(/grid-template-columns:\s*1fr auto/);
  });

  it('when and the recipient count share the first line, the count right-flushed as a brand micro-label', () => {
    const when = phoneRuleBody(CSS, '.chq-comms-batch-row > .chq-comms-history-when');
    expect(when).toMatch(/grid-row:\s*1/);
    const count = phoneRuleBody(CSS, '.chq-comms-batch-row > .chq-comms-batch-count');
    expect(count).toMatch(/grid-row:\s*1/);
    expect(count).toMatch(/justify-self:\s*end/);
    expect(count).toMatch(/text-transform:\s*uppercase/);
    expect(count).toMatch(/color:\s*var\(--chq-brand\)/);
  });

  it('subject, template and the recipients control each span the card', () => {
    for (const sel of [
      '.chq-comms-batch-row > .chq-comms-history-subject',
      '.chq-comms-batch-row > .chq-comms-batch-template',
    ]) {
      expect(phoneRuleBody(CSS, sel)).toMatch(/grid-column:\s*1 \/ -1/);
    }
    const toggle = phoneRuleBody(
      CSS,
      '.chq-comms-batch-row > .chq-comms-batch-toggle,\n  .chq-comms-batch-row > .chq-comms-batch-open',
    );
    expect(toggle).toMatch(/grid-column:\s*1 \/ -1/);
    expect(toggle).toMatch(/width:\s*100%/);
  });

  it('drops both column-head rows -- a head over a card stack labels tracks that no longer exist', () => {
    expect(phoneRuleBody(CSS, '.chq-comms-batch-col-heads')).toMatch(/display:\s*none/);
    // Scoped as a descendant so it outranks the row rule on the SAME element
    // (the head carries .chq-comms-recipient-row too).
    expect(
      phoneRuleBody(CSS, '.chq-comms-batch-recipients .chq-comms-recipient-col-heads-row'),
    ).toMatch(/display:\s*none/);
  });

  it('the expanded recipients band stacks, and the user-filed display:contents fix is preserved', () => {
    const row = phoneRuleBody(CSS, '.chq-comms-batch-recipients .chq-comms-recipient-row');
    expect(row).toMatch(/display:\s*flex/);
    expect(row).toMatch(/flex-direction:\s*column/);
    // Desktop-side guard: the fix stays a TOP-LEVEL display:contents.
    expect(topLevelRuleBody(CSS, '.chq-comms-send-detail')).toMatch(/display:\s*contents/);
    // …and the promoted body still runs the stacked card's full width.
    expect(phoneRuleBody(CSS, '.chq-comms-send-detail-body')).toMatch(/width:\s*100%/);
  });

  it('the head stacks and its back link takes the 44px floor with horizontal padding', () => {
    expect(phoneRuleBody(CSS, '.chq-comms-history-head')).toMatch(/flex-direction:\s*column/);
    expect(phoneRuleBody(CSS, '.chq-comms-history-titles')).toMatch(/flex-direction:\s*column/);
    const crumb = phoneRuleBody(CSS, '.chq-comms-history-breadcrumb');
    expect(crumb).toMatch(/min-height:\s*44px/);
    expect(crumb).toMatch(/align-items:\s*center/);
    expect(crumb).toMatch(/padding-right:\s*16px/);
  });

  it('the phone head rules live in a LATER block than the desktop rules they override', () => {
    // The regression this pins: .chq-comms-history-head's desktop base rule
    // is declared BELOW comms.css's first 700px query, so at equal
    // specificity it wins over a phone rule written above it.
    const desktopIdx = CSS.search(/\n\.chq-comms-history-head\s*\{/);
    const phoneIdx = CSS.lastIndexOf('.chq-comms-history-head {');
    expect(desktopIdx).toBeGreaterThan(0);
    expect(phoneIdx).toBeGreaterThan(desktopIdx);
  });
});

describe('v12 phone frame "Templates · 390" (templates.css + comms.css)', () => {
  it('the back link takes the 44px floor, glyph still flush with the column edge', () => {
    const crumb = phoneRuleBody(TEMPLATES_CSS, '.chq-comms-templates-breadcrumb');
    expect(crumb).toMatch(/min-height:\s*44px/);
    expect(crumb).toMatch(/align-items:\s*center/);
    expect(crumb).toMatch(/padding-right:\s*16px/);
  });

  it("the row's name is the frame's Open target: 44px, full card width, display face", () => {
    const name = phoneRuleBody(TEMPLATES_CSS, '.chq-comms-template-name');
    expect(name).toMatch(/min-height:\s*44px/);
    // A <button> shrink-wraps to its label even at display:flex.
    expect(name).toMatch(/width:\s*100%/);
    expect(name).toMatch(/font-family:\s*var\(--chq-font-display\)/);
  });

  it('the last-used line is the frame\'s uppercase micro-label, unlabelled and unwrapped', () => {
    expect(phoneRuleBody(TEMPLATES_CSS, '.chq-comms-template-last-used')).toMatch(
      /text-transform:\s*uppercase/,
    );
    // Its value already opens with the words the prefix would repeat.
    expect(
      phoneRuleBody(CSS, '.chq-comms-templates-table td.chq-comms-templates-col-last-used[data-label]::before'),
    ).toMatch(/content:\s*none/);
    // The generic DEC-937 attr(data-label) rule is untouched (Name keeps it).
    expect(phoneBlocks(CSS)).toMatch(
      /\.chq-comms-templates-table td\[data-label\]::before\s*\{\s*content:\s*attr\(data-label\) ': ';/,
    );
    // The pinned 96px column width is released at card width.
    expect(
      phoneRuleBody(CSS, '.chq-comms-templates-table .chq-comms-templates-col-last-used'),
    ).toMatch(/width:\s*100%/);
  });

  it("the editor takes the frame's 48px fields and 150px body box", () => {
    expect(phoneRuleBody(TEMPLATES_CSS, '.chq-comms-editor input.chq-input')).toMatch(
      /min-height:\s*48px/,
    );
    expect(phoneRuleBody(TEMPLATES_CSS, '.chq-comms-editor .chq-textarea')).toMatch(
      /min-height:\s*150px/,
    );
  });

  it("the footer becomes the frame's action bar: primary fills, Delete on its own left-aligned line", () => {
    expect(phoneRuleBody(TEMPLATES_CSS, '.chq-comms-editor-actions > .chq-btn-primary')).toMatch(
      /flex:\s*1 1 0/,
    );
    const del = phoneRuleBody(TEMPLATES_CSS, '.chq-comms-editor-delete');
    expect(del).toMatch(/flex:\s*1 0 100%/);
    expect(del).toMatch(/justify-content:\s*flex-start/);
    expect(del).toMatch(/min-height:\s*44px/);
  });

  it('the merge-field menu drops its 300px popover for a full-width in-column list at 44px a row', () => {
    const panel = phoneRuleBody(CSS, '.chq-insert-field-menu-panel');
    expect(panel).toMatch(/position:\s*static/);
    expect(panel).toMatch(/width:\s*100%/);
    const item = phoneRuleBody(CSS, '.chq-insert-field-menu-item');
    expect(item).toMatch(/min-height:\s*44px/);
    // B8 caret rule: a full-width control pushes the caret to its own edge.
    expect(phoneRuleBody(CSS, '.chq-insert-field-menu-trigger')).toMatch(
      /justify-content:\s*space-between/,
    );
    expect(phoneRuleBody(CSS, '.chq-insert-field-menu-item-sample')).toMatch(/margin-left:\s*auto/);
  });
});

describe('phone selectors match the markup they lay out', () => {
  it('the batch row emits count/template/toggle as DIRECT children (the phone grid uses `>`)', async () => {
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/email-log`]: listEnvelope([batchRow()]),
    });

    render(
      <MemoryRouter>
        <HistoryTab eventId={EVENT_ID} templatesById={{}} rhythm={null} />
      </MemoryRouter>,
    );

    const row = await screen.findByText('Your talk has been accepted to DevFlow Conf 2027');
    const batch = row.closest('.chq-comms-batch-row')!;
    for (const cls of [
      'chq-comms-history-when',
      'chq-comms-history-subject',
      'chq-comms-batch-count',
      'chq-comms-batch-template',
      'chq-comms-batch-toggle',
    ]) {
      expect(batch.querySelector(`:scope > .${cls}`), `${cls} is not a direct child`).not.toBeNull();
    }
  });

  it('the templates breadcrumb and row name are real controls the 44px floor can land on', async () => {
    mockApi({
      [`GET /api/v1/events/${EVENT_ID}/templates`]: listEnvelope([template()]),
    });

    render(
      <MemoryRouter>
        <TemplatesTab eventId={EVENT_ID} />
      </MemoryRouter>,
    );

    await screen.findByRole('heading', { name: 'Templates' });
    expect(document.querySelector('button.chq-comms-templates-breadcrumb')).not.toBeNull();
    expect(document.querySelector('button.chq-comms-template-name')).not.toBeNull();
    // The Last-used cell keeps the data-label the pinned DEC-937 rule reads,
    // even though the phone card suppresses the prefix for that one cell.
    expect(
      document.querySelector('td.chq-comms-templates-col-last-used[data-label="Last used"]'),
    ).not.toBeNull();
  });
});
