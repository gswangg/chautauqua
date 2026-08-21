// v12m-w16-ui-r2-a (DEC-919): CONTACTS 390 -- the rule builder is
// DISCLOSED, not deleted. Below 700px the desktop rule stack
// (`.chq-contacts-filter-rules-row`) is hidden by default and only shown
// again with `.is-builder-open`; the 390 chip strip's own controls own the
// disclosure: the "+ Rule" chip adds a rule AND opens the builder, a
// chip's own label re-opens it for editing (without adding), and a "Done"
// control (the row's last child, rendered unconditionally per the
// DEC-937 wave-129 shape) closes it again. This suite exercises the React
// state machine only -- jsdom has no viewport width, so it never asserts
// which markup is *visually* on screen at 390 (that's contacts.css's job,
// covered by contacts-rule-builder-390.test.ts's CSS-text scan).
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { FilterRulesPanel } from './FilterRulesPanel';
import { MAX_SEGMENT_RULES } from '../../../../src/domain/contacts';
import type { SegmentRule } from './types';

afterEach(() => {
  cleanup();
});

const noop = () => {};

function rulesRow(): HTMLElement {
  const row = document.querySelector('.chq-contacts-filter-rules-row');
  if (!row) throw new Error('rules row not found');
  return row as HTMLElement;
}

describe('FilterRulesPanel builder disclosure (DEC-919)', () => {
  it('the rules row carries no is-builder-open class by default', () => {
    render(<FilterRulesPanel rules={[]} onChange={noop} matchCount={0} totalCount={0} onSaveAsSegment={noop} />);
    expect(rulesRow().className).not.toContain('is-builder-open');
  });

  it('"+ Rule" (the chip strip control) adds a rule AND opens the builder', () => {
    const onChange = vi.fn();
    const rules: SegmentRule[] = [{ field: 'company', op: 'eq', value: 'Acme' }];
    render(<FilterRulesPanel rules={rules} onChange={onChange} matchCount={1} totalCount={10} onSaveAsSegment={noop} />);

    expect(rulesRow().className).not.toContain('is-builder-open');
    fireEvent.click(screen.getByRole('button', { name: '+ Rule' }));

    expect(onChange).toHaveBeenCalledWith([
      { field: 'company', op: 'eq', value: 'Acme' },
      expect.objectContaining({ value: '' }),
    ]);
    expect(rulesRow().className).toContain('is-builder-open');
  });

  it('tapping a rule chip\'s own edit button opens the builder without adding a rule', () => {
    const onChange = vi.fn();
    const rules: SegmentRule[] = [{ field: 'company', op: 'eq', value: 'Acme' }];
    render(<FilterRulesPanel rules={rules} onChange={onChange} matchCount={1} totalCount={10} onSaveAsSegment={noop} />);

    fireEvent.click(screen.getByRole('button', { name: 'Edit Company is Acme' }));

    expect(onChange).not.toHaveBeenCalled();
    expect(rulesRow().className).toContain('is-builder-open');
  });

  it('"Done" closes the builder', () => {
    const rules: SegmentRule[] = [{ field: 'company', op: 'eq', value: 'Acme' }];
    render(<FilterRulesPanel rules={rules} onChange={noop} matchCount={1} totalCount={10} onSaveAsSegment={noop} />);

    fireEvent.click(screen.getByRole('button', { name: 'Edit Company is Acme' }));
    expect(rulesRow().className).toContain('is-builder-open');

    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(rulesRow().className).not.toContain('is-builder-open');
  });

  it('the chip\'s own dismiss (✕) removes the CORRECT rule while the builder is closed, mapping into `rules` not `activeRules(rules)`', () => {
    const onChange = vi.fn();
    // An incomplete (half-typed) rule precedes a complete one, so an
    // activeRules-indexed dismiss would delete the wrong entry.
    const rules: SegmentRule[] = [
      { field: 'email', op: 'contains', value: '' }, // half-typed: no chip
      { field: 'company', op: 'eq', value: 'Acme' }, // chip index 0
      { field: 'title', op: 'ne', value: 'Intern' }, // chip index 1
    ];
    render(<FilterRulesPanel rules={rules} onChange={onChange} matchCount={2} totalCount={10} onSaveAsSegment={noop} />);

    expect(rulesRow().className).not.toContain('is-builder-open');
    fireEvent.click(screen.getByRole('button', { name: 'Remove Title is not Intern' }));

    expect(onChange).toHaveBeenCalledWith([rules[0], rules[1]]);
  });

  it('"+ Rule" is NOT disabled at MAX_SEGMENT_RULES while the builder is closed', () => {
    const rules: SegmentRule[] = Array.from({ length: MAX_SEGMENT_RULES }, () => ({
      field: 'company' as const,
      op: 'eq' as const,
      value: 'Acme',
    }));
    render(<FilterRulesPanel rules={rules} onChange={noop} matchCount={1} totalCount={10} onSaveAsSegment={noop} />);
    expect(rulesRow().className).not.toContain('is-builder-open');
    expect(screen.getByRole('button', { name: '+ Rule' })).not.toBeDisabled();
  });

  it('"+ Rule" IS disabled at the cap once the builder is open', () => {
    const rules: SegmentRule[] = Array.from({ length: MAX_SEGMENT_RULES }, () => ({
      field: 'company' as const,
      op: 'eq' as const,
      value: 'Acme',
    }));
    render(<FilterRulesPanel rules={rules} onChange={noop} matchCount={1} totalCount={10} onSaveAsSegment={noop} />);

    const chipEdit = document.querySelector('.chq-contacts-filter-rule-chip-edit') as HTMLElement;
    fireEvent.click(chipEdit);
    expect(rulesRow().className).toContain('is-builder-open');
    expect(screen.getByRole('button', { name: '+ Rule' })).toBeDisabled();
  });
});
