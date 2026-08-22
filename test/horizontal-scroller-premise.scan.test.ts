// DEC-367 wave-30 amendment (task v12m-w30-d): grounds the overflow
// instrument's two escape hatches in the design pack.
//
// scripts/render-sweep.ts's mobile page.evaluate defines
// `inHorizontalScroller(el)` and excludes every element held by an
// ancestor computing `overflow-x: auto|scroll` from BOTH maxElementRight
// and overflowOffenders (DEC-424's remedy for a deliberately wide matrix
// that scrolls inside its own container). That exclusion is correct only
// when the scroller it protects is one the design pack actually draws --
// otherwise the round-4 "zero horizontal-overflow offenders" verdict is
// equally consistent with a real defect the sheet cures by hiding it
// inside a scroller the pack never asked for. This scan enumerates every
// `overflow-x: auto|scroll` / `overflow: auto|scroll` declaration in the
// product and JOINS each one to the pack: does any docs/design/*.dc.html
// frame draw a scrolling region there? A row with no such grounding is
// UNGROUNDED-SCROLLER.
//
// The second escape hatch is scripts/render-sweep.ts's KNOWN_CLIP_EXCEPTIONS
// -- an in-code exemption list whose premise can rot like any allowlist
// (DEC-725). This scan re-derives it against the tree: any member that no
// longer names a real element, or whose element is not a deliberate,
// designed truncation, is a STALE-CLIP-EXCEPTION row.
//
// RECORDING PRECEDES REPAIR (this wave's own instruction): this scan
// measures and grounds. It does not delete a scroller -- a wrong deletion
// turns a hidden phone overflow into a visible one on desktop, which is
// FROZEN (DEC-385 single-direction responsive).
//
// POPULATION (DEC-808 idiom: enumerated, never hand-listed): every
// `app/src/**/*.css` file PLUS every SSR `*_CSS` module under `src/`, via
// `ssrCssSources()` -- the same derived helper
// `app/src/status-density-pairing.scan.test.ts` uses -- never a
// `src/**/*.css.ts` filename glob, which silently drops `src/views/theme.ts`
// (theme.ts carries no `.css.ts` suffix and is exactly the shape that
// dropped it from a sibling scan for wave after wave).

import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ssrCssSources } from './helpers/ssr-css-sources';
import { stripCssComments } from './helpers/strip-css-comments';
import { KNOWN_CLIP_EXCEPTIONS } from '../scripts/render-sweep';
import { DEC_367 } from '../src/decisions';

const DEVIATIONS_PATH = join(dirname(fileURLToPath(import.meta.url)), '..', 'docs', 'design', 'DEVIATIONS.md');

/** The whole `## 3. Interpretations where the frames underspecify` section
 * body -- BLESSED-DEFENSIVE's burden of proof (b) is a matching entry in
 * exactly this section, never anywhere else in the file. */
function deviationsSection3(): string {
  const text = readFileSync(DEVIATIONS_PATH, 'utf8');
  const start = text.indexOf('## 3. Interpretations where the frames underspecify');
  if (start === -1) throw new Error('DEVIATIONS.md §3 heading not found');
  const rest = text.slice(start + 1);
  const nextHeadingRel = rest.search(/\n## \d/);
  const end = nextHeadingRel === -1 ? text.length : start + 1 + nextHeadingRel;
  return text.slice(start, end);
}

// DEC-367 wave-30 amendment: "the overflow instrument's two escape hatches
// (scroller-held and KNOWN_CLIP_EXCEPTIONS) are premises about the pack, and
// an ungrounded escape hatch hides overflow rather than curing it" -- this
// whole file's reason to exist.
void DEC_367;

const HERE = dirname(fileURLToPath(import.meta.url)); // test/
const REPO_ROOT = join(HERE, '..');
const APP_SRC = join(REPO_ROOT, 'app', 'src');

interface CssSource {
  rel: string;
  text: string;
}

/** Every *.css file under app/src, enumerated (DEC-808), never hand-listed. */
function allAppCssFiles(root: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(root, { withFileTypes: true, recursive: true })) {
    if (!entry.isFile() || !entry.name.endsWith('.css')) continue;
    out.push(join(entry.parentPath, entry.name));
  }
  return out.sort();
}

/** SSR `*_CSS` modules are whole TypeScript files: `export const NAME_CSS =
 * \`...\`` template literals sitting beside ordinary `//`-commented TS
 * prose. Running a CSS rule-block parser over the raw file text (as
 * app/src/status-density-pairing.scan.test.ts's population builder does)
 * is safe there because its class-name regex rejects any bogus "selector"
 * a stray brace in comment prose produces -- this scan accepts much wider
 * selector shapes (bare `table`, `pre`, plain compound selectors), so a
 * `//` comment mentioning "(overflow-x: auto)" beside an unrelated `{`/`}`
 * elsewhere in the file would otherwise be misread as a real declaration.
 * Extract just the backtick-delimited template literal bodies instead, one
 * per exported `_CSS` constant, and parse only those. `${...}`
 * interpolations collapse to empty (their content is another module's own
 * constant, scanned separately as that module's own file) -- a
 * `.${ARRAY[N]}` selector-position interpolation degrades to a bare `.`,
 * same known shape docs/design/audit/overflow-390-v12.md's wave-119
 * predicate repair documents for the sibling instrument. */
function extractCssLiterals(fileText: string): string {
  const out: string[] = [];
  const re = /export const [A-Z0-9_]+_CSS = `/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(fileText)) !== null) {
    let i = m.index + m[0].length;
    let buf = '';
    let braceDepth = 0;
    while (i < fileText.length) {
      const ch = fileText[i];
      if (ch === '\\' && i + 1 < fileText.length) {
        buf += fileText[i + 1];
        i += 2;
        continue;
      }
      if (braceDepth === 0 && ch === '`') {
        i++;
        break;
      }
      if (ch === '$' && fileText[i + 1] === '{') {
        braceDepth = 1;
        i += 2;
        continue;
      }
      if (braceDepth > 0) {
        if (ch === '{') braceDepth++;
        else if (ch === '}') {
          braceDepth--;
          if (braceDepth === 0) {
            i++;
            continue;
          }
        }
        i++;
        continue;
      }
      buf += ch;
      i++;
    }
    out.push(buf);
    re.lastIndex = i;
  }
  return out.join('\n');
}

function buildPopulation(): CssSource[] {
  const appSources: CssSource[] = allAppCssFiles(APP_SRC).map((file) => ({
    rel: relative(REPO_ROOT, file),
    text: readFileSync(file, 'utf8'),
  }));
  const ssrSources: CssSource[] = ssrCssSources().map((s) => ({ rel: s.path, text: extractCssLiterals(s.text) }));
  return [...appSources, ...ssrSources].sort((a, b) => a.rel.localeCompare(b.rel));
}

type Decl = Record<string, string>;

interface RawRule {
  selectors: string[];
  decl: Decl;
  media: string | null;
}

/** Parse "prop: value; prop2: value2" into a lower-cased-key map. */
function parseDecl(body: string): Decl {
  const out: Decl = {};
  for (const stmt of body.split(';')) {
    const idx = stmt.indexOf(':');
    if (idx === -1) continue;
    const prop = stmt.slice(0, idx).trim().toLowerCase();
    const value = stmt.slice(idx + 1).trim();
    if (!prop || !value) continue;
    out[prop] = value;
  }
  return out;
}

/**
 * Walk a comment-stripped CSS(-in-TS) file's brace structure. Every at-rule
 * pushes a media context frame; every plain selector block is recorded
 * against the current @media frame (or null at top level). Same shape as
 * app/src/status-density-pairing.scan.test.ts's parseRules -- one level of
 * @media nesting, which is all this codebase's stylesheets use.
 */
function parseRules(css: string): RawRule[] {
  const rules: RawRule[] = [];
  const mediaStack: (string | null)[] = [];
  let buf = '';
  let i = 0;
  while (i < css.length) {
    const ch = css[i];
    if (ch === '{') {
      const header = buf.trim();
      buf = '';
      if (header.startsWith('@')) {
        mediaStack.push(header.startsWith('@media') ? header : null);
        i++;
        continue;
      }
      let depth = 1;
      let j = i + 1;
      while (depth > 0 && j < css.length) {
        if (css[j] === '{') depth++;
        else if (css[j] === '}') depth--;
        j++;
      }
      const body = css.slice(i + 1, j - 1);
      const media = mediaStack.length > 0 ? mediaStack[mediaStack.length - 1] ?? null : null;
      if (header) {
        rules.push({
          selectors: header.split(',').map((s) => s.trim()).filter(Boolean),
          decl: parseDecl(body),
          media,
        });
      }
      i = j;
      continue;
    }
    if (ch === '}') {
      if (mediaStack.length > 0) mediaStack.pop();
      buf = '';
      i++;
      continue;
    }
    buf += ch;
    i++;
  }
  return rules;
}

function isPhoneMedia(media: string | null): boolean {
  if (media === null) return false;
  const m = /max-width\s*:\s*([\d.]+)px/.exec(media);
  if (!m) return false;
  return parseFloat(m[1]!) <= 700;
}

/** True if `value` is a bare (no !important, no interpolation-residue)
 * `auto` or `scroll` keyword. */
function isAutoOrScroll(value: string): boolean {
  return /^(auto|scroll)$/.test(value.trim());
}

interface ScrollerRow {
  file: string;
  selector: string;
  prop: 'overflow-x' | 'overflow';
  value: string;
  scope: 'phone' | 'base';
}

const population = buildPopulation();
const ROWS: ScrollerRow[] = [];

for (const source of population) {
  const rules = parseRules(stripCssComments(source.text));
  for (const rule of rules) {
    for (const prop of ['overflow-x', 'overflow'] as const) {
      const value = rule.decl[prop];
      if (value === undefined || !isAutoOrScroll(value)) continue;
      for (const selector of rule.selectors) {
        ROWS.push({
          file: source.rel,
          selector,
          prop,
          value: value.trim(),
          scope: isPhoneMedia(rule.media) ? 'phone' : 'base',
        });
      }
    }
  }
}

// -----------------------------------------------------------------------
// VERDICTS: hand-researched joins against docs/design/*.dc.html, keyed
// `${file}::${selector}`. Reading the pack for each row is the point of
// this wave's task -- see docs/design/audit/horizontal-scroller-390-v12.md
// for the citation behind every verdict. GROUNDED = a frame draws this
// exact scrolling region. UNGROUNDED-SCROLLER = no frame does. OUT-OF-SCOPE
// = the surface is ruled chrome, not a designed screen (DEC-382), so a
// pack join is not applicable at all.
// -----------------------------------------------------------------------

type Verdict = 'GROUNDED' | 'UNGROUNDED-SCROLLER' | 'OUT-OF-SCOPE' | 'BLESSED-DEFENSIVE';

/** BLESSED-DEFENSIVE (DEC-367 wave-34 amendment): 'no frame draws it' is
 * true of these rows and not dispositive -- each one guards a CONTENT
 * CLASS the pack cannot draw because the pack is a static mock
 * (author-supplied markdown, an organiser-chosen column set, a live room
 * count). A row graded this way must name both (a) the content class it
 * guards, in `contentClass`, and (b) carry a `reason` whose claim is
 * cross-checked against a matching docs/design/DEVIATIONS.md §3 entry by
 * this file's own tests -- a row that cannot name both stays
 * UNGROUNDED-SCROLLER (see `effectiveVerdict` below). */
interface BlessedDefensiveEntry {
  verdict: 'BLESSED-DEFENSIVE';
  contentClass: string;
  reason: string;
}

type VerdictEntry = Verdict | BlessedDefensiveEntry;

function verdictOf(entry: VerdictEntry): Verdict {
  return typeof entry === 'string' ? entry : entry.verdict;
}

/** The single place that enforces BLESSED-DEFENSIVE's two-part burden of
 * proof: a named content class AND a DEVIATIONS.md §3 entry that mentions
 * both this row's source file and its selector. Either missing downgrades
 * the row to UNGROUNDED-SCROLLER -- 'no frame draws it' alone never
 * qualifies. Non-BLESSED-DEFENSIVE verdicts pass through unchanged. */
function effectiveVerdict(entry: VerdictEntry, file: string, selector: string, section3: string): Verdict {
  const v = verdictOf(entry);
  if (v !== 'BLESSED-DEFENSIVE') return v;
  const e = entry as BlessedDefensiveEntry;
  const hasContentClass = e.contentClass.trim().length > 0;
  const groundedInDeviations = section3.includes(file) && section3.includes(selector);
  return hasContentClass && groundedInDeviations ? 'BLESSED-DEFENSIVE' : 'UNGROUNDED-SCROLLER';
}

const VERDICTS: Readonly<Record<string, VerdictEntry>> = {
  // Shared chip-strip component: the pattern itself is drawn repeatedly
  // (Contacts.dc.html:187/194/452, Submissions.dc.html:148,
  // Overview.dc.html:196) -- every concrete surface below cites its own
  // frame line directly; this is the shared base rule the surfaces compose.
  'app/src/styles.css::.chq-chipstrip': 'GROUNDED',

  // Contacts: filter-rule chip strip and segment-pill strip -- both cited
  // in-code to Contacts.dc.html:187 and :194-195 already.
  'app/src/pages/contacts/contacts.css::.chq-contacts-filter-chipstrip': 'GROUNDED',
  'app/src/pages/contacts/contacts.css::.chq-contacts-segment-pills': 'GROUNDED',

  // Contacts: import-wizard step indicator. v12m-w33-b (DEC-367 wave-33):
  // RESOLVED -- the strip is now `display: none` at phone (no overflow-x
  // declaration survives there), so this row no longer appears in ROWS.
  // See docs/design/audit/horizontal-scroller-390-v12.md.

  // Speakers: the onboarding grid's horizontal-scroll wrapper is exactly
  // Speakers.dc.html:75/577's `min-width:1060px` task matrix.
  'app/src/pages/speakers/speakers.css::.chq-speakers-grid-wrap': 'GROUNDED',

  // Submissions: chip-strip filter/view-tab row, phone-scoped -- grounded
  // by Submissions.dc.html:148 (already cited in-code at submissions.css
  // near this rule).
  'app/src/pages/submissions/submissions.css::.chq-submissions-filterbar': 'GROUNDED',
  'app/src/pages/submissions/submissions.css::.chq-submissions-filterbar .chq-status-pills': 'GROUNDED',
  'app/src/pages/submissions/submissions.css::.chq-submissions-viewtabs': 'GROUNDED',

  // Submissions: the results-table wrap. Submissions.dc.html's desktop
  // frame is a fixed 1600px canvas (:32/:190/:402/:565/:609) with no
  // overflow-x drawn anywhere for the table -- it never needs to scroll in
  // the mock. The wrapper exists for the organizer-toggled custom-column
  // picker (.chq-submissions-columnpicker-panel a few rules above), a
  // feature the pack's static frame doesn't model. BLESSED-DEFENSIVE:
  // see docs/design/DEVIATIONS.md §3.
  'app/src/pages/submissions/submissions.css::.chq-submissions-table-wrap': {
    verdict: 'BLESSED-DEFENSIVE',
    contentClass: 'organiser-toggled custom-column picker',
    reason:
      'a fixed-canvas static frame has no way to draw a column set the viewer chooses at runtime',
  },

  // Overview: phone deadline-chip strip -- grounded by Overview.dc.html:196
  // (`display:flex; gap:7px; overflow-x:auto`).
  'app/src/pages/overview/overview.css::.chq-overview-deadlines': 'GROUNDED',

  // Agenda (admin): the day-grid matrix (time down the left, rooms across
  // the top) is the room-column matrix Agenda.dc.html's own comment (this
  // sheet, DEC-870) describes; no Agenda.dc.html frame draws overflow-x
  // literally on .chq-day-grid, but the room-lane matrix shape it renders
  // is the exact "deliberately wide matrix" this scan's own task
  // description names as legitimate to keep unlisted-as-defect --
  // Agenda.dc.html:139 draws the sibling chip-strip pattern this same
  // sheet's DEC-584 comment says superseded the room-column layout for the
  // *day* view; .chq-day-grid backs a different, still-live room view. No
  // frame quote pins this exact wrapper, so shape resemblance alone does
  // not qualify it (DEC-180). It qualifies instead on the DEC-367 wave-34
  // content-class ruling: the room count is live data, not a fixed
  // design-time quantity, so no static frame can draw the matrix at every
  // width a real room count could produce. BLESSED-DEFENSIVE: see
  // docs/design/DEVIATIONS.md §3.
  'app/src/pages/agenda/agenda.css::.chq-day-grid': {
    verdict: 'BLESSED-DEFENSIVE',
    contentClass: 'live room-lane matrix (room count is live event data)',
    reason:
      'a static frame draws one snapshot room count and cannot depict the matrix at a real event\'s actual room count',
  },

  // Comms: preview-pane Prev/Next switcher, phone-scoped. v12m-w33-b
  // (DEC-367 wave-33): RESOLVED -- overflow-x dropped (the strip holds
  // exactly two 44px buttons at a 12px gap and cannot overflow 390), so
  // this row no longer appears in ROWS. See docs/design/audit/
  // horizontal-scroller-390-v12.md.

  // Docs (SSR /docs, DEC-382: a NEW designed public surface, its own
  // frame). Docs.dc.html's "Docs · an article" frame (:27) annotates
  // "Reading measure 680" matching .chq-docs-code's own 680px max-width,
  // but draws no <pre>/code-block example at all -- no literal overflow-x
  // in the frame. BLESSED-DEFENSIVE: a defensive affordance for
  // author-supplied, markdown-sourced code of arbitrary line length the
  // static mock's one captured article never happened to render. See
  // docs/design/DEVIATIONS.md §3.
  'src/routes/docs-site.css.ts::.chq-docs-code': {
    verdict: 'BLESSED-DEFENSIVE',
    contentClass: 'author-supplied markdown code block',
    reason: 'markdown authors can paste code of any line length, independent of which article a static mock happened to snapshot',
  },

  // Tools chrome (GET /, /docs/api, /dev/mailbox): DEC-382 rules these
  // three operator surfaces "chrome, not designed screens" sharing
  // TOOLS_CSS -- there is no Tools.dc.html and none is expected. A pack
  // join does not apply.
  'src/routes/tools.css.ts::.chq-tool-table-wrap': 'OUT-OF-SCOPE',
  'src/routes/tools.css.ts::.chq-tool-pre': 'OUT-OF-SCOPE',

  // Portal: generic `table`/`pre` phone rule, a defensive "any embedded
  // content gets its own scroll container instead of the page" catch-all
  // (own comment). "Chautauqua Public and Portal.dc.html" draws no <table>
  // anywhere in the portal frames. BLESSED-DEFENSIVE: guards
  // organiser-authored embedded content, the same content class
  // .chq-docs-code guards on the portal side of the product. See
  // docs/design/DEVIATIONS.md §3.
  'src/routes/portal/portal.css.ts::table': {
    verdict: 'BLESSED-DEFENSIVE',
    contentClass: 'embedded content (organiser-authored table)',
    reason: 'a static frame set cannot enumerate the shape of organiser-authored embedded content in advance',
  },
  'src/routes/portal/portal.css.ts::pre': {
    verdict: 'BLESSED-DEFENSIVE',
    contentClass: 'embedded content (organiser-authored preformatted block)',
    reason: 'a static frame set cannot enumerate the shape of organiser-authored embedded content in advance',
  },

  // Public Agenda: day-row scroll wrapper. v12m-w33-b (DEC-367 wave-33):
  // RESOLVED -- the overflow-x/-webkit-overflow-scrolling pair is removed
  // (the DEC-584 wave-64 "harmless no-op wrapper" premise was itself the
  // ungrounded scroller; "Chautauqua Public and Portal.dc.html"'s Agenda
  // frames (:132, :249) draw no overflow-x for the day-row region), so
  // this row no longer appears in ROWS. See docs/design/audit/
  // horizontal-scroller-390-v12.md.

  // Public Agenda: desktop day switcher (210px joined group). Grounded --
  // the frame's phone day-switcher shape (Public and Portal.dc.html:377)
  // is the direct citation this file's own comment already carries for
  // the phone override below; the desktop 210px group is the same
  // component's base rule, and the frame's desktop day rows
  // (:165-166/:283-284) draw the same 2-day content this rule composes
  // (a >2-day event scrolling past 210px is the untested but structurally
  // identical case DEC-989's phone amendment already reasons through for
  // the phone variant of this exact component).
  'src/routes/public/css/agenda.css.ts::.chq-pub-day-switcher': 'GROUNDED',

  // Public Agenda: the day-switcher's own phone scrolling-strip container,
  // and one pill segment restating the same "this segment scrolls rather
  // than squeezes" contract on itself (own comment: "a truthful no-op").
  // Both are the exact scroller "Chautauqua Public and Portal.dc.html:377
  // `display:flex; gap:7px; overflow-x:auto; -webkit-overflow-scrolling:
  // touch`" draws, cited in-code already.
  'src/routes/public/css/agenda.css.ts::.$$ACCENT_BOUND_CLASSES1$$': 'GROUNDED',
};

/** CSS-in-TS `.${ARRAY[N]}` selector-position interpolations collapse to a
 * bare `.` under this scan's literal-text extraction (the same defect
 * docs/design/audit/overflow-390-v12.md's wave-119 predicate repair
 * documents for the sibling instrument). Rather than resolve the import
 * (out of this scan's scope), the two affected selectors from
 * public/css/agenda.css.ts are matched by a stable synthetic key derived
 * from their known real class name (.chq-pub-day-pill, per that same
 * audit doc) so the VERDICTS lookup stays keyed on real, grep-able text
 * instead of a meaningless bare `.`. */
function verdictKey(row: ScrollerRow): string {
  if (row.file === 'src/routes/public/css/agenda.css.ts' && row.selector === '.') {
    return `${row.file}::.$$ACCENT_BOUND_CLASSES1$$`;
  }
  return `${row.file}::${row.selector}`;
}

describe('horizontal-scroller premise (DEC-367 wave-30 amendment)', () => {
  it('the population is non-empty (vacuous-population tripwire)', () => {
    expect(ROWS.length).toBeGreaterThan(0);
  });

  it('every enumerated overflow-x/overflow auto|scroll declaration has a recorded verdict', () => {
    const unrecorded = ROWS.filter((r) => VERDICTS[verdictKey(r)] === undefined);
    expect(
      unrecorded.length,
      `Rows with no VERDICTS entry (research and record a verdict before landing):\n` +
        unrecorded.map((r) => `  ${r.file}::${r.selector} (${r.prop}: ${r.value})`).join('\n'),
    ).toBe(0);
  });

  it('every VERDICTS entry still names a real row (no stale key)', () => {
    const liveKeys = new Set(ROWS.map(verdictKey));
    const stale = Object.keys(VERDICTS).filter((k) => !liveKeys.has(k));
    expect(
      stale.length,
      `VERDICTS entries with no matching live row (selector renamed/removed -- drop or fix the key):\n` +
        stale.join('\n'),
    ).toBe(0);
  });

  // -----------------------------------------------------------------------
  // BLESSED-DEFENSIVE burden of proof: every row graded BLESSED-DEFENSIVE
  // must name a content class AND a DEVIATIONS.md §3 entry that mentions
  // both its source file and its selector -- effectiveVerdict is the sole
  // enforcement point, exercised here against the real map.
  // -----------------------------------------------------------------------
  const section3 = deviationsSection3();

  it('every BLESSED-DEFENSIVE row names a content class and a matching DEVIATIONS.md §3 entry', () => {
    const failures: string[] = [];
    for (const [key, entry] of Object.entries(VERDICTS)) {
      if (verdictOf(entry) !== 'BLESSED-DEFENSIVE') continue;
      const [file, selector] = key.split('::');
      const graded = effectiveVerdict(entry, file!, selector!, section3);
      if (graded !== 'BLESSED-DEFENSIVE') {
        failures.push(`${key}: downgraded to ${graded} -- missing content class or DEVIATIONS.md §3 grounding`);
      }
    }
    expect(failures.length, failures.join('\n')).toBe(0);
  });

  it('negative control: a synthetic BLESSED-DEFENSIVE row with no §3 backing grades UNGROUNDED-SCROLLER', () => {
    const synthetic: BlessedDefensiveEntry = {
      verdict: 'BLESSED-DEFENSIVE',
      contentClass: 'a made-up content class no DEVIATIONS.md entry backs',
      reason: 'this row exists only to prove the downgrade path fires',
    };
    expect(effectiveVerdict(synthetic, 'app/src/pages/nowhere/nowhere.css', '.chq-does-not-exist', section3)).toBe(
      'UNGROUNDED-SCROLLER',
    );
    // Also prove a missing contentClass alone downgrades it, even with real
    // §3 text supplied.
    const noContentClass: BlessedDefensiveEntry = { verdict: 'BLESSED-DEFENSIVE', contentClass: '', reason: 'x' };
    expect(
      effectiveVerdict(
        noContentClass,
        'app/src/pages/submissions/submissions.css',
        '.chq-submissions-table-wrap',
        section3,
      ),
    ).toBe('UNGROUNDED-SCROLLER');
  });

  // -----------------------------------------------------------------------
  // TWO-SIDED RATCHET (DEC-948 shape): UNGROUNDED_SCROLLER_CEILING may only
  // be LOWERED as real rows get an actual pack citation or a documented
  // DEVIATIONS.md override; it must never be silently raised to swallow a
  // new one landing elsewhere. Pinned to the exact measured count today.
  // -----------------------------------------------------------------------
  const ungroundedCount = Object.entries(VERDICTS).filter(([key, entry]) => {
    const [file, selector] = key.split('::');
    return effectiveVerdict(entry, file!, selector!, section3) === 'UNGROUNDED-SCROLLER';
  }).length;

  it(`UNGROUNDED_SCROLLER_CEILING (${UNGROUNDED_SCROLLER_CEILING}) matches the measured UNGROUNDED-SCROLLER count exactly`, () => {
    expect(
      ungroundedCount,
      `Measured ${ungroundedCount} UNGROUNDED-SCROLLER row(s) in VERDICTS but ` +
        `UNGROUNDED_SCROLLER_CEILING is ${UNGROUNDED_SCROLLER_CEILING}. If a row was newly grounded ` +
        `(a real pack citation found) or newly ruled via DEVIATIONS.md, lower the ceiling to match. ` +
        `If a new ungrounded scroller landed, this scan's VERDICTS map must record it explicitly -- ` +
        `never silently raise the ceiling to absorb it.`,
    ).toBe(UNGROUNDED_SCROLLER_CEILING);
  });

  // -----------------------------------------------------------------------
  // KNOWN_CLIP_EXCEPTIONS staleness (DEC-725: an in-code exemption's premise
  // rots like an allowlist). Re-derive: does each keyed selector still
  // match a real rule, and is that rule still a genuine designed
  // truncation (a `-webkit-line-clamp` or equivalent deliberate collapse),
  // not a visually-hidden affordance under CLIP_VISUALLY_HIDDEN_MAX_PX?
  // -----------------------------------------------------------------------
  it('every KNOWN_CLIP_EXCEPTIONS member still names a real, genuinely-truncating rule', () => {
    const staleRows: string[] = [];
    for (const key of Object.keys(KNOWN_CLIP_EXCEPTIONS)) {
      // key shape: "<route path>::<tag.class.class>"
      const selectorPart = key.split('::')[1] ?? '';
      const classTokens = selectorPart.split('.').filter((t) => t && t !== selectorPart.split('.')[0]);
      const primaryClass = classTokens[0];
      if (!primaryClass) {
        staleRows.push(`${key}: could not parse a class token from the key`);
        continue;
      }
      const hit = population.find((s) => new RegExp(`\\.${primaryClass}\\b[^{]*\\{[^}]*-webkit-line-clamp`, 's').test(s.text));
      if (!hit) {
        staleRows.push(`${key}: no rule for .${primaryClass} declares -webkit-line-clamp anywhere in the population`);
      }
    }
    expect(
      staleRows.length,
      `STALE-CLIP-EXCEPTION row(s) -- premise no longer holds, re-verify and update ` +
        `KNOWN_CLIP_EXCEPTIONS in scripts/render-sweep.ts:\n${staleRows.join('\n')}`,
    ).toBe(STALE_CLIP_EXCEPTION_CEILING);
  });
});

/** DEC-367 wave-34 (task w34-i): five of the eight rows this constant used
 * to cover (submissions.css .chq-submissions-table-wrap, agenda.css
 * .chq-day-grid, docs-site.css.ts .chq-docs-code, portal.css.ts table +
 * pre) each now name a content class the pack's static mock cannot draw
 * plus a matching docs/design/DEVIATIONS.md §3 entry, and grade
 * BLESSED-DEFENSIVE instead (see effectiveVerdict above). Measured 3
 * remaining on a branch cut from main, which lacks v12m-w33-b:
 * contacts-panels.css .chq-steps, comms.css .chq-comms-preview-nav,
 * public/css/agenda.css.ts .chq-pub-agenda-day-scroll -- all three are
 * v12m-w33-b's in-flight work, deliberately left untouched here. Once
 * v12m-w33-b lands on main this ceiling should re-measure to 0; the merge
 * train must re-run this scan after both branches are in, not inherit
 * either measurement.
 *
 * MEGABATCH (wave-34 thunderdome): v12m-w33-b landed in this same batch and
 * drained exactly those three rows, so per this comment's own instruction
 * the ceiling is re-measured on the merged tree rather than inheriting
 * either branch's number. (Tools chrome rows are OUT-OF-SCOPE, DEC-382, and
 * excluded from this count -- see VERDICTS above.) See
 * docs/design/audit/horizontal-scroller-390-v12.md for the full ledger. */
export const UNGROUNDED_SCROLLER_CEILING = 0;

/** Measured 0 today: KNOWN_CLIP_EXCEPTIONS' one member
 * (`/admin/agenda::div.chq-session-card-title`) still names a real
 * `.chq-session-card-title` rule declaring `-webkit-line-clamp: 3`
 * (app/src/pages/agenda/agenda.css) -- a genuine designed truncation, not
 * a rotted premise. */
export const STALE_CLIP_EXCEPTION_CEILING = 0;
