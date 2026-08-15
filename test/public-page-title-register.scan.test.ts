// DEC-990 amendment (w49-h): ONE public page-title register, at the
// handoff's stated numbers. docs/design/README.md's typography table states
// exactly two customer-facing h1 registers -- "Page title (desktop)"
// 36px/700/-0.04em (25-27px on phone) and "Overview headline" 44px/700/
// -0.042em. Six customer-facing surfaces used to each declare their own
// bespoke h1 size (24/1.6rem/34/27/29/44px) instead of sharing one register.
// .chq-pub-surface-title (src/routes/public/css/rail.css.ts) is now the
// shared page-title class, applied to every customer-facing page-title <h1>
// (sessions/speakers/agenda/my-schedule/session+speaker detail, the
// programme print title, and every submit-views.tsx page-title h1); the
// CFP/programme stylesheets don't compose rail.css.ts, so they each declare
// their own copy of the same class with the same numbers. This scan is the
// regression guard: it fails if any h1-ish selector in the customer-facing
// CSS modules declares a font-size outside the two README registers (their
// desktop values, or the phone companion each already carried before this
// task -- 26px for page title inside rail.css.ts's existing <=700px block,
// 30px for the untouched .chq-home-hero phone override).

import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = join(__dirname, "..");
const PUBLIC_ROOT = join(ROOT, "src", "routes", "public");

// The exact files this task's ruling is scoped to: the public/css/* family,
// plus the three standalone stylesheet modules that don't compose it.
const TARGET_FILES = [
  ...readdirSync(join(PUBLIC_ROOT, "css"))
    .filter((f) => f.endsWith(".css.ts"))
    .map((f) => join(PUBLIC_ROOT, "css", f)),
  join(PUBLIC_ROOT, "cfp.css.ts"),
  join(PUBLIC_ROOT, "programme.css.ts"),
  join(PUBLIC_ROOT, "home.css.ts"),
];

// Page title register (README: 36px desktop / 25-27px phone). We accept the
// exact desktop value and the exact phone value already in use.
const PAGE_TITLE_SIZES = new Set(["36px"]);
const PAGE_TITLE_PHONE_SIZES = new Set(["26px"]);
// Overview headline register (README: 44px desktop; .chq-home-hero's own
// pre-existing phone rendition, untouched by this task, is left as-is).
const HERO_SIZES = new Set(["44px"]);
const HERO_PHONE_SIZES = new Set(["30px"]);

interface RuleHit {
  file: string;
  selector: string;
  fontSize: string;
}

// Strip /* ... */ comments so a comment preceding a rule never leaks into
// the "selector" text captured by extractRules below.
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "");
}

function extractRules(cssRaw: string): { selector: string; body: string }[] {
  const css = stripComments(cssRaw);
  const rules: { selector: string; body: string }[] = [];
  const re = /([^{}]+)\{([^{}]*)\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(css)) !== null) {
    rules.push({ selector: (m[1] ?? "").trim(), body: m[2] ?? "" });
  }
  return rules;
}

function isPageTitleSelector(selector: string): boolean {
  return /\.chq-pub-surface-title\b/.test(selector) || /\.chq-prog-title\b/.test(selector) || /\.chq-cfp-intro h1\b/.test(selector) || /\.chq-cfp-confirm h1\b/.test(selector) || /\.chq-cfp-closed h1\b/.test(selector);
}

function isHeroSelector(selector: string): boolean {
  return /\.chq-home-hero h1\b/.test(selector);
}

function fontSizeOf(body: string): string | null {
  const m = /font-size\s*:\s*([^;]+);/.exec(body);
  return m && m[1] !== undefined ? m[1].trim() : null;
}

describe("public page-title register scan (DEC-990 amendment)", () => {
  it("every h1/page-title selector in the customer-facing CSS modules declares only the two README registers", () => {
    const badHits: string[] = [];
    for (const file of TARGET_FILES) {
      const src = readFileSync(file, "utf8");
      const rel = relative(ROOT, file).split("\\").join("/");
      const rules = extractRules(src);
      for (const rule of rules) {
        const fontSize = fontSizeOf(rule.body);
        if (fontSize === null) continue;
        const isTitle = isPageTitleSelector(rule.selector);
        const isHero = isHeroSelector(rule.selector);
        if (!isTitle && !isHero) continue;
        const allowed = isTitle ? new Set([...PAGE_TITLE_SIZES, ...PAGE_TITLE_PHONE_SIZES]) : new Set([...HERO_SIZES, ...HERO_PHONE_SIZES]);
        if (!allowed.has(fontSize)) {
          badHits.push(`${rel}: "${rule.selector}" declares font-size: ${fontSize} (not one of ${[...allowed].join(", ")})`);
        }
      }
    }
    expect(badHits, badHits.join("\n") || "no offender found").toHaveLength(0);
  });

  it("the shared .chq-pub-surface-title register is exactly 36px/700/-0.04em on desktop wherever it is declared", () => {
    for (const file of [join(PUBLIC_ROOT, "css", "rail.css.ts"), join(PUBLIC_ROOT, "cfp.css.ts"), join(PUBLIC_ROOT, "programme.css.ts")]) {
      const src = readFileSync(file, "utf8");
      // Excludes the 26px phone rendition inside rail.css.ts's <=700px media
      // block: extractRules is media-unaware, so both share the same
      // ".chq-pub-surface-title" selector text -- the base (desktop) rule is
      // the one that still carries the full font-size/weight/letter-spacing
      // declaration set.
      const rules = extractRules(src).filter((r) => r.selector === ".chq-pub-surface-title" && r.body.includes("font-weight"));
      expect(rules.length, `${relative(ROOT, file)}: expected exactly one base .chq-pub-surface-title rule`).toBe(1);
      const rule = rules[0];
      if (!rule) throw new Error("unreachable: length checked above");
      const body = rule.body;
      expect(body).toContain("font-size: 36px");
      expect(body).toContain("font-weight: 700");
      expect(body).toContain("letter-spacing: -0.04em");
    }
  });

  it(".chq-home-hero h1 stays at the overview-headline register (44px/700/-0.042em), untouched", () => {
    const src = readFileSync(join(PUBLIC_ROOT, "home.css.ts"), "utf8");
    const rules = extractRules(src).filter((r) => r.selector === ".chq-home-hero h1");
    expect(rules.length).toBeGreaterThanOrEqual(1);
    const base = rules[0];
    if (!base) throw new Error("unreachable: length checked above");
    expect(base.body).toContain("font-size: 44px");
    expect(base.body).toContain("font-weight: 700");
    expect(base.body).toContain("letter-spacing: -0.042em");
  });
});
