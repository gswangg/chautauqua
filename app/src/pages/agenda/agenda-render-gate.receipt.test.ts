// task w13-o (DEC-393 wave-124 render-gate exemption shape, DEC-991-shaped
// receipt). DayGrid/SessionCard controls are never mounted at phone width --
// PhoneAgenda.tsx is swapped in instead -- which is a stronger fact than any
// CSS and is why agenda.css exempts six of their selectors from the
// undeclared-height tap-floor lens rather than flooring them. A bare
// assertion ("not used on phone") is the shape DEC-099 refuses; this file
// instead pins the render gate's own literal source text (named component
// path + verbatim literal) so the exemption reason can never drift silently
// out of sync with the code that makes it true, and reuses the scan's own
// exemption-detection helper (DEC-613: no second copy of the vocabulary)
// against agenda.css so a future edit that drops or misplaces one of the six
// comments fails loudly here rather than only being caught by eyeballing the
// lens output.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { hasExemptionForToken } from '../../phone-tap-target-scan/core.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const AGENDA_TSX = readFileSync(join(HERE, '..', 'Agenda.tsx'), 'utf-8');
const PHONE_AGENDA_TSX = readFileSync(join(HERE, 'PhoneAgenda.tsx'), 'utf-8');
const DAY_GRID_TSX = readFileSync(join(HERE, 'DayGrid.tsx'), 'utf-8');
const UNSCHEDULED_TRAY_TSX = readFileSync(join(HERE, 'UnscheduledTray.tsx'), 'utf-8');
const AGENDA_CSS = readFileSync(join(HERE, 'agenda.css'), 'utf-8');

describe('Agenda.tsx: the phone/desktop render gate is real (named component + verbatim literal)', () => {
  it('computes isPhone from useIsPhone()', () => {
    expect(AGENDA_TSX).toContain('const isPhone = useIsPhone();');
  });

  it('the isPhone ternary renders PhoneAgenda on phone and the desktop layout (which mounts DayGrid) otherwise', () => {
    expect(AGENDA_TSX).toContain('{isPhone ? (');
    expect(AGENDA_TSX).toContain('<PhoneAgenda');
    expect(AGENDA_TSX).toContain('<DayGrid');
    // The ternary's PhoneAgenda branch must precede the DayGrid mount in
    // source order -- the shape "isPhone ? phone : desktop", not the
    // reverse, which is what actually gates DayGrid off the phone render.
    const phoneIdx = AGENDA_TSX.indexOf('<PhoneAgenda');
    const dayGridIdx = AGENDA_TSX.indexOf('<DayGrid');
    expect(phoneIdx).toBeGreaterThan(0);
    expect(dayGridIdx).toBeGreaterThan(phoneIdx);
  });

  it('DayGrid mounts inside the desktop-only chq-agenda-layout wrapper, not beside PhoneAgenda', () => {
    const desktopBranch = AGENDA_TSX.slice(AGENDA_TSX.indexOf(') : ('), AGENDA_TSX.indexOf('<DayGrid'));
    expect(desktopBranch).toContain('chq-agenda-layout');
  });
});

describe('PhoneAgenda.tsx: swapped in on phone, imports neither DayGrid nor SessionCard', () => {
  it('never imports DayGrid', () => {
    expect(PHONE_AGENDA_TSX).not.toMatch(/from ['"]\.\/DayGrid['"]/);
  });

  it('never imports SessionCard', () => {
    expect(PHONE_AGENDA_TSX).not.toMatch(/from ['"]\.\/SessionCard['"]/);
  });
});

describe('SessionCard.tsx mounts only from the two desktop-only call sites the exemption comments cite', () => {
  it('DayGrid.tsx renders <SessionCard at the cited line', () => {
    expect(DAY_GRID_TSX).toContain('<SessionCard');
    expect(DAY_GRID_TSX).toContain("import { SessionCard } from './SessionCard';");
  });

  it('UnscheduledTray.tsx renders <SessionCard at the cited line', () => {
    expect(UNSCHEDULED_TRAY_TSX).toContain('<SessionCard');
    expect(UNSCHEDULED_TRAY_TSX).toContain("import { SessionCard } from './SessionCard';");
  });
});

describe('agenda.css: every render-gated selector carries a tap-floor-exempt comment naming the gate (DEC-393 wave-124 shape)', () => {
  const RENDER_GATED_SELECTORS = [
    'chq-day-grid-cell-btn',
    'chq-day-grid-cell-btn-clash',
    'chq-day-grid-noroom-btn',
    'chq-day-grid-clash-item',
    'chq-session-card',
    'chq-session-card-conflict',
  ];

  it.each(RENDER_GATED_SELECTORS)('%s has an immediately-preceding tap-floor-exempt comment', (token) => {
    expect(hasExemptionForToken(AGENDA_CSS, token)).toBe(true);
  });

  it.each(RENDER_GATED_SELECTORS)('%s: the exemption reason names the render gate, not a bare "not used on phone" assertion', (token) => {
    const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(`\\/\\*\\s*tap-floor-exempt:([^*]*)\\*\\/\\s*[^{}]*\\.${escaped}\\b`);
    const match = AGENDA_CSS.match(re);
    expect(match, `expected a tap-floor-exempt comment for .${token}`).not.toBeNull();
    const reason = match?.[1] ?? '';
    expect(reason).toMatch(/render-gate/);
    expect(reason).toMatch(/Agenda\.tsx:71/);
    expect(reason).toMatch(/:426/);
    expect(reason).toMatch(/agenda-render-gate\.receipt\.test\.ts/);
  });
});
