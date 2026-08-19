// Design pack v12 (docs/design/DESIGN-RULINGS.md, "The wordmark needs an
// optical nudge, and it depends on the alignment mode").
//
// Familjen Grotesk's font box is asymmetric — at 22px it reports ascent 23 /
// descent 5, so 1.27em of ink inside a 1em box, and the glyphs land ~3px
// below the box's own centre. Beside Figtree (near-symmetric) in a flex
// header the wordmark therefore reads low. The offset is line-height-
// invariant: growing the line box by d moves the baseline and the box centre
// by the same d/2, so no line-height value reconciles them and the SAME
// nudge is owed whether the box is line-height:1 (as the frames write it) or
// 1.08 (DEC-991's floor for the display face, which is why the app never
// writes the frames' literal 1).
//
// The ruling in one sentence: NUDGE THE OUTERMOST ELEMENT THAT CARRIES THE
// WORDMARK'S INK.
//   - align-items:center header  -> the nudge rides the wordmark itself.
//   - align-items:baseline run   -> the nudge rides the RUN. Baseline
//     alignment reconciles the run's children with each other, never the
//     pair with the centred bar, and `top` is a post-layout offset baseline
//     alignment cannot absorb — so nudging the inner span breaks the shared
//     baseline instead of fixing the header.
//
// This file is the inventory. It exists because "a find-and-replace on the
// wordmark string alone will hit the wrong element in baseline runs" — the
// failure mode is silent, so the alignment mode is asserted alongside the
// nudge at every site.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, '..');

function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '');
}

const SOURCES: Record<string, string> = {};
function source(rel: string): string {
  // `${SHARED_FRAGMENT}` interpolations inside a .css.ts template literal
  // carry braces that would end a rule body early (home.css.ts's
  // HOME_CHROME_GUTTER sits mid-rule in .chq-home-header). Drop the
  // placeholder; nothing this file asserts lives inside one.
  SOURCES[rel] ??= stripComments(readFileSync(join(REPO_ROOT, rel), 'utf-8')).replace(/\$\{[^{}]*\}/g, '');
  return SOURCES[rel]!;
}

/** First rule body for an exact selector. */
function ruleBody(rel: string, selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const m = source(rel).match(new RegExp(`(?:^|[};])\\s*${escaped}\\s*\\{([^{}]*)\\}`, 'm'));
  expect(m, `no rule for ${selector} in ${rel}`).not.toBeNull();
  return m![1]!;
}

function declValue(body: string, prop: string): string | undefined {
  const m = body.match(new RegExp(`(?:^|;)\\s*${prop}\\s*:\\s*([^;]+)`));
  return m ? m[1]!.trim() : undefined;
}

/** The ruling's scale: -3px at 22px, -2.5px at 20px, -2px at 17px. */
const NUDGE_BY_SIZE: Record<string, string> = { '22px': '-3px', '20px': '-2.5px', '17px': '-2px' };

interface Ref {
  file: string;
  selector: string;
}

interface Site {
  name: string;
  /** The centred header bar the wordmark's ink is measured against. */
  header: Ref;
  /** The element that must carry the nudge — outermost ink-carrying box. */
  nudged: Ref;
  /** The element whose font-size sets the nudge magnitude. */
  sized: Ref;
  /** Present iff the wordmark sits in an align-items:baseline run: the run
   * (which is `nudged`) and the inner wordmark that must NOT carry a `top`. */
  run?: { align: Ref; reset: Ref };
}

const APP_CSS = 'app/src/styles.css';
const THEME = 'src/views/theme.ts';
const PORTAL_CSS = 'src/routes/portal/portal.css.ts';
const DOCS_CSS = 'src/routes/docs-site.css.ts';
const HOME_CSS = 'src/routes/public/home.css.ts';

const SITES: Site[] = [
  {
    name: 'admin SPA header, centred (app/src/App.tsx)',
    header: { file: APP_CSS, selector: '.chq-header' },
    nudged: { file: APP_CSS, selector: '.chq-wordmark' },
    sized: { file: APP_CSS, selector: '.chq-wordmark' },
  },
  {
    name: 'SSR operator shell, centred — API docs, dev mailbox, tools (src/views/theme.ts)',
    header: { file: THEME, selector: '.chq-header' },
    nudged: { file: THEME, selector: '.chq-wordmark' },
    sized: { file: THEME, selector: '.chq-wordmark' },
  },
  {
    name: 'public home / hub header, centred (src/routes/root.tsx)',
    header: { file: HOME_CSS, selector: '.chq-home-header' },
    nudged: { file: HOME_CSS, selector: '.chq-home-org' },
    sized: { file: HOME_CSS, selector: '.chq-home-org' },
  },
  {
    name: 'docs site header — baseline run, wordmark + "Docs"',
    header: { file: DOCS_CSS, selector: '.chq-docs-header' },
    nudged: { file: DOCS_CSS, selector: '.chq-docs-brandrow' },
    sized: { file: DOCS_CSS, selector: '.chq-docs-wordmark' },
    run: {
      align: { file: DOCS_CSS, selector: '.chq-docs-brandrow' },
      reset: { file: DOCS_CSS, selector: '.chq-docs-wordmark' },
    },
  },
  {
    name: 'portal header — baseline run, wordmark + event name',
    header: { file: THEME, selector: '.chq-header' },
    nudged: { file: PORTAL_CSS, selector: '.chq-portal-brandline' },
    sized: { file: THEME, selector: '.chq-wordmark' },
    run: {
      align: { file: PORTAL_CSS, selector: '.chq-portal-brandline' },
      reset: { file: PORTAL_CSS, selector: '.chq-portal-shell .chq-wordmark' },
    },
  },
];

describe('the wordmark optical nudge rides the outermost ink-carrying element (design pack v12)', () => {
  it('covers every wordmark render site the app has', () => {
    // Tripwire: a new header that draws the wordmark must be added here.
    expect(SITES).toHaveLength(5);
  });

  it.each(SITES)('$name: nudge magnitude matches the site font size', (site) => {
    const fontSize = declValue(ruleBody(site.sized.file, site.sized.selector), 'font-size');
    expect(fontSize, `${site.sized.selector} declares no font-size`).toBeDefined();
    const expected = NUDGE_BY_SIZE[fontSize!];
    expect(expected, `no ruled nudge for font-size ${fontSize}`).toBeDefined();

    const body = ruleBody(site.nudged.file, site.nudged.selector);
    expect(declValue(body, 'position')).toBe('relative');
    expect(declValue(body, 'top')).toBe(expected);
  });

  it.each(SITES)('$name: the header bar it is measured against is align-items:center', (site) => {
    expect(declValue(ruleBody(site.header.file, site.header.selector), 'align-items')).toBe('center');
  });

  it.each(SITES.filter((s) => s.run))('$name: the run is align-items:baseline and IS the nudged element', (site) => {
    const run = site.run!;
    expect(declValue(ruleBody(run.align.file, run.align.selector), 'align-items')).toBe('baseline');
    expect(site.nudged.selector).toBe(run.align.selector);
  });

  it.each(SITES.filter((s) => s.run))(
    '$name: the wordmark INSIDE the baseline run carries no offset of its own',
    (site) => {
      // A `top` here would break the run's shared baseline — `top` is a
      // post-layout offset baseline alignment cannot absorb — which is
      // exactly the failure the ruling warns a find-and-replace produces.
      // Where a broader rule already sets position:relative (theme.ts's
      // .chq-wordmark reaches into the portal), the reset must be explicit.
      const body = ruleBody(site.run!.reset.file, site.run!.reset.selector);
      expect(declValue(body, 'top')).toBeUndefined();
      const position = declValue(body, 'position');
      expect(position === undefined || position === 'static').toBe(true);
    },
  );

  it('no site reaches for line-height:1 to fix this (DEC-991 bans it on the display face; the nudge is line-height-invariant)', () => {
    for (const site of SITES) {
      const lh = declValue(ruleBody(site.nudged.file, site.nudged.selector), 'line-height');
      if (lh === undefined) continue;
      expect(parseFloat(lh), `${site.nudged.selector} in ${site.nudged.file}`).toBeGreaterThan(1);
    }
  });
});
