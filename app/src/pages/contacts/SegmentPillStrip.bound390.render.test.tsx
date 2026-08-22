// SegmentPillStrip 390 bound + stand-down coverage (task v12m-w16-ui-r4-d,
// src/decisions-data/DEC-678.md, src/decisions-data/DEC-919.md). Two
// defects: (1) an unbounded user-supplied segment name can push the whole
// strip off screen at 390, bounded by a shared truncation register in
// contacts.css; (2) a settled-empty strip renders a lone inert `All`
// pill that asserts a choice the data cannot offer, so the component
// stands down (renders null) once `segmentsLoaded` is true and the
// segments array is empty.
import type { ComponentProps } from 'react';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { SegmentPillStrip } from './SegmentPillStrip';
import type { Segment } from './types';

afterEach(() => {
  cleanup();
});

const SEGMENTS: Segment[] = [
  { id: 'seg1', name: 'Speakers', rules: [{ field: 'role', op: 'eq', value: 'speaker' }], count: 41 },
];

function renderStrip(overrides: Partial<ComponentProps<typeof SegmentPillStrip>> = {}) {
  return render(
    <SegmentPillStrip
      segments={SEGMENTS}
      segmentsLoaded
      segmentId=""
      onApplySegment={vi.fn()}
      {...overrides}
    />,
  );
}

describe('SegmentPillStrip (390 stand-down, src/decisions-data/DEC-678.md)', () => {
  it('segmentsLoaded true with an empty segments array renders nothing', () => {
    const { container } = renderStrip({ segmentsLoaded: true, segments: [] });
    expect(container.firstChild).toBeNull();
  });

  it('segmentsLoaded false with an empty array still renders the strip and its All pill', () => {
    const { container } = renderStrip({ segmentsLoaded: false, segments: [] });
    expect(container.firstChild).not.toBeNull();
    expect(screen.getByText('All')).toBeInTheDocument();
  });

  it('one segment renders both the All pill and the segment pill', () => {
    renderStrip({ segments: SEGMENTS });
    expect(screen.getByText('All')).toBeInTheDocument();
    expect(screen.getByText('Speakers · 41')).toBeInTheDocument();
  });
});

// Source-scan half over contacts.css (src/decisions-data/DEC-919.md): the
// `.chq-contacts-segment-pills .chq-pill` bound rule lives inside the
// single terminal `@media (max-width: 700px)` block, declares
// `overflow: hidden` and `text-overflow: ellipsis`, and the shared
// `.chq-pill` token is never redeclared bare anywhere in this sheet.
const HERE = dirname(fileURLToPath(import.meta.url));
const CSS_PATH = join(HERE, 'contacts.css');
const CSS = readFileSync(CSS_PATH, 'utf-8');

const MEDIA_HEADER = '@media (max-width: 700px)';

function stripComments(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));
}

function normalise(s: string): string {
  return s.trim().replace(/\s+/g, ' ');
}

function findTerminalMediaBlockBody(css: string): { start: number; end: number } {
  const clean = stripComments(css);
  const ranges: { start: number; end: number }[] = [];
  let depth = 0;
  let headerStart = 0;
  let pendingMediaOpen = -1;
  for (let i = 0; i < clean.length; i++) {
    const c = clean[i];
    if (c === '{') {
      if (depth === 0 && normalise(clean.slice(headerStart, i)) === MEDIA_HEADER) {
        pendingMediaOpen = i + 1;
      }
      depth += 1;
      headerStart = i + 1;
    } else if (c === '}') {
      depth -= 1;
      if (depth < 0) throw new Error('unbalanced braces (unmatched })');
      if (depth === 0 && pendingMediaOpen !== -1) {
        ranges.push({ start: pendingMediaOpen, end: i });
        pendingMediaOpen = -1;
      }
      headerStart = i + 1;
    }
  }
  if (depth !== 0) throw new Error('unbalanced braces at EOF');
  if (ranges.length === 0) throw new Error(`no top-level ${MEDIA_HEADER} block found in ${CSS_PATH}`);
  return ranges[ranges.length - 1]!;
}

describe('contacts.css: segment-pill 46vw truncation bound (src/decisions-data/DEC-919.md)', () => {
  const block = findTerminalMediaBlockBody(CSS);
  const blockBody = CSS.slice(block.start, block.end);

  // The strip's earlier `.chq-contacts-segment-pills .chq-pill` rule
  // (contacts.css, appended in task r1-c) shares this exact selector
  // string but carries no truncation bound -- both `it`s below must
  // match the SECOND occurrence (the one this task appends, carrying
  // `max-width: 46vw`), never the first one a bare selector-only regex
  // would find.
  const boundRuleRe = /\.chq-contacts-segment-pills\s+\.chq-pill\s*\{([^}]*max-width:\s*46vw[^}]*)\}/;

  it('declares the .chq-contacts-segment-pills .chq-pill truncation bound inside the terminal block', () => {
    // docs/design/Chautauqua Contacts.dc.html:196 draws this pill:
    // `Speakers · 41`
    expect(blockBody).toMatch(boundRuleRe);
  });

  it('the bound rule declares overflow: hidden and text-overflow: ellipsis', () => {
    // docs/design/Chautauqua Contacts.dc.html:196 draws this pill:
    // `Speakers · 41`
    const match = boundRuleRe.exec(blockBody);
    expect(match).not.toBeNull();
    const body = match![1]!;
    expect(body).toMatch(/overflow:\s*hidden/);
    expect(body).toMatch(/text-overflow:\s*ellipsis/);
  });

  // A bare declaration is `.chq-pill` used as the WHOLE selector -- the
  // nearest non-whitespace character before it (walking back to a
  // selector-list boundary) is `{`, `}`, `,`, or start-of-file, with only
  // whitespace in between. A descendant/compound use like
  // `.chq-contacts-segment-pills .chq-pill {` has a class token in that
  // gap and does not match.
  it('never redeclares the shared .chq-pill token bare anywhere in this sheet', () => {
    const clean = stripComments(CSS);
    const bareRe = /(^|[{},])\s*\.chq-pill\s*\{/g;
    const offenders: string[] = [];
    let m: RegExpExecArray | null;
    while ((m = bareRe.exec(clean)) !== null) {
      offenders.push(clean.slice(Math.max(0, m.index - 40), m.index + 20));
    }
    // docs/design/Chautauqua Contacts.dc.html:196 draws this pill:
    // `Speakers · 41`
    expect(offenders).toEqual([]);
  });
});
