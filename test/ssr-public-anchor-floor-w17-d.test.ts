// v12m-w17-d (DEC-393 wave-142 fourth evasion mode -- classless SSR anchor):
// floors the public event surfaces' confirmed-live classless anchors --
// .chq-pub-rail-day-row a (three markup sites: sessions.tsx's day tabs,
// agenda-rail.tsx's rooms-in-use and track-highlight rows),
// .chq-pub-agenda-block-title a (agenda-grid.tsx's card-title drill-in),
// and detail.tsx's three anchors (two REAL FLOOR list-row links, one
// inline-in-prose EXEMPT speaker byline). Disposition is decided by the
// markup the anchor sits in, never by its href or its words (DEC-393).
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function read(relPath: string): string {
  return readFileSync(new URL(`../${relPath}`, import.meta.url), "utf8");
}

// Mirrors ssr-public-anchor-floor.test.ts's own brace-walker: the sheet's
// ONE terminal @media (max-width: 700px) block (DEC-385).
function terminalPhoneBlock(source: string): string {
  const openings: number[] = [];
  const re = /@media\s*\(max-width:\s*700px\)\s*\{/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(source))) {
    openings.push(m.index + m[0].length - 1);
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
  const horizontal = values.length === 1 ? values[0]! : values[1]!;
  expect(horizontal, `${selectorLiteral}: horizontal padding must be non-zero`).toBeGreaterThan(0);
}

const EXEMPT_GRAMMAR = /^\s*\/\*\s*tap-floor-exempt:/m;

function assertExempt(source: string, tokenName: string): void {
  const re = new RegExp(`\\/\\*\\s*tap-floor-exempt:[^*]*\\*\\/\\s*[^{}]*\\.${tokenName}\\b[^{}]*\\{([^}]*)\\}`);
  const m = source.match(re);
  expect(m, `expected a tap-floor-exempt comment directly above a real .${tokenName} rule`).not.toBeNull();
  expect(m![1]!.trim().length, `${tokenName}: exempt rule must actually declare something`).toBeGreaterThan(0);
}

describe("v12m-w17-d: public event surfaces' classless anchor floor (DEC-393 wave-142)", () => {
  it("rail.css.ts: rail-day-row link, agenda-block-title link, detail social/session links REAL FLOOR", () => {
    const src = read("src/routes/public/css/rail.css.ts");
    const block = terminalPhoneBlock(src);
    assertRealFloor(block, ".chq-pub-rail-day-row a");
    assertRealFloor(block, ".chq-pub-agenda-block-title a");
    assertRealFloor(block, ".chq-pub-detail-social-link");
    assertRealFloor(block, ".chq-pub-detail-session-link");
  });

  it("rail.css.ts: detail speaker byline is EXEMPT (inline-in-prose)", () => {
    const src = read("src/routes/public/css/rail.css.ts");
    expect(src).toMatch(EXEMPT_GRAMMAR);
    assertExempt(src, "chq-pub-detail-speaker-link");
  });

  it("agenda.css.ts: agenda day-footer's next-day link is EXEMPT (inline-in-prose)", () => {
    const src = read("src/routes/public/css/agenda.css.ts");
    expect(src).toMatch(EXEMPT_GRAMMAR);
    assertExempt(src, "chq-pub-agenda-day-footer a");
  });

  it("markup: the three rail-day-row sites and the agenda block title carry no new class (ancestor-scoped selector reaches them)", () => {
    const sessions = read("src/routes/public/sessions.tsx");
    const agendaRail = read("src/routes/public/agenda-rail.tsx");
    const agendaGrid = read("src/routes/public/agenda-grid.tsx");
    expect(sessions).toMatch(/<div class="chq-pub-rail-day-row">\s*<a href=/);
    expect((agendaRail.match(/<div class="chq-pub-rail-day-row">\s*<a href=/g) ?? []).length).toBe(2);
    expect(agendaGrid).toMatch(/<div class="chq-pub-agenda-block-title">\s*<strong>\s*<a href=/);
  });

  it("markup: detail.tsx's three anchors carry the correct classes", () => {
    const src = read("src/routes/public/detail.tsx");
    expect(src).toMatch(/<a class="chq-pub-detail-social-link" href=\{link\.url\}/);
    expect(src).toMatch(/<a class="chq-pub-detail-session-link" href=\{sessionDetailPath/);
    expect(src).toMatch(/<a class="chq-pub-detail-speaker-link" href=\{speakerDetailPath/);
  });
});
