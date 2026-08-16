import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

// DEC-851 (wave-67 amendment): the Overview button family
// (.chq-overview-toolbar-btn[-primary], .chq-overview-btn[-primary],
// .chq-overview-link-btn[.chq-overview-link-muted]) and .chq-nav-link
// never read the B8 motion/hover tokens -- no transition, and the primary
// tier had no hover background at all. This asserts against the
// stylesheet source text (the precedent is
// app/src/pages/settings/settings-field-width.test.ts) rather than
// computed styles, since jsdom does not resolve `:hover` or CSS custom
// properties. Presence of a hover rule is not enough by itself -- the
// wave-66 flagged-break-band finding (DEC-021) was a modifier whose
// values were byte-identical to its base and still passed a presence
// scan. Every case below asserts BOTH that a hover rule exists AND that
// at least one of its declared values differs from the base rule it
// overrides.

const overviewCssPath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "overview.css",
);
const overviewCss = readFileSync(overviewCssPath, "utf8");

const stylesCssPath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "styles.css",
);
const stylesCss = readFileSync(stylesCssPath, "utf8");

function ruleBodyFor(css: string, selector: string): string {
  const idx = css.indexOf(selector);
  expect(idx, `selector ${selector} not found`).toBeGreaterThanOrEqual(0);
  const open = css.indexOf("{", idx);
  const close = css.indexOf("}", open);
  return css.slice(open + 1, close);
}

function propValue(body: string, prop: string): string | undefined {
  const withoutComments = body.replace(/\/\*[\s\S]*?\*\//g, "");
  const match = withoutComments.match(
    new RegExp(`(?:^|[;{])\\s*${prop}\\s*:\\s*([^;]+);`),
  );
  return match?.[1]?.trim();
}

function assertHoverDiffersFromBase(
  css: string,
  baseSelector: string,
  hoverSelector: string,
  props: string[],
) {
  const baseBody = ruleBodyFor(css, baseSelector);
  const hoverBody = ruleBodyFor(css, hoverSelector);
  const changed = props.some((prop) => {
    const hoverVal = propValue(hoverBody, prop);
    if (hoverVal === undefined) return false;
    const baseVal = propValue(baseBody, prop);
    return hoverVal !== baseVal;
  });
  expect(
    changed,
    `expected at least one of [${props.join(", ")}] to differ between ` +
      `${baseSelector} and ${hoverSelector}`,
  ).toBe(true);
}

function assertHasScopedTransition(css: string, selector: string) {
  const body = ruleBodyFor(css, selector);
  const transition = propValue(body, "transition");
  expect(transition, `${selector} has no transition declaration`).toBeDefined();
  expect(transition).not.toMatch(/^all\b/);
  expect(transition).toContain("var(--chq-motion-color)");
}

describe("overview.css button family motion + hover (DEC-851 wave-67)", () => {
  it("toolbar secondary tier: base transitions and hover differs from base", () => {
    assertHasScopedTransition(overviewCss, ".chq-overview-toolbar-btn {");
    assertHoverDiffersFromBase(
      overviewCss,
      ".chq-overview-toolbar-btn {",
      ".chq-overview-toolbar-btn:hover {",
      ["background", "border-color"],
    );
  });

  it("toolbar secondary tier: active differs from base", () => {
    assertHoverDiffersFromBase(
      overviewCss,
      ".chq-overview-toolbar-btn {",
      ".chq-overview-toolbar-btn:active {",
      ["background"],
    );
  });

  it("toolbar primary tier: hover and active fill differ from base", () => {
    assertHoverDiffersFromBase(
      overviewCss,
      ".chq-overview-toolbar-btn-primary {",
      ".chq-overview-toolbar-btn-primary:hover {",
      ["background"],
    );
    assertHoverDiffersFromBase(
      overviewCss,
      ".chq-overview-toolbar-btn-primary {",
      ".chq-overview-toolbar-btn-primary:active {",
      ["background"],
    );
  });

  it("row secondary tier: base transitions and hover/active differ from base", () => {
    assertHasScopedTransition(overviewCss, ".chq-overview-btn {");
    assertHoverDiffersFromBase(
      overviewCss,
      ".chq-overview-btn {",
      ".chq-overview-btn:hover {",
      ["background", "border-color"],
    );
    assertHoverDiffersFromBase(
      overviewCss,
      ".chq-overview-btn {",
      ".chq-overview-btn:active {",
      ["background"],
    );
  });

  it("row primary tier: hover/active fill differ from base", () => {
    assertHoverDiffersFromBase(
      overviewCss,
      ".chq-overview-btn-primary {",
      ".chq-overview-btn-primary:hover {",
      ["background"],
    );
    assertHoverDiffersFromBase(
      overviewCss,
      ".chq-overview-btn-primary {",
      ".chq-overview-btn-primary:active {",
      ["background"],
    );
  });

  it("tertiary link tier: base transitions and hover colour differs from base", () => {
    assertHasScopedTransition(overviewCss, ".chq-overview-link-btn {");
    assertHoverDiffersFromBase(
      overviewCss,
      ".chq-overview-link-btn {",
      ".chq-overview-link-btn:hover {",
      ["color"],
    );
  });

  it("tertiary link muted variant: hover colour differs from both its own base and the un-muted hover", () => {
    assertHoverDiffersFromBase(
      overviewCss,
      ".chq-overview-link-btn.chq-overview-link-muted {",
      ".chq-overview-link-btn.chq-overview-link-muted:hover {",
      ["color"],
    );
    const mutedHover = propValue(
      ruleBodyFor(
        overviewCss,
        ".chq-overview-link-btn.chq-overview-link-muted:hover {",
      ),
      "color",
    );
    const unmutedHover = propValue(
      ruleBodyFor(overviewCss, ".chq-overview-link-btn:hover {"),
      "color",
    );
    expect(mutedHover).not.toBe(unmutedHover);
  });

  it("no rule in the button family uses `transition: all`", () => {
    expect(overviewCss).not.toMatch(/transition:\s*all\b/);
  });
});

describe(".chq-nav-link motion + hover (DEC-851 wave-67)", () => {
  it("has a property-scoped transition and hover differs from base", () => {
    assertHasScopedTransition(stylesCss, ".chq-nav-link {");
    assertHoverDiffersFromBase(
      stylesCss,
      ".chq-nav-link {",
      ".chq-nav-link:hover {",
      ["background", "color"],
    );
  });

  it("does not use `transition: all`", () => {
    const body = ruleBodyFor(stylesCss, ".chq-nav-link {");
    expect(propValue(body, "transition")).not.toMatch(/^all\b/);
  });
});
