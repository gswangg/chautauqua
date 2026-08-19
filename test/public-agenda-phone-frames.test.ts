// v12 design pack — the two width:390 PHONE frames in
// docs/design/Chautauqua Public and Portal.dc.html:
//
//   "Public agenda · phone"   (:371-409) — day switcher + card action, the
//                              agenda a scanning attendee actually reads
//   "My schedule · phone"     (:864-893) — /schedule's saved-session list
//                              and its Remove / .ics affordances
//
// Both frames are SSR (src/routes/public/**), assembled from FOUR
// stylesheets this task owns: css/agenda.css.ts, css/rail.css.ts,
// css/cards.css.ts, css/chrome.css.ts (concatenated, in that order, into
// PUBLIC_CSS — public.css.ts). Desktop is FROZEN; this file only asserts
// against each sheet's own `@media (max-width: 700px)` phone layer plus a
// desktopLayer() freeze pin per sheet, mirroring
// test/home-phone-frames.test.ts.
//
// jsdom applies no stylesheet and evaluates no @media rule, so these are
// source-scan pins on the CSS TEXT, not computed style.
//
// Two standing rules are pinned alongside the frame geometry:
//
//   * DEC-385 single-direction: every phone layer is `@media (max-width:
//     …)` ONLY across all four sheets. A min-width query is a hard failure.
//   * DESIGN-RULINGS "The 44px floor, and how it gets evaded": no phone
//     token may author a `min-height` below 44px, and an interactive
//     element needs min-height PLUS centred flex PLUS horizontal
//     padding/centering — min-height alone leaves the hit box the width of
//     its text.
//
// DEC-385 (w85 amendment) FINDING closed by this task: rail.css.ts's own
// phone override of `.chq-pub-surface-title` (26px) sat mid-file, BEFORE
// this file's own later top-level `.chq-pub-surface-title` rule (36px,
// task-w49-h) — same selector/specificity, later source position wins
// regardless of which one's @media condition matched, so the phone override
// was silently dead. Fixed by moving every RAIL_CSS phone declaration to
// one block at the true end of the file (see rail.css.ts). The
// `noTopLevelRuleAfter` check below is a standing tripwire against the same
// failure mode recurring in any of the four sheets this task owns.
import { describe, expect, it } from "vitest";
import { AGENDA_CSS } from "../src/routes/public/css/agenda.css";
import { RAIL_CSS } from "../src/routes/public/css/rail.css";
import { CARDS_CSS } from "../src/routes/public/css/cards.css";
import { CHROME_CSS } from "../src/routes/public/css/chrome.css";
import { ACCENT_BOUND_CLASSES } from "../src/routes/public/css/accent-classes";

/** Comments are stripped before any brace scanning: a literal `{`/`}`
 * inside a long frame-citation comment would desynchronise the depth
 * counter and silently truncate a block. */
function stripComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, "");
}

/** Concatenated bodies of every `@media (max-width: …)` block in `css`.
 * Brace-matched rather than regex-bounded, so a nested rule can never end
 * the block early. */
function phoneLayer(css: string): string {
  const out: string[] = [];
  const opener = /@media\s*\(max-width:\s*\d+px\)\s*\{/g;
  let m: RegExpExecArray | null;
  while ((m = opener.exec(css)) !== null) {
    let depth = 1;
    let i = m.index + m[0].length;
    const start = i;
    while (i < css.length && depth > 0) {
      if (css[i] === "{") depth += 1;
      else if (css[i] === "}") depth -= 1;
      i += 1;
    }
    if (depth !== 0) throw new Error("unbalanced @media block");
    out.push(css.slice(start, i - 1));
  }
  if (out.length === 0) throw new Error("no max-width media block found");
  return out.join("\n");
}

/** The complement of phoneLayer: every top-level (non-media) declaration in
 * `css`, with all `@media (...) { ... }` blocks (of any condition) excised
 * — brace-matched, same mechanism as phoneLayer. This is the "desktop
 * layer" freeze-pin surface, and also the surface a shadowing later
 * top-level rule for an already phone-overridden selector would live on. */
function desktopLayer(css: string): string {
  let result = "";
  let last = 0;
  const opener = /@media\s*\([^)]*\)\s*\{/g;
  let m: RegExpExecArray | null;
  while ((m = opener.exec(css)) !== null) {
    result += css.slice(last, m.index);
    let depth = 1;
    let i = m.index + m[0].length;
    while (i < css.length && depth > 0) {
      if (css[i] === "{") depth += 1;
      else if (css[i] === "}") depth -= 1;
      i += 1;
    }
    last = i;
    opener.lastIndex = i;
  }
  result += css.slice(last);
  return result;
}

/** A single rule's declaration body, by selector, inside an already-scoped
 * layer (see phoneLayer/desktopLayer). Selectors are compared as WHOLE
 * members of the rule's selector list, not by substring. */
function findRule(layer: string, selector: string): string {
  const rule = /([^{}]+)\{([^{}]*)\}/g;
  let m: RegExpExecArray | null;
  while ((m = rule.exec(layer)) !== null) {
    const selectors = m[1]!
      .split(",")
      .map((s) => s.trim().replace(/\s+/g, " "))
      .filter(Boolean);
    if (selectors.includes(selector)) return m[2]!;
  }
  throw new Error(`no rule for ${selector}`);
}

const SHEETS = {
  agenda: { name: "agenda.css.ts", css: AGENDA_CSS },
  rail: { name: "rail.css.ts", css: RAIL_CSS },
  cards: { name: "cards.css.ts", css: CARDS_CSS },
  chrome: { name: "chrome.css.ts", css: CHROME_CSS },
} as const;

const CLEAN = Object.fromEntries(
  Object.entries(SHEETS).map(([k, v]) => [k, stripComments(v.css)]),
) as Record<keyof typeof SHEETS, string>;

const PHONE = Object.fromEntries(
  Object.entries(CLEAN).map(([k, css]) => [k, phoneLayer(css)]),
) as Record<keyof typeof SHEETS, string>;

const DESKTOP = Object.fromEntries(
  Object.entries(CLEAN).map(([k, css]) => [k, desktopLayer(css)]),
) as Record<keyof typeof SHEETS, string>;

const DAY_PILL = `.${ACCENT_BOUND_CLASSES[1]}`; // "chq-pub-day-pill"

describe("DEC-385: every owned sheet's phone layer is single-direction", () => {
  for (const [key, { name }] of Object.entries(SHEETS)) {
    it(`${name} declares no min-width media query`, () => {
      expect(CLEAN[key as keyof typeof SHEETS]).not.toMatch(/@media[^{]*min-width/);
    });
  }

  it("every owned sheet has at least one max-width phone block", () => {
    for (const key of Object.keys(SHEETS) as (keyof typeof SHEETS)[]) {
      expect(PHONE[key].length).toBeGreaterThan(0);
    }
  });
});

describe("DESIGN-RULINGS: never author a min-height below 44px on a phone token", () => {
  it("floors every authored min-height at 44px, across all four sheets", () => {
    const all = Object.values(PHONE).join("\n");
    const heights = [...all.matchAll(/min-height:\s*(\d+)px/g)].map((m) => Number(m[1]));
    expect(heights.length).toBeGreaterThan(0);
    for (const h of heights) expect(h).toBeGreaterThanOrEqual(44);
  });
});

describe("DEC-385 (w85 amendment): no owned sheet's phone rule is shadowed by its own later top-level rule", () => {
  it("rail.css.ts's phone .chq-pub-surface-title override now wins (moved to the file's end)", () => {
    // The bug this task closed: a phone-scoped rule earlier in source than
    // a same-selector top-level rule loses the cascade at every width,
    // including <=700px, because a plain rule with no media condition
    // always applies and later source position wins at equal specificity.
    const phoneIdx = RAIL_CSS.indexOf("@media (max-width: 700px)");
    const surfaceTitlePhoneIdx = RAIL_CSS.indexOf(".chq-pub-surface-title { font-size: 26px; }");
    const surfaceTitleTopLevelIdx = RAIL_CSS.indexOf(".chq-pub-surface-title {\n    font-family:");
    expect(phoneIdx).toBeGreaterThan(-1);
    expect(surfaceTitlePhoneIdx).toBeGreaterThan(-1);
    expect(surfaceTitleTopLevelIdx).toBeGreaterThan(-1);
    // the phone override must now come AFTER the top-level rule it narrows
    expect(surfaceTitlePhoneIdx).toBeGreaterThan(surfaceTitleTopLevelIdx);
  });

  it("rail.css.ts's phone block is the file's last top-level construct", () => {
    const trimmed = CLEAN.rail.trimEnd();
    const lastOpenerIdx = [...trimmed.matchAll(/@media\s*\(max-width:\s*\d+px\)\s*\{/g)].pop()?.index ?? -1;
    expect(lastOpenerIdx).toBeGreaterThan(-1);
    // nothing but the phone block's own closing brace follows its opener
    const afterOpener = trimmed.slice(lastOpenerIdx);
    const opens = [...afterOpener.matchAll(/\{/g)].length;
    const closes = [...afterOpener.matchAll(/\}/g)].length;
    expect(opens).toBe(closes);
  });
});

describe("v12 phone frame 'Public agenda' (390) — day switcher + card action", () => {
  // docs/design/Chautauqua Public and Portal.dc.html:378
  // `<span style="flex-shrink:0; background:#1B1D17; color:#F4F1E8; border-radius:99px; min-height:44px; display:flex; align-items:center; padding:0 15px; font-size:13px; font-weight:600">Tue 12</span>`
  it("the day pill (active AND idle) reaches the 44px floor with centred flex and horizontal padding", () => {
    const base = findRule(DESKTOP.agenda, DAY_PILL);
    expect(base).toMatch(/display:\s*flex/);
    expect(base).toMatch(/align-items:\s*center/);
    expect(base).toMatch(/justify-content:\s*center/);
    expect(base).toMatch(/padding:\s*0 \d+px/);
    const phone = findRule(PHONE.agenda, DAY_PILL);
    expect(phone).toMatch(/min-height:\s*44px/);
  });

  // docs/design/Chautauqua Public and Portal.dc.html:395
  // `<span style="border:1px solid #BAB6A6; border-radius:6px; background:#EFEBDF; min-height:44px; display:flex; align-items:center; justify-content:center; font-size:13px; font-weight:600; margin-top:2px">{{ s.action }}</span>`
  it("the phone list's per-row action is a bordered, centred, 44px-floor button — not a bare min-height on a text link", () => {
    const phone = findRule(PHONE.agenda, ".chq-pub-itinerary-row");
    expect(phone).toMatch(/border:\s*1px solid var\(--chq-border\)/);
    expect(phone).toMatch(/border-radius:\s*var\(--chq-r-ctl-phone\)/);
    expect(phone).toMatch(/background:\s*var\(--chq-surface-sunk\)/);
    expect(phone).toMatch(/min-height:\s*44px/);
    expect(phone).toMatch(/display:\s*flex/);
    expect(phone).toMatch(/align-items:\s*center/);
    expect(phone).toMatch(/justify-content:\s*center/);
  });

  it("desktopLayer freeze pin: the base .chq-pub-itinerary-row stays a plain, unbordered flex row (button styling is phone-only)", () => {
    const base = findRule(DESKTOP.agenda, ".chq-pub-itinerary-row");
    expect(base).not.toMatch(/border\s*:/);
    expect(base).not.toMatch(/min-height\s*:/);
    expect(base).toMatch(/display:\s*flex/);
  });

  it("desktopLayer freeze pin: the day pill's idle-state colour and 38px desktop segment height are unchanged", () => {
    const base = findRule(DESKTOP.agenda, DAY_PILL);
    expect(base).toMatch(/min-height:\s*38px/);
    expect(base).toMatch(/color:\s*var\(--chq-brandable-accent\)/);
  });
});

describe("v12 phone frame 'My schedule' (390) — saved-session list + .ics affordance", () => {
  // docs/design/Chautauqua Public and Portal.dc.html:880
  // `<span style="border:1px solid #BAB6A6; border-radius:6px; background:#EFEBDF; min-height:44px; display:flex; align-items:center; justify-content:center; font-size:13px; font-weight:600">Remove</span>`
  it("Remove is a bordered, centred, 44px-floor button on phone — the desktop row renders it as plain text", () => {
    const phone = findRule(PHONE.rail, ".chq-pub-schedule-remove");
    expect(phone).toMatch(/border:\s*1px solid var\(--chq-border\)/);
    expect(phone).toMatch(/border-radius:\s*var\(--chq-r-ctl-phone\)/);
    expect(phone).toMatch(/background:\s*var\(--chq-surface-sunk\)/);
    expect(phone).toMatch(/min-height:\s*44px/);
    expect(phone).toMatch(/display:\s*flex/);
    expect(phone).toMatch(/align-items:\s*center/);
    expect(phone).toMatch(/justify-content:\s*center/);
  });

  it("desktopLayer freeze pin: the base .chq-pub-schedule-remove stays a plain, unbordered text control", () => {
    const base = findRule(DESKTOP.rail, ".chq-pub-schedule-remove");
    expect(base).not.toMatch(/border\s*:/);
    expect(base).not.toMatch(/min-height\s*:/);
    expect(base).toMatch(/color:\s*var\(--chq-ink-2\)/);
  });

  // docs/design/Chautauqua Public and Portal.dc.html:885
  // `<span style="flex:1; background:#4E5C31; color:#F7F9F0; border-radius:6px; min-height:46px; display:flex; align-items:center; justify-content:center; font-size:14px; font-weight:700">Download .ics</span>`
  it("the shared .ics CTA (Your schedule rail, rendered on both /agenda and /schedule) keeps the same primary fill the frame draws, and reaches the 44px floor on phone", () => {
    const base = findRule(DESKTOP.agenda, ".chq-pub-itinerary-cta");
    expect(base).toMatch(/background:\s*var\(--chq-brand\)/);
    const phone = findRule(PHONE.agenda, ".chq-pub-itinerary-cta");
    expect(phone).toMatch(/min-height:\s*44px/);
    expect(phone).toMatch(/align-items:\s*center/);
    expect(phone).toMatch(/justify-content:\s*center/);
  });

  it("the /schedule two-column layout collapses to one column on phone (rail — carrying the .ics CTA — stacks below the list)", () => {
    const phone = findRule(PHONE.rail, ".chq-pub-schedule-layout");
    expect(phone).toMatch(/grid-template-columns:\s*1fr\b/);
  });
});
