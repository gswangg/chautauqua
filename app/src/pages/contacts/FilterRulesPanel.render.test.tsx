// DEC-868: FilterRulesPanel is one row — "Matching all of" the AND, one
// editable [field ▾][op ▾][value][Remove] group per rule (writing the
// whole array back through onChange, never a draft-then-commit form), a
// tertiary-text "Add a rule" link, and — only once a rule is active — the
// match count and "Save as a segment" control at the row's end.
// DEC-868 amendment (wave 45): one eyebrow, one control tier — the caption
// is a section-label (uppercase, CSS-only), and "Add a rule" is
// .chq-btn-tertiary (no border/background) rather than a dashed button, so
// Remove and Save as a segment remain the row's only bordered controls.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { FilterRulesPanel, FILTER_RULE_FIELDS } from './FilterRulesPanel';
import { MAX_SEGMENT_RULES } from '../../../../src/domain/contacts';
import type { SegmentRule } from './types';

const HERE = dirname(fileURLToPath(import.meta.url));
const CSS = readFileSync(join(HERE, 'contacts.css'), 'utf-8');
const SHARED_CSS = readFileSync(join(HERE, '../../styles.css'), 'utf-8');

/** Extracts a top-level (not inside an @media block) rule's declaration
 * body by selector — same helper as DuplicatesView.render.test.tsx and
 * shell-geometry.test.ts. */
function topLevelRuleBody(css: string, selector: string): string {
  const withoutMedia = css.replace(/@media[^{]*\{(?=((?:[^{}]*\{[^{}]*\}[^{}]*)*))\1\}/g, '');
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = withoutMedia.match(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`));
  const body = match?.[1];
  if (body === undefined) throw new Error(`no top-level rule found for ${selector}`);
  return body;
}

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

  it('falls back to "<matchCount> match" (no denominator) when totalCount is unknown (null)', () => {
    const rules: SegmentRule[] = [{ field: 'company', op: 'eq', value: 'Acme' }];
    render(<FilterRulesPanel rules={rules} onChange={noop} matchCount={41} totalCount={null} onSaveAsSegment={noop} />);
    expect(screen.getByText('41 match')).toBeInTheDocument();
    expect(screen.queryByText(/of.*match/)).not.toBeInTheDocument();
  });

  // DEC-422 (amendment, wave 59): MAX_SEGMENT_RULES now lives in
  // src/domain/contacts.ts, and this panel declares the cap on its own
  // "Add a rule" affordance -- disabled at the cap, with a quiet line
  // naming it, rather than letting the array grow past what GET
  // /contacts?rules= will actually accept.
  it('"Add a rule" stays enabled and no cap line shows below the rule cap', () => {
    const rules: SegmentRule[] = Array.from({ length: MAX_SEGMENT_RULES - 1 }, () => ({
      field: 'company' as const,
      op: 'eq' as const,
      value: 'Acme',
    }));
    render(<FilterRulesPanel rules={rules} onChange={noop} matchCount={1} totalCount={10} onSaveAsSegment={noop} />);
    expect(screen.getByRole('button', { name: 'Add a rule' })).not.toBeDisabled();
    expect(screen.queryByText(`Up to ${MAX_SEGMENT_RULES} rules.`)).not.toBeInTheDocument();
  });

  it('"Add a rule" disables at MAX_SEGMENT_RULES and shows a quiet cap line naming it', () => {
    const rules: SegmentRule[] = Array.from({ length: MAX_SEGMENT_RULES }, () => ({
      field: 'company' as const,
      op: 'eq' as const,
      value: 'Acme',
    }));
    render(<FilterRulesPanel rules={rules} onChange={noop} matchCount={1} totalCount={10} onSaveAsSegment={noop} />);
    expect(screen.getByRole('button', { name: 'Add a rule' })).toBeDisabled();
    expect(screen.getByText(`Up to ${MAX_SEGMENT_RULES} rules.`)).toBeInTheDocument();
  });

  it('"Add a rule" renders as a tertiary link, not a bordered button', () => {
    render(<FilterRulesPanel rules={[]} onChange={noop} matchCount={0} totalCount={0} onSaveAsSegment={noop} />);
    const addRule = screen.getByRole('button', { name: 'Add a rule' });
    expect(addRule.className).toContain('chq-btn-tertiary');
    expect(addRule.className).not.toContain('chq-contacts-add-rule');
  });
});

// contacts.css: one eyebrow, one control tier (DEC-868 amendment, wave 45).
// The caption is a section-label eyebrow (uppercase + tracking) and the
// tertiary "Add a rule" control declares no border of its own, so this row
// never grows a third hand-styled control tier.
describe('contacts.css: filter-rules row has one eyebrow, one control tier', () => {
  it('the caption rule is an uppercase, letterspaced eyebrow', () => {
    const body = topLevelRuleBody(CSS, '.chq-contacts-filter-rules-caption');
    expect(body).toMatch(/text-transform:\s*uppercase/);
    expect(body).toMatch(/letter-spacing:\s*\S+/);
  });

  it('the dashed .chq-contacts-add-rule tier is gone', () => {
    expect(CSS).not.toMatch(/\.chq-contacts-add-rule\s*\{/);
  });

  // DEC-406 amendment (wave 47): .chq-btn-tertiary now declares its own
  // `border: none` explicitly (rather than relying on the UA default being
  // absent) so a bare tertiary control never picks up the browser's
  // `2px outset ButtonBorder`.
  it('.chq-btn-tertiary (the "Add a rule" control) declares border: none, not a bordered look', () => {
    const body = topLevelRuleBody(SHARED_CSS, '.chq-btn-tertiary');
    expect(body).toMatch(/border:\s*none/);
  });
});
