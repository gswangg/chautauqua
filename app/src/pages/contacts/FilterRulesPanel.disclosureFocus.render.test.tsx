// v12m-w16-ui-r3-f (src/decisions-data/DEC-990.md, extending its wave-128
// amendment carried by src/decisions-data/DEC-919.md): "a disclosure that
// reveals a control moves focus INTO it, and it moves focus to the SPECIFIC
// control the trigger named -- otherwise the disclosure has hidden the
// thing it just revealed". This suite exercises the focus-management state
// machine only (jsdom has no viewport width, mirroring
// FilterRulesPanel.builderDisclosure.render.test.tsx's own scope note) --
// it never asserts which markup is visually on screen at 390, only where
// `document.activeElement` lands once the disclosure opens.
//
// FilterRulesPanel is a fully controlled component (rules/onChange), so
// exercising a real "add a rule, then re-render with the appended rule"
// round trip needs a small stateful harness rather than a bare onChange
// spy -- otherwise `rules` would never actually grow and the newly-added
// rule's field select would never mount for focus to land on.
import { afterEach, describe, expect, it } from 'vitest';
import { useState } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { FilterRulesPanel } from './FilterRulesPanel';
import { MAX_SEGMENT_RULES } from '../../../../src/domain/contacts';
import type { SegmentRule } from './types';

afterEach(() => {
  cleanup();
});

function Harness({ initialRules }: { initialRules: SegmentRule[] }) {
  const [rules, setRules] = useState<SegmentRule[]>(initialRules);
  return (
    <FilterRulesPanel
      rules={rules}
      onChange={setRules}
      matchCount={0}
      totalCount={0}
      onSaveAsSegment={() => {}}
    />
  );
}

describe('FilterRulesPanel disclosure focus (src/decisions-data/DEC-990.md)', () => {
  it('clicking "+ Rule" with zero rules opens the builder AND focuses the new rule\'s field select', () => {
    render(<Harness initialRules={[]} />);

    fireEvent.click(screen.getByRole('button', { name: '+ Rule' }));

    expect(document.querySelector('.chq-contacts-filter-rules-row')?.className).toContain(
      'is-builder-open'
    );
    expect(document.activeElement).toBe(screen.getByRole('combobox', { name: 'Filter 1 field' }));
  });

  it('clicking the SECOND chip\'s edit control focuses "Filter 2 field", not "Filter 1 field"', () => {
    const rules: SegmentRule[] = [
      { field: 'company', op: 'eq', value: 'Acme' },
      { field: 'title', op: 'ne', value: 'Intern' },
    ];
    render(<Harness initialRules={rules} />);

    fireEvent.click(screen.getByRole('button', { name: 'Edit Title is not Intern' }));

    expect(document.activeElement).toBe(screen.getByRole('combobox', { name: 'Filter 2 field' }));
    expect(document.activeElement).not.toBe(screen.getByRole('combobox', { name: 'Filter 1 field' }));
  });

  it('at MAX_SEGMENT_RULES with the builder closed, "+ Rule" still opens and lands focus inside the rules row, never back on the chip', () => {
    const rules: SegmentRule[] = Array.from({ length: MAX_SEGMENT_RULES }, () => ({
      field: 'company' as const,
      op: 'eq' as const,
      value: 'Acme',
    }));
    render(<Harness initialRules={rules} />);

    const addChip = screen.getByRole('button', { name: '+ Rule' });
    fireEvent.click(addChip);

    const row = document.querySelector('.chq-contacts-filter-rules-row') as HTMLElement;
    expect(row.className).toContain('is-builder-open');
    expect(document.activeElement).not.toBe(addChip);
    expect(row.contains(document.activeElement)).toBe(true);
    // no rule was appended at the cap: focus lands on the LAST existing
    // rule's field select, per the amendment's edge case.
    expect(document.activeElement).toBe(
      screen.getByRole('combobox', { name: `Filter ${MAX_SEGMENT_RULES} field` })
    );
  });

  it('focus is not re-stolen on a subsequent unrelated re-render (typing into a value input)', () => {
    const rules: SegmentRule[] = [{ field: 'company', op: 'eq', value: 'Acme' }];
    render(<Harness initialRules={rules} />);

    fireEvent.click(screen.getByRole('button', { name: '+ Rule' }));
    expect(document.activeElement).toBe(screen.getByRole('combobox', { name: 'Filter 2 field' }));

    const valueInput = screen.getByRole('textbox', { name: 'Filter 1 value' });
    valueInput.focus();
    fireEvent.change(valueInput, { target: { value: 'Acme Corp' } });

    expect(document.activeElement).toBe(valueInput);
  });
});
