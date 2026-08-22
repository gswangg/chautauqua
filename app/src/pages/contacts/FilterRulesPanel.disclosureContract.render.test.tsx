// v12m-w16-ui-r4-e (src/decisions-data/DEC-990.md, amendment wave-16 r4):
// the Contacts 390 builder disclosure carries the FULL disclosure contract,
// not just the `is-builder-open` toggle: both triggers announce their
// expanded state and name the region they control, focus moves back to the
// trigger (`.chq-contacts-filter-add-chip`) when `Done` closes the builder,
// and any blank rule (invisible in both the chip strip and the query, per
// `activeRules()` in segments.ts) is pruned on close so it stops consuming
// MAX_SEGMENT_RULES. Desktop is frozen: `.chq-contacts-filter-add-chip` and
// `.chq-contacts-filter-builder-done` each carry a bare top-level
// `display: none` in contacts.css, and `.chq-contacts-filter-rule-chip-edit`
// is hidden the same way through its parent `.chq-contacts-filter-chipstrip`
// (also `display: none` by default) -- so none of the handlers this suite
// exercises can ever fire above 700px, and this file pins that with a
// sheet-text assertion below (jsdom has no real layout engine, matching the
// sibling contacts-rule-builder-390.test.ts's approach).
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
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

function addChip(): HTMLElement {
  return screen.getByRole('button', { name: '+ Rule' });
}

describe('FilterRulesPanel builder disclosure contract (src/decisions-data/DEC-990.md)', () => {
  it('both triggers carry aria-expanded="false" initially and aria-controls matching the rules row id', () => {
    const rules: SegmentRule[] = [{ field: 'company', op: 'eq', value: 'Acme' }];
    render(<FilterRulesPanel rules={rules} onChange={noop} matchCount={1} totalCount={10} onSaveAsSegment={noop} />);

    const rowId = rulesRow().id;
    expect(rowId).toBeTruthy();

    const chip = addChip();
    const editButton = screen.getByRole('button', { name: 'Edit Company is Acme' });

    expect(chip).toHaveAttribute('aria-expanded', 'false');
    expect(chip).toHaveAttribute('aria-controls', rowId);
    expect(editButton).toHaveAttribute('aria-expanded', 'false');
    expect(editButton).toHaveAttribute('aria-controls', rowId);
  });

  it('both triggers read aria-expanded="true" after "+ Rule" opens the builder', () => {
    const rules: SegmentRule[] = [{ field: 'company', op: 'eq', value: 'Acme' }];
    render(<FilterRulesPanel rules={rules} onChange={noop} matchCount={1} totalCount={10} onSaveAsSegment={noop} />);

    fireEvent.click(addChip());

    expect(addChip()).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('button', { name: 'Edit Company is Acme' })).toHaveAttribute('aria-expanded', 'true');
  });

  it('clicking "Done" returns focus to the "+ Rule" trigger, not document.body', () => {
    const rules: SegmentRule[] = [{ field: 'company', op: 'eq', value: 'Acme' }];
    render(<FilterRulesPanel rules={rules} onChange={noop} matchCount={1} totalCount={10} onSaveAsSegment={noop} />);

    fireEvent.click(screen.getByRole('button', { name: 'Edit Company is Acme' }));
    expect(rulesRow().className).toContain('is-builder-open');

    fireEvent.click(screen.getByRole('button', { name: 'Done' }));

    expect(document.activeElement).toBe(addChip());
    expect(document.activeElement).not.toBe(document.body);
  });

  it('"Done" prunes blank rules from onChange, keeping only non-blank rules in original order', () => {
    const onChange = vi.fn();
    const rules: SegmentRule[] = [
      { field: 'email', op: 'contains', value: '' }, // blank
      { field: 'company', op: 'eq', value: 'Acme' }, // non-blank
      { field: 'title', op: 'contains', value: '   ' }, // blank (whitespace-only)
      { field: 'lastName', op: 'ne', value: 'Smith' }, // non-blank
    ];
    render(<FilterRulesPanel rules={rules} onChange={onChange} matchCount={2} totalCount={10} onSaveAsSegment={noop} />);

    fireEvent.click(screen.getByRole('button', { name: 'Done' }));

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith([rules[1], rules[3]]);
  });

  it('"Done" does not call onChange at all when there are no blank rules', () => {
    const onChange = vi.fn();
    const rules: SegmentRule[] = [
      { field: 'company', op: 'eq', value: 'Acme' },
      { field: 'lastName', op: 'ne', value: 'Smith' },
    ];
    render(<FilterRulesPanel rules={rules} onChange={onChange} matchCount={2} totalCount={10} onSaveAsSegment={noop} />);

    fireEvent.click(screen.getByRole('button', { name: 'Done' }));

    expect(onChange).not.toHaveBeenCalled();
  });

  it('the desktop "Add a rule" button is unchanged: addRule still appends a blank rule, no pruning', () => {
    const onChange = vi.fn();
    const rules: SegmentRule[] = [{ field: 'company', op: 'eq', value: '' }];
    render(<FilterRulesPanel rules={rules} onChange={onChange} matchCount={0} totalCount={10} onSaveAsSegment={noop} />);

    fireEvent.click(screen.getByRole('button', { name: 'Add a rule' }));

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith([
      { field: 'company', op: 'eq', value: '' },
      expect.objectContaining({ value: '' }),
    ]);
  });

  it('desktop is frozen: the phone-only triggers/close control are display:none above 700px in contacts.css', () => {
    const css = readFileSync(join(__dirname, 'contacts.css'), 'utf8');
    // .chq-contacts-filter-add-chip and .chq-contacts-filter-builder-done
    // each carry their own bare top-level display:none.
    for (const selector of ['.chq-contacts-filter-add-chip', '.chq-contacts-filter-builder-done']) {
      const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const topLevelRule = new RegExp(`(^|\\n)${escaped}\\s*\\{[^}]*display:\\s*none`, 'm');
      expect(css).toMatch(topLevelRule);
    }
    // .chq-contacts-filter-rule-chip-edit is hidden at desktop through its
    // parent .chq-contacts-filter-chipstrip, which is display:none by
    // default (only the terminal <=700px phone block turns it back on).
    expect(css).toMatch(/(^|\n)\.chq-contacts-filter-chipstrip\s*\{[^}]*display:\s*none/m);
  });
});
