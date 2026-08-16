// DEC-383 (wave-66 amendment): "an anchor that paints itself as a button
// owns its own hover". theme.ts:214's `a:not(.chq-btn):hover { color:
// var(--chq-brand-hover) }` carves out exactly ONE class (chq-btn), so every
// OTHER filled anchor -- any element whose class paints
// `color: var(--chq-on-brand)` as its resting ink on a dark fill -- has its
// label repainted to the darker brand colour on hover while the fill stays
// put, producing dark-on-dark. Per the ruling, the population is DERIVED,
// never hand-listed (same family as DEC-367/DEC-808): scan every `*_CSS`
// template-literal export under src/routes/** and src/views/** for rules
// that set `color: var(--chq-on-brand)`, collect the class names those
// rules are keyed on, then scan every `<a>` in src/routes/**/*.tsx for one
// of those classes. Such an anchor must EITHER also carry `chq-btn`
// (inheriting the tier's own hover) OR the class's owning sheet must
// declare an anchor-qualified `a.<class>:hover` rule that sets `color`
// (bare `.<class>:hover` at (0,2,0) loses the specificity race to
// `a:not(.chq-btn):hover` at (0,2,1) and is not a fix).

import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, "..");
const ROUTES_SRC = join(REPO_ROOT, "src", "routes");
const VIEWS_SRC = join(REPO_ROOT, "src", "views");

function walk(dir: string, suffix: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    const st = statSync(p);
    if (st.isDirectory()) out.push(...walk(p, suffix));
    else if (entry.endsWith(suffix)) out.push(p);
  }
  return out;
}

const CSS_MODULE_FILES = [...walk(ROUTES_SRC, ".ts"), ...walk(VIEWS_SRC, ".ts")].filter(
  (f) => !f.endsWith(".test.ts"),
);

type CssRule = { file: string; rel: string; selector: string; body: string };

/** Pulls every top-level-or-nested `selector { body }` rule out of a plain
 * CSS-in-template-literal string, including rules nested inside an
 * `@media (...) { ... }` wrapper, WITHOUT assuming a fixed nesting depth:
 * repeatedly strip the innermost (brace-free-body) rules, recording any
 * whose selector does not itself start with `@` (i.e. is not the at-rule
 * wrapper), until nothing further peels off. */
/** Template-literal interpolations (`${...}`) inside a `*_CSS` string are
 * not CSS syntax -- some (e.g. `${agendaQs({ day }, ...)}`) contain their
 * own nested braces, which would otherwise desynchronise the brace-counting
 * rule extractor below. Replace every `${...}` span (matched by brace
 * depth, not a flat regex) with a neutral placeholder that contains no
 * braces, colons or semicolons. */
function stripInterpolations(css: string): string {
  let out = "";
  let i = 0;
  while (i < css.length) {
    if (css[i] === "$" && css[i + 1] === "{") {
      let depth = 1;
      let j = i + 2;
      for (; j < css.length && depth > 0; j++) {
        if (css[j] === "{") depth++;
        else if (css[j] === "}") depth--;
      }
      out += "X";
      i = j;
    } else {
      out += css[i];
      i++;
    }
  }
  return out;
}

/** Strips `/* ... *\/` block comments -- a comment sitting immediately above
 * a rule would otherwise be swallowed into the "selector" capture by the
 * brace-counting extractor below (the comment text precedes the rule's `{`
 * with no brace of its own in between). */
function stripComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, "");
}

function extractRules(cssRaw: string): Array<{ selector: string; body: string }> {
  const rules: Array<{ selector: string; body: string }> = [];
  let text = stripComments(stripInterpolations(cssRaw));
  let changed = true;
  const ruleRe = /([^{}]+)\{([^{}]*)\}/g;
  while (changed) {
    changed = false;
    text = text.replace(ruleRe, (_m, selectorRaw: string, bodyRaw: string) => {
      changed = true;
      const selector = selectorRaw.trim();
      if (!selector.startsWith("@")) {
        rules.push({ selector, body: bodyRaw });
      }
      return "";
    });
  }
  return rules;
}

/** Every `*_CSS` (or THEME_CSS) exported template-literal constant found in
 * the given source text, by scanning for `export const <NAME>_CSS = \`...\`;`
 * -- this is a syntactic scan, not a TS import, so it works uniformly across
 * every module without a per-file allowlist. */
function extractCssExports(source: string): string[] {
  const out: string[] = [];
  const re = /export const [A-Z_]*_CSS\s*=\s*`([\s\S]*?)`\s*;/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(source))) {
    out.push(m[1]!);
  }
  return out;
}

function allCssRules(): CssRule[] {
  const rules: CssRule[] = [];
  for (const file of CSS_MODULE_FILES) {
    const raw = readFileSync(file, "utf-8");
    const rel = relative(REPO_ROOT, file).split(sep).join("/");
    for (const cssText of extractCssExports(raw)) {
      for (const rule of extractRules(cssText)) {
        rules.push({ file, rel, selector: rule.selector, body: rule.body });
      }
    }
  }
  return rules;
}

const ALL_RULES = allCssRules();

function declValue(body: string, prop: string): string | null {
  const re = new RegExp(`(?:^|;)\\s*${prop}\\s*:\\s*([^;]+);?`);
  const m = body.match(re);
  return m ? m[1]!.trim() : null;
}

/** The derived population: every bare class name mentioned in a selector
 * whose rule body sets `color: var(--chq-on-brand)`. A selector may be
 * compound/comma-joined (`.a, .b:hover`) -- every class token in it counts. */
function onBrandClasses(): Set<string> {
  const classes = new Set<string>();
  for (const rule of ALL_RULES) {
    if (declValue(rule.body, "color") !== "var(--chq-on-brand)") continue;
    for (const part of rule.selector.split(",")) {
      const classRe = /\.([\w-]+)/g;
      let cm: RegExpExecArray | null;
      while ((cm = classRe.exec(part))) {
        classes.add(cm[1]!);
      }
    }
  }
  return classes;
}

const ON_BRAND_CLASSES = onBrandClasses();

/** True iff some sheet declares an anchor-qualified `a.<className>:hover`
 * (optionally compound, e.g. `a.foo:hover, a.bar:hover`) that sets `color`. */
function hasAnchorQualifiedHover(className: string): boolean {
  return ALL_RULES.some((rule) => {
    if (declValue(rule.body, "color") === null) return false;
    return rule.selector
      .split(",")
      .map((s) => s.trim())
      .includes(`a.${className}:hover`);
  });
}

type AnchorUse = { file: string; rel: string; line: number; classes: string[]; snippet: string };

function findAnchorUses(): AnchorUse[] {
  const uses: AnchorUse[] = [];
  const tsxFiles = walk(ROUTES_SRC, ".tsx");
  const tagRe = /<a\b[^>]*>/g;
  const classAttrRe = /class=(\{[^}]*\}|"[^"]*")/;
  for (const file of tsxFiles) {
    const raw = readFileSync(file, "utf-8");
    const rel = relative(REPO_ROOT, file).split(sep).join("/");
    let m: RegExpExecArray | null;
    while ((m = tagRe.exec(raw))) {
      const tag = m[0];
      const classMatch = tag.match(classAttrRe);
      if (!classMatch) continue;
      const classFragment = classMatch[1]!;
      const classes = new Set<string>();
      const stringRe = /"([^"]*)"/g;
      let sm: RegExpExecArray | null;
      while ((sm = stringRe.exec(classFragment))) {
        for (const tok of sm[1]!.split(/\s+/)) {
          if (tok) classes.add(tok);
        }
      }
      const line = raw.slice(0, m.index).split("\n").length;
      uses.push({ file, rel, line, classes: [...classes], snippet: tag });
    }
  }
  return uses;
}

const ANCHOR_USES = findAnchorUses();

describe("no anchor paints an on-brand label under a:not(.chq-btn):hover (DEC-383 wave-66 amendment)", () => {
  it("the scan actually found on-brand classes (population sanity floor)", () => {
    expect(ON_BRAND_CLASSES.size).toBeGreaterThanOrEqual(1);
  });

  it("the scan actually found anchor elements to check (population sanity floor)", () => {
    expect(ANCHOR_USES.length).toBeGreaterThanOrEqual(1);
  });

  for (const use of ANCHOR_USES) {
    const flaggedClasses = use.classes.filter((c) => ON_BRAND_CLASSES.has(c));
    if (flaggedClasses.length === 0) continue;

    for (const className of flaggedClasses) {
      it(`${use.rel}:${use.line} <a class="...${className}..."> carries chq-btn or has an anchor-qualified a.${className}:hover`, () => {
        const carriesBtn = use.classes.includes("chq-btn");
        const hasHover = hasAnchorQualifiedHover(className);
        expect(
          carriesBtn || hasHover,
          `${use.rel}:${use.line} renders <a class="...${className}...">, and ` +
            `.${className} sets color: var(--chq-on-brand) somewhere in the ` +
            "SSR stylesheets, but the anchor carries neither chq-btn nor a " +
            `sheet-declared a.${className}:hover rule with a color -- the ` +
            "generic a:not(.chq-btn):hover in theme.ts will repaint this " +
            "anchor's label to the hover brand on its unchanged fill " +
            `(dark-on-dark). Tag: ${use.snippet}`,
        ).toBe(true);
      });
    }
  }
});
