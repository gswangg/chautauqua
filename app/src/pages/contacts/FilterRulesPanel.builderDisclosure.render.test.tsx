// DEC-993/DEC-919 (task r1-b): the desktop rule groups and the 390 chip
// strip say the same rule twice at 390, so the builder collapses by
// default (`.chq-contacts-filter-rules-row` with no `is-builder-open`
// class) and discloses on demand -- `+ Rule`, or tapping a chip's body --
// rather than being deleted outright (DEC-919 forbids losing the ability
// to author/edit a rule on a phone). This suite covers the disclosure
// STATE machine only; CSS decides visibility at width (covered by
// contacts-rule-builder-390.test.ts), so no width/media assertions here.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { FilterRulesPanel } from './FilterRulesPanel';
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

describe('FilterRulesPanel builder disclosure (DEC-993/DEC-919)', () => {
  const oneRule: SegmentRule[] = [{ field: 'company', op: 'eq', value: 'Acme' }];

  it('the rules row carries no is-builder-open class on first render', () => {
    render(<FilterRulesPanel rules={oneRule} onChange={noop} matchCount={2} totalCount={10} onSaveAsSegment={noop} />);
    expect(rulesRow().className).not.toContain('is-builder-open');
  });

  it('clicking + Rule both adds a rule AND opens the builder', () => {
    const onChange = vi.fn();
    render(<FilterRulesPanel rules={oneRule} onChange={onChange} matchCount={2} totalCount={10} onSaveAsSegment={noop} />);
    const addChip = screen.getByRole('button', { name: '+ Rule' });
    fireEvent.click(addChip);
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0]![0]).toHaveLength(oneRule.length + 1);
    expect(rulesRow().className).toContain('is-builder-open');
  });

  it('clicking a chip body opens the builder without calling onChange', () => {
    const onChange = vi.fn();
    render(<FilterRulesPanel rules={oneRule} onChange={onChange} matchCount={2} totalCount={10} onSaveAsSegment={noop} />);
    const editButton = screen.getByRole('button', { name: 'Edit Company is Acme' });
    fireEvent.click(editButton);
    expect(onChange).not.toHaveBeenCalled();
    expect(rulesRow().className).toContain('is-builder-open');
  });

  it("clicking a chip's dismiss removes the rule and does NOT open the builder", () => {
    const onChange = vi.fn();
    render(<FilterRulesPanel rules={oneRule} onChange={onChange} matchCount={2} totalCount={10} onSaveAsSegment={noop} />);
    const dismiss = screen.getByRole('button', { name: 'Remove Company is Acme' });
    fireEvent.click(dismiss);
    expect(onChange).toHaveBeenCalledWith([]);
    expect(rulesRow().className).not.toContain('is-builder-open');
  });

  it('clicking Done clears the open state', () => {
    render(<FilterRulesPanel rules={oneRule} onChange={noop} matchCount={2} totalCount={10} onSaveAsSegment={noop} />);
    fireEvent.click(screen.getByRole('button', { name: 'Edit Company is Acme' }));
    expect(rulesRow().className).toContain('is-builder-open');
    const done = screen.getByRole('button', { name: 'Done' });
    fireEvent.click(done);
    expect(rulesRow().className).not.toContain('is-builder-open');
  });
});
