// SSR sticky-footer scan (DEC-808 wave-117 amendment). The mandate asked
// for a "sweep" of the sticky-footer idiom (home.css.ts's
// `.chq-home-shell { display:flex; flex-direction:column; min-height:100vh }`
// plus `.chq-home-body { ...; flex: 1 0 auto }`) to every other short SSR
// page. A hand-listed sweep is finished the moment someone forgets a file,
// so this scan DERIVES its population instead: it walks every `.tsx` under
// src/routes/** and src/views/** for a JSX `<footer` carrying a `chq-`
// class, resolves the enclosing shell class from the SAME file (the
// `chq-*-shell` class token appearing in that file's markup) and that
// shell's growing child (the file's single `<main class="...">`), and then
// asserts the union of every SSR stylesheet (DEC-808 wave-96 amendment
// population: every src/**/*.ts module exporting a `*_CSS` template
// literal, plus src/views/theme.ts) declares the idiom for that shell:
//
//   - the shell selector itself: `display: flex`, `flex-direction: column`,
//     and `min-height: 100vh` or `100dvh` (the phone chrome unit).
//   - a selector whose last compound token is the main's class: a `flex`
//     declaration that grows (`flex: 1 ...` or `flex: 1`).
//
// A vacuous-population tripwire asserts the population is non-empty and
// contains the two known members (`.chq-home-shell`, `.chq-portal-shell`);
// a synthetic positive/negative control proves the detector itself can
// fail, not just pass, against fabricated markup+CSS it never reads from
// disk.
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { DEC_808 } from "../src/decisions";
import { stripCssComments } from "./helpers/strip-css-comments";

// DEC-808 is a compile-checked dependency of this file's population and
// verdict logic (see the header above): referencing the constant here
// makes that dependency visible to a reader and to the compiler.
void DEC_808;

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = join(HERE, "..", "src");

/** Every file under `root` whose name ends with `suffix`, enumerated via
 * readdirSync (DEC-808) rather than a hand-listed manifest. */
function allFiles(root: string, suffix: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(root, { withFileTypes: true, recursive: true })) {
    if (!entry.isFile() || !entry.name.endsWith(suffix)) continue;
    out.push(join(entry.parentPath, entry.name));
  }
  return out.sort();
}

// ---------------------------------------------------------------------
// Population: every SSR view module rendering a <footer class="chq-...">.
// ---------------------------------------------------------------------

interface ShellMember {
  /** relative path of the view file, for readable failure messages */
  file: string;
  footerClass: string;
  shellClass: string;
  /** the growing child's class, resolved from the file's single <main>. */
  bodyClass: string;
}

const FOOTER_RE = /<footer\b[^>]*\bclass="([^"]*\bchq-[^"]*)"/g;
const SHELL_CLASS_RE = /\bchq-[\w-]*-shell\b/;
const MAIN_RE = /<main\b[^>]*\bclass="([^"]*)"/;

function deriveShellMembers(): ShellMember[] {
  const roots = [join(SRC, "routes"), join(SRC, "views")];
  const files = roots.flatMap((r) => allFiles(r, ".tsx"));
  const members: ShellMember[] = [];

  for (const file of files) {
    const raw = readFileSync(file, "utf-8");
    const text = stripCssComments(raw);

    const footerMatches = [...text.matchAll(FOOTER_RE)];
    if (footerMatches.length === 0) continue;

    const shellMatch = text.match(SHELL_CLASS_RE);
    if (!shellMatch) {
      throw new Error(
        `${file} renders a <footer class="chq-..."> but no chq-*-shell class token appears anywhere in the same file -- the sweep's shell-resolution step assumes every SSR page with a footer names its own shell in the same module.`,
      );
    }
    const shellClass = shellMatch[0];

    const mainMatch = text.match(MAIN_RE);
    if (!mainMatch) {
      throw new Error(
        `${file} renders a <footer> and a ${shellClass} but has no <main class="..."> to resolve as the shell's growing child.`,
      );
    }
    const mainClassAttr = mainMatch[1] ?? "";
    const bodyClass = mainClassAttr
      .split(/\s+/)
      .find((c) => c.startsWith("chq-"));
    if (!bodyClass) {
      throw new Error(`${file}'s <main> has no chq- class to resolve as ${shellClass}'s growing child.`);
    }

    for (const fm of footerMatches) {
      const footerClass = (fm[1] ?? "")
        .split(/\s+/)
        .find((c) => c.startsWith("chq-"));
      if (!footerClass) continue;
      members.push({ file: file.slice(SRC.length + 1), footerClass, shellClass, bodyClass });
    }
  }
  return members;
}

// ---------------------------------------------------------------------
// SSR stylesheet population (DEC-808 wave-96 amendment): every src/**/*.ts
// module exporting a `*_CSS` template literal, plus src/views/theme.ts
// (already covered by the same export shape).
// ---------------------------------------------------------------------

function findCssModules(root: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(root, { withFileTypes: true, recursive: true })) {
    if (!entry.isFile()) continue;
    if (!entry.name.endsWith(".ts") && !entry.name.endsWith(".tsx")) continue;
    const path = join(entry.parentPath, entry.name);
    const raw = readFileSync(path, "utf-8");
    if (/export const \w+_CSS = `/.test(raw)) out.push(path);
  }
  return out.sort();
}

function extractCssText(filePath: string): string {
  const raw = readFileSync(filePath, "utf-8");
  const cssMatch = raw.match(/export const \w+_CSS = `([\s\S]*?)`;/);
  if (!cssMatch) throw new Error(`no exported *_CSS template literal found in ${filePath}`);
  return cssMatch[1] ?? "";
}

function unionCssText(): string {
  return findCssModules(SRC)
    .map(extractCssText)
    .join("\n\n");
}

// ---------------------------------------------------------------------
// A tiny rule-block parser, mirroring test/ssr-page-clamp.scan.test.ts:
// `selector { body }` pairs, comment-stripped, @media preludes flattened
// out of the way first so a phone-only override's selector still resolves
// against its own body (this scan only needs to know a matching selector +
// declaration pair exists SOMEWHERE in the sheet, not which media block).
// ---------------------------------------------------------------------

interface Rule {
  selectors: string[];
  body: string;
}

function parseRules(cssText: string): Rule[] {
  const noComments = stripCssComments(cssText);
  // Template-literal interpolations (`${HOME_BODY_MEASURE}` etc) are read
  // from raw TS source, unevaluated -- their `${` / `}` are real characters
  // that would corrupt the brace-matching rule parser below (a selector
  // whose body contains an interpolation would look like it has a nested,
  // unclosed brace pair). Interpolated CSS fragments in this tree are
  // always simple `${IDENTIFIER}` with no nested braces, so stripping them
  // outright is safe and never hides a real declaration -- every
  // declaration this scan checks for is written as a literal, never
  // assembled through an interpolated fragment.
  const noInterpolations = noComments.replace(/\$\{[^{}]*\}/g, "");
  const noAtRulePreludes = noInterpolations.replace(/@media\s*\([^)]*\)\s*\{/g, "{");
  const rules: Rule[] = [];
  const ruleRe = /([^{}]+)\{([^{}]*)\}/g;
  let m: RegExpExecArray | null;
  while ((m = ruleRe.exec(noAtRulePreludes)) !== null) {
    const selectorText = (m[1] ?? "").trim();
    if (!selectorText) continue;
    const body = m[2] ?? "";
    const selectors = selectorText.split(",").map((s) => s.trim().replace(/\s+/g, " "));
    rules.push({ selectors, body });
  }
  return rules;
}

/** True if `selector`, split on whitespace, has `token` (e.g. `.chq-foo`)
 * as one of its comma-separated members exactly. */
function selectorEquals(selector: string, token: string): boolean {
  return selector === token;
}

/** True if `selector`'s LAST whitespace-separated compound is exactly
 * `token` -- matches both a bare `.chq-foo` selector and a descendant one
 * like `.chq-shell > .chq-foo`. */
function selectorEndsWith(selector: string, token: string): boolean {
  const parts = selector.split(/\s+/).filter((p) => p !== ">");
  return parts.length > 0 && parts[parts.length - 1] === token;
}

const MIN_HEIGHT_RE = /min-height\s*:\s*100(?:vh|dvh)\b/;
const DISPLAY_FLEX_RE = /display\s*:\s*flex\b/;
const FLEX_DIRECTION_COLUMN_RE = /flex-direction\s*:\s*column\b/;
const FLEX_GROW_RE = /flex\s*:\s*1\b/;

/** Does the sheet declare the sticky-footer shell idiom for `shellClass`? */
function shellDeclaresIdiom(rules: Rule[], shellClass: string): boolean {
  const token = `.${shellClass}`;
  return rules.some(
    (r) =>
      r.selectors.some((s) => selectorEquals(s, token)) &&
      MIN_HEIGHT_RE.test(r.body) &&
      DISPLAY_FLEX_RE.test(r.body) &&
      FLEX_DIRECTION_COLUMN_RE.test(r.body),
  );
}

/** Does the sheet declare a flex-grow rule for `bodyClass`, resolved as
 * the LAST compound of some selector (bare or `.shell > .body`)? */
function bodyDeclaresGrow(rules: Rule[], bodyClass: string): boolean {
  const token = `.${bodyClass}`;
  return rules.some((r) => r.selectors.some((s) => selectorEndsWith(s, token)) && FLEX_GROW_RE.test(r.body));
}

describe("ssr-shell-sticky-footer.scan", () => {
  const members = deriveShellMembers();
  const cssText = unionCssText();
  const rules = parseRules(cssText);

  it("population is non-empty and derived, not hand-listed (DEC-808 vacuous-population tripwire)", () => {
    expect(members.length).toBeGreaterThan(0);
    const shellClasses = new Set(members.map((m) => m.shellClass));
    expect(shellClasses.has("chq-home-shell")).toBe(true);
    expect(shellClasses.has("chq-portal-shell")).toBe(true);
  });

  it("every derived shell declares the sticky-footer idiom (display:flex; flex-direction:column; min-height:100vh|100dvh)", () => {
    const offenders = members.filter((m) => !shellDeclaresIdiom(rules, m.shellClass));
    expect(offenders.map((o) => `${o.shellClass} (${o.file})`)).toEqual([]);
  });

  it("every derived shell's growing child declares a flex-grow rule", () => {
    const offenders = members.filter((m) => !bodyDeclaresGrow(rules, m.bodyClass));
    expect(offenders.map((o) => `${o.bodyClass} (${o.file})`)).toEqual([]);
  });

  // Synthetic positive/negative control: proves the detector itself is
  // capable of failing, over fabricated markup+CSS it never reads from
  // disk -- not just that it happens to pass on the real tree today.
  describe("synthetic control", () => {
    const goodCss = `
      .chq-fake-shell { display: flex; flex-direction: column; min-height: 100vh; }
      .chq-fake-shell > .chq-fake-body { flex: 1 0 auto; }
    `;
    const badCss = `
      .chq-fake-shell { display: block; }
      .chq-fake-body { padding: 8px; }
    `;

    it("passes a shell+body pair that carries the idiom", () => {
      const r = parseRules(goodCss);
      expect(shellDeclaresIdiom(r, "chq-fake-shell")).toBe(true);
      expect(bodyDeclaresGrow(r, "chq-fake-body")).toBe(true);
    });

    it("fails a shell+body pair that omits the idiom", () => {
      const r = parseRules(badCss);
      expect(shellDeclaresIdiom(r, "chq-fake-shell")).toBe(false);
      expect(bodyDeclaresGrow(r, "chq-fake-body")).toBe(false);
    });
  });
});
