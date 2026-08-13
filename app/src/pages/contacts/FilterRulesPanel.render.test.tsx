// DEC-868: FilterRulesPanel is one row — "Matching all of" the AND, one
// editable [field ▾][op ▾][value][Remove] group per rule (writing the
// whole array back through onChange, never a draft-then-commit form), a
// dashed "Add a rule" button, and — only once a rule is active — the match
// count and "Save as a segment" control at the row's end.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { FilterRulesPanel, FILTER_RULE_FIELDS } from './FilterRulesPanel';
import type { SegmentRule } from './types';

afterEach(() => {
  cleanup();
});

const noop = () => {};

describe('FilterRulesPanel (DEC-868)', () => {
  it('renders "Matching all of" and an "Add a rule" button even with no rules, and no match count', () => {
    render(<FilterRulesPanel rules={[]} onChange={noop} matchCount={0} totalCount={0} onSaveAsSegment={noop} />);
    expect(screen.getByText('Matching all of')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add a rule' })).toBeInTheDocument();
    expect(screen.queryByText(/match$/)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Save as a segment' })).not.toBeInTheDocument();
  });

  it('exposes exactly the server-understood standard fields plus a custom-field choice', () => {
    const rules: SegmentRule[] = [{ field: 'company', op: 'eq', value: 'Acme' }];
    render(<FilterRulesPanel rules={rules} onChange={noop} matchCount={1} totalCount={10} onSaveAsSegment={noop} />);
    const select = screen.getByLabelText('Filter 1 field') as HTMLSelectElement;
    const values = Array.from(select.options).map((o) => o.value);
    expect(values).toEqual([...FILTER_RULE_FIELDS, 'custom']);
    expect(FILTER_RULE_FIELDS).toEqual(['email', 'firstName', 'lastName', 'company', 'title']);
  });

  it('renders one editable group per rule, aria-labeled by position', () => {
    const rules: SegmentRule[] = [
      { field: 'company', op: 'eq', value: 'Acme' },
      { field: 'title', op: 'contains', value: 'Engineer' },
    ];
    render(<FilterRulesPanel rules={rules} onChange={noop} matchCount={2} totalCount={10} onSaveAsSegment={noop} />);
    expect((screen.getByLabelText('Filter 1 field') as HTMLSelectElement).value).toBe('company');
    expect((screen.getByLabelText('Filter 1 operator') as HTMLSelectElement).value).toBe('eq');
    expect((screen.getByLabelText('Filter 1 value') as HTMLInputElement).value).toBe('Acme');
    expect((screen.getByLabelText('Filter 2 field') as HTMLSelectElement).value).toBe('title');
    expect((screen.getByLabelText('Filter 2 value') as HTMLInputElement).value).toBe('Engineer');
  });

  it('"Add a rule" appends a blank rule to the existing array', async () => {
    const { fireEvent } = await import('@testing-library/react');
    const onChange = vi.fn();
    const rules: SegmentRule[] = [{ field: 'company', op: 'eq', value: 'Acme' }];
    render(<FilterRulesPanel rules={rules} onChange={onChange} matchCount={1} totalCount={10} onSaveAsSegment={noop} />);

    fireEvent.click(screen.getByRole('button', { name: 'Add a rule' }));

    expect(onChange).toHaveBeenCalledWith([
      { field: 'company', op: 'eq', value: 'Acme' },
      { field: FILTER_RULE_FIELDS[0], op: 'contains', value: '' },
    ]);
  });

  it('editing the field select of a rule updates only that rule, in place', async () => {
    const { fireEvent } = await import('@testing-library/react');
    const onChange = vi.fn();
    const rules: SegmentRule[] = [
      { field: 'company', op: 'eq', value: 'Acme' },
      { field: 'title', op: 'contains', value: 'Engineer' },
    ];
    render(<FilterRulesPanel rules={rules} onChange={onChange} matchCount={2} totalCount={10} onSaveAsSegment={noop} />);

    fireEvent.change(screen.getByLabelText('Filter 2 field'), { target: { value: 'email' } });

    expect(onChange).toHaveBeenCalledWith([
      { field: 'company', op: 'eq', value: 'Acme' },
      { field: 'email', op: 'contains', value: 'Engineer' },
    ]);
  });

  it('selecting the custom-field choice reveals an inline key input that composes custom.<key>', async () => {
    const { fireEvent } = await import('@testing-library/react');
    const onChange = vi.fn();
    const rules: SegmentRule[] = [{ field: 'company', op: 'eq', value: 'Acme' }];
    render(<FilterRulesPanel rules={rules} onChange={onChange} matchCount={1} totalCount={10} onSaveAsSegment={noop} />);

    fireEvent.change(screen.getByLabelText('Filter 1 field'), { target: { value: 'custom' } });
    expect(onChange).toHaveBeenCalledWith([{ field: 'custom.', op: 'eq', value: 'Acme' }]);

    onChange.mockClear();
    render(
      <FilterRulesPanel
        rules={[{ field: 'custom.', op: 'eq', value: 'Acme' }]}
        onChange={onChange}
        matchCount={1}
        totalCount={10}
        onSaveAsSegment={noop}
      />,
    );
    fireEvent.change(screen.getByLabelText('Filter 1 custom field key'), { target: { value: 'tshirt' } });
    expect(onChange).toHaveBeenCalledWith([{ field: 'custom.tshirt', op: 'eq', value: 'Acme' }]);
  });

  it('the Remove button drops exactly that rule, leaving the others', async () => {
    const { fireEvent } = await import('@testing-library/react');
    const onChange = vi.fn();
    const rules: SegmentRule[] = [
      { field: 'company', op: 'eq', value: 'Acme' },
      { field: 'title', op: 'contains', value: 'Engineer' },
    ];
    render(<FilterRulesPanel rules={rules} onChange={onChange} matchCount={2} totalCount={10} onSaveAsSegment={noop} />);

    fireEvent.click(screen.getByRole('button', { name: 'Remove filter 1' }));

    expect(onChange).toHaveBeenCalledWith([{ field: 'title', op: 'contains', value: 'Engineer' }]);
  });

  it('shows the match count and Save-as-segment control only once a rule is active (activeRules)', () => {
    const halfTyped: SegmentRule[] = [{ field: 'company', op: 'eq', value: '' }];
    render(
      <FilterRulesPanel rules={halfTyped} onChange={noop} matchCount={318} totalCount={318} onSaveAsSegment={noop} />,
    );
    expect(screen.queryByText(/match$/)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Save as a segment' })).not.toBeInTheDocument();
  });

  it('reports "<matchCount> of <totalCount> match" and calls onSaveAsSegment when a rule is active', async () => {
    const { fireEvent } = await import('@testing-library/react');
    const onSaveAsSegment = vi.fn();
    const rules: SegmentRule[] = [{ field: 'company', op: 'eq', value: 'Acme' }];
    render(
      <FilterRulesPanel rules={rules} onChange={noop} matchCount={41} totalCount={318} onSaveAsSegment={onSaveAsSegment} />,
    );

    expect(screen.getByText('41 of 318 match')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Save as a segment' }));
    expect(onSaveAsSegment).toHaveBeenCalledOnce();
  });
});
