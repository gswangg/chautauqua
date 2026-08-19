// v12 design pack -- the reviewer's two list surfaces at 390
// (DEC-874 wave-86, DEC-385 wave-85, task w4-g):
//
//   "Your plans · /review", the hub -- receipted per-line below
//   "Reviewer queue · /review/plans/:id" -- receipted per-line below
//
// jsdom applies no stylesheet and evaluates no @media rule, so -- mirroring
// app/src/pages/contacts/contacts-phone-frames.test.ts and
// app/src/phone-page-scaffold.test.ts -- these are source-scan pins on the
// CSS TEXT of review.css (and, for the shared scaffold classes, styles.css)
// plus the JSX TEXT of ReviewerQueue.tsx, not computed style.
//
// Two standing rules pinned alongside the frame geometry:
//
//   * DEC-385 single-direction: the phone layer is `@media (max-width: …)`
//     ONLY -- a min-width query anywhere in review.css is a hard failure
//     here.
//   * DEC-874 wave-86: neither frame renders a page-level Sign out control
//     -- that stays the shell's single control (restored on phone by a
//     separate branch). ReviewerQueue.tsx must never mint its own.
//
// Desktop is frozen: every phone assertion below reads only inside a
// max-width block or a scoped selector, and no desktop rule is touched.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, '..', '..', '..', '..');

/** Strips block comments before any brace scanning, mirroring
 * contacts-phone-frames.test.ts's `read` -- a literal `{`/`}` inside a long
 * explanatory comment must never desynchronise the depth counter. */
function read(path: string): string {
  return readFileSync(path, 'utf-8').replace(/\/\*[\s\S]*?\*\//g, '');
}

const REVIEW_CSS = read(join(HERE, 'review.css'));
const STYLES_CSS = read(join(REPO_ROOT, 'app/src/styles.css'));
const REVIEWER_QUEUE_TSX = readFileSync(join(HERE, 'ReviewerQueue.tsx'), 'utf-8');
const FRAME_FILE = join(REPO_ROOT, 'docs/design/Chautauqua Review.dc.html');
const FRAME_TEXT = readFileSync(FRAME_FILE, 'utf-8');
const FRAME_LINES = FRAME_TEXT.split('\n');

/** Confirms a citation's literal text is exactly what the frame file has on
 * that line (DEC-976: a citation is not an assertion by itself, so every
 * citation below is checked against the real bytes it names). */
function frameLine(lineNo: number): string {
  const line = FRAME_LINES[lineNo - 1];
  if (line === undefined) throw new Error(`docs/design/Chautauqua Review.dc.html has no line ${lineNo}`);
  return line;
}

/** Concatenated bodies of every `@media (max-width: …)` block in `css`,
 * brace-matched -- copied verbatim from contacts-phone-frames.test.ts /
 * phone-page-scaffold.test.ts's `phoneLayer`. */
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

/** A single rule's declaration body, by selector, inside `layer`. Selectors
 * are compared as WHOLE members of the rule's selector list. */
function ruleIn(layer: string, selector: string): string {
  const rule = /([^{}]+)\{([^{}]*)\}/g;
  let m: RegExpExecArray | null;
  while ((m = rule.exec(layer)) !== null) {
    const selectors = m[1]!
      .split(',')
      .map((s) => s.trim().replace(/\s+/g, ' '))
      .filter(Boolean);
    if (selectors.includes(selector)) return m[2]!;
  }
  throw new Error(`no rule for ${selector} in given layer`);
}

const REVIEW_PHONE = phoneLayer(REVIEW_CSS);
const STYLES_PHONE = phoneLayer(STYLES_CSS);

describe('DEC-385: the review phone layer is single-direction', () => {
  it('review.css declares no min-width media query', () => {
    expect(REVIEW_CSS).not.toMatch(/@media[^{]*min-width/);
  });

  it('review.css has at least one max-width phone block', () => {
    expect(phoneLayer(REVIEW_CSS).length).toBeGreaterThan(0);
  });
});

describe('DEC-154/DEC-874 wave-91 amendment: ReviewerQueue.tsx uses the ONE sign-out contract', () => {
  it('ReviewerQueue.tsx makes no fetch() call and has no second \'/logout\' literal', () => {
    expect(REVIEWER_QUEUE_TSX).not.toMatch(/fetch\(/);
    expect(REVIEWER_QUEUE_TSX).not.toMatch(/\/logout/);
  });

  it('ReviewerQueue.tsx imports signOut from lib/api', () => {
    expect(REVIEWER_QUEUE_TSX).toMatch(/import\s*\{[^}]*\bsignOut\b[^}]*\}\s*from\s*'\.\.\/\.\.\/lib\/api'/);
  });
});

// This suite's per-line citations below (frame :799, :806, :811, :814,
// :793-801, :821) already receipt every claim inside this frame's
// 793-830 extent -- see the file header above for the frame's own
// opening-container citation and quote.
describe('"Your plans · /review" phone frame', () => {
  it('frame :799 draws the hub H1 at 25px, the drill register', () => {
    const literal =
      '        <h1 style="margin:0; font-family:\'Familjen Grotesk\', sans-serif; font-size:25px; font-weight:700; letter-spacing:-0.04em; line-height:1.05">17 left to score</h1>';
    expect(frameLine(799)).toBe(literal);
    // ReviewerQueue.tsx wraps both hub H1 branches in the shared
    // .chq-phone-head-drill scaffold, which consumes the SAME
    // --chq-type-page-title-phone-drill token the scoped queue route's own
    // head uses (styles.css, DEC-643) -- never a second 25px literal here.
    expect(REVIEWER_QUEUE_TSX).toMatch(/chq-phone-head chq-phone-head-drill">\s*<h1 className="chq-page-title">Your plans/);
    expect(REVIEWER_QUEUE_TSX).toMatch(
      /chq-phone-head chq-phone-head-drill">\s*<h1 className="chq-page-title">\{`\$\{leftTotal\} left to score`\}<\/h1>/,
    );
    const drillRule = ruleIn(STYLES_PHONE, '.chq-phone-head-drill .chq-page-title');
    expect(drillRule).toMatch(/font-size:\s*var\(--chq-type-page-title-phone-drill\)/);
  });

  it('frame :804-816 pairs the plan title and its state pill on one baseline row via display:contents', () => {
    const literal =
      '            <div style="display:flex; align-items:baseline; justify-content:space-between; gap:10px">';
    expect(frameLine(806)).toBe(literal);
    const rowRule = ruleIn(REVIEW_PHONE, '.chq-reviewer-plan-row');
    expect(rowRule).toMatch(/display:\s*grid/);
    expect(rowRule).toMatch(/'name pill'/);
    const nameLineRule = ruleIn(REVIEW_PHONE, '.chq-reviewer-plan-row-name-line');
    expect(nameLineRule).toMatch(/display:\s*contents/);
    const pillRule = ruleIn(REVIEW_PHONE, '.chq-reviewer-plan-row-pill');
    expect(pillRule).toMatch(/grid-area:\s*pill/);
  });

  it('frame :811 draws the card progress hairline at 5px -- the shared .chq-bar default, untouched', () => {
    const literal = '            <div style="height:5px; border-radius:99px; background:#E1DDCE; overflow:hidden">';
    expect(frameLine(811)).toBe(literal);
    const barRule = ruleIn(read(join(REPO_ROOT, 'app/src/styles.css')).replace(/@media[^{]*\{(?=((?:[^{}]*\{[^{}]*\}[^{}]*)*))\1\}/g, ''), '.chq-bar');
    expect(barRule).toMatch(/height:\s*5px/);
  });

  it('frame :814/:817 makes the action the row\'s LAST element, spanning full width, and the loose skip sentence stays a plain line', () => {
    const actionLine = '            <span style="{{ p.btnStyle }}">{{ p.btn }}</span>';
    expect(frameLine(814)).toBe(actionLine);
    const actionRule = ruleIn(REVIEW_PHONE, '.chq-reviewer-plan-row-action');
    expect(actionRule).toMatch(/grid-area:\s*action/);
    expect(actionRule).toMatch(/justify-self:\s*stretch/);
    expect(actionRule).toMatch(/min-height:\s*44px/);
    expect(actionRule).toMatch(/display:\s*flex/);
    expect(actionRule).toMatch(/align-items:\s*center/);
    expect(actionRule).toMatch(/padding:\s*0 16px/);
  });

  it('frame :793-801 draws no Plan/State/Your progress column head -- it is hidden at 390', () => {
    const headRowRule = ruleIn(REVIEW_PHONE, '.chq-reviewer-plan-head-row');
    expect(headRowRule).toMatch(/display:\s*none/);
  });

  it('frame :821 carries the hidden-scores note in a docked footer band, invisible above the breakpoint', () => {
    const literal = '        <span style="font-size:13px; color:#565A4B">Scores stay hidden from other reviewers</span>';
    expect(frameLine(821)).toBe(literal);
    expect(REVIEWER_QUEUE_TSX).toMatch(
      /chq-reviewer-plans-phone-note chq-phone-dock">Scores stay hidden from other reviewers<\/p>/,
    );
    // Hidden by default (no top-level rule outside any media block) --
    // mirrors phone-block-visibility.test.ts's own contract for
    // .chq-phone-* classes, extended here to this page-local sibling.
    const withoutMedia = REVIEW_CSS.replace(/@media[^{]*\{(?=((?:[^{}]*\{[^{}]*\}[^{}]*)*))\1\}/g, '');
    expect(withoutMedia).toMatch(/\.chq-reviewer-plans-phone-note\s*\{\s*display:\s*none;\s*\}/);
    const phoneNoteRule = ruleIn(REVIEW_PHONE, '.chq-reviewer-plans-phone-note');
    expect(phoneNoteRule).toMatch(/display:\s*flex/);
  });
});

// This suite's per-line citations below (frame :420, :419, :422-423,
// :434, :429-437, :441-443) already receipt every claim inside this
// frame's 413-451 extent -- see the file header above for the frame's own
// opening-container citation and quote.
describe('"Reviewer queue · /review/plans/:id" phone frame', () => {
  it('frame :420 draws the queue H1 at 25px through the same drill scaffold as the hub', () => {
    const literal =
      '        <h1 style="margin:0; font-family:\'Familjen Grotesk\', sans-serif; font-size:25px; font-weight:700; letter-spacing:-0.04em; line-height:1.05">11 left to score</h1>';
    expect(frameLine(420)).toBe(literal);
    expect(REVIEWER_QUEUE_TSX).toMatch(/chq-review-scoped-head chq-phone-head chq-phone-head-drill"/);
  });

  it('frame :419 draws an 11px/800/0.1em uppercase eyebrow, scoped to this head only', () => {
    const literal =
      '        <span style="font-size:11px; font-weight:800; letter-spacing:0.1em; text-transform:uppercase; color:#565A4B">Review · Wave 2</span>';
    expect(frameLine(419)).toBe(literal);
    const eyebrowRule = ruleIn(REVIEW_PHONE, '.chq-review-scoped-head .chq-section-label');
    expect(eyebrowRule).toMatch(/font-weight:\s*800/);
    expect(eyebrowRule).toMatch(/letter-spacing:\s*0\.1em/);
  });

  it('frame :422-423 draws a 6px progress hairline', () => {
    const literal = '        <div style="height:6px; border-radius:99px; background:#E1DDCE; overflow:hidden">';
    expect(frameLine(422)).toBe(literal);
    const progressRule = ruleIn(REVIEW_PHONE, '.chq-review-scoped-progress');
    expect(progressRule).toMatch(/height:\s*6px/);
  });

  it('frame :434 draws a 17px card title, one size down from the 20px desktop title', () => {
    const literal =
      '            <span style="font-family:\'Familjen Grotesk\', sans-serif; font-size:17px; font-weight:600; letter-spacing:-0.02em; line-height:1.3">{{ q.title }}</span>';
    expect(frameLine(434)).toBe(literal);
    const titleRule = ruleIn(REVIEW_PHONE, '.chq-review-queue-title');
    expect(titleRule).toMatch(/font-size:\s*17px/);
  });

  it('frame :429-437 stacks the card into one column so the action (:436) is its LAST, full-width element', () => {
    const rowLiteral =
      '          <div style="padding:15px 0; border-bottom:1px solid #E1DDCE; display:flex; flex-direction:column; gap:8px">';
    expect(frameLine(429)).toBe(rowLiteral);
    const rowRule = ruleIn(REVIEW_PHONE, '.chq-review-queue-row');
    expect(rowRule).toMatch(/display:\s*flex/);
    expect(rowRule).toMatch(/flex-direction:\s*column/);
    const actionRule = ruleIn(REVIEW_PHONE, '.chq-review-queue-row-action');
    expect(actionRule).toMatch(/width:\s*100%/);
  });

  it('frame :441-443 docks the footer with the hidden-scores line, no Sign out in the JSX', () => {
    const footerLiteral =
      '      <div style="flex-shrink:0; border-top:1px solid #1B1D17; background:#EFEBDF; padding:12px 16px 16px; display:flex; align-items:center; gap:12px">';
    expect(frameLine(441)).toBe(footerLiteral);
    // DEC-385 wave-91 amendment: this is the DESKTOP queue footer -- the
    // ONE phone dock per surface lives at ReviewerQueue.tsx's separate
    // `.chq-phone-dock chq-review-phone-dock` standing band (asserted
    // below), so this row no longer mints `.chq-phone-dock` itself.
    expect(REVIEWER_QUEUE_TSX).toMatch(/className="chq-review-queue-footer">/);
    expect(REVIEWER_QUEUE_TSX).toMatch(/className="chq-phone-dock chq-review-phone-dock"/);
    const dockRule = ruleIn(STYLES_PHONE, '.chq-phone-dock');
    expect(dockRule).toMatch(/position:\s*sticky/);
    expect(dockRule).toMatch(/bottom:\s*0/);
  });
});
