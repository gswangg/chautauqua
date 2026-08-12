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
import { CommsPage } from '../Comms';
import { listEnvelope, mockApi } from '../../test-utils/mockApi';

const EVENT_ID = 'evt-comms-phone';
const HERE = dirname(fileURLToPath(import.meta.url));
const CSS = readFileSync(join(HERE, 'comms.css'), 'utf-8');

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

    render(<CommsPage />);

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

    render(<CommsPage />);
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
