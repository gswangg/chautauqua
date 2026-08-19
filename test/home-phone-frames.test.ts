// v12 design pack — the three width:390 PHONE frames in
// docs/design/Chautauqua Home.dc.html:
//
//   "Event hub · phone"     (line 113) — the full state: open CFPs,
//                            published programmes, past events
//   "Between cycles · phone"(line 228) — no open CFP, past programmes only
//   "Fresh deploy · phone"  (line 299) — nothing has ever run
//
// Their desktop twins are at :28, :181, :269 — desktop is FROZEN, and this
// file only asserts against the phone (`@media (max-width: 700px)`) layer
// of home.css.ts.
//
// jsdom applies no stylesheet and evaluates no @media rule, so — mirroring
// app/src/pages/contacts/contacts-phone-frames.test.ts — these are
// source-scan pins on the CSS TEXT of HOME_CSS, not computed style.
//
// Two standing rules are pinned alongside the frame geometry:
//
//   * DEC-385 single-direction: the phone layer is `@media (max-width: …)`
//     ONLY. A min-width query would make the sheet bidirectional and is a
//     hard failure here.
//   * DESIGN-RULINGS "The 44px floor, and how it gets evaded": no phone
//     token may author a `min-height` below 44px, and an interactive
//     element needs min-height PLUS centred flex PLUS horizontal padding —
//     padding alone does not reach the floor, and without padding the hit
//     box is only as wide as the text.
import { describe, expect, it } from "vitest";
import { HOME_CSS } from "../src/routes/public/home.css";

/** Comments are stripped before any brace scanning: this sheet carries long
 * frame-citation comments, and a literal `{`/`}` inside a jsdoc-style block
 * would desynchronise the depth counter and silently truncate a block. */
function stripComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, "");
}

const CLEAN = stripComments(HOME_CSS);

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

/** A single rule's declaration body, by selector, inside an already-extracted
 * phone layer (see `phoneLayer`). Selectors are compared as WHOLE members of
 * the rule's selector list, not by substring. */
function phoneRule(layer: string, selector: string): string {
  const rule = /([^{}]+)\{([^{}]*)\}/g;
  let m: RegExpExecArray | null;
  while ((m = rule.exec(layer)) !== null) {
    const selectors = m[1]!
      .split(",")
      .map((s) => s.trim().replace(/\s+/g, " "))
      .filter(Boolean);
    if (selectors.includes(selector)) return m[2]!;
  }
  throw new Error(`no phone rule for ${selector}`);
}

/** Every rule body in `layer` whose selector list, as WHOLE members,
 * includes `selector` -- concatenated. Some selectors (e.g.
 * .chq-home-action-secondary) appear in more than one phone-layer rule: a
 * grouped rule shared with .chq-home-action-primary AND a standalone rule
 * carrying its own min-height override. `phoneRule` returns only the
 * first match; this returns all of them, for assertions that must see
 * every declaration regardless of which rule carries it. */
function phoneRuleAll(layer: string, selector: string): string {
  const bodies: string[] = [];
  const rule = /([^{}]+)\{([^{}]*)\}/g;
  let m: RegExpExecArray | null;
  while ((m = rule.exec(layer)) !== null) {
    const selectors = m[1]!
      .split(",")
      .map((s) => s.trim().replace(/\s+/g, " "))
      .filter(Boolean);
    if (selectors.includes(selector)) bodies.push(m[2]!);
  }
  if (bodies.length === 0) throw new Error(`no phone rule for ${selector}`);
  return bodies.join("\n");
}

const PHONE = phoneLayer(CLEAN);

describe("DEC-385: the home phone layer is single-direction", () => {
  it("declares no min-width media query", () => {
    expect(CLEAN).not.toMatch(/@media[^{]*min-width/);
  });

  it("has at least one max-width phone block", () => {
    expect(PHONE.length).toBeGreaterThan(0);
  });
});

describe("DESIGN-RULINGS: never author a min-height below 44px on a phone token", () => {
  it("floors every authored min-height at 44px", () => {
    const heights = [...PHONE.matchAll(/min-height:\s*(\d+)px/g)].map((m) => Number(m[1]));
    expect(heights.length).toBeGreaterThan(0);
    for (const h of heights) expect(h).toBeGreaterThanOrEqual(44);
  });
});

describe("v12 phone frame 'Event hub' (390) — header band", () => {
  it("header: 14px 16px padding, 12px gap, centred flex", () => {
    const header = phoneRule(PHONE, ".chq-home-header");
    expect(header).toMatch(/padding-block:\s*14px/);
    expect(header).toMatch(/padding-inline:\s*16px/);
    expect(header).toMatch(/gap:\s*12px/);
  });

  it("org name narrows to 17px display face (weight/letter-spacing inherited from base)", () => {
    const org = phoneRule(PHONE, ".chq-home-org");
    expect(org).toMatch(/font-size:\s*17px/);
  });

  it("Sign in reaches the 44px floor with centred flex AND horizontal padding", () => {
    const signin = phoneRule(PHONE, ".chq-home-signin");
    expect(signin).toMatch(/min-height:\s*44px/);
    expect(signin).toMatch(/display:\s*flex/);
    expect(signin).toMatch(/align-items:\s*center/);
    expect(signin).toMatch(/padding:\s*0 \d+px/);
  });
});

describe("v12 phone frame 'Event hub' (390) — body", () => {
  it("body: 20px 16px padding, 24px gap", () => {
    const body = phoneRule(PHONE, ".chq-home-body");
    expect(body).toMatch(/padding-block:\s*20px/);
    expect(body).toMatch(/padding-inline:\s*16px/);
    expect(body).toMatch(/gap:\s*24px/);
  });

  it("H1 'Events' is 30px/1.05 (desktop is 44px/1.2)", () => {
    const h1 = phoneRule(PHONE, ".chq-home-hero h1");
    expect(h1).toMatch(/font-size:\s*30px/);
    expect(h1).toMatch(/line-height:\s*1\.05/);
  });

  it("intro paragraph is 14px/1.6 (desktop is 16px/1.65)", () => {
    const p = phoneRule(PHONE, ".chq-home-hero p");
    expect(p).toMatch(/font-size:\s*14px/);
    expect(p).toMatch(/line-height:\s*1\.6\b/);
  });

  it("section label letter-spacing narrows to 0.1em (desktop is 0.12em)", () => {
    const label = phoneRule(PHONE, ".chq-home-section-label");
    expect(label).toMatch(/letter-spacing:\s*0\.1em/);
  });
});

describe("v12 phone frame 'Event hub' (390) — Open for submissions row", () => {
  it("the row collapses to a single stacked column", () => {
    const row = phoneRule(PHONE, ".chq-home-row");
    expect(row).toMatch(/grid-template-columns:\s*1fr\b/);
  });

  it("name is 20px", () => {
    expect(phoneRule(PHONE, ".chq-home-name")).toMatch(/font-size:\s*20px/);
  });

  it("dates and venue share the frame's muted 13px treatment", () => {
    const dates = phoneRule(PHONE, ".chq-home-dates");
    expect(dates).toMatch(/font-size:\s*13px/);
    expect(dates).toMatch(/color:\s*var\(--chq-muted\)/);
    expect(phoneRule(PHONE, ".chq-home-venue")).toMatch(/font-size:\s*13px/);
  });

  it("'Submit a talk' stretches full-width, staying at the 48px floor set at base scope", () => {
    const primary = phoneRule(PHONE, ".chq-home-action-primary");
    expect(primary).toMatch(/width:\s*100%/);
    expect(primary).toMatch(/justify-content:\s*center/);
  });
});

describe("v12 phone frame 'Event hub' (390) — Programme published row", () => {
  it("published-row name narrows to 18px, overriding the desktop 21px override by selector specificity", () => {
    const name = phoneRule(PHONE, ".chq-home-row-published .chq-home-name");
    expect(name).toMatch(/font-size:\s*18px/);
    expect(name).toMatch(/letter-spacing:\s*-0\.022em/);
  });

  it("'Browse sessions' narrows from the desktop 46px to the frame's 44px", () => {
    expect(phoneRuleAll(PHONE, ".chq-home-action-secondary")).toMatch(/min-height:\s*44px/);
  });
});

describe("v12 phone frame 'Event hub' / 'Between cycles' (390) — Already happened row", () => {
  it("archive row is a compact grid with the name/meta pair on the left, action right-flushed", () => {
    const row = phoneRule(PHONE, ".chq-home-archive-row");
    expect(row).toMatch(/grid-template-columns:\s*1fr auto/);
    expect(row).toMatch(/align-items:\s*center/);
  });

  it("archive name narrows to 16px (desktop is 17px)", () => {
    expect(phoneRule(PHONE, ".chq-home-archive-name")).toMatch(/font-size:\s*16px/);
  });

  it("archive row's meta line narrows to 12px, scoped so the shared .chq-home-meta base stays 13px elsewhere", () => {
    expect(phoneRule(PHONE, ".chq-home-archive-row .chq-home-meta")).toMatch(/font-size:\s*12px/);
  });

  it("'Sessions ›' reaches the 44px floor with centred flex, horizontal padding, and flex-shrink:0", () => {
    const quiet = phoneRule(PHONE, ".chq-home-action-quiet");
    expect(quiet).toMatch(/min-height:\s*44px/);
    expect(quiet).toMatch(/padding:\s*0 \d+px/);
    expect(quiet).toMatch(/flex-shrink:\s*0/);
  });
});

describe("v12 phone frame 'Event hub' (390) — footer band", () => {
  it("footer uses the frame's stronger ink border, not the desktop rule border", () => {
    const footer = phoneRule(PHONE, ".chq-home-footer");
    expect(footer).toMatch(/border-top-color:\s*var\(--chq-ink\)/);
    expect(footer).toMatch(/padding-block:\s*12px 16px/);
    expect(footer).toMatch(/padding-inline:\s*16px/);
  });

  it("'API docs' reaches the 44px floor with centred flex AND horizontal padding", () => {
    const apiDocs = phoneRule(PHONE, ".chq-home-footer-link-end");
    expect(apiDocs).toMatch(/min-height:\s*44px/);
    expect(apiDocs).toMatch(/display:\s*flex/);
    expect(apiDocs).toMatch(/align-items:\s*center/);
    expect(apiDocs).toMatch(/padding:\s*0 \d+px/);
  });
});

describe("desktopLayer freeze pin — base-scope rules untouched by this task", () => {
  /** The base-scope (non-media) portion of HOME_CSS, i.e. everything before
   * the first `@media` block -- desktop is FROZEN, so this task's phone
   * additions must all live inside the media block appended at the end. */
  function desktopLayer(css: string): string {
    const idx = css.indexOf("@media (max-width: 700px)");
    expect(idx, "no phone media block found").toBeGreaterThan(-1);
    return css.slice(0, idx);
  }

  const DESKTOP = desktopLayer(CLEAN);

  it("desktop header keeps its 20px gap and 20px org name", () => {
    const header = /\.chq-home-header\s*\{([^}]*)\}/.exec(DESKTOP)?.[1] ?? "";
    expect(header).toMatch(/gap:\s*20px/);
    const org = /\.chq-home-org\s*\{([^}]*)\}/.exec(DESKTOP)?.[1] ?? "";
    expect(org).toMatch(/font-size:\s*20px/);
    expect(org).toMatch(/top:\s*-2\.5px/);
  });

  it("desktop hero h1 keeps 44px/1.2, desktop hero p keeps 16px/1.65", () => {
    const h1 = /\.chq-home-hero h1\s*\{([^}]*)\}/.exec(DESKTOP)?.[1] ?? "";
    expect(h1).toMatch(/font-size:\s*44px/);
    expect(h1).toMatch(/line-height:\s*1\.2\b/);
    const p = /\.chq-home-hero p\s*\{([^}]*)\}/.exec(DESKTOP)?.[1] ?? "";
    expect(p).toMatch(/font-size:\s*16px/);
    expect(p).toMatch(/line-height:\s*1\.65/);
  });

  it("desktop section label keeps 0.12em letter-spacing", () => {
    const label = /\.chq-home-section-label\s*\{([^}]*)\}/.exec(DESKTOP)?.[1] ?? "";
    expect(label).toMatch(/letter-spacing:\s*0\.12em/);
  });

  it("desktop published-row name keeps 21px, desktop action-secondary keeps 46px", () => {
    const publishedName = /\.chq-home-row-published \.chq-home-name\s*\{([^}]*)\}/.exec(DESKTOP)?.[1] ?? "";
    expect(publishedName).toMatch(/font-size:\s*21px/);
    const secondary = /\.chq-home-action-secondary\s*\{([^}]*)\}/.exec(DESKTOP)?.[1] ?? "";
    expect(secondary).toMatch(/min-height:\s*46px/);
  });

  it("desktop archive name keeps 17px, desktop footer keeps the rule-colored border", () => {
    const archiveName = /\.chq-home-archive-name\s*\{([^}]*)\}/.exec(DESKTOP)?.[1] ?? "";
    expect(archiveName).toMatch(/font-size:\s*17px/);
    const footer = /\.chq-home-footer\s*\{([^}]*)\}/.exec(DESKTOP)?.[1] ?? "";
    expect(footer).toMatch(/border-top:\s*1px solid var\(--chq-rule\)/);
  });

  it("desktop .chq-home-action-quiet still declares no min-height (base-scope, pinned by public-home-full-bleed too)", () => {
    const quiet = /\.chq-home-action-quiet\s*\{([^}]*)\}/.exec(DESKTOP)?.[1] ?? "";
    expect(quiet).not.toMatch(/min-height\s*:/);
  });
});
