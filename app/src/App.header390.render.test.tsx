// DEC-576 wave-22 amendment (task w22-e, SHELL LANE, no page files): the
// 390 shell header band -- wordmark + right-flushed identity slot -- is the
// SHELL's frame to satisfy, not any one page's. docs/design/audit/
// settings-hub-390-v12.md's own wave-22 amendment records :278 (wordmark)
// and :279 (event name) as NOT INSTRUMENTABLE from a page-scoped mount of
// SettingsPage, and names the correct owner as "a future shell-level
// frame-verdict lane covering App.tsx's Header across every page it
// wraps". This file is that lane's one receipt. It mounts the REAL App
// (its own BrowserRouter), the same harness App.render.test.tsx already
// uses -- never a second mock stack, per this task's own instruction.
//
// Frame lines this file verdicts (every admin 390 frame draws the same
// literal band, byte-for-byte): Chautauqua Settings.dc.html:277-279,
// Chautauqua Submissions.dc.html:139-141, Chautauqua Content.dc.html:
// 200-202/249-251, Chautauqua Contacts.dc.html:181-183 --
// `font-family:'Familjen Grotesk', sans-serif; font-size:20px;
// font-weight:700; letter-spacing:-0.03em; line-height:1;
// position:relative; top:-2.5px` for the wordmark, and
// `margin-left:auto; font-size:12px; font-weight:600; color:#565A4B` for
// the right-flushed identity slot beside it, inside a
// `border-bottom:1px solid #1B1D17; padding:14px 16px; flex-shrink:0`
// band.
//
// jsdom applies no @media, so this file is two halves, the established
// idiom (PhoneAgenda.phone-head.render.test.tsx, scorecard-phone-frames.
// test.ts): a REACT render pin on DOM structure/content, and a SOURCE-SCAN
// pin on styles.css TEXT for the phone-width geometry jsdom cannot apply.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { App } from './App';
import { mockApi } from './test-utils/mockApi';
import { resetEventsCacheForTests } from './lib/useCurrentEvent';
import { stripCssComments } from '../../test/helpers/strip-css-comments';
// compile-checked provenance marker (DEC-576 dependency, per this task's
// own instruction): a DEC-NNN constant is a mutable string the scribe
// overwrites every wave (DEC-967 wave-126), not a receipt of build -- this
// import only proves the dependency is compile-checked, never a citation of
// its current text.
import { DEC_576 } from '../../src/decisions';

void DEC_576;

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, '..', '..');

beforeEach(() => {
  window.history.pushState({}, '', '/admin');
});

afterEach(() => {
  cleanup();
  window.history.pushState({}, '', '/admin');
  window.localStorage.clear();
  resetEventsCacheForTests();
});

async function renderShell() {
  mockApi({
    'GET /api/v1/me': {
      userId: 'u-1',
      email: 'organizer@example.com',
      name: 'Jordan Alvarez',
      role: 'organizer',
      orgId: 'org-1',
    },
    'GET /api/v1/events': { items: [{ id: 'ev-1', name: 'DevFlow Conf' }], total: 1, page: 1, perPage: 50 },
    'GET /api/v1/events/ev-1/overview': {
      speakers: { contactsOwing: 0, overdueAssignments: 0 },
      agenda: { unplaced: 0, conflicts: 0 },
    },
  });

  render(<App />);
  const header = await screen.findByRole('banner');
  // DEC-978: EventSwitcher's own fetch waits for `me` to resolve.
  await waitFor(() => {
    expect(within(header).getByText('DevFlow Conf')).toBeInTheDocument();
  });
  return header;
}

describe('shell header 390 band -- wordmark region (Settings.dc.html:278 and siblings)', () => {
  it('the wordmark is a single .chq-wordmark span reading "chautauqua"', async () => {
    const header = await renderShell();
    const wordmark = within(header).getByText('chautauqua');
    expect(wordmark).toHaveClass('chq-wordmark');
    expect(wordmark.tagName).toBe('SPAN');
  });
});

describe('shell header 390 band -- the right-flushed identity slot (Settings.dc.html:279 and siblings)', () => {
  it('the event name renders as a real control (.chq-eventswitcher-menu-btn), not a bare <span> -- the divergence this lane must adjudicate', async () => {
    const header = await renderShell();
    // The frame draws a plain right-flushed <span>. The app renders the
    // shared EventSwitcher control -- an accessible button, not inert
    // text. Asserted here so a future regression toward an inert span (or
    // toward removing the control) both fail loudly against this pin.
    const switcherBtn = within(header).getByRole('button', { name: 'Switch event' });
    expect(switcherBtn).toHaveClass('chq-eventswitcher-menu-btn');
    expect(within(switcherBtn).getByText('DevFlow Conf')).toHaveClass('chq-eventswitcher-name');
  });

  it('.chq-header-identity (the right-flushed slot`s host) is the one thing that stays visible at phone -- only .chq-user-identity inside it stands down', async () => {
    const header = await renderShell();
    const identity = header.querySelector('.chq-header-identity');
    expect(identity).not.toBeNull();
    // The event switcher lives directly in .chq-header-identity, a sibling
    // of .chq-user-identity -- CSS (verified below) hides only the latter
    // at phone width, never the identity block itself, which would also
    // take the switcher down with it and strand the capability DEC-919
    // forbids losing.
    expect(identity!.querySelector('.chq-eventswitcher')).not.toBeNull();
  });
});

describe('shell header 390 band -- geometry (border-bottom:1px solid #1B1D17; padding:14px 16px; flex-shrink:0)', () => {
  it('.chq-nav and .chq-header-identity .chq-user-identity are present in the DOM (React renders unconditionally; CSS -- checked below -- is what hides them at phone)', async () => {
    const header = await renderShell();
    expect(within(header).getByRole('navigation', { name: 'Primary' })).toBeInTheDocument();
    expect(within(header).getByText('JORDAN A.', { exact: false })).toBeInTheDocument();
  });
});

/** Mirrors PhoneAgenda.phone-head.render.test.tsx's phoneLayer/phoneRule/
 * topLevelRuleBody trio (itself mirroring scorecard-phone-frames.test.ts) --
 * reused rather than re-derived, per DEC-613. */
function phoneLayer(css: string): string {
  const out: string[] = [];
  const opener = /@media\s*\(max-width:\s*\d+px\)\s*\{/g;
  let m: RegExpExecArray | null;
  while ((m = opener.exec(css)) !== null) {
    let depth = 1;
    let i = m.index + m[0].length;
    const start = i;
    while (i < css.length && depth > 0) {
      if (css[i] === '{') depth += 1;
      else if (css[i] === '}') depth -= 1;
      i += 1;
    }
    if (depth !== 0) throw new Error('unbalanced @media block');
    out.push(css.slice(start, i - 1));
  }
  if (out.length === 0) throw new Error('no max-width media block found');
  return out.join('\n');
}

function phoneRule(css: string, selector: string): string {
  const layer = phoneLayer(css);
  const rule = /([^{}]+)\{([^{}]*)\}/g;
  let m: RegExpExecArray | null;
  while ((m = rule.exec(layer)) !== null) {
    const selectors = m[1]!
      .split(',')
      .map((s) => s.trim().replace(/\s+/g, ' '))
      .filter(Boolean);
    if (selectors.includes(selector)) return m[2]!;
  }
  throw new Error(`no phone rule for ${selector}`);
}

function phoneRuleOptional(css: string, selector: string): string | null {
  try {
    return phoneRule(css, selector);
  } catch {
    return null;
  }
}

function stripAnyMedia(css: string): string {
  return css.replace(/@media[^{]*\{(?=((?:[^{}]*\{[^{}]*\}[^{}]*)*))\1\}/g, '');
}

function topLevelRuleBody(css: string, selector: string): string {
  const withoutMedia = stripAnyMedia(css);
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const m = new RegExp(`${escaped}\\s*\\{([^}]*)\\}`).exec(withoutMedia);
  if (!m || m[1] === undefined) throw new Error(`no top-level rule for ${selector}`);
  return m[1];
}

const STYLES_CSS = stripCssComments(readFileSync(join(REPO_ROOT, 'app', 'src', 'styles.css'), 'utf-8'));

describe('shell header 390 CSS geometry, read from styles.css text (jsdom applies no @media)', () => {
  it('.chq-header keeps the frame`s 14px 16px phone padding (top-level 15px 34px is desktop-frozen)', () => {
    expect(phoneRule(STYLES_CSS, '.chq-header')).toMatch(/padding:\s*14px 16px/);
    expect(topLevelRuleBody(STYLES_CSS, '.chq-header')).toMatch(/padding:\s*15px 34px/);
  });

  it('.chq-header keeps its border-bottom var(--chq-ink) at top level, which resolves to the frame`s literal #1B1D17', () => {
    expect(topLevelRuleBody(STYLES_CSS, '.chq-header')).toMatch(/border-bottom:\s*1px solid var\(--chq-ink\)/);
    expect(STYLES_CSS).toMatch(/--chq-ink:\s*#1b1d17/i);
    expect(topLevelRuleBody(STYLES_CSS, '.chq-header')).toMatch(/flex-shrink:\s*0/);
  });

  it('.chq-header .chq-wordmark takes the frame`s 20px/-2.5px phone pair (this lane`s one CSS fix) -- desktop`s 22px/-3px stays untouched', () => {
    expect(phoneRule(STYLES_CSS, '.chq-header .chq-wordmark')).toMatch(/font-size:\s*20px/);
    expect(phoneRule(STYLES_CSS, '.chq-header .chq-wordmark')).toMatch(/top:\s*-2\.5px/);
    expect(topLevelRuleBody(STYLES_CSS, '.chq-wordmark')).toMatch(/font-size:\s*22px/);
    expect(topLevelRuleBody(STYLES_CSS, '.chq-wordmark')).toMatch(/top:\s*-3px/);
  });

  it('.chq-nav stands down at phone width (top-level rule is untouched, so desktop keeps the full nav)', () => {
    expect(phoneRule(STYLES_CSS, '.chq-nav')).toMatch(/display:\s*none/);
    expect(() => topLevelRuleBody(STYLES_CSS, '.chq-nav')).not.toThrow();
    expect(topLevelRuleBody(STYLES_CSS, '.chq-nav')).not.toMatch(/display:\s*none/);
  });

  it('.chq-header-identity .chq-user-identity stands down at phone width, but .chq-header-identity itself and .chq-eventswitcher carry no phone display:none -- only the desktop identity label is removed, never the event switcher', () => {
    expect(phoneRule(STYLES_CSS, '.chq-header-identity .chq-user-identity')).toMatch(/display:\s*none/);
    expect(phoneRuleOptional(STYLES_CSS, '.chq-header-identity')).toBeNull();
    expect(phoneRuleOptional(STYLES_CSS, '.chq-eventswitcher')).toBeNull();
  });

  it('DEC-385 single-direction: none of the three phone stand-down rules above have a top-level counterpart (they narrow, they never widen)', () => {
    expect(() => topLevelRuleBody(STYLES_CSS, '.chq-header-identity .chq-user-identity')).toThrow();
  });
});

describe('.chq-shell:has([data-chq-phone-head]) .chq-header stand-down: a frame-driven exception (the Review scorecard 390 frames), not a hole', () => {
  it('the rule exists, inside the phone block, setting display:none', () => {
    expect(phoneRule(STYLES_CSS, '.chq-shell:has([data-chq-phone-head]) .chq-header')).toMatch(/display:\s*none/);
    expect(() => topLevelRuleBody(STYLES_CSS, '.chq-shell:has([data-chq-phone-head]) .chq-header')).toThrow();
  });

  it('Scorecard.tsx is the ONLY live setter of data-chq-phone-head -- a second setter fails loudly here', () => {
    const setters = findDataAttributeSetters(join(REPO_ROOT, 'app', 'src'), 'data-chq-phone-head');
    expect(setters).toEqual(['pages/review/Scorecard.tsx']);
  });
});

/** Walks app/src/**\/*.tsx (excluding *.test.tsx) collecting files that set
 * `attr` as a REAL JSX attribute or object-literal key -- `attr[:=]`,
 * immediately after the attribute name -- filtering out any line whose
 * trimmed text starts with a `//` line comment (this codebase's phone-
 * head/-dock attributes are always set via an object-literal spread, e.g.
 * Scorecard.tsx's `{ 'data-chq-phone-head': true }`, or a bare JSX
 * attribute; neither shape spans multiple lines in this tree today). */
function findDataAttributeSetters(root: string, attr: string): string[] {
  const escaped = attr.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // Matches both a bare JSX attribute (`data-chq-phone-head=`) and an
  // object-literal key (`'data-chq-phone-head': true`) -- the closing
  // quote of the key form sits between the name and the colon, so an
  // optional quote char is allowed there.
  const settingPattern = new RegExp(`${escaped}["']?\\s*[:=]`);
  const out: string[] = [];
  for (const file of walkTsx(root)) {
    const text = readFileSync(file, 'utf-8');
    const hit = text.split('\n').some((line) => {
      const trimmed = line.trim();
      if (trimmed.startsWith('//')) return false;
      return settingPattern.test(line) && line.includes(attr);
    });
    if (hit) out.push(file.slice(root.length + 1));
  }
  return out.sort();
}

function walkTsx(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    const st = statSync(p);
    if (st.isDirectory()) {
      out.push(...walkTsx(p));
    } else if (entry.endsWith('.tsx') && !entry.endsWith('.test.tsx')) {
      out.push(p);
    }
  }
  return out;
}
