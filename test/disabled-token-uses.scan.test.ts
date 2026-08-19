// Design pack v12 (docs/design/DESIGN-RULINGS.md, "Disabled: #8E8A7A on a
// #DDD8C8 border ... has exactly TWO legal uses"): the Disabled register is
// an INERT CONTROL (a pager arrow with no page to go to, a Remove at its
// lower bound) or a DRAG HANDLE (the ⋮⋮ glyph, which is chrome, not
// content). Nothing else — never placeholder text, never de-emphasis, never
// a "finished" or "empty" value. The pair fails the 4.5 floor at 3.06:1 on
// paper (the token has since been darkened to #7D7869 for the 3:1
// disabled-control exemption — see test/contrast-tokens.test.ts — but the
// exemption is the CONTROL exemption, so it still cannot carry meaning),
// and the ruling records that this token escaped into three separate
// designs in consecutive rounds, each time as "the quiet version of
// something". De-emphasis is weight, not lightness: 600 at --chq-muted
// (#565A4B, 6.28:1).
//
// So the rule is enumerable, and this scan enumerates it: EVERY CSS rule
// that composes var(--chq-disabled) or var(--chq-disabled-bg) must be a
// named legal use below. A fourth escape cannot land unnoticed.
//
// DEC-808: directory walk, never a hand-listed manifest of stylesheets —
// the same collector test/display-heading-line-height.scan.test.ts uses, so
// a new page's CSS is covered the moment it exists.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, '..');

function walk(dir: string, out: string[]): void {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === 'dist' || entry === '.git') continue;
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      walk(full, out);
    } else if (entry.endsWith('.css') || entry.endsWith('.css.ts')) {
      out.push(full);
    }
  }
}

function collectStylesheets(): string[] {
  const files: string[] = [];
  walk(join(REPO_ROOT, 'app', 'src'), files);
  walk(join(REPO_ROOT, 'src'), files);
  const themeTs = join(REPO_ROOT, 'src', 'views', 'theme.ts');
  if (!files.includes(themeTs)) files.push(themeTs);
  return files;
}

function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '');
}

/** Same `{selector, body}` parser the sibling stylesheet scans use. Rules
 * nested in an @media block are picked up as their own inner rule. */
function parseRules(css: string): Array<{ selector: string; body: string }> {
  const rules: Array<{ selector: string; body: string }> = [];
  const ruleRe = /([^{}]+)\{([^{}]*)\}/g;
  let m: RegExpExecArray | null;
  while ((m = ruleRe.exec(css)) !== null) {
    const selector = m[1]!.trim().replace(/\s+/g, ' ');
    if (selector.startsWith('@') || selector === '') continue;
    rules.push({ selector, body: m[2]! });
  }
  return rules;
}

const DISABLED_TOKEN_RE = /var\(--chq-disabled(?:-bg)?\)/;

/** Every selector allowed to compose the Disabled register, each with the
 * legal use it falls under. Adding a row here is a design decision, not a
 * test fix: it must be an inert control or a drag handle. */
const LEGAL_USES: Record<string, string> = {
  // --- inert controls: the shared button/link tiers -------------------
  "button:disabled, .chq-btn:disabled, button[aria-disabled=true], .chq-btn[aria-disabled=true]":
    'inert control — the SSR theme\'s disabled button tiers (B8)',
  "button:disabled:hover, .chq-btn:disabled:hover, button[aria-disabled=true]:hover, .chq-btn[aria-disabled=true]:hover, button:disabled:active, .chq-btn:disabled:active, button[aria-disabled=true]:active, .chq-btn[aria-disabled=true]:active":
    'inert control — the same tiers holding rest colour through hover/active',
  ".chq-btn:disabled, .chq-btn[aria-disabled='true']": 'inert control — the SPA\'s disabled button tiers (B8)',
  ".chq-btn:disabled:hover, .chq-btn[aria-disabled='true']:hover, .chq-btn:disabled:active, .chq-btn[aria-disabled='true']:active":
    'inert control — the same tiers holding rest colour through hover/active',
  '.chq-link-button:disabled, .chq-link-button:disabled:hover':
    "inert control — the ruling's own example, a Remove at its lower bound",

  // --- inert controls: per-page ---------------------------------------
  '.chq-comms-preview-nav button:disabled':
    "inert control — the ruling's own example, a pager arrow with no page to go to",
  ".chq-review-add-link[aria-disabled='true']":
    'inert control — Add criterion at the soft cap; pointer-events:none beside it',
  '.chq-review-field-disabled':
    'inert control — the anonymise checkbox frozen once a review is submitted (input[disabled])',
  '.chq-review-field-disabled .chq-review-checkbox-label':
    "inert control — that same frozen checkbox's own label; the caption beside it sets --chq-muted itself",
  '.chq-detail-session-details-fields #submission-format:disabled, .chq-detail-session-details-fields #submission-audience-level:disabled':
    'inert control — selects genuinely disabled when the form carries no field of the role',
  '.chq-submissions-clone:disabled': 'inert control — Clone with nothing clonable',
  '.chq-portal-preview-download':
    'inert control — the preview page\'s Download carries `disabled aria-disabled="true"` (src/routes/portal/preview.tsx)',

  // --- drag handles ----------------------------------------------------
  // (none compose the token today: .chq-forms-field-drag and the PlanEditor
  // handle both draw --chq-muted, which is stricter than the ruling
  // requires. Legal either way — the row stays here so the second legal use
  // is visible in the enumeration rather than implied by its absence.)
};

/** Escapes that are real but sit in another lane's files. Subset, not
 * equality: fixing one must not turn this suite red for the lane that fixed
 * it — delete the row in the same change. A NEW escape still fails loudly,
 * which is the whole point of the scan. */
const KNOWN_ESCAPES_OTHER_LANE: Record<string, string> = {
  '.chq-speakers-cell-none':
    'empty value ("—" for a speaker with no assignment of that task) — a v12 violation owned by the speakers-grid lane (app/src/pages/speakers/speakers.css)',
};

interface Hit {
  file: string;
  selector: string;
}

function scan(): Hit[] {
  const hits: Hit[] = [];
  for (const file of collectStylesheets()) {
    const src = stripComments(readFileSync(file, 'utf-8'));
    const rel = relative(REPO_ROOT, file);
    for (const { selector, body } of parseRules(src)) {
      if (!DISABLED_TOKEN_RE.test(body)) continue;
      hits.push({ file: rel, selector });
    }
  }
  return hits;
}

describe('the Disabled register has exactly two legal uses (design pack v12)', () => {
  it('scans a non-trivial rule population (tripwire: a dead regex must fail loudly, not go quiet)', () => {
    expect(scan().length).toBeGreaterThanOrEqual(10);
  });

  it('every rule composing --chq-disabled / --chq-disabled-bg is a named inert control or drag handle', () => {
    const unaccounted = scan()
      .filter((h) => !(h.selector in LEGAL_USES) && !(h.selector in KNOWN_ESCAPES_OTHER_LANE))
      .map((h) => `${h.file}: ${h.selector}`);
    expect(
      unaccounted,
      `The Disabled token is for inert controls and drag handles only. De-emphasis is weight, not lightness: 600 at var(--chq-muted).\n${unaccounted.join('\n')}`,
    ).toEqual([]);
  });

  it('no LEGAL_USES row is dead (a stale allowlist hides the next escape)', () => {
    const live = new Set(scan().map((h) => h.selector));
    const dead = Object.keys(LEGAL_USES).filter((sel) => !live.has(sel));
    expect(dead, dead.join('\n')).toEqual([]);
  });

  it('negative control: a synthetic de-emphasis rule IS flagged', () => {
    const synthetic = `.chq-synthetic-quiet-value { font-size: 11px; color: var(--chq-disabled); }`;
    const rules = parseRules(synthetic).filter((r) => DISABLED_TOKEN_RE.test(r.body));
    expect(rules).toHaveLength(1);
    expect(rules[0]!.selector in LEGAL_USES).toBe(false);
  });

  it('the two converted escapes now read in the de-emphasis register (600 at --chq-muted), not the disabled one', () => {
    const settings = stripComments(
      readFileSync(join(REPO_ROOT, 'app', 'src', 'pages', 'settings', 'settings.css'), 'utf-8'),
    );
    const hint = parseRules(settings).find(
      (r) => r.selector === '.chq-settings-people-actions .chq-settings-row-hint',
    );
    expect(hint).toBeDefined();
    expect(hint!.body).toMatch(/color:\s*var\(--chq-muted\)/);
    expect(hint!.body).toMatch(/font-weight:\s*600/);

    const contacts = stripComments(
      readFileSync(join(REPO_ROOT, 'app', 'src', 'pages', 'contacts', 'contacts-panels.css'), 'utf-8'),
    );
    const skip = parseRules(contacts).find((r) => r.selector === '.chq-contacts-import-preview-cell-skip');
    expect(skip).toBeDefined();
    expect(skip!.body).toMatch(/color:\s*var\(--chq-muted\)/);
    expect(skip!.body).toMatch(/font-weight:\s*600/);
  });
});
