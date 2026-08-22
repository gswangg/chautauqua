// src/decisions-data/DEC-919.md (wave-16 r4 amendment): the 390 chip strip's
// caption slot carries the truth about the strip, in two directions. It
// stands down when `activeRules(rules)` is empty rather than asserting "All
// of" over nothing (per docs/design/Chautauqua Contacts.dc.html, lines
// 188-189: `All of` heads a non-empty `sc-for` run over
// `{{ activeRules }}`), and it carries a SECOND cap caption --
// `.chq-contacts-filter-chipstrip-cap` -- when the strip's own `+ Rule`
// control has hit MAX_SEGMENT_RULES, because the desktop cap explanation
// (`.chq-contacts-filter-rules-cap`) lives inside the row that is
// `display:none` at 390 while the builder is closed. This suite follows
// FilterRulesPanel.ruleChips.render.test.tsx's shape.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { FilterRulesPanel } from './FilterRulesPanel';
import { MAX_SEGMENT_RULES } from '../../lib/domain-caps';
import type { SegmentRule } from './types';

afterEach(() => {
  cleanup();
});

const noop = () => {};

function makeRules(n: number): SegmentRule[] {
  return Array.from({ length: n }, (_, i) => ({
    field: 'company',
    op: 'eq' as const,
    value: `v${i}`,
  }));
}

describe('FilterRulesPanel chip strip caption slot (src/decisions-data/DEC-919.md wave-16 r4)', () => {
  it('with zero rules, renders no chipstrip-caption node', () => {
    render(<FilterRulesPanel rules={[]} onChange={noop} matchCount={0} totalCount={null} onSaveAsSegment={noop} />);
    expect(document.querySelector('.chq-contacts-filter-chipstrip-caption')).toBeNull();
  });

  it('with one active rule, the caption exists and reads "All of"', () => {
    const rules: SegmentRule[] = [{ field: 'company', op: 'eq', value: 'Acme' }];
    render(<FilterRulesPanel rules={rules} onChange={noop} matchCount={1} totalCount={null} onSaveAsSegment={noop} />);
    const caption = document.querySelector('.chq-contacts-filter-chipstrip-caption');
    expect(caption).not.toBeNull();
    expect(caption?.textContent).toBe('All of');
  });

  it('with one rule whose value is blank (activeRules empty), the caption is still absent -- gated on activeRules, not rules.length', () => {
    const rules: SegmentRule[] = [{ field: 'company', op: 'eq', value: '' }];
    render(<FilterRulesPanel rules={rules} onChange={noop} matchCount={0} totalCount={null} onSaveAsSegment={noop} />);
    expect(document.querySelector('.chq-contacts-filter-chipstrip-caption')).toBeNull();
  });

  it('at MAX_SEGMENT_RULES, a chipstrip-cap node exists inside the chip strip and precedes the + Rule button in DOM order', () => {
    const rules = makeRules(MAX_SEGMENT_RULES);
    render(<FilterRulesPanel rules={rules} onChange={noop} matchCount={0} totalCount={null} onSaveAsSegment={noop} />);
    const strip = document.querySelector('.chq-contacts-filter-chipstrip');
    expect(strip).not.toBeNull();
    const cap = strip!.querySelector('.chq-contacts-filter-chipstrip-cap');
    const addChip = strip!.querySelector('.chq-contacts-filter-add-chip');
    expect(cap).not.toBeNull();
    expect(addChip).not.toBeNull();
    expect(cap!.textContent).toBe(`Up to ${MAX_SEGMENT_RULES} rules.`);
    // Node.DOCUMENT_POSITION_FOLLOWING (4): addChip follows cap.
    // eslint-disable-next-line no-bitwise
    expect(cap!.compareDocumentPosition(addChip!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('below the cap, the chipstrip-cap node is absent', () => {
    const rules = makeRules(MAX_SEGMENT_RULES - 1);
    render(<FilterRulesPanel rules={rules} onChange={noop} matchCount={0} totalCount={null} onSaveAsSegment={noop} />);
    expect(document.querySelector('.chq-contacts-filter-chipstrip-cap')).toBeNull();
  });
});

describe('contacts.css source scan (src/decisions-data/DEC-919.md wave-16 r4): chipstrip-cap default + terminal phone rule', () => {
  const CSS_PATH = join(dirname(fileURLToPath(import.meta.url)), 'contacts.css');
  const css = readFileSync(CSS_PATH, 'utf8');

  it('carries a bare top-level `display: none` default outside any media block', () => {
    const mediaFree = css.replace(/@media[^{]*\{[\s\S]*$/, '');
    expect(mediaFree).toMatch(/\.chq-contacts-filter-chipstrip-cap\s*\{\s*display:\s*none;\s*\}/);
  });

  it('carries a rule inside the single terminal @media (max-width: 700px) block', () => {
    // Matches only actual block-opener sites (`@media (...) {`), not the
    // string's appearance inside prose comments elsewhere in the file.
    const mediaOpeners = css.match(/@media \(max-width: 700px\)\s*\{/g) ?? [];
    expect(mediaOpeners.length).toBe(1);
    const mediaIndex = css.search(/@media \(max-width: 700px\)\s*\{/);
    const mediaBlock = css.slice(mediaIndex);
    expect(mediaBlock).toMatch(/\.chq-contacts-filter-chipstrip-cap\s*\{[^}]*display:\s*flex;/);
  });

  it('cites the design frame at line 188 with a verbatim backtick-quoted literal from that line', () => {
    expect(css).toMatch(/docs\/design\/Chautauqua\s+Contacts\.dc\.html:188/);
    const flat = css.replace(/\s+/g, ' ');
    const frameLine188 = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..', 'docs', 'design', 'Chautauqua Contacts.dc.html'),
      'utf8'
    ).split('\n')[187]!;
    // The frame's declaration-list slice cited in the CSS comments, verbatim
    // (whitespace-normalised) and backtick-quoted.
    const literal = frameLine188.match(/font-size:10px[^"]*align-items:center/)![0];
    expect(flat).toContain(`\`${literal.replace(/\s+/g, ' ')}\``);
  });
});
