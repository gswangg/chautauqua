// v12 design pack — the three width:390 PHONE frames this task (w3-a) owns
// in "docs/design/Chautauqua Public and Portal.dc.html":
//
//   "Speaker portal"        (:414-472) — the portal home/landing page
//   "Portal · Your tasks"   (:476-501) — a back-linked drill-in page
//   "Portal · Your profile" (:531-559) — a back-linked drill-in page
//
// Modelled on test/home-phone-frames.test.ts's idiom: jsdom applies no
// stylesheet and evaluates no @media rule, so this is a source-scan pin on
// the CSS TEXT of PORTAL_CSS, mirroring test/portal-phone-fit.test.ts and
// test/portal-phone-shell.test.ts's balanced-brace helpers. Every citation
// below is `docs/design/Chautauqua Public and Portal.dc.html:<line>`, a
// body line strictly inside its frame's extent (never the label line
// above), immediately followed by the verbatim literal from that exact
// line and an assertion pinning what the literal declares (DEC-976).
//
// Two standing rules are pinned alongside the frame geometry:
//
//   * DEC-385 single-direction: the phone layer is `@media (max-width: …)`
//     ONLY. A min-width query would make the sheet bidirectional and is a
//     hard failure here.
//   * DESIGN-RULINGS "The 44px floor, and how it gets evaded": no phone
//     token may author a `min-height` below 44px.
import { describe, expect, it } from "vitest";
import { PORTAL_CSS } from "../src/routes/portal/portal.css";

/** Comments are stripped before any brace scanning: this sheet carries long
 * frame-citation comments, and a literal `{`/`}` inside one would
 * desynchronise the depth counter and silently truncate a block. */
function stripComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, "");
}

const CLEAN = stripComments(PORTAL_CSS);

/** Concatenated bodies of every `@media (max-width: …)` block in `css`,
 * brace-matched rather than regex-bounded so a nested rule can never end
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

/** Every rule body in `layer` whose selector list, as WHOLE members,
 * includes `selector` -- concatenated, so a selector declared across more
 * than one grouped/standalone rule in the block is fully visible. */
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

describe("DEC-385: the portal phone layer is single-direction", () => {
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

describe('v12 phone frame "Speaker portal" (390) — head band', () => {
  // docs/design/Chautauqua Public and Portal.dc.html:415
  // `<div style="border-bottom:1px solid #1B1D17; padding:14px 16px; flex-shrink:0; display:flex; flex-direction:column; gap:10px">`
  it("head: 14px 16px padding, shared across the whole /portal family", () => {
    const header = phoneRuleAll(PHONE, ".chq-portal-shell > .chq-header");
    expect(header).toMatch(/padding:\s*14px 16px/);
  });
});

describe('v12 phone frame "Speaker portal" (390) — body', () => {
  // docs/design/Chautauqua Public and Portal.dc.html:424
  // `<div style="flex:1; min-height:0; overflow-y:auto; padding:16px">`
  it("landing body: flat 16px padding (no back link on this page)", () => {
    const body = phoneRuleAll(PHONE, ".chq-portal-shell > .chq-measure");
    expect(body).toMatch(/padding:\s*16px;/);
  });

  // docs/design/Chautauqua Public and Portal.dc.html:420
  // `<span style="font-family:'Familjen Grotesk', sans-serif; font-size:25px; font-weight:700; letter-spacing:-0.04em; line-height:1.05">Two things to do</span>`
  it("H1 uses the drill token, not the 27px cluster-landing one — this frame draws 25px too", () => {
    const hero = phoneRuleAll(PHONE, ".chq-portal-hero");
    expect(hero).toMatch(/font-size:\s*var\(--chq-type-page-title-phone-drill\)/);
  });
});

describe('v12 phone frame "Portal · Your tasks" (390) — head band', () => {
  // docs/design/Chautauqua Public and Portal.dc.html:478
  // `<a href="#" style="font-size:13px; font-weight:700; min-height:44px; display:flex; align-items:center">‹ Your portal</a>`
  it("back link reaches the 44px floor with centred flex", () => {
    const back = phoneRuleAll(PHONE, ".chq-portal-back");
    expect(back).toMatch(/min-height:\s*44px/);
  });

  // docs/design/Chautauqua Public and Portal.dc.html:479
  // `<h1 style="margin:0; font-family:'Familjen Grotesk', sans-serif; font-size:25px; font-weight:700; letter-spacing:-0.04em; line-height:1.05">Your tasks</h1>`
  it("H1 is the 25px drill register, one size below the 27px cluster-landing token", () => {
    const hero = phoneRuleAll(PHONE, ".chq-portal-hero");
    expect(hero).toMatch(/font-size:\s*var\(--chq-type-page-title-phone-drill\)/);
  });
});

describe('v12 phone frame "Portal · Your tasks" (390) — body + dock', () => {
  // docs/design/Chautauqua Public and Portal.dc.html:481
  // `<div style="flex:1; min-height:0; overflow-y:auto; padding:14px 16px 16px">`
  it("drill body: 14px 16px 16px padding, scoped to pages with a back link", () => {
    const body = phoneRuleAll(PHONE, ".chq-portal-shell:has(.chq-portal-back) > .chq-measure");
    expect(body).toMatch(/padding:\s*14px 16px 16px/);
  });

  // docs/design/Chautauqua Public and Portal.dc.html:492
  // `<div style="flex-shrink:0; border-top:1px solid #1B1D17; background:#EFEBDF; padding:12px 16px 16px; display:flex; gap:8px">`
  it("dock: ink border-top, sunk background, 12px 16px 16px padding", () => {
    const dock = phoneRuleAll(PHONE, ".chq-portal-shell > .chq-portal-footer");
    expect(dock).toMatch(/border-top:\s*1px solid var\(--chq-ink\)/);
    expect(dock).toMatch(/background:\s*var\(--chq-surface-sunk\)/);
    expect(dock).toMatch(/padding:\s*12px 16px 16px/);
  });
});

describe('v12 phone frame "Portal · Your profile" (390) — head band', () => {
  // docs/design/Chautauqua Public and Portal.dc.html:533
  // `<a href="#" style="font-size:13px; font-weight:700; min-height:44px; display:flex; align-items:center">‹ Your portal</a>`
  it("back link reaches the 44px floor (same rule as the Your tasks frame)", () => {
    const back = phoneRuleAll(PHONE, ".chq-portal-back");
    expect(back).toMatch(/min-height:\s*44px/);
  });

  // docs/design/Chautauqua Public and Portal.dc.html:534
  // `<h1 style="margin:0; font-family:'Familjen Grotesk', sans-serif; font-size:25px; font-weight:700; letter-spacing:-0.04em; line-height:1.05">Your profile</h1>`
  it("H1 is the 25px drill register", () => {
    const hero = phoneRuleAll(PHONE, ".chq-portal-hero");
    expect(hero).toMatch(/font-size:\s*var\(--chq-type-page-title-phone-drill\)/);
  });
});

describe('v12 phone frame "Portal · Your profile" (390) — body + dock', () => {
  // docs/design/Chautauqua Public and Portal.dc.html:536
  // `<div style="flex:1; min-height:0; overflow-y:auto; padding:14px 16px 16px">`
  it("drill body: same 14px 16px 16px padding as the Your tasks frame", () => {
    const body = phoneRuleAll(PHONE, ".chq-portal-shell:has(.chq-portal-back) > .chq-measure");
    expect(body).toMatch(/padding:\s*14px 16px 16px/);
  });

  // docs/design/Chautauqua Public and Portal.dc.html:550
  // `<div style="flex-shrink:0; border-top:1px solid #1B1D17; background:#EFEBDF; padding:12px 16px 16px; display:flex; gap:8px">`
  it("dock: same ink border-top / sunk background / 12px 16px 16px padding as the Your tasks frame", () => {
    const dock = phoneRuleAll(PHONE, ".chq-portal-shell > .chq-portal-footer");
    expect(dock).toMatch(/border-top:\s*1px solid var\(--chq-ink\)/);
    expect(dock).toMatch(/background:\s*var\(--chq-surface-sunk\)/);
    expect(dock).toMatch(/padding:\s*12px 16px 16px/);
  });
});

describe("desktopLayer freeze pin — base-scope rules untouched by this task", () => {
  /** The base-scope (non-media) portion of PORTAL_CSS, i.e. everything
   * before the first `@media` block -- desktop is FROZEN, and this task's
   * phone additions all live inside the media block moved to the end of
   * portal.css.ts as this task's first commit step. */
  function desktopLayer(css: string): string {
    const idx = css.indexOf("@media (max-width: 700px)");
    expect(idx, "no phone media block found").toBeGreaterThan(-1);
    return css.slice(0, idx);
  }

  const DESKTOP = desktopLayer(CLEAN);

  it("desktop .chq-portal-hero keeps the shared page-title register, not the phone drill token", () => {
    const hero = /\.chq-portal-hero\s*\{([^}]*)\}/.exec(DESKTOP)?.[1] ?? "";
    expect(hero).toMatch(/font-size:\s*var\(--chq-type-page-title-size\)/);
    expect(hero).not.toMatch(/phone-drill/);
  });

  it("desktop .chq-portal-back declares no min-height (the 44px floor is phone-only, DEC-367)", () => {
    const back = /\.chq-portal-back\s*\{([^}]*)\}/.exec(DESKTOP)?.[1] ?? "";
    expect(back).not.toMatch(/min-height\s*:/);
  });

  it("desktop .chq-portal-shell > .chq-measure keeps its unmediated 560px clamp, no padding declared there", () => {
    const measure = /\.chq-portal-shell\s*>\s*\.chq-measure\s*\{([^}]*)\}/.exec(DESKTOP)?.[1] ?? "";
    expect(measure).toMatch(/max-width:\s*var\(--chq-portal-measure\)/);
    expect(measure).not.toMatch(/padding\s*:/);
  });

  it("only one @media (max-width: 700px) block exists in the file (moved, not duplicated)", () => {
    const matches = CLEAN.match(/@media\s*\(max-width:\s*700px\)/g) ?? [];
    expect(matches.length).toBe(1);
  });
});
