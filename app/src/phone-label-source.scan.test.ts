// Phone-card label source scan (DEC-937 amendment, wave 24 / task w24-a).
//
// contacts.css keyed the phone card's field labels to column position --
// `td:nth-child(3)::before { content: 'Company'; }` -- while the desktop
// <th> already carried the true string. Any column reorder silently
// mislabels the card; DEC-937's fix is `td[data-label]::before { content:
// attr(data-label) }`, sourcing the label from the cell, never the
// position. This scan generalises the check across every app/src CSS file
// (readdirSync-enumerated, DEC-808 idiom, never a hand-listed manifest):
// inside any `@media` block gated on a max-width breakpoint (a phone/narrow
// reflow), a `::before`/`::after` rule whose selector carries a positional
// pseudo-class (:nth-child, :nth-of-type, :first-child, :last-child) must
// never declare a `content` literal containing a letter. `content:
// attr(...)` is allowed anywhere -- it sources text from the DOM, not a
// position-keyed guess.
//
// Known, documented exception: app/src/pages/submissions/submissions.css's
// `content: '· '` bullet separator (around line 515-517) sits on a
// positional selector inside a max-width block, but it is punctuation only
// -- no letter, so it already passes the regex without an allowlist entry.
// It is named here in prose (DEC-610) as the reason this scan doesn't
// simply ban positional ::before/::after content outright: punctuation
// decoration never carries a column's meaning the way a label string does.
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const HERE = dirname(fileURLToPath(import.meta.url)); // app/src
const REPO_ROOT = join(HERE, '..', '..');

/** Every *.css file under app/src, enumerated rather than named (DEC-808). */
function allAppCssFiles(root: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(root, { withFileTypes: true, recursive: true })) {
    if (!entry.isFile() || !entry.name.endsWith('.css')) continue;
    out.push(join(entry.parentPath, entry.name));
  }
  return out.sort();
}

function stripComments(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, '');
}

/** Extracts the bodies of every top-level `@media (...max-width...) { ... }`
 * block in `text`, matching braces so nested rule blocks don't truncate it. */
function maxWidthMediaBodies(text: string): string[] {
  const bodies: string[] = [];
  const re = /@media[^{]*max-width[^{]*\{/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const bodyStart = m.index + m[0].length;
    let depth = 1;
    let i = bodyStart;
    for (; i < text.length && depth > 0; i++) {
      if (text[i] === '{') depth++;
      else if (text[i] === '}') depth--;
    }
    bodies.push(text.slice(bodyStart, i - 1));
  }
  return bodies;
}

const POSITIONAL_PSEUDO = /:(nth-child|nth-of-type|first-child|last-child)\(?[^{},]*\)?/;

/** Splits a CSS block into { selector, declarations } rule records (one
 * level deep -- callers pass an already-extracted @media body). */
function ruleRecords(block: string): Array<{ selector: string; declarations: string }> {
  const out: Array<{ selector: string; declarations: string }> = [];
  const re = /([^{}]+)\{([^{}]*)\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(block)) !== null) {
    out.push({ selector: m[1]!.trim(), declarations: m[2]! });
  }
  return out;
}

/** A `content:` value from `declarations`, if any (the raw quoted/attr text). */
function contentValues(declarations: string): string[] {
  const out: string[] = [];
  const re = /content:\s*([^;]+);/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(declarations)) !== null) {
    out.push(m[1]!.trim());
  }
  return out;
}

function offendingRules(text: string): Array<{ selector: string; content: string }> {
  const offenders: Array<{ selector: string; content: string }> = [];
  for (const body of maxWidthMediaBodies(text)) {
    for (const { selector, declarations } of ruleRecords(body)) {
      if (!POSITIONAL_PSEUDO.test(selector)) continue;
      if (!/::(before|after)/.test(selector)) continue;
      for (const value of contentValues(declarations)) {
        if (value.startsWith('attr(')) continue; // sourced from the DOM, always allowed
        if (/[A-Za-z]/.test(value)) offenders.push({ selector, content: value });
      }
    }
  }
  return offenders;
}

describe('phone-card label source scan (DEC-937 wave-24)', () => {
  const files = allAppCssFiles(HERE).map((path) => ({ label: relative(REPO_ROOT, path), path }));

  it('scans a non-trivial number of files (vacuous-scan tripwire)', () => {
    expect(files.length).toBeGreaterThan(5);
  });

  it('flags a synthetic positional letter-bearing content literal (positive control)', () => {
    const css = `
      @media (max-width: 700px) {
        .x tbody td:nth-child(3)::before { content: 'Company'; }
      }
    `;
    expect(offendingRules(css)).toHaveLength(1);
  });

  it('does not flag attr()-sourced content on a positional selector (negative control)', () => {
    const css = `
      @media (max-width: 700px) {
        .x tbody td[data-label]:last-child::before { content: attr(data-label); }
      }
    `;
    expect(offendingRules(css)).toHaveLength(0);
  });

  it('does not flag punctuation-only content on a positional selector (negative control, DEC-610 shape)', () => {
    const css = `
      @media (max-width: 700px) {
        .x tbody td:nth-child(2)::before { content: '· '; }
      }
    `;
    expect(offendingRules(css)).toHaveLength(0);
  });

  it('no positional ::before/::after rule inside a max-width media block declares a letter-bearing content literal', () => {
    const offenders: string[] = [];
    for (const { label, path } of files) {
      const text = stripComments(readFileSync(path, 'utf-8'));
      for (const { selector, content } of offendingRules(text)) {
        offenders.push(`${label}: ${selector} { content: ${content} }`);
      }
    }
    expect(
      offenders,
      `positional ::before/::after content literals inside a max-width media block (source the text from the cell, e.g. data-label + attr(), not from column position):\n${offenders.join('\n')}`,
    ).toEqual([]);
  });
});
