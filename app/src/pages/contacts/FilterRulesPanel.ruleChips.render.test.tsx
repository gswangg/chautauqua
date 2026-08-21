// src/decisions-data/DEC-919.md: the 390 head's rule strip projects each ACTIVE rule as a
// dismissible chip -- a second sibling to the desktop
// `.chq-contacts-filter-rules-row`, hidden on desktop by CSS alone. This
// suite covers the chip strip specifically: it renders once per ACTIVE
// rule (never a half-typed one), speaks the builder's own field/op
// vocabulary (not segments.ts's describeRules quotes-and-symbols
// grammar), and its dismiss button's index maps into `rules`, never into
// `activeRules(rules)` -- so removing the SECOND chip (which may not be
// the second entry in `rules` once a half-typed rule sits between active
// ones) removes the right rule.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { FilterRulesPanel, ruleChipLabel } from './FilterRulesPanel';
import type { SegmentRule } from './types';

afterEach(() => {
  cleanup();
});

const noop = () => {};

describe('FilterRulesPanel rule chip strip (src/decisions-data/DEC-919.md)', () => {
  const rules: SegmentRule[] = [
    { field: 'company', op: 'eq', value: 'Acme' },
    { field: 'email', op: 'contains', value: '' }, // half-typed: no chip
    { field: 'title', op: 'ne', value: 'Intern' },
  ];

  it('renders exactly one chip per ACTIVE rule, skipping the half-typed one', () => {
    render(<FilterRulesPanel rules={rules} onChange={noop} matchCount={2} totalCount={10} onSaveAsSegment={noop} />);
    const chips = document.querySelectorAll('.chq-contacts-filter-rule-chip');
    expect(chips.length).toBe(2);
  });

  it('speaks the builder vocabulary (FIELD_LABELS / OP_OPTIONS), not describeRules', () => {
    render(<FilterRulesPanel rules={rules} onChange={noop} matchCount={2} totalCount={10} onSaveAsSegment={noop} />);
    const chips = document.querySelectorAll('.chq-contacts-filter-rule-chip');
    expect(chips[0]?.textContent).toContain('Company is Acme');
    expect(chips[1]?.textContent).toContain('Title is not Intern');
  });

  it('ruleChipLabel resolves custom.* fields by stripping the prefix', () => {
    expect(ruleChipLabel({ field: 'custom.vip', op: 'contains', value: 'yes' })).toBe('vip contains yes');
  });

  it('dismissing the SECOND chip removes the third rule (rules[2]), proving the index maps into `rules`', () => {
    const onChange = vi.fn();
    render(
      <FilterRulesPanel rules={rules} onChange={onChange} matchCount={2} totalCount={10} onSaveAsSegment={noop} />
    );
    const chips = document.querySelectorAll('.chq-contacts-filter-rule-chip');
    expect(chips.length).toBe(2);
    const secondChip = chips[1] as HTMLElement;
    const dismiss = within(secondChip).getByRole('button', { name: 'Remove Title is not Intern' });
    fireEvent.click(dismiss);
    expect(onChange).toHaveBeenCalledWith([rules[0], rules[1]]);
  });

  it('caption reads "All of" in the chip strip, distinct from the desktop row\'s "Matching all of"', () => {
    render(<FilterRulesPanel rules={rules} onChange={noop} matchCount={2} totalCount={10} onSaveAsSegment={noop} />);
    expect(screen.getByText('All of')).toBeInTheDocument();
    expect(screen.getByText('Matching all of')).toBeInTheDocument();
  });
});
