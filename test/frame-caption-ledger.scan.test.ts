// Frame caption/consequence ledger (DEC-976 wave-133; task w8-a).
//
// Every prior ledger in this campaign grades a SCREEN (phone-frame-ledger,
// desktop-frame-ledger: "is this screen cited by some test?") or a CONTROL
// (frame-control-label.scan.test.ts: "does the app render the words a
// button/footer/anchor draws?"). Nothing has ever graded the pack's third
// population: what a frame SAYS in its prose -- the muted caption/consequence
// spans that carry the design's explanations, warnings and confirmations,
// distinct from a control's own clickable label (field guide, wave-133 "THE
// PACK HAS A THIRD POPULATION" entry). This is that instrument.
//
//   1. POPULATION -- derived from docs/design/*.dc.html at test time, never
//      hand-listed (DEC-808). Every `<span|div|p style="...">TEXT</span>`
//      (opening and closing tag names match via backreference) whose style
//      attribute carries `color:#565A4B`, `color:#3F4237` or `color:#8E8A7A`
//      -- the pack's three muted-prose colours -- and does NOT carry
//      `text-transform:uppercase` (an eyebrow/label chip, not prose), where
//      TEXT contains no `<`/`>` (so a span/div/p wrapping further markup,
//      e.g. a grid-header container, can never satisfy the grammar) and no
//      `{{` (a template interpolation, not literal prose -- same exclusion
//      the desktop ledger already applies to its own population), is
//      >= 20 chars after trimming, and contains no digit and no `@`.
//
//      The digit/`@` filters are DISCRIMINATORS ON THE POPULATION, not an
//      exclusion of offenders (DEC-180): they drop count-composed rows (a
//      caption reading "18 more · 23 is under the 100-recipient cap" is a
//      COMPOSED-from-data render, graded by a different instrument were one
//      to exist) and fixture identities ("sam@example.com · Reviewer") from
//      ever entering the population in the first place -- neither
//      discriminator removes a real offender AFTER classification the way an
//      exclusion table does below.
//
//   2. EXCLUSIONS -- two written tables, each entry {fileName, line, text,
//      reason}, each asserted below to still resolve to its cited
//      file:line:text in the CURRENT pack (a stale exclusion fails loudly,
//      exactly like every prior ledger's exclusion-citation guard):
//        a. EXPLAINER -- the pack's own annotation panels, commentary about
//           the design system rather than product copy the app renders.
//        b. FIXTURE -- invented sample identities and sample body text used
//           as mock data inside a frame, not a caption a real screen draws.
//      Each reason is a PRINCIPLE (DEC-099): a fact about what the entry IS,
//      never a branch name or a schedule.
//
//   3. MATCH -- built over every .ts/.tsx/.css/.md file under app/src/** and
//      src/** (readdirSync recursive, skipping any path containing
//      `.test.`, DEC-808 enumeration). Both sides are normalized IDENTICALLY:
//      comments stripped (a string/template-aware scan, so a `//` or `/*`
//      inside a string literal is never mistaken for a real comment opener
//      -- the exact defect DEC-967 wave-130 already named and fixed once in
//      test/frame-source-corpus.ts; this file needs its OWN wide entity
//      table -- &hellip; &quot; &#39; &ldquo; &rdquo; &lt; &gt; beyond that
//      module's set -- so it cannot reuse that function without silently
//      narrowing its own decode table, and re-implements the same
//      string-aware algorithm rather than the two-regex shape that algorithm
//      was written to replace), HTML entities decoded (&amp; &lsaquo;
//      &rsaquo; &nbsp; &middot; &hellip; &quot; &#39; &mdash; &ndash;
//      &ldquo; &rdquo; &lt; &gt;), then every whitespace run collapsed to a
//      single space. Both normalizations matter on the SOURCE side: JSX
//      routinely wraps a one-line frame caption across three source lines
//      (needs whitespace-collapse) and writes the pack's `&middot;`/`&mdash;`
//      characters as literal HTML entities (needs entity-decode) -- skipping
//      either invents unmatched rows in the fix-me direction (measured
//      directly: dropping entity-decode alone raised this branch's
//      UNMATCHED count). A caption is MATCHED when the normalized corpus
//      contains the normalized text (plain substring test, not
//      boundary-anchored -- unlike the control-label ledger's short button
//      words, every population member here is >= 20 chars, so an accidental
//      substring collision inside a longer sentence is not a realistic risk
//      the way it is for a four-letter control label).
//
//   4. RATCHET -- FRAME_CAPTION_UNMATCHED_CEILING is a single exported
//      const, hand-measured on this branch by forcing it to -1 and reading
//      the printed offender list (never `= UNMATCHED.length` or any
//      expression naming the measured set -- the ninth saturated-ratchet-lie
//      pattern named in the wave-128 field guide). Two-sided, identical
//      shape to every prior ledger in this campaign
//      (test/desktop-frame-ledger.scan.test.ts's CLAIMED_FLOOR,
//      test/frame-control-label.scan.test.ts's FOOTER_LABEL_CEILING): one
//      `it` fails when the offender count rises ABOVE the ceiling, printing
//      the full offender list; a companion `it` fails when it falls BELOW,
//      printing the exact replacement line so a stale ceiling can never
//      license stagnation.
//
// This file names the app's uninstrumented caption/consequence gap; it does
// not close it -- that is scheduled work for a future lane, not this ledger.
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { DEC_380, DEC_976 } from '../src/decisions';

void DEC_976; // wave-135: the exclusion taxonomy grows a fourth named class, COMPOSED, with exactly three legal reason shapes (see COMPOSED_EXCLUSIONS below)
void DEC_380; // wave-135: a caption absent only by a full stop (or an un-rendered reason line) is a BUILD, never an exclusion-table entry

const HERE = dirname(fileURLToPath(import.meta.url)); // test/
const REPO_ROOT = join(HERE, '..');
const DESIGN_ROOT = join(REPO_ROOT, 'docs', 'design');
const APP_SRC_ROOT = join(REPO_ROOT, 'app', 'src');
const SRC_ROOT = join(REPO_ROOT, 'src');

// -- Population: muted-prose spans in docs/design ---------------------------

export interface Caption {
  /** Bare filename under docs/design/, e.g. "Chautauqua Docs.dc.html". */
  fileName: string;
  /** 1-based line number the opening tag starts on. */
  line: number;
  text: string;
}

const MUTED_COLOR_RE = /color:#565A4B|color:#3F4237|color:#8E8A7A/;
const UPPERCASE_RE = /text-transform:uppercase/;

// Matches an opening `<span|div|p style="...">` through its own matching
// closing tag (backreference \1 on the tag name), across line breaks (`s`
// flag) -- the pack's caption spans are single-line in practice (asserted
// below by the non-vacuity/exact-count guards), but the grammar itself does
// not assume that.
const TAG_RE = /<(span|div|p)\s+style="([^"]*)">([^<]*)<\/\1>/gs;

/** Every *.dc.html file directly under docs/design, enumerated rather than
 * named (DEC-808), identical to every sibling ledger's own designFiles(). */
export function designFiles(): string[] {
  return readdirSync(DESIGN_ROOT, { withFileTypes: true })
    .filter((e) => e.isFile() && e.name.endsWith('.dc.html'))
    .map((e) => e.name)
    .sort();
}

/** Extracts every population-qualifying caption from raw frame-file TEXT.
 * Exported so the non-vacuity synthetic fixture below can drive this exact
 * function over a fabricated fixture, never a real product count. */
export function captionsInText(text: string): { line: number; text: string }[] {
  const out: { line: number; text: string }[] = [];
  TAG_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = TAG_RE.exec(text)) !== null) {
    const style = m[2]!;
    const rawText = m[3]!;
    if (!MUTED_COLOR_RE.test(style)) continue;
    if (UPPERCASE_RE.test(style)) continue;
    if (rawText.includes('{{')) continue;
    const trimmed = rawText.trim();
    if (trimmed.length < 20) continue;
    if (/\d/.test(trimmed)) continue;
    if (trimmed.includes('@')) continue;
    const line = text.slice(0, m.index).split('\n').length;
    out.push({ line, text: trimmed });
  }
  return out;
}

function captionsInFile(fileName: string): Caption[] {
  const full = join(DESIGN_ROOT, fileName);
  const content = readFileSync(full, 'utf-8');
  return captionsInText(content).map((c) => ({ fileName, line: c.line, text: c.text }));
}

const ALL_CAPTIONS: Caption[] = designFiles().flatMap(captionsInFile);

// -- Exclusions ---------------------------------------------------------------

interface Exclusion {
  fileName: string;
  line: number;
  text: string;
  reason: string;
}

/** (a) EXPLAINER -- the pack's own annotation panels, commentary about the
 * design system rather than product copy a real screen draws. Each entry
 * asserted below to still resolve to its cited file:line:text in the
 * current pack. */
const EXPLAINER_EXCLUSIONS: Exclusion[] = [
  {
    fileName: 'Chautauqua Docs.dc.html',
    line: 245,
    text: 'Nine blocks. An article is a sequence of these and nothing else — a new kind of block is a change to this page first, not a one-off inside one article.',
    reason:
      "the Docs frame's own 'element library' annotation panel names the nine block types an article may use -- design-system vocabulary, not a Docs article the app renders.",
  },
  {
    fileName: 'Chautauqua Docs.dc.html',
    line: 252,
    text: 'Paragraphs are short. If one runs past six lines at this measure it is two paragraphs, or it is a list.',
    reason: "the same 'element library' panel's prose-block rule, not product copy.",
  },
  {
    fileName: 'Chautauqua Docs.dc.html',
    line: 286,
    text: 'Something true that the screen does not say. Olive edge, one line of label, two sentences at most.',
    reason: "the same 'element library' panel's aside-block rule, not product copy.",
  },
  {
    fileName: 'Chautauqua Docs.dc.html',
    line: 290,
    text: 'Ink edge, reserved for irreversible acts and data loss. If everything is a warning, nothing is — expect at most one per article.',
    reason: "the same 'element library' panel's aside-block rule, not product copy.",
  },
  {
    fileName: 'Chautauqua Docs.dc.html',
    line: 292,
    text: 'Two weights, no others. No tip / note / info / caution ladder — a reader cannot rank five colours, and translation breaks the words.',
    reason: "the same 'element library' panel's aside-block rule (block-vocabulary notes), not product copy.",
  },
  {
    fileName: 'Chautauqua Docs.dc.html',
    line: 323,
    text: 'A block is for something the reader will copy. Never for prose, never for a UI label.',
    reason: "the same 'element library' panel's code-block rule, not product copy.",
  },
  {
    fileName: 'Chautauqua Docs.dc.html',
    line: 336,
    text: 'Closes every article. Names the screen, not the doc — a reader finishing here is about to go and do the thing.',
    reason: "the same 'element library' panel's where-next-block rule, not product copy.",
  },
  {
    fileName: 'Chautauqua Home.dc.html',
    line: 364,
    text: 'A published programme stays published after the event ends, so a finished event would sit at the top of a flat list forever. Grouping fixes that and matches what a visitor arrived to find out: can I submit, or what\'s on?',
    reason:
      "the Home frame's own 'Rules you can't see on the page' hub-ordering annotation panel (already recorded as an explainer panel in test/desktop-frame-ledger.scan.test.ts:326), not product copy.",
  },
  {
    fileName: 'Chautauqua Home.dc.html',
    line: 399,
    text: 'Chautauqua is named once, in the footer, as an attribution link to the repository. That is the only place the product appears on a customer-facing surface.',
    reason:
      "the same 'Rules you can't see on the page' hub-ordering annotation panel, not product copy.",
  },
  {
    fileName: 'Chautauqua Overview.dc.html',
    line: 407,
    text: "The agenda grid, and only the agenda grid. Its column count is the event's room count, which an organiser can add to — so width genuinely buys columns and capping it would force scrolling on a monitor that had the room. The speaker matrix and pipeline board look like canvases but are not: their columns are bounded by the task list and the five fixed stages, so both sit at the table measure and scroll below their own minimum.",
    reason:
      "the Overview frame's own widths annotation panel (already recorded as an explainer panel in test/desktop-frame-ledger.scan.test.ts:353), not product copy.",
  },
  {
    fileName: 'Chautauqua Overview.dc.html',
    line: 568,
    text: 'A status cell takes a ring, never a fill — it already carries a fill that encodes its state.',
    reason: "the Overview frame's own interaction-states annotation panel, not product copy.",
  },
  {
    fileName: 'Chautauqua Overview.dc.html',
    line: 626,
    text: 'The button is the progress indicator and the only thing disabled — no spinner, no overlay, no fake percentage. The button never says "Sent!"; the result panel reports.',
    reason: "the Overview frame's own interaction-states annotation panel, not product copy.",
  },
];

/** (b) FIXTURE -- invented sample identities and sample body text used as
 * mock data inside a frame, not a caption a real screen draws. Each entry
 * asserted below to still resolve to its cited file:line:text in the
 * current pack. */
const FIXTURE_EXCLUSIONS: Exclusion[] = [
  {
    fileName: 'Chautauqua Public and Portal.dc.html',
    line: 464,
    text: 'Priya Raman · Latticework Systems',
    reason: 'invented sample speaker identity used as mock card content, not a real UI caption.',
  },
  {
    fileName: 'Chautauqua Public and Portal.dc.html',
    line: 1081,
    text: 'Priya Raman · Latticework Systems',
    reason: 'invented sample speaker identity used as mock card content, not a real UI caption.',
  },
  {
    fileName: 'Chautauqua Public and Portal.dc.html',
    line: 996,
    text: 'Priya Raman leads the build-tooling platform team at Latticework Systems. She maintained the open-source task runner gantry.',
    reason: 'invented sample speaker bio used as mock body text, not a real UI caption.',
  },
  {
    fileName: 'Chautauqua Speakers.dc.html',
    line: 346,
    text: 'Priya Raman leads the build-tooling platform team at Latticework Systems. She maintained the open-source task runner gantry and speaks on build systems and CI reliability.',
    reason: 'invented sample speaker bio used as mock body text, not a real UI caption.',
  },
  {
    fileName: 'Chautauqua Review.dc.html',
    line: 256,
    text: 'Strong practical content and a clear narrative arc; abstract could name the specific tooling used. Recommend accept for the AI track.',
    reason: 'invented sample reviewer comment used as mock body text, not a real UI caption.',
  },
  {
    fileName: 'Chautauqua Review.dc.html',
    line: 333,
    text: 'Strong practical content and a clear narrative arc; abstract could name the specific tooling used. Recommend accept for the AI track.',
    reason: 'invented sample reviewer comment used as mock body text, not a real UI caption.',
  },
];

/** (c) COMPOSED -- DEC-976 wave-135's fourth exclusion class. A caption
 * here IS product copy the app draws (unlike EXPLAINER/FIXTURE above), but
 * it never appears in source as one static substring the way a plain label
 * does, so this ledger's plain-substring MATCH can never find it. Each
 * entry's `reason` names, in a full sentence, exactly one of three legal
 * shapes -- and (DEC-099) always names a MECHANISM, never a schedule or a
 * branch/wave name:
 *
 *   (i) COMPOSED-from-data -- the frame's exact words are assembled at
 *       render time from live record data (a name, a count, a label, a
 *       saved-view's own filter state, ...). The reason quotes the
 *       composing expression VERBATIM with its file:line coordinate, so the
 *       exclusion is itself a citation a future reader can re-grep.
 *   (ii) PARTIAL -- the app draws the reader-facing clause of the caption
 *        (a real substring match, findable by eye in the source), and the
 *        remaining residue is the PACK'S OWN NOTE about how the control
 *        that clause names actually behaves -- not copy the screen renders
 *        at all. The reason cites the file:line where that behaviour is
 *        implemented, so the "residue is just an annotation" claim is
 *        itself checkable.
 *   (iii) BLESSED/DEFERRED -- the caption draws a feature or rework the
 *         build does not carry, and DEVIATIONS.md §6 (or a DEC ruling) has
 *         already settled that as scope, not a defect. The reason quotes
 *         the deferring bullet's own words. DEVIATIONS.md is never edited
 *         by an entry here -- this table only cites it.
 *
 * Every entry below is shape (i) or (iii); each entry's composing
 * expression (or deferring bullet) was verified to exist on the branch that
 * wrote it -- the fifteen candidates named for this lane, four could not be
 * verified against source as it stands today and are not entered here:
 * Chautauqua Speakers.dc.html:479 (no facet composes a person's name from
 * the roster -- narrowing.ts's own header comment says so: "the frame's
 * person-name clause ... comes from the SEARCH term the organiser typed,
 * never a name synthesised from the roster"), Chautauqua Comms.dc.html:769
 * (no `session_time` merge field or matching warning sentence exists
 * anywhere in app/src or src today), and Chautauqua Settings.dc.html:1175
 * and :1400 (DEVIATIONS.md §6 carries no bullet deferring either row yet --
 * per this lane's own instructions, an in-flight sibling wave may add them
 * later). Each is left in the graded, unexcluded population until its own
 * citation exists to write down. */
const COMPOSED_EXCLUSIONS: Exclusion[] = [
  {
    fileName: 'Chautauqua Settings.dc.html',
    line: 614,
    text: 'Settings · Call for papers',
    reason:
      "app/src/pages/Settings.tsx:351 composes the fixed 'Settings' word with the live section label as `&lsaquo; {editingSection ? editingSection.label : 'Settings'}`; editingSection.label is 'Call for papers' for the cfp section (SECTIONS[1].label, Settings.tsx:82).",
  },
  {
    fileName: 'Chautauqua Settings.dc.html',
    line: 795,
    text: 'Settings · Tracks and rooms',
    reason:
      "the same Settings.tsx:351 composing expression; editingSection.label is 'Tracks and rooms' for the tracks-rooms section (SECTIONS[2].label, Settings.tsx:90).",
  },
  {
    fileName: 'Chautauqua Settings.dc.html',
    line: 876,
    text: 'Settings · Speaker portal',
    reason:
      "the same Settings.tsx:351 composing expression; editingSection.label is 'Speaker portal' for the portal section (SECTIONS[4].label, Settings.tsx:106).",
  },
  {
    fileName: 'Chautauqua Settings.dc.html',
    line: 957,
    text: 'Settings · People and roles',
    reason:
      "the same Settings.tsx:351 composing expression; editingSection.label is 'People and roles' for the people section (SECTIONS[6].label, Settings.tsx:124).",
  },
  {
    fileName: 'Chautauqua Settings.dc.html',
    line: 1028,
    text: 'Settings · Public pages · AI track sessions',
    reason:
      "the same Settings.tsx:351 composing expression supplies 'Settings · Public pages' (editingSection.label 'Public pages', SECTIONS[3].label, Settings.tsx:98); the trailing embed name is the live `{embed.name}` at app/src/pages/settings/SavedEmbedsPanel.tsx:239.",
  },
  {
    fileName: 'Chautauqua Settings.dc.html',
    line: 1118,
    text: 'Settings · Your data',
    reason:
      "the same Settings.tsx:351 composing expression; editingSection.label is 'Your data' for the your-data section (SECTIONS[5].label, Settings.tsx:116).",
  },
  {
    fileName: 'Chautauqua Settings.dc.html',
    line: 669,
    text: 'Three tracks, five formats, no account needed. We email you a portal link, and you can edit until the form closes.',
    reason:
      "src/routes/public/submit-views.tsx:464-470 composes the lede's opening clause from the event's own live track/format counts -- `const trackCount = tracks.length;` / `const formatCount = (formatField?.options ?? []).length;` feeding `ledeParts`, joined into `introLede` at :470 -- the DEC-986 organiser-authored form.description overrides the tail sentence, so only the counted opening clause is this mechanism's own words.",
  },
  {
    fileName: 'Chautauqua Speakers.dc.html',
    line: 326,
    text: 'Speakers · Priya Raman',
    reason:
      "app/src/pages/speakers/SpeakerDetailPage.tsx:495-497 draws the fixed '‹ Speakers' back link beside `<h1 className=\"chq-page-title\">{detail.contact.name}</h1>`, the live contact's name.",
  },
  {
    fileName: 'Chautauqua Speakers.dc.html',
    line: 530,
    text: 'Or paste this into your browser: chautauqua.cc/portal/tasks',
    reason:
      'src/mail/shell.ts:65 composes `Or paste this into your browser: ${escapeHtml(opts.cta.href)}` from the mail CTA’s live href.',
  },
  {
    fileName: 'Chautauqua Submissions.dc.html',
    line: 538,
    text: 'Pending · AI Engineering · newest first',
    reason:
      "app/src/pages/submissions/ViewTabs.tsx's summarizeFilters (DEC-750, :105-116) composes the save-view subtitle from the current status/search/track/sort filter state, joined with `parts.join(' · ')` at :116.",
  },
  {
    fileName: 'Chautauqua Comms.dc.html',
    line: 267,
    text: 'Six available · dropped in at the cursor',
    reason:
      'app/src/pages/comms/InsertFieldMenu.tsx:44 composes `{fields.length} available &middot; dropped in at the cursor` from the live merge-field count.',
  },
];

function isExcluded(c: Caption, table: Exclusion[]): boolean {
  return table.some((e) => e.fileName === c.fileName && e.line === c.line && e.text === c.text);
}

const CAPTIONS_AFTER_EXCLUSION: Caption[] = ALL_CAPTIONS.filter(
  (c) =>
    !isExcluded(c, EXPLAINER_EXCLUSIONS) &&
    !isExcluded(c, FIXTURE_EXCLUSIONS) &&
    !isExcluded(c, COMPOSED_EXCLUSIONS)
);

// -- Match side: every non-test .ts/.tsx/.css/.md under app/src/** and src/**

function isSourceFile(name: string): boolean {
  return name.endsWith('.ts') || name.endsWith('.tsx') || name.endsWith('.css') || name.endsWith('.md');
}

/** Every .ts/.tsx/.css/.md file under `root`, skipping any path containing
 * `.test.`, enumerated via readdirSync rather than named (DEC-808). */
export function enumerateSourceFiles(root: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(root, { withFileTypes: true, recursive: true })) {
    if (!entry.isFile() || !isSourceFile(entry.name)) continue;
    const full = join(entry.parentPath, entry.name);
    if (full.includes('.test.')) continue;
    out.push(full);
  }
  return out.sort();
}

type ScanState = 'normal' | 'single' | 'double' | 'template' | 'line' | 'block';

/** Single left-to-right scanner that strips block and line comments while
 * tracking `'`/`"`/`` ` `` string and template-literal state and stepping
 * over backslash escapes -- the same string-aware shape
 * test/frame-source-corpus.ts's stripComments uses (DEC-967 wave-130), so a
 * `//`/`/*` inside a string literal is never mistaken for a real comment
 * opener. Re-implemented here (rather than imported) because this ledger's
 * own entity table below is wider than that module's, and the two must stay
 * one function each, not a shared function called with two different entity
 * tables threaded through it. */
export function stripComments(src: string): string {
  let out = '';
  let i = 0;
  const n = src.length;
  let state: ScanState = 'normal';

  while (i < n) {
    const c = src[i]!;
    const c2 = i + 1 < n ? src[i + 1] : undefined;

    if (state === 'normal') {
      if (c === '/' && c2 === '/') {
        state = 'line';
        out += ' ';
        i += 2;
        continue;
      }
      if (c === '/' && c2 === '*') {
        state = 'block';
        out += ' ';
        i += 2;
        continue;
      }
      if (c === "'" || c === '"' || c === '`') {
        state = c === "'" ? 'single' : c === '"' ? 'double' : 'template';
        out += c;
        i += 1;
        continue;
      }
      out += c;
      i += 1;
      continue;
    }

    if (state === 'line') {
      if (c === '\n') {
        state = 'normal';
        out += c;
      }
      i += 1;
      continue;
    }

    if (state === 'block') {
      if (c === '*' && c2 === '/') {
        state = 'normal';
        out += ' ';
        i += 2;
        continue;
      }
      i += 1;
      continue;
    }

    const quoteChar = state === 'single' ? "'" : state === 'double' ? '"' : '`';
    if (c === '\\') {
      out += c;
      if (c2 !== undefined) out += c2;
      i += 2;
      continue;
    }
    out += c;
    i += 1;
    if (c === quoteChar) state = 'normal';
    continue;
  }

  return out;
}

// Wide entity table -- DEC-976 wave-133's own list, beyond
// test/frame-source-corpus.ts's set (which lacks &hellip; &quot; &#39;
// &ldquo; &rdquo; &lt; &gt;).
const ENTITY_MAP: Record<string, string> = {
  '&amp;': '&',
  '&lsaquo;': '‹',
  '&rsaquo;': '›',
  '&nbsp;': ' ',
  '&middot;': '·',
  '&hellip;': '…',
  '&quot;': '"',
  '&#39;': "'",
  '&mdash;': '—',
  '&ndash;': '–',
  '&ldquo;': '“',
  '&rdquo;': '”',
  '&lt;': '<',
  '&gt;': '>',
};

/** Strips comments (string/template-aware), decodes this ledger's wide HTML
 * entity table, and collapses whitespace runs to a single space. Applied
 * identically to both the frame-pack side and the source-corpus side. */
export function normalizeCaption(raw: string): string {
  let s = stripComments(raw);
  for (const [entity, char] of Object.entries(ENTITY_MAP)) {
    s = s.split(entity).join(char);
  }
  return s.replace(/\s+/g, ' ').trim();
}

/** True when `text` (normalized) occurs verbatim as a substring of some
 * already-normalized source blob. Plain substring, not boundary-anchored:
 * every population member here is >= 20 chars (the population's own length
 * discriminator), so an accidental in-word collision is not a realistic
 * risk the way it is for a short control label. */
export function captionIsMatched(text: string, normalizedBlobs: string[]): boolean {
  const needle = normalizeCaption(text);
  if (needle.length === 0) return false;
  return normalizedBlobs.some((blob) => blob.includes(needle));
}

const SOURCE_FILES = [...enumerateSourceFiles(APP_SRC_ROOT), ...enumerateSourceFiles(SRC_ROOT)];
const NORMALIZED_SOURCE_BLOBS: string[] = SOURCE_FILES.map((f) => normalizeCaption(readFileSync(f, 'utf-8')));

const UNMATCHED: Caption[] = CAPTIONS_AFTER_EXCLUSION.filter(
  (c) => !captionIsMatched(c.text, NORMALIZED_SOURCE_BLOBS)
);

// -- Ratchet -------------------------------------------------------------
// Re-measured on this branch (v12m-w10-ee, DEC-976 wave-135) by forcing this
// const to -1 and reading the printed offender list: population 233
// muted-prose captions across 13 frame files (>= 20 chars, no digit, no
// `@`, not text-transform:uppercase), 29 excluded (12 EXPLAINER, 6 FIXTURE,
// 11 COMPOSED), 204 graded, 59 unmatched by any normalized app/src or src
// source file. The COMPOSED table adds 11 of the 15 rows named for this
// lane; the other 4 (Speakers.dc.html:479, Comms.dc.html:769,
// Settings.dc.html:1175, :1400) could not be verified against source as it
// stands today and stay in the graded, unexcluded population -- see the
// COMPOSED_EXCLUSIONS doc comment above. May only be RAISED as a
// merge-train act if a future predicate widening surfaces more real
// divergences, and should be LOWERED as sibling lanes close real
// caption/consequence gaps.
export const FRAME_CAPTION_UNMATCHED_CEILING = 59;

describe('frame caption/consequence ledger (DEC-976 wave-133, v12 mobile campaign)', () => {
  it('non-vacuity: population is large and spans many frames and many source files (vacuous-grammar guard)', () => {
    expect(ALL_CAPTIONS.length).toBeGreaterThan(150);
    const distinctFiles = new Set(ALL_CAPTIONS.map((c) => c.fileName));
    expect(distinctFiles.size).toBeGreaterThanOrEqual(10);
    expect(SOURCE_FILES.length).toBeGreaterThanOrEqual(100);
  });

  it('enumerates exactly 233 population-qualifying captions across 13 files (vacuous-population tripwire)', () => {
    expect(designFiles().length).toBe(13);
    expect(ALL_CAPTIONS.length).toBe(233);
  });

  it('non-vacuity: synthetic positive/negative controls over a fabricated single-file population, never a live product count', () => {
    const fabricatedFrameText = [
      '<div style="display:flex; flex-direction:column">',
      '  <p style="margin:0; font-size:16px; color:#3F4237">Zzy Synthetic Caption present in the corpus below and long enough to qualify.</p>',
      '  <span style="font-size:13px; color:#565A4B">Zzy Synthetic Caption absent from the corpus below and long enough to qualify.</span>',
      // Excluded by the digit discriminator: never enters the population.
      '  <span style="font-size:13px; color:#565A4B">Zzy Synthetic Caption with a digit 7 in it, long enough otherwise.</span>',
      // Excluded by text-transform:uppercase: an eyebrow chip, not prose.
      '  <span style="font-size:13px; color:#565A4B; text-transform:uppercase">Zzy Synthetic Eyebrow Chip Not Counted At All Here</span>',
      // Excluded by the < / > containment rule: wraps further markup.
      '  <div style="color:#3F4237"><span>Zzy Synthetic Nested Markup Not Counted</span></div>',
      '</div>',
    ].join('\n');

    const extracted = captionsInText(fabricatedFrameText);
    const extractedTexts = extracted.map((e) => e.text);
    expect(extractedTexts).toContain(
      'Zzy Synthetic Caption present in the corpus below and long enough to qualify.'
    );
    expect(extractedTexts).toContain(
      'Zzy Synthetic Caption absent from the corpus below and long enough to qualify.'
    );
    expect(extractedTexts.some((t) => t.includes('with a digit'))).toBe(false);
    expect(extractedTexts.some((t) => t.includes('Eyebrow Chip'))).toBe(false);
    expect(extractedTexts.some((t) => t.includes('Nested Markup'))).toBe(false);

    // Fabricated single-file "source" population: wraps the PRESENT caption
    // across three JSX-style lines, writes its own `&mdash;` as an entity,
    // and puts the ABSENT caption only inside a comment that must be
    // stripped before matching.
    const fabricatedSource = [
      '// this comment mentions "Zzy Synthetic Caption absent from the corpus below and long enough to qualify." and must not satisfy it',
      'const caption = (',
      '  <p>',
      '    Zzy Synthetic Caption present in the corpus',
      '    below and long enough to qualify. &mdash; end',
      '  </p>',
      ');',
    ].join('\n');
    const normalized = [normalizeCaption(fabricatedSource)];

    expect(
      captionIsMatched(
        'Zzy Synthetic Caption present in the corpus below and long enough to qualify.',
        normalized
      )
    ).toBe(true);
    expect(
      captionIsMatched(
        'Zzy Synthetic Caption absent from the corpus below and long enough to qualify.',
        normalized
      )
    ).toBe(false);
  });

  it('EXPLAINER exclusions each resolve to their cited file:line:text in the current pack', () => {
    for (const e of EXPLAINER_EXCLUSIONS) {
      const hit = ALL_CAPTIONS.find((c) => c.fileName === e.fileName && c.line === e.line && c.text === e.text);
      expect(hit, `${e.fileName}:${e.line} no longer resolves to the cited text in the pack`).toBeDefined();
    }
  });

  it('FIXTURE exclusions each resolve to their cited file:line:text in the current pack', () => {
    for (const e of FIXTURE_EXCLUSIONS) {
      const hit = ALL_CAPTIONS.find((c) => c.fileName === e.fileName && c.line === e.line && c.text === e.text);
      expect(hit, `${e.fileName}:${e.line} no longer resolves to the cited text in the pack`).toBeDefined();
    }
  });

  it('COMPOSED exclusions each resolve to their cited file:line:text in the current pack', () => {
    for (const e of COMPOSED_EXCLUSIONS) {
      const hit = ALL_CAPTIONS.find((c) => c.fileName === e.fileName && c.line === e.line && c.text === e.text);
      expect(hit, `${e.fileName}:${e.line} no longer resolves to the cited text in the pack`).toBeDefined();
    }
  });

  it(`never exceeds FRAME_CAPTION_UNMATCHED_CEILING (${FRAME_CAPTION_UNMATCHED_CEILING}) unmatched captions`, () => {
    if (UNMATCHED.length > FRAME_CAPTION_UNMATCHED_CEILING) {
      const offenders = UNMATCHED.map((c) => `${c.fileName}:${c.line} -- "${c.text}"`);
      throw new Error(
        `${UNMATCHED.length} frame captions are unmatched by any app source file, above the ceiling of ` +
          `${FRAME_CAPTION_UNMATCHED_CEILING}. FRAME_CAPTION_UNMATCHED_CEILING may only be RAISED (a ` +
          `merge-train act, never a worker's edit mid-lane), and only once re-measured against the integrated ` +
          `tree. Offenders:\n${offenders.join('\n')}`
      );
    }
    expect(UNMATCHED.length).toBeLessThanOrEqual(FRAME_CAPTION_UNMATCHED_CEILING);
  });

  it(`never sits BELOW FRAME_CAPTION_UNMATCHED_CEILING (${FRAME_CAPTION_UNMATCHED_CEILING}) without the ceiling being lowered to match (a stale ceiling licenses stagnation)`, () => {
    if (UNMATCHED.length < FRAME_CAPTION_UNMATCHED_CEILING) {
      throw new Error(
        `${UNMATCHED.length} frame captions are unmatched, below the ceiling of ${FRAME_CAPTION_UNMATCHED_CEILING}. ` +
          `This is the ratchet working: coverage landed. Lower the ceiling in the same commit (a merge-train act) ` +
          `by replacing the line:\n  export const FRAME_CAPTION_UNMATCHED_CEILING = ${UNMATCHED.length};`
      );
    }
    expect(UNMATCHED.length).toBeGreaterThanOrEqual(FRAME_CAPTION_UNMATCHED_CEILING);
  });
});
