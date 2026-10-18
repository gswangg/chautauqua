// Pure helpers behind the portal editor: which conditions count, the
// matches-nobody sentence, whether a rule can reach a sponsor contact, which
// field levels are sent, and the change preview's permission lines.
import { describe, expect, it } from 'vitest';
import {
  completeRule,
  draftProblems,
  levelsFor,
  matchesNobodyLine,
  permissionChangeLines,
  ruleCanMatchCompanies,
  serverPermissionLine,
  setFieldHelp,
  setFieldLevel,
  withOp,
  type PortalDraft,
} from './portalDraft';
import type { RuleFieldOption } from './types';

const OPTIONS: RuleFieldOption[] = [
  { field: 'role', label: 'Role', values: [{ value: 'volunteer', label: 'Volunteer' }, { value: 'press', label: 'Press' }] },
  { field: 'format', label: 'Session format', values: [{ value: 'Keynote', label: 'Keynote' }] },
];

function draft(overrides: Partial<PortalDraft> = {}): PortalDraft {
  return { name: 'Volunteers', note: '', rule: { groups: [] }, fieldPermissions: {}, capabilities: {}, notifyOnJoin: true, items: [], ...overrides };
}

describe('portal editor helpers', () => {
  it('counts complete conditions only, and keeps values that still fit a new test', () => {
    const rule = { groups: [{ conditions: [{ field: 'role', op: 'is' as const, values: ['volunteer'] }, { field: 'format', op: 'is' as const, values: [] }] }] };
    expect(completeRule(rule)).toEqual({ groups: [{ conditions: [{ field: 'role', op: 'is', values: ['volunteer'] }] }] });
    expect(withOp({ field: 'role', op: 'is_any_of', values: ['volunteer', 'press'] }, 'is')).toEqual({ field: 'role', op: 'is', values: ['volunteer'] });
    expect(withOp({ field: 'role', op: 'is', values: ['volunteer'] }, 'is_none_of').values).toEqual(['volunteer']);
    expect(withOp({ field: 'role', op: 'is', values: ['volunteer'] }, 'is_not_empty').values).toEqual([]);
  });

  it('says who the rule is waiting for', () => {
    expect(matchesNobodyLine({ groups: [{ conditions: [{ field: 'role', op: 'is', values: ['volunteer'] }] }] }, OPTIONS)).toBe('No one has the role Volunteer yet.');
    expect(matchesNobodyLine({ groups: [{ conditions: [{ field: 'role', op: 'is_any_of', values: ['volunteer', 'press'] }] }] }, OPTIONS)).toBe(
      'No one has the role Volunteer or Press yet.',
    );
    expect(matchesNobodyLine({ groups: [{ conditions: [{ field: 'format', op: 'is', values: ['Keynote'] }] }] }, OPTIONS)).toBe('Nobody matches Session format is Keynote yet.');
    expect(matchesNobodyLine({ groups: [] }, OPTIONS)).toBe('The rule has no conditions yet, so it matches nobody.');
  });

  it('tells whether some "or" group could match a sponsor contact', () => {
    expect(ruleCanMatchCompanies({ groups: [{ conditions: [{ field: 'kind', op: 'is', values: ['company'] }] }] })).toBe(true);
    expect(ruleCanMatchCompanies({ groups: [{ conditions: [{ field: 'sponsor_tier', op: 'is', values: ['gold'] }] }] })).toBe(true);
    expect(ruleCanMatchCompanies({ groups: [{ conditions: [{ field: 'role', op: 'is_any_of', values: ['speaker', 'moderator'] }] }] })).toBe(false);
    expect(ruleCanMatchCompanies({ groups: [{ conditions: [{ field: 'format', op: 'is', values: ['Keynote'] }] }] })).toBe(false);
    expect(ruleCanMatchCompanies({ groups: [{ conditions: [{ field: 'format', op: 'is_not', values: ['Keynote'] }] }] })).toBe(true);
    expect(ruleCanMatchCompanies({ groups: [{ conditions: [{ field: 'kind', op: 'is_not', values: ['company'] }] }] })).toBe(false);
    expect(ruleCanMatchCompanies({ groups: [] })).toBe(false);
  });

  it('sends only the fields the organizer decided', () => {
    // set back to its default on a field the saved portal never named: dropped
    expect(setFieldLevel(setFieldLevel({}, {}, 'bio', 'view'), {}, 'bio', 'edit')).toEqual({});
    // a field the saved portal named stays named
    expect(setFieldLevel({ bio: { level: 'view' } }, { bio: { level: 'view' } }, 'bio', 'edit')).toEqual({ bio: { level: 'edit' } });
    // help text keeps an otherwise-default field named
    expect(setFieldHelp({}, {}, 'bio', 'Two paragraphs.')).toEqual({ bio: { level: 'edit', help: 'Two paragraphs.' } });
    expect(setFieldHelp({ bio: { level: 'edit', help: 'x' } }, {}, 'bio', '')).toEqual({});
    expect(levelsFor('email', ['hidden', 'view', 'edit'])).toEqual(['hidden', 'view']);
    expect(levelsFor('bio', ['hidden', 'view', 'edit'])).toEqual(['hidden', 'view', 'edit']);
  });

  it('lists permission changes in the levels participants get', () => {
    const saved = draft({ fieldPermissions: { headshot: { level: 'view' } } });
    const edited = draft({ fieldPermissions: { headshot: { level: 'view' }, phone: { level: 'edit' } }, capabilities: { addCoPresenters: true } });
    expect(permissionChangeLines(saved, edited)).toEqual(['Phone number: Hidden to Edit', 'Add co-presenters: off to on']);
    expect(serverPermissionLine('bio: view -> edit')).toBe('Bio: View to Edit');
    expect(serverPermissionLine('editSubmission: off -> on')).toBe('Edit their submission: off to on');
  });

  it('names what blocks Review and save', () => {
    const problems = draftProblems(
      draft({
        name: ' ',
        rule: { groups: [{ conditions: [{ field: 'role', op: 'is', values: ['press'] }] }, { conditions: [{ field: 'format', op: 'is', values: [] }] }] },
      }),
      OPTIONS,
    );
    expect(problems.map((p) => p.label)).toEqual(['The portal needs a name.', 'Choose a value for Session format in “or” group 2, or remove that condition.']);
  });
});
