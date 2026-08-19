// v12m-w1-c (DEC-919 amendment wave 98): "Merge · 390"
// docs/design/Chautauqua Contacts.dc.html:522-539 — four phone-only
// copy/geometry divergences from the desktop "Duplicates · merge" surface,
// all confined to a max-width block (DEC-385) or a span the desktop keeps
// visible. Every assertion below carries a DEC-976 receipt: a
// backtick-quoted VERBATIM literal from the cited frame line, and a real
// `expect(` within 6 source lines beneath the comment.
//
// jsdom applies no stylesheet and evaluates no @media rule (mirroring
// contacts-phone-frames.test.ts and shell-geometry.test.ts), so these are
// source-scan pins over MergePage.tsx's JSX text and contacts-panels.css's
// CSS text, not computed style.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const HERE = dirname(fileURLToPath(import.meta.url));

const TSX = readFileSync(join(HERE, 'MergePage.tsx'), 'utf-8');

/** Comments stripped before any brace scanning -- a literal `{`/`}` inside
 * a long explanatory comment would desynchronise a depth counter and
 * silently truncate a block (mirrors contacts-phone-frames.test.ts's
 * `read()`). */
function readCss(): string {
  return readFileSync(join(HERE, 'contacts-panels.css'), 'utf-8').replace(/\/\*[\s\S]*?\*\//g, '');
}

const CSS = readCss();

/** Concatenated bodies of every `@media (max-width: …)` block in the
 * sheet, brace-matched so a nested rule's own `}` can never end the block
 * early. */
function phoneLayer(css: string): string {
  const out: string[] = [];
  const opener = /@media\s*\(max-width:\s*\d+px\)\s*\{/g;
  let m: RegExpExecArray | null;
  while ((m = opener.exec(css)) !== null) {
    let depth = 1;
    let i = m.index + m[0].length;
    const start = i;
    while (i < css.length && depth > 0) {
      if (css[i] === '{') depth += 1;
      else if (css[i] === '}') depth -= 1;
      i += 1;
    }
    if (depth !== 0) throw new Error('unbalanced @media block');
    out.push(css.slice(start, i - 1));
  }
  if (out.length === 0) throw new Error('no max-width media block found');
  return out.join('\n');
}

/** Every rule body, by selector, inside the phone layer (whole-member
 * selector-list match, not substring), concatenated in source order. The
 * sheet's earlier phone block (:828/:1254, out of this task's scope) and
 * its terminal block (this task's scope, per DEC-385 wave-98 "the terminal
 * block IS terminal — write inside it") can both declare the same
 * selector; joining rather than returning-first is what lets an assertion
 * find a declaration wherever in the phone layer it actually landed. */
function phoneRule(css: string, selector: string): string {
  const layer = phoneLayer(css);
  const rule = /([^{}]+)\{([^{}]*)\}/g;
  const bodies: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = rule.exec(layer)) !== null) {
    const selectors = m[1]!
      .split(',')
      .map((s) => s.trim().replace(/\s+/g, ' '))
      .filter(Boolean);
    if (selectors.includes(selector)) bodies.push(m[2]!);
  }
  if (bodies.length === 0) throw new Error(`no phone rule for ${selector}`);
  return bodies.join('\n');
}

/** A selector's rule body OUTSIDE any @media block -- the unconditional
 * top-level default the terminal phone block overrides (mirrors
 * contacts-phone-frames.test.ts's `stripAnyMedia`). */
function topLevelRule(css: string, selector: string): string {
  let stripped = '';
  let i = 0;
  const opener = /@media[^{]*\{/g;
  let m: RegExpExecArray | null;
  while ((m = opener.exec(css)) !== null) {
    stripped += css.slice(i, m.index);
    let depth = 1;
    let j = m.index + m[0].length;
    while (j < css.length && depth > 0) {
      if (css[j] === '{') depth += 1;
      else if (css[j] === '}') depth -= 1;
      j += 1;
    }
    i = j;
    opener.lastIndex = j;
  }
  stripped += css.slice(i);
  const rule = /([^{}]+)\{([^{}]*)\}/g;
  while ((m = rule.exec(stripped)) !== null) {
    const selectors = m[1]!
      .split(',')
      .map((s) => s.trim().replace(/\s+/g, ' '))
      .filter(Boolean);
    if (selectors.includes(selector)) return m[2]!;
  }
  throw new Error(`no top-level rule for ${selector}`);
}

describe('v12 phone frame "Merge · 390" (docs/design/Chautauqua Contacts.dc.html:522-539)', () => {
  // docs/design/Chautauqua Contacts.dc.html:524 `<a href="#" style="font-size:13px; font-weight:700; min-height:44px; display:flex; align-items:center">‹ Duplicates</a>`
  it('back link: ONE anchor, the "Contacts · " prefix is its own span, hidden only at <=700px', () => {
    expect(TSX).toMatch(
      /<Link[^>]*className="chq-contacts-merge-back"[^>]*>\s*&lsaquo;\s*<span className="chq-contacts-merge-back-prefix">Contacts &middot; <\/span>Duplicates\s*<\/Link>/,
    );
    // Never a second Link/anchor for the phone case -- ONE <Link>, reused
    // for both the loaded and empty-state branches via the `backLink` const.
    expect(TSX.match(/<Link\b/g)?.length).toBe(1);
    expect(phoneRule(CSS, '.chq-contacts-merge-back-prefix')).toMatch(/display:\s*none/);
  });

  // docs/design/Chautauqua Contacts.dc.html:526 `<span style="font-size:13px; color:#565A4B">1 of 6 pairs · Marcus Okafor</span>`
  it('head subtitle: the pair-count line appends " · <kept name>" as a phone-only suffix span', () => {
    expect(TSX).toMatch(
      /chq-contacts-merge-pair-count-name">\s*\{' '\}\s*&middot; \{keepContact\.firstName\} \{keepContact\.lastName\}/,
    );
    expect(topLevelRule(CSS, '.chq-contacts-merge-pair-count-name')).toMatch(/display:\s*none/);
    expect(phoneRule(CSS, '.chq-contacts-merge-pair-count-name')).toMatch(/display:\s*inline/);
  });

  // docs/design/Chautauqua Contacts.dc.html:537 `...>Merge them</span>`
  it('footer primary: ONE button, two spans -- "Merge them" shows only at <=700px, the named desktop label hides there', () => {
    expect(TSX).toMatch(/<span className="chq-contacts-merge-primary-phone-label">Merge them<\/span>/);
    // Exactly one onClick={() => setConfirmOpen(true)} trigger -- never a
    // second button wired to doMerge.
    expect(TSX.match(/setConfirmOpen\(true\)/g)?.length).toBe(1);
    expect(topLevelRule(CSS, '.chq-contacts-merge-primary-phone-label')).toMatch(/display:\s*none/);
    expect(phoneRule(CSS, '.chq-contacts-merge-primary-phone-label')).toMatch(/display:\s*inline/);
    expect(phoneRule(CSS, '.chq-contacts-merge-primary-desktop-label')).toMatch(/display:\s*none/);
  });

  // docs/design/Chautauqua Contacts.dc.html:538 `<span style="border:1px solid #BAB6A6; border-radius:6px; ...">Not a duplicate</span>`
  it('footer secondary: "Not a duplicate" gets the frame\'s bordered treatment only at <=700px, desktop keeps the text link', () => {
    const phone = phoneRule(CSS, '.chq-contacts-merge-not-duplicate');
    expect(phone).toMatch(/border:\s*1px solid var\(--chq-border\)/);
    expect(phone).toMatch(/border-radius:\s*var\(--chq-r-ctl-phone\)/);
    // Desktop's borderless text-link rule (DEC-992) is untouched.
    expect(topLevelRule(CSS, '.chq-contacts-merge-not-duplicate')).toMatch(/border:\s*none/);
  });

  it('DEC-385: every rule above lives only inside a max-width media query, never a min-width one', () => {
    expect(CSS).not.toMatch(/@media\s*\(min-width/);
  });
});
