import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { plural, countOf } from './plural';

describe('plural', () => {
  it('regular noun', () => {
    expect(plural(0, 'session')).toBe('sessions');
    expect(plural(1, 'session')).toBe('session');
    expect(plural(2, 'session')).toBe('sessions');
  });

  it('irregular noun uses the supplied plural form, never a guessed "s"', () => {
    expect(plural(0, 'person', 'people')).toBe('people');
    expect(plural(1, 'person', 'people')).toBe('person');
    expect(plural(2, 'person', 'people')).toBe('people');
  });
});

describe('countOf', () => {
  it('regular noun', () => {
    expect(countOf(0, 'session')).toBe('0 sessions');
    expect(countOf(1, 'session')).toBe('1 session');
    expect(countOf(2, 'session')).toBe('2 sessions');
  });

  it('irregular noun', () => {
    expect(countOf(0, 'person', 'people')).toBe('0 people');
    expect(countOf(1, 'person', 'people')).toBe('1 person');
    expect(countOf(2, 'person', 'people')).toBe('2 people');
  });

  it('multi-word singular (no bare "s" guess needed)', () => {
    expect(countOf(0, 'possible duplicate')).toBe('0 possible duplicates');
    expect(countOf(1, 'possible duplicate')).toBe('1 possible duplicate');
    expect(countOf(2, 'possible duplicate')).toBe('2 possible duplicates');
  });
});

// DEC-925: guard against a seventh hand-copied `? '' : 's'` ternary being
// written anywhere under app/src. plural.ts (and this test) are the one
// allowed home for the literal string, since they document/verify it.
describe('no hand-copied pluralization ternaries outside plural.ts', () => {
  const APP_SRC = join(__dirname, '..');
  const ALLOWLIST = new Set(['lib/plural.ts', 'lib/plural.test.ts']);
  // Pre-existing offenders as of DEC-925 (w22-h): out of this task's scope
  // (owned by other files/tasks) but flagged for a follow-up conversion.
  const LEGACY_ALLOWLIST = new Set([
    'pages/forms/FieldList.tsx',
    'pages/settings/EventSettingsPanel.tsx',
    'pages/settings/ResourcesPanel.tsx',
    'pages/settings/PortalSettingsPanel.tsx',
    'pages/contacts/AddToEventModal.tsx',
    'pages/speakers/OnboardingGrid.tsx',
    'pages/comms/ComposeWizard.tsx',
    'pages/content/DeliverableDetail.tsx',
    'pages/review/ReviewerQueue.tsx',
    'pages/review/PlanEditor.tsx',
    'pages/submissions/SubmissionDetailPage.tsx',
    'pages/agenda/ConflictChip.tsx',
    'pages/agenda/DayGrid.tsx',
  ]);

  function walk(dir: string): string[] {
    const out: string[] = [];
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      const st = statSync(full);
      if (st.isDirectory()) out.push(...walk(full));
      else if (/\.(ts|tsx)$/.test(entry)) out.push(full);
    }
    return out;
  }

  it('bans the substring `? \'\' : \'s\'` outside the allowlisted files', () => {
    const offenders: string[] = [];
    for (const file of walk(APP_SRC)) {
      const rel = relative(APP_SRC, file);
      if (ALLOWLIST.has(rel) || LEGACY_ALLOWLIST.has(rel)) continue;
      const contents = readFileSync(file, 'utf8');
      if (contents.includes("? '' : 's'")) offenders.push(rel);
    }
    expect(offenders).toEqual([]);
  });
});
