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
import { DEC_367, DEC_745 } from '../src/decisions';

void DEC_367; // wave-87 amendment: the two-legal-uses scan below extends to phone (<=700px) blocks
void DEC_745; // wave-100 amendment: the checkbox/radio :disabled inert-control accounts below

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
  "input[type='checkbox']:disabled, input[type='radio']:disabled":
    'inert control — a checkbox/radio that cannot be toggled (B8); the SPA styles.css spelling with quoted attribute values (DEC-745 wave-100 amendment)',
  'input[type=checkbox]:disabled, input[type=radio]:disabled':
    'inert control — a checkbox/radio that cannot be toggled (B8); the SSR theme.ts spelling with unquoted attribute values (DEC-745 wave-100 amendment)',

  // --- drag handles ----------------------------------------------------
  // (none compose the token today: .chq-forms-field-drag and the PlanEditor
  // handle both draw --chq-muted, which is stricter than the ruling
  // requires. Legal either way — the row stays here so the second legal use
  // is visible in the enumeration rather than implied by its absence.)
};

/** File-bound subset of LEGAL_USES for accounts that name a SPECIFIC
 * stylesheet, not just a selector -- DEC-745 wave-100 amendment. A plain
 * selector-only allowlist (the `no LEGAL_USES row is dead` check below)
 * cannot tell two files apart if they ever shared a selector string; this
 * ties each of the two checkbox/radio accounts to its own file so the
 * stale-account tripwire (mirroring
 * app/src/phone-horizontal-overflow.scan.test.ts's STALE_EXEMPTIONS shape)
 * can say exactly which file a dead account belonged to. The reason text
 * itself is single-sourced from LEGAL_USES -- never duplicated here. */
const NAMED_FILE_ACCOUNTS: Array<{ file: string; selector: string }> = [
  {
    file: 'app/src/styles.css',
    selector: "input[type='checkbox']:disabled, input[type='radio']:disabled",
  },
  {
    file: 'src/views/theme.ts',
    selector: 'input[type=checkbox]:disabled, input[type=radio]:disabled',
  },
];

/** Escapes that are real but sit in another lane's files. Subset, not
 * equality: fixing one must not turn this suite red for the lane that fixed
 * it — delete the row in the same change. A NEW escape still fails loudly,
 * which is the whole point of the scan. */
// Emptied by the speakers-grid lane: .chq-speakers-cell-none now reads
// 600/var(--chq-muted) like every other resting state. Kept as an empty map
// rather than deleted so the dead-allowlist tripwire below keeps a subject.
const KNOWN_ESCAPES_OTHER_LANE: Record<string, string> = {};

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

// ---------------------------------------------------------------------------
// DEC-367 (wave-87 amendment): the two-legal-uses rule extended to phone.
// Population gains every rule inside a `@media (max-width: <=700px)` block
// across app/src/**/*.css and src/**/*.css.ts. A use there is legal ONLY
// when its selector resolves to an inert control (:disabled / [disabled] /
// [aria-disabled]) or to the codebase's own drag-handle token -- derived
// from the source below, never guessed at by name. Everything else fails,
// carrying the ruling's own sentence (De-emphasis is weight, not lightness:
// 600 at var(--chq-muted)) plus the offending file and selector.
// ---------------------------------------------------------------------------

/** Same directory walk as collectStylesheets, generalised to any extension
 * set so the drag-handle deriver can walk .tsx alongside the .css/.css.ts
 * walk above (DEC-808: a directory walk, never a hand-listed manifest). */
function walkExt(dir: string, exts: string[], out: string[]): void {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === 'dist' || entry === '.git') continue;
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      walkExt(full, exts, out);
    } else if (exts.some((ext) => entry.endsWith(ext))) {
      out.push(full);
    }
  }
}

const DRAG_GLYPH = '⋮⋮'; // ⋮⋮ -- the ruling's own drag-handle example, chrome not content

/** Finds the class name attached to whatever JSX element wraps the ⋮⋮
 * glyph, by reading the source rather than hand-naming
 * `.chq-forms-field-drag`. Walks every .tsx file, takes the LAST
 * `className="..."` occurring before a glyph occurrence with no
 * intervening closing tag (`</`) -- i.e. the nearest className still
 * "open" over that text -- and returns it. Throws if no glyph/className
 * pairing exists anywhere: a dead deriver must fail loudly, not fall back
 * to a guess. */
function deriveDragHandleClass(): string {
  const files: string[] = [];
  walkExt(join(REPO_ROOT, 'app', 'src'), ['.tsx'], files);
  walkExt(join(REPO_ROOT, 'src'), ['.tsx'], files);
  const classAttrRe = /className=["']([\w-]+)["']/g;
  for (const file of files) {
    const src = readFileSync(file, 'utf-8');
    let searchFrom = 0;
    for (;;) {
      const glyphIdx = src.indexOf(DRAG_GLYPH, searchFrom);
      if (glyphIdx === -1) break;
      const windowStart = Math.max(0, glyphIdx - 1500);
      const before = src.slice(windowStart, glyphIdx);
      const lastClose = before.lastIndexOf('</');
      const matches = [...before.matchAll(classAttrRe)];
      const last = matches[matches.length - 1];
      if (last && last.index !== undefined && last.index > lastClose) {
        return last[1]!;
      }
      searchFrom = glyphIdx + DRAG_GLYPH.length;
    }
  }
  throw new Error(
    'deriveDragHandleClass: no className="..." attribute precedes a ⋮⋮ glyph anywhere under app/src or src -- ' +
      'the drag-handle token this scan\'s phone-block legality check relies on could not be derived from source.',
  );
}

function escapeRegExp(literal: string): string {
  return literal.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const INERT_CONTROL_RE = /:disabled\b|\[disabled\]|\[aria-disabled/;

/** A phone-block selector is a legal use only as an inert control or as the
 * derived drag-handle token -- DEC-367's own two clauses, nothing else. */
function isLegalPhoneUse(selector: string, dragClass: string): boolean {
  if (INERT_CONTROL_RE.test(selector)) return true;
  const dragRe = new RegExp(`\\.${escapeRegExp(dragClass)}(?![\\w-])`);
  return dragRe.test(selector);
}

/** Same brace-counting shape as parseRules, but returns the @media
 * condition text alongside each block's body-span (start/end index into
 * the SAME string it was called on), so a phone-scoped hit and a
 * phone-scoped exemption comment can both be checked against the same
 * span without a second copy of the vocabulary. */
function extractMediaBlocks(css: string): Array<{ condition: string; bodyStart: number; bodyEnd: number; body: string }> {
  const blocks: Array<{ condition: string; bodyStart: number; bodyEnd: number; body: string }> = [];
  const re = /@media[^{]*\{/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(css)) !== null) {
    const condition = m[0].slice(0, -1).trim();
    const bodyStart = re.lastIndex;
    let depth = 1;
    let i = bodyStart;
    for (; i < css.length && depth > 0; i++) {
      if (css[i] === '{') depth++;
      else if (css[i] === '}') depth--;
    }
    const bodyEnd = i - 1;
    blocks.push({ condition, bodyStart, bodyEnd, body: css.slice(bodyStart, bodyEnd) });
    re.lastIndex = bodyEnd;
  }
  return blocks;
}

const MAX_WIDTH_RE = /max-width:\s*(\d+)px/;

/** DEC-576's own breakpoint: every phone block in this codebase is written
 * `max-width: 700px` (a handful of 900px tablet blocks exist and are
 * out of scope -- the ruling says "<=700px"). */
function isPhoneCondition(condition: string): boolean {
  const m = MAX_WIDTH_RE.exec(condition);
  return m !== null && parseInt(m[1]!, 10) <= 700;
}

interface PhoneHit {
  file: string;
  selector: string;
  body: string;
}

/** The extended population: every rule inside a phone (<=700px) media
 * block, across the same file set `scan()` above already walks, that
 * composes the Disabled token. */
function scanPhoneHits(): PhoneHit[] {
  const hits: PhoneHit[] = [];
  for (const file of collectStylesheets()) {
    const stripped = stripComments(readFileSync(file, 'utf-8'));
    const rel = relative(REPO_ROOT, file);
    for (const block of extractMediaBlocks(stripped)) {
      if (!isPhoneCondition(block.condition)) continue;
      for (const { selector, body } of parseRules(block.body)) {
        if (!DISABLED_TOKEN_RE.test(body)) continue;
        hits.push({ file: rel, selector, body });
      }
    }
  }
  return hits;
}

interface PhoneExemption {
  file: string;
  reason: string;
  selector: string;
  composesToken: boolean;
  inPhoneBlock: boolean;
}

/** Structural, two-sided exemption comment shape (DEC-948's wave-49 shape,
 * DEC-967 wave-62): `/* PHONE-DISABLED-EXEMPT: <reason> *\/` sitting
 * DIRECTLY above the rule it exempts. Because the regex re-reads whatever
 * rule text currently follows the comment, an exemption cannot silently
 * drift out of sync with the code it excuses the way a separate ledger
 * entry could -- if the rule under it stops composing the token, moves out
 * of a phone block, or turns out to already be a legal use on its own, the
 * comment is flagged stale with an explicit delete-this-line message. */
function findPhoneExemptions(rawByFile: Array<{ file: string; raw: string }>, dragClass: string): PhoneExemption[] {
  const out: PhoneExemption[] = [];
  const exemptRe = /\/\*\s*PHONE-DISABLED-EXEMPT:([\s\S]*?)\*\/\s*([^{}]+)\{([^{}]*)\}/gd;
  for (const { file, raw } of rawByFile) {
    const phoneBlocks = extractMediaBlocks(raw).filter((b) => isPhoneCondition(b.condition));
    const re = new RegExp(exemptRe.source, 'gd');
    let m: RegExpExecArray | null;
    while ((m = re.exec(raw)) !== null) {
      const selector = m[2]!.trim().replace(/\s+/g, ' ');
      const body = m[3]!;
      const indices = (m as unknown as { indices: Array<[number, number]> }).indices;
      const ruleStart = indices[2]![0];
      const inPhoneBlock = phoneBlocks.some((b) => ruleStart >= b.bodyStart && ruleStart < b.bodyEnd);
      out.push({
        file,
        reason: m[1]!.trim(),
        selector,
        composesToken: DISABLED_TOKEN_RE.test(body) && !isLegalPhoneUse(selector, dragClass),
        inPhoneBlock,
      });
    }
  }
  return out;
}

function collectRawStylesheets(): Array<{ file: string; raw: string }> {
  return collectStylesheets().map((file) => ({
    file: relative(REPO_ROOT, file),
    raw: readFileSync(file, 'utf-8'),
  }));
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

  it('no NAMED_FILE_ACCOUNTS row is stale (its selector must still match a rule in its own named file, else: delete this line)', () => {
    const hits = scan();
    const stale = NAMED_FILE_ACCOUNTS.filter(
      (a) => !hits.some((h) => h.file === a.file && h.selector === a.selector),
    );
    expect(
      stale,
      stale
        .map(
          (a) =>
            `${a.file} :: ${a.selector} -- stale named-file account, no longer matches a rule in its named file -- delete this line`,
        )
        .join('\n'),
    ).toEqual([]);
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

const PHONE_RULING_SENTENCE =
  "DEC-367 (design pack v12, DESIGN-RULINGS.md): the Disabled register has exactly two legal uses at phone widths " +
  "too -- an inert control (:disabled / [disabled] / [aria-disabled]) or the codebase's own drag-handle token. " +
  '#8E8A7A on #DDD8C8 "fails the 4.5 floor at 3.06:1 on paper, so anything carrying meaning in it is unreadable by ' +
  'someone who needs the contrast." A phone card has no column for a value to recede into -- that is exactly where ' +
  'the de-emphasis reflex returns. De-emphasis is WEIGHT, not lightness: 800 -> 600 at var(--chq-muted) (#565A4B, ' +
  '6.28:1) is the remedy this rule should have reached for instead.';

describe('DEC-367 (wave-87 amendment): the two legal uses hold inside phone (<=700px) blocks too', () => {
  it('vacuous-population tripwire: the phone-block population is non-empty and contains a known legal use', () => {
    const hits = scanPhoneHits();
    expect(hits.length).toBeGreaterThan(0);
    const dragClass = deriveDragHandleClass();
    expect(hits.some((h) => isLegalPhoneUse(h.selector, dragClass))).toBe(true);
  });

  it('derives the drag-handle token from source rather than a hand-picked name', () => {
    const dragClass = deriveDragHandleClass();
    expect(dragClass.length).toBeGreaterThan(0);
    // sanity: the derived class is a real, still-composing selector fragment
    // somewhere in the stylesheets (it need not appear in the phone
    // population specifically -- only that it resolves to something real).
    const anyStylesheetText = collectStylesheets()
      .map((f) => readFileSync(f, 'utf-8'))
      .join('\n');
    expect(anyStylesheetText.includes(`.${dragClass}`)).toBe(true);
  });

  it('every phone-block rule composing the Disabled token is an inert control, the drag handle, or structurally exempted', () => {
    const dragClass = deriveDragHandleClass();
    const hits = scanPhoneHits();
    const rawByFile = collectRawStylesheets();
    const liveExemptions = findPhoneExemptions(rawByFile, dragClass).filter(
      (e) => e.inPhoneBlock && e.composesToken,
    );
    const offenders = hits.filter((h) => {
      if (isLegalPhoneUse(h.selector, dragClass)) return false;
      return !liveExemptions.some((e) => e.file === h.file && e.selector === h.selector);
    });
    expect(
      offenders,
      offenders.map((o) => `${o.file}: ${o.selector}\n${PHONE_RULING_SENTENCE}`).join('\n\n'),
    ).toEqual([]);
  });

  it('every PHONE-DISABLED-EXEMPT comment still exempts a real, currently-necessary phone offender (no stale lines)', () => {
    const dragClass = deriveDragHandleClass();
    const rawByFile = collectRawStylesheets();
    const exemptions = findPhoneExemptions(rawByFile, dragClass);
    const stale = exemptions.filter((e) => !(e.inPhoneBlock && e.composesToken));
    expect(
      stale,
      stale
        .map(
          (e) =>
            `${e.file}: PHONE-DISABLED-EXEMPT comment ("${e.reason}") over ".${e.selector}" is stale -- delete this ` +
            `line. The rule it exempts no longer composes the Disabled token, is no longer inside a <=700px block, ` +
            'or is already a legal use on its own and never needed the exemption.',
        )
        .join('\n'),
    ).toEqual([]);
  });

  it('negative control: a synthetic phone de-emphasis rule IS flagged, and weight-not-lightness reads in the failure message', () => {
    const synthetic = `
      @media (max-width: 700px) {
        .chq-synthetic-phone-quiet-value { font-size: 11px; color: var(--chq-disabled); }
      }
    `;
    const dragClass = deriveDragHandleClass();
    const blocks = extractMediaBlocks(synthetic).filter((b) => isPhoneCondition(b.condition));
    expect(blocks).toHaveLength(1);
    const rules = parseRules(blocks[0]!.body).filter((r) => DISABLED_TOKEN_RE.test(r.body));
    expect(rules).toHaveLength(1);
    expect(isLegalPhoneUse(rules[0]!.selector, dragClass)).toBe(false);
    expect(PHONE_RULING_SENTENCE).toMatch(/weight, not lightness/i);
    expect(PHONE_RULING_SENTENCE).toMatch(/800 -> 600 at var\(--chq-muted\)/);
  });

  it('negative control: a synthetic tablet-only (900px) rule is OUT of the phone population', () => {
    const synthetic = `
      @media (max-width: 900px) {
        .chq-synthetic-tablet-quiet-value { color: var(--chq-disabled); }
      }
    `;
    const blocks = extractMediaBlocks(synthetic).filter((b) => isPhoneCondition(b.condition));
    expect(blocks).toHaveLength(0);
  });

  it('a structural PHONE-DISABLED-EXEMPT comment suppresses its rule when live, and a stale one is caught', () => {
    const dragClass = deriveDragHandleClass();
    const live = `
      @media (max-width: 700px) {
        /* PHONE-DISABLED-EXEMPT: fixture -- an inert-looking control the legality check cannot itself prove */
        .chq-synthetic-exempt-fixture { color: var(--chq-disabled); }
      }
    `;
    const liveExemptions = findPhoneExemptions([{ file: 'fixture-live.css', raw: live }], dragClass);
    expect(liveExemptions).toHaveLength(1);
    expect(liveExemptions[0]!.inPhoneBlock).toBe(true);
    expect(liveExemptions[0]!.composesToken).toBe(true);

    // Stale: the rule underneath no longer composes the token (someone
    // fixed it to --chq-muted but forgot to delete the exemption comment).
    const stale = `
      @media (max-width: 700px) {
        /* PHONE-DISABLED-EXEMPT: fixture -- now stale, the rule below was fixed */
        .chq-synthetic-exempt-fixture { color: var(--chq-muted); font-weight: 600; }
      }
    `;
    const staleExemptions = findPhoneExemptions([{ file: 'fixture-stale.css', raw: stale }], dragClass);
    expect(staleExemptions).toHaveLength(1);
    expect(staleExemptions[0]!.composesToken).toBe(false);

    // Stale: the rule moved outside any phone block.
    const movedOut = `
      /* PHONE-DISABLED-EXEMPT: fixture -- no longer inside a phone block */
      .chq-synthetic-exempt-fixture { color: var(--chq-disabled); }
    `;
    const movedExemptions = findPhoneExemptions([{ file: 'fixture-moved.css', raw: movedOut }], dragClass);
    expect(movedExemptions).toHaveLength(1);
    expect(movedExemptions[0]!.inPhoneBlock).toBe(false);
  });
});
