// DEC-787: FilterRulesPanel restores the multi-facet contact filter as its
// own component. Covers: chip text comes from the shared describeRules
// helper, the field vocabulary is exactly the server-understood set (plus
// custom.<key> via a typed key), and add/remove mutate the rules array
// non-destructively (an add appends, a remove drops exactly one).
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { FilterRulesPanel, FILTER_RULE_FIELDS } from './FilterRulesPanel';
import { describeRules } from './segments';
import type { SegmentRule } from './types';

afterEach(() => {
  cleanup();
});

describe('FilterRulesPanel (DEC-787)', () => {
  it('exposes exactly the server-understood standard fields plus a custom-field choice', () => {
    render(<FilterRulesPanel rules={[]} onChange={() => {}} />);
    const select = screen.getByLabelText('Filter field') as HTMLSelectElement;
    const values = Array.from(select.options).map((o) => o.value);
    expect(values).toEqual([...FILTER_RULE_FIELDS, 'custom']);
    expect(FILTER_RULE_FIELDS).toEqual(['email', 'firstName', 'lastName', 'company', 'title']);
  });

  it('renders each active rule as a chip using the describeRules helper for its text', () => {
    const rules: SegmentRule[] = [{ field: 'company', op: 'eq', value: 'Acme' }];
    render(<FilterRulesPanel rules={rules} onChange={() => {}} />);
    expect(screen.getByText(describeRules(rules))).toBeInTheDocument();
  });

  it('adding a rule appends to the existing rules rather than replacing them', () => {
    const onChange = vi.fn();
    const rules: SegmentRule[] = [{ field: 'company', op: 'eq', value: 'Acme' }];
    render(<FilterRulesPanel rules={rules} onChange={onChange} />);

    fireEvent.change(screen.getByLabelText('Filter field'), { target: { value: 'title' } });
    fireEvent.change(screen.getByLabelText('Filter operator'), { target: { value: 'contains' } });
    fireEvent.change(screen.getByLabelText('Filter value'), { target: { value: 'Engineer' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add filter' }));

    expect(onChange).toHaveBeenCalledWith([
      { field: 'company', op: 'eq', value: 'Acme' },
      { field: 'title', op: 'contains', value: 'Engineer' },
    ]);
  });

  it('a custom field rule resolves to custom.<key>', () => {
    const onChange = vi.fn();
    render(<FilterRulesPanel rules={[]} onChange={onChange} />);

    fireEvent.change(screen.getByLabelText('Filter field'), { target: { value: 'custom' } });
    fireEvent.change(screen.getByLabelText('Custom field key'), { target: { value: 'tshirt' } });
    fireEvent.change(screen.getByLabelText('Filter value'), { target: { value: 'L' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add filter' }));

    expect(onChange).toHaveBeenCalledWith([{ field: 'custom.tshirt', op: 'contains', value: 'L' }]);
  });

  it('removing a chip drops exactly that rule, leaving the others', () => {
    const onChange = vi.fn();
    const rules: SegmentRule[] = [
      { field: 'company', op: 'eq', value: 'Acme' },
      { field: 'title', op: 'contains', value: 'Engineer' },
    ];
    render(<FilterRulesPanel rules={rules} onChange={onChange} />);

    fireEvent.click(screen.getByRole('button', { name: /Remove filter company/ }));

    expect(onChange).toHaveBeenCalledWith([{ field: 'title', op: 'contains', value: 'Engineer' }]);
  });
});
