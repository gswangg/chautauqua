// v12m-w14-dd (DEC-393 wave-139 taxonomy; DEC-367 wave-138 third evasion
// mode): Public SSR cluster -- floor 15 bare anchors and close the search
// button's width evasion.
//
// DISPOSITION (DEC-393 wave-139, exactly three classes, chosen by grepping
// the markup under src/routes/public/*.tsx -- never inferred from the class
// name):
//   (a) REAL FLOOR (default) -- the token IS the tap target: asserted here
//       by requiring `min-height: 44px`, `display: flex`, `align-items:
//       center` and a non-zero horizontal padding all present on the
//       element-qualified selector's own rule.
//   (b) COMPOSITION-EXEMPT -- every markup site also carries an
//       already-floored sibling class: asserted by the literal grammar
//       `/^\s*\/\*\s*tap-floor-exempt:/` on a comment naming the sibling.
//   (c) MODIFIER-EXEMPT -- same grammar, naming the base class.
//
// One token in this task's docket (.chq-pub-accent-link) is graded
// differently than the docket named it: grepping every markup site under
// src/routes/public/*.tsx shows accent-link composes ALONE (no already-
// floored sibling) on four of its six sites (detail.tsx's Back link,
// speakers.tsx's two Show-more links), so it is graded REAL FLOOR here, not
// the MODIFIER-EXEMPT the docket suggested. See rail.css.ts's own comment
// at the accent-link phone rule for the full grep citation.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function read(relPath: string): string {
  return readFileSync(new URL(`../${relPath}`, import.meta.url), "utf8");
}

// Brace-matches the LAST top-level `@media (max-width: 700px) { ... }`
// block in a source string -- the sheet's one terminal phone block
// (DEC-385). Mirrors phone-cascade-order.scan.test.ts's brace-walking
// approach rather than a naive `\{[^}]*\}` regex, which would stop at the
// first nested rule's closing brace.
function terminalPhoneBlock(source: string): string {
  const openings: number[] = [];
  const re = /@media\s*\(max-width:\s*700px\)\s*\{/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(source))) {
    openings.push(m.index + m[0].length - 1); // index of the opening `{`
  }
  expect(openings.length, `expected at least one @media(max-width:700px) block in: ${source.slice(0, 80)}…`).toBeGreaterThan(0);
  const openIdx = openings[openings.length - 1]!;
  let depth = 0;
  for (let i = openIdx; i < source.length; i++) {
    if (source[i] === "{") depth++;
    else if (source[i] === "}") {
      depth--;
      if (depth === 0) return source.slice(openIdx + 1, i);
    }
  }
  throw new Error("unterminated @media block");
}

// Extracts the FIRST rule body for an element-qualified selector inside a
// block of CSS text (selector must appear literally, e.g.
// ".chq-pub-foo {" or "button.chq-pub-foo[type=submit] {").
function ruleBody(block: string, selectorLiteral: string): string {
  const escaped = selectorLiteral.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(escaped + "\\s*\\{([^}]*)\\}");
  const m = block.match(re);
  expect(m, `selector ${selectorLiteral} not found in phone block`).not.toBeNull();
  return m![1]!;
}

function assertRealFloor(block: string, selectorLiteral: string): void {
  const body = ruleBody(block, selectorLiteral);
  expect(body, `${selectorLiteral}: missing min-height:44px`).toMatch(/min-height:\s*44px/);
  expect(body, `${selectorLiteral}: missing display:flex`).toMatch(/display:\s*flex/);
  expect(body, `${selectorLiteral}: missing align-items:center`).toMatch(/align-items:\s*center/);
  const paddingMatch = body.match(/padding:\s*([^;]+);/);
  expect(paddingMatch, `${selectorLiteral}: missing a padding declaration`).not.toBeNull();
  const values = paddingMatch![1]!
    .trim()
    .split(/\s+/)
    .map((v) => parseFloat(v));
  // Horizontal padding is the 2nd/4th value in a 4-value shorthand, the 2nd
  // in a 2-value shorthand, or the only value in a 1-value shorthand.
  const horizontal = values.length === 1 ? values[0]! : values[1]!;
  expect(horizontal, `${selectorLiteral}: horizontal padding must be non-zero`).toBeGreaterThan(0);
}

const EXEMPT_GRAMMAR = /^\s*\/\*\s*tap-floor-exempt:/m;

function assertExempt(source: string, siblingName: string): void {
  expect(source, `expected a tap-floor-exempt comment naming ${siblingName}`).toMatch(EXEMPT_GRAMMAR);
  const commentMatch = source.match(/\/\*\s*tap-floor-exempt:[^*]*\*\//);
  expect(commentMatch).not.toBeNull();
  expect(commentMatch![0]).toContain(siblingName);
}

describe("v12m-w14-dd: public SSR cluster anchor floor (DEC-393 wave-139)", () => {
  it("agenda.css.ts: list-title/speaker-name REAL FLOOR, day-pill REAL FLOOR, day-pill-active MODIFIER-EXEMPT", () => {
    const src = read("src/routes/public/css/agenda.css.ts");
    const block = terminalPhoneBlock(src);
    assertRealFloor(block, ".chq-pub-agenda-list-title");
    assertRealFloor(block, ".chq-pub-speaker-name");
    // day-pill is interpolated (ACCENT_BOUND_CLASSES[1]) but renders as the
    // literal class .chq-pub-day-pill -- assert on the interpolation site's
    // rule body directly since the selector text itself isn't literal.
    const dayPillBodies = [...block.matchAll(/\$\{ACCENT_BOUND_CLASSES\[1\]\}\s*\{([^}]*)\}/g)];
    expect(dayPillBodies.length).toBeGreaterThan(0);
    const dayPillBody = dayPillBodies[dayPillBodies.length - 1]!;
    expect(dayPillBody[1]).toMatch(/min-height:\s*44px/);
    expect(dayPillBody[1]).toMatch(/display:\s*flex/);
    expect(dayPillBody[1]).toMatch(/align-items:\s*center/);
    expect(dayPillBody[1]).toMatch(/padding:\s*0\s+15px/);
    assertExempt(src, "chq-pub-day-pill");
  });

  it("cards.css.ts: session-title and headshot-link REAL FLOOR", () => {
    const src = read("src/routes/public/css/cards.css.ts");
    const block = terminalPhoneBlock(src);
    assertRealFloor(block, ".chq-pub-session-title");
    assertRealFloor(block, ".chq-pub-headshot-link");
  });

  it("chrome.css.ts: activefilters-chip/-clear and select-clear REAL FLOOR; search-submit width evasion closed", () => {
    const src = read("src/routes/public/css/chrome.css.ts");
    const block = terminalPhoneBlock(src);
    assertRealFloor(block, ".chq-pub-activefilters-chip");
    assertRealFloor(block, ".chq-pub-activefilters-clear");
    assertRealFloor(block, ".chq-pub-select-clear");
    // DEC-367 wave-138 third evasion mode: the phone rule already declares
    // every clause of the floor and still measured 40px wide because the
    // base rule's width:40px survives -- width:auto + min-width:44px closes
    // it without touching the desktop rule.
    const submitBody = ruleBody(block, "button.chq-pub-search-submit[type=submit]");
    expect(submitBody).toMatch(/width:\s*auto/);
    expect(submitBody).toMatch(/min-width:\s*44px/);
  });

  it("empty.css.ts: a new terminal ≤700px block floors empty-escape", () => {
    const src = read("src/routes/public/css/empty.css.ts");
    // This sheet had NO 700px block before this task -- assert exactly one
    // exists now, as the last top-level construct.
    const mediaCount = (src.match(/@media\s*\(max-width:\s*700px\)/g) ?? []).length;
    expect(mediaCount).toBe(1);
    const lastMediaIdx = src.lastIndexOf("@media (max-width: 700px)");
    const lastConstructIdx = src.lastIndexOf("`;");
    expect(lastMediaIdx).toBeGreaterThan(-1);
    expect(lastMediaIdx).toBeLessThan(lastConstructIdx);
    const block = terminalPhoneBlock(src);
    assertRealFloor(block, ".chq-pub-empty-escape");
  });

  it("rail.css.ts: rail-cfp-link/-programme-link, schedule-browse-link, schedule-row-title, accent-link REAL FLOOR", () => {
    const src = read("src/routes/public/css/rail.css.ts");
    const block = terminalPhoneBlock(src);
    assertRealFloor(block, ".chq-pub-rail-cfp-link");
    assertRealFloor(block, ".chq-pub-rail-programme-link");
    assertRealFloor(block, ".chq-pub-schedule-browse-link");
    assertRealFloor(block, ".chq-pub-schedule-row-title");
    // accent-link is interpolated (ACCENT_BOUND_CLASSES[2]) at its base
    // (color-only) rule, but this task's phone floor is added on the
    // literal selector directly.
    assertRealFloor(block, ".chq-pub-accent-link");
  });
});
