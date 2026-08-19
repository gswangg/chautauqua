// SSR-stylesheet CSS token + class contract (DEC-970). Extends the CSS
// contract app/src/css-contract.scan.test.ts already enforces for the admin
// SPA (DEC-937) to every server-rendered stylesheet -- everything an
// anonymous visitor sees. Two invariants:
//
//   A) every BARE var(--chq-...) reference (no fallback argument) in an SSR
//      stylesheet must resolve to a real declaration -- either in the
//      theme's :root token block (src/views/theme.ts), or declared locally
//      in the same module. An undefined token otherwise resolves to
//      transparent/initial silently in the browser with no build-time
//      signal. A var(--chq-foo, <fallback>) call is exempt: the fallback is
//      a deliberate, visible default, not a silent failure.
//
//   B) every `chq-...` class name appearing in a `class` attribute anywhere
//      under src/**/*.tsx has at least one matching class selector in the
//      union of the SSR stylesheets -- otherwise the class does nothing in
//      the browser and the author likely meant to style it.
//
//   C) the reverse direction (DEC-970's deferred half, landed here): every
//      `chq-...` class TOKEN appearing in a class SELECTOR anywhere in the
//      union of the SSR stylesheets must appear somewhere in the whole
//      source TEXT of src/**/*.ts / src/**/*.tsx (excluding the SSR
//      stylesheet modules themselves -- a selector trivially contains its
//      own token, so counting a stylesheet's own text as "usage" of its own
//      rule would make every rule vacuously alive). Matching is done against
//      whole file text, not just `class=` attributes, so a class assembled
//      by an inline <script> string, a helper constant, or a JSX `className`
//      alias (Hono JSX maps className -> class, see node_modules/hono/dist/
//      jsx/utils.js) is never a false positive. Work is done at TOKEN level:
//      every class token in a rule's selector (including compound/
//      descendant/pseudo selectors and selectors nested in @media blocks)
//      is collected, and a rule is dead only when EVERY token in its
//      selector is unused -- a rule with one live token among several stays.
//
// DEC-970 deferred (C) for exactly one stated reason: "DEC-968 is adopting
// the one known instance, and a dead-rule check landing first would fail on
// a defect another lane is fixing." DEC-968 landed (.chq-pub-session-tag is
// now emitted by src/routes/public/cards.tsx:61-64), so that reason has
// expired and (C) lands here.
//
// All three scans ENUMERATE their inputs via readdirSync (mirroring
// DEC-937/DEC-808) rather than a hand-listed manifest, so a new SSR
// stylesheet or page is checked automatically.
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { DEC_970 } from "../src/decisions";

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

/** Every SSR stylesheet module: every `*.css.ts` route module plus
 * src/views/theme.ts (the shared THEME_CSS token block every SSR shell
 * inlines). `home.css` is already named `home.css.ts` on disk (a `*.css.ts`
 * module like the rest, not a bare `.css` file), so it's covered by the
 * `.css.ts` enumeration below without a separate case. */
const CSS_TS_FILES = allFiles(SRC, ".css.ts");
const THEME_FILE = join(SRC, "views", "theme.ts");
const SSR_STYLE_MODULES = [...CSS_TS_FILES, THEME_FILE].sort();

/** Non-`.css.ts` supporting modules that exist only to be imported by a
 * `*.css.ts` fragment (public.css.ts's contention decomposition, wave 68):
 * css/accent-classes.ts holds ONLY the shared ACCENT_BOUND_CLASSES class-
 * name array (DEC-838), no CSS rules of its own. Its raw text would
 * otherwise vacuously satisfy invariant C's "used somewhere in src/**"
 * check for those exact three class names (the same self-reference problem
 * SSR_STYLE_MODULES is already excluded from below), so it gets the same
 * exclusion even though it isn't itself an inlined stylesheet. */
const NON_STYLESHEET_CSS_SOURCES = [join(SRC, "routes", "public", "css", "accent-classes.ts")];

/** Strips /* ... *\/ block comments so a decision note quoting CSS-shaped
 * text is never mistaken for a real rule. */
function stripComments(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, "");
}

/** Resolves a relative import specifier (e.g. "./css/accent-classes") from
 * `fromFile` to an on-disk path, trying the extensions a `*.css.ts`
 * fragment or its supporting module might use. */
function resolveImportFile(fromFile: string, relSpecifier: string): string {
  const base = join(dirname(fromFile), relSpecifier);
  for (const ext of [".css.ts", ".ts", ".tsx", ""]) {
    const candidate = `${base}${ext}`;
    try {
      readFileSync(candidate, "utf-8");
      return candidate;
    } catch {
      continue;
    }
  }
  throw new Error(`cannot resolve import "${relSpecifier}" from ${fromFile}`);
}

/** Finds the array-literal items bound to `ident` -- either declared
 * locally in `raw` (same file), or, if `ident` is imported instead (a
 * decomposed *.css.ts fragment sharing one source array with a sibling
 * fragment, e.g. ACCENT_BOUND_CLASSES in css/accent-classes.ts), by
 * following the import to its source file. */
function resolveArrayLiteral(raw: string, filePath: string, ident: string): string[] {
  const localMatch = raw.match(new RegExp(`const\\s+${ident}\\s*=\\s*\\[([^\\]]*)\\]`));
  if (localMatch) {
    return [...(localMatch[1] ?? "").matchAll(/"([^"]*)"|'([^']*)'/g)].map((m) => m[1] ?? m[2] ?? "");
  }
  const importMatch = raw.match(new RegExp(`import\\s*\\{[^}]*\\b${ident}\\b[^}]*\\}\\s*from\\s*["']([^"']+)["']`));
  if (!importMatch) return [];
  const importedPath = resolveImportFile(filePath, importMatch[1] ?? "");
  return resolveArrayLiteral(readFileSync(importedPath, "utf-8"), importedPath, ident);
}

/**
 * Extracts the exported `..._CSS` template-literal CSS text from an SSR
 * stylesheet module, and resolves two kinds of `${...}` interpolation so an
 * interpolated selector/fragment is visible to the scan just like a literal
 * one:
 *
 *   - `${IDENT[N]}` (e.g. public.css.ts's `${ACCENT_BOUND_CLASSES[1]}`,
 *     DEC-838) against an `IDENT`-named array-literal constant, declared
 *     either in the same file or (css/agenda.css.ts, css/rail.css.ts)
 *     imported from a sibling fragment module.
 *   - bare `${IDENT}` where IDENT is an imported `..._CSS` constant (public
 *     .css.ts's contention-decomposition fragments, wave 68: `${CHROME_CSS}
 *     ${CARDS_CSS}${AGENDA_CSS}${RAIL_CSS}`) -- recursively resolved to
 *     that fragment's own (already-interpolated) CSS text, so the composed
 *     PUBLIC_CSS the scan sees matches its actual runtime value.
 */
function extractCssText(filePath: string): string {
  const raw = readFileSync(filePath, "utf-8");
  const cssMatch = raw.match(/export const \w+_CSS = `([\s\S]*?)`;/);
  if (!cssMatch) throw new Error(`no exported *_CSS template literal found in ${filePath}`);
  const css = cssMatch[1] ?? "";
  return css.replace(/\$\{(\w+)(?:\[(\d+)\])?\}/g, (full, ident: string, idxStr?: string) => {
    if (idxStr !== undefined) {
      const items = resolveArrayLiteral(raw, filePath, ident);
      return items[Number(idxStr)] ?? full;
    }
    if (!/_CSS$/.test(ident)) return full;
    const importMatch = raw.match(new RegExp(`import\\s*\\{[^}]*\\b${ident}\\b[^}]*\\}\\s*from\\s*["']([^"']+)["']`));
    if (!importMatch) return full;
    const importedPath = resolveImportFile(filePath, importMatch[1] ?? "");
    return extractCssText(importedPath);
  });
}

/** Extracts the `:root { ... }` block body from THEME_CSS. */
function extractRootBody(css: string): string {
  const match = stripComments(css).match(/:root\s*\{([^}]*)\}/);
  if (!match) throw new Error("no :root block found in theme.ts's THEME_CSS");
  return match[1] ?? "";
}

/** Every distinct `--chq-...` custom property referenced via a BARE
 * var(--chq-foo) call (no fallback argument). A var(--chq-foo, <fallback>)
 * call is deliberately self-healing and out of scope (see file header). */
function referencedTokens(css: string): string[] {
  const out = new Set<string>();
  const re = /var\(\s*(--chq-[A-Za-z0-9-]+)\s*\)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(stripComments(css))) !== null) {
    const name = m[1];
    if (name) out.add(name);
  }
  return [...out];
}

/** Whether `token` is declared (as `token:`) anywhere in the given css text. */
function isDeclaredIn(css: string, token: string): boolean {
  const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`${escaped}\\s*:`).test(css);
}

/**
 * Splits `css` into its individual style rules (leaf selector { ... }
 * blocks), including rules nested inside @media/@supports/@keyframes
 * wrappers, and returns each rule's raw selector text (comma-separated
 * multi-selectors kept together, since they share one declaration block --
 * a rule is one unit for the dead-rule check). At-rule preludes themselves
 * (the `@media (...)` text) are never returned as a "selector".
 */
function extractRules(css: string): string[] {
  const text = stripComments(css);
  const rules: string[] = [];
  let buffer = "";
  const stack: Array<"atrule" | "selector"> = [];
  for (const ch of text) {
    if (ch === "{") {
      const trimmed = buffer.trim();
      if (trimmed.startsWith("@")) {
        stack.push("atrule");
      } else {
        stack.push("selector");
        rules.push(trimmed);
      }
      buffer = "";
    } else if (ch === "}") {
      stack.pop();
      buffer = "";
    } else {
      buffer += ch;
    }
  }
  return rules;
}

/** Every distinct `chq-...` class token appearing in a selector's text
 * (compound `.chq-a.is-on`, descendant `.chq-a .chq-b`, pseudo `.chq-a:hover`
 * all included -- CSS only ever spells `.chq-foo` as a class selector, never
 * as a value, in this codebase). */
function classTokensInSelector(selector: string): string[] {
  return [...new Set([...selector.matchAll(/\.(chq-[A-Za-z0-9_-]+)/g)].map((m) => m[1]!))];
}

const MODULE_CSS = new Map(SSR_STYLE_MODULES.map((f) => [f, extractCssText(f)] as const));
const THEME_CSS = MODULE_CSS.get(THEME_FILE);
if (THEME_CSS === undefined) throw new Error("theme.ts's THEME_CSS was not extracted");
const ROOT_BODY = extractRootBody(THEME_CSS);

describe("SSR stylesheet CSS token + class contract (DEC-970)", () => {
  it("found more than one SSR stylesheet module to scan", () => {
    // Guards the enumeration itself: if readdirSync ever returned nothing,
    // every assertion below would vacuously pass.
    expect(SSR_STYLE_MODULES.length).toBeGreaterThan(5);
  });

  it("depends on DEC-970 (compile-checked)", () => {
    // Code that depends on a decision must reference its constant so the
    // dependency is compile-checked (see src/decisions.ts's header).
    expect(DEC_970.length).toBeGreaterThan(0);
  });

  it("every var(--chq-...) reference resolves to a declaration in :root or its own module", () => {
    const offenders: string[] = [];
    for (const [path, css] of MODULE_CSS) {
      const label = relative(SRC, path);
      for (const token of referencedTokens(css)) {
        const declaredGlobally = isDeclaredIn(ROOT_BODY, token);
        const declaredLocally = isDeclaredIn(css, token);
        if (!declaredGlobally && !declaredLocally) {
          offenders.push(`${label}: ${token}`);
        }
      }
    }
    expect(offenders, `undeclared CSS custom properties:\n${offenders.join("\n")}`).toEqual([]);
  });

  // Every declared `.chq-...` class selector across the SSR stylesheets,
  // regardless of nesting (@media, pseudo-classes, compound selectors like
  // `.chq-dot.is-on`) -- a generic scan for the token itself in selector
  // position, since CSS only ever spells `.chq-foo` as a class selector
  // (never as a property value in this codebase).
  const DECLARED_CLASSES = new Set<string>();
  for (const css of MODULE_CSS.values()) {
    for (const m of stripComments(css).matchAll(/\.(chq-[A-Za-z0-9_-]+)/g)) {
      const name = m[1];
      if (name) DECLARED_CLASSES.add(name);
    }
  }

  /**
   * Named, individually-justified exceptions -- never an open allowlist.
   * Each entry is a class that appears in a `class` attribute but is
   * genuinely style-free by design: either its own visual treatment lives
   * entirely on a child/sibling it doesn't own, or its markup is already
   * fully styled by a global (non-class-scoped) rule.
   */
  const STYLE_FREE_BY_DESIGN: ReadonlyMap<string, string> = new Map([
    [
      "chq-portal-signout",
      "shared.tsx: the <form> wraps the sign-out POST/CSRF mechanics only -- " +
        "its visual treatment lives entirely on the nested .chq-btn/.chq-btn-tertiary/.chq-portal-signout-btn button.",
    ],
    [
      "chq-pub-agenda-list-wrap",
      "agenda.tsx: the <section> exists to host the day's aria-label; every visual treatment lives on its " +
        "children (.chq-pub-agenda-list, .chq-pub-agenda-list-item, etc.), not the wrapper itself.",
    ],
    [
      "chq-portal-copresenter-fields",
      "portal/edit.tsx: DEC-029's wave-108 amendment turned the co-presenter <form> into a plain container " +
        "whose controls join #chq-portal-edit-form via the `form` attribute. The element it replaced carried " +
        "no class and no bare-`form` rule ever styled it; every visual treatment lives on its children " +
        "(.chq-portal-copresenter-names, -email-role, -role, -submit), so the wrapper itself is style-free.",
    ],
    [
      "chq-pub-sessions-list",
      "sessions.tsx: the <div> is the sessions-layout grid's first (1fr) column; its width comes from the " +
        "parent .chq-pub-sessions-layout grid-template-columns, and its internal spacing comes entirely from " +
        "its children (PublicSearchBox/PublicFilterBar/SessionCard), not a rule of its own.",
    ],
  ]);

  it("every chq-... class used in a class attribute has a matching selector (or a named exception)", () => {
    const tsxFiles = allFiles(SRC, ".tsx");
    const usedButUnexplained: string[] = [];

    for (const filePath of tsxFiles) {
      const text = readFileSync(filePath, "utf-8");
      const label = relative(SRC, filePath);
      for (const cls of classesUsedIn(text)) {
        if (DECLARED_CLASSES.has(cls)) continue;
        if (STYLE_FREE_BY_DESIGN.has(cls)) continue;
        usedButUnexplained.push(`${label}: ${cls}`);
      }
    }

    expect(
      usedButUnexplained,
      `chq-... classes used in JSX with no matching CSS selector and no named exception:\n${usedButUnexplained.join("\n")}`,
    ).toEqual([]);
  });

  it("every named exception is actually used in a class attribute somewhere under src/", () => {
    // Guards STYLE_FREE_BY_DESIGN itself from silently growing stale (a
    // class later given a real CSS rule, or removed from JSX entirely,
    // should have its exception entry deleted rather than lingering).
    const tsxFiles = allFiles(SRC, ".tsx");
    const usedClasses = new Set<string>();
    for (const filePath of tsxFiles) {
      for (const cls of classesUsedIn(readFileSync(filePath, "utf-8"))) usedClasses.add(cls);
    }
    const stale = [...STYLE_FREE_BY_DESIGN.keys()].filter((cls) => !usedClasses.has(cls));
    expect(stale, `named exceptions no longer used in any class attribute:\n${stale.join("\n")}`).toEqual([]);
  });

  /**
   * Invariant C (DEC-970's deferred reverse direction): named, individually-
   * justified exceptions for a class token whose ONLY source rule is
   * genuinely emitted elsewhere (an inline <script> string, a documented
   * dynamic constant) that the whole-source-text scan still can't see --
   * never an open allowlist, never populated from failure output.
   */
  const DEAD_RULE_EXCEPTIONS: ReadonlyMap<string, string> = new Map();

  it("every chq-... class token in an SSR selector is used somewhere in src/**/*.ts(x) (or a named exception)", () => {
    // "Used" is whole-source-text matching (not just `class=` attributes),
    // deliberately: a class assembled by an inline <script> string, a
    // helper constant, or Hono JSX's `className` alias (className -> class,
    // see node_modules/hono/dist/jsx/utils.js) is never a false positive.
    // The stylesheet modules themselves are excluded from the "used" text
    // scan -- a selector always contains its own token, so counting that
    // occurrence as "usage" would make every rule vacuously alive.
    const styleModuleSet = new Set([...SSR_STYLE_MODULES, ...NON_STYLESHEET_CSS_SOURCES]);
    const sourceFiles = [...allFiles(SRC, ".ts"), ...allFiles(SRC, ".tsx")].filter((f) => !styleModuleSet.has(f));
    const usedTokens = new Set<string>();
    for (const filePath of sourceFiles) {
      const text = readFileSync(filePath, "utf-8");
      for (const m of text.matchAll(/chq-[A-Za-z0-9_-]+/g)) usedTokens.add(m[0]);
    }

    const offenders: string[] = [];
    for (const [path, css] of MODULE_CSS) {
      const label = relative(SRC, path);
      for (const selector of extractRules(css)) {
        const tokens = classTokensInSelector(selector);
        if (tokens.length === 0) continue; // not a class rule (element/attr selector, keyframe %, etc.)
        const liveTokens = tokens.filter((t) => usedTokens.has(t) || DEAD_RULE_EXCEPTIONS.has(t));
        if (liveTokens.length > 0) continue; // at least one token in this rule is used -- rule stays
        offenders.push(`${label}: selector "${selector}" -- dead token(s): ${tokens.join(", ")}`);
      }
    }

    expect(
      offenders,
      `CSS rules whose class token(s) are used by no markup and have no named exception (delete the rule):\n${offenders.join("\n")}`,
    ).toEqual([]);
  });

  it("every named dead-rule exception is actually declared in a class selector somewhere in the SSR stylesheets", () => {
    // Guards DEAD_RULE_EXCEPTIONS from growing stale the same way
    // STYLE_FREE_BY_DESIGN is guarded above.
    const declaredTokens = new Set<string>();
    for (const css of MODULE_CSS.values()) {
      for (const selector of extractRules(css)) for (const t of classTokensInSelector(selector)) declaredTokens.add(t);
    }
    const stale = [...DEAD_RULE_EXCEPTIONS.keys()].filter((t) => !declaredTokens.has(t));
    expect(stale, `named dead-rule exceptions no longer declared in any SSR selector:\n${stale.join("\n")}`).toEqual([]);
  });
});

/**
 * Every distinct `chq-...` token appearing in a `class` attribute in the
 * given .tsx source text -- both static (`class="a b"`) and dynamic
 * (`class={expr}`) attributes. For a dynamic attribute, string literals
 * directly in the expression are read (covers ternaries like
 * `class={isActive ? "chq-a chq-b" : "chq-a"}`); a bare identifier in the
 * expression is additionally traced one level to a `const <ident> = ...;`
 * declaration in the same file (covers `class={rowClass}` where `rowClass`
 * is a locally-computed string one line above).
 */
function classesUsedIn(text: string): Set<string> {
  const out = new Set<string>();
  const addTokensFrom = (literal: string): void => {
    for (const tok of literal.split(/\s+/)) if (tok.startsWith("chq-")) out.add(tok);
  };
  const literalsIn = (expr: string): string[] => [...expr.matchAll(/'([^']*)'|"([^"]*)"/g)].map((m) => m[1] ?? m[2] ?? "");

  // Static class="..."
  for (const m of text.matchAll(/\bclass="([^"]*)"/g)) addTokensFrom(m[1] ?? "");

  // Dynamic class={...} -- balanced-brace extraction of the expression.
  const dynStarts: number[] = [];
  for (const m of text.matchAll(/\bclass=\{/g)) dynStarts.push(m.index + m[0].length);
  for (const start of dynStarts) {
    let depth = 1;
    let i = start;
    while (i < text.length && depth > 0) {
      if (text[i] === "{") depth++;
      else if (text[i] === "}") depth--;
      i++;
    }
    const expr = text.slice(start, i - 1);
    for (const lit of literalsIn(expr)) addTokensFrom(lit);

    // Trace bare identifiers referenced in the expression to a same-file
    // `const <ident> = ...;` declaration one level deep.
    const seen = new Set<string>();
    for (const m of expr.matchAll(/[A-Za-z_$][A-Za-z0-9_$]*/g)) {
      const ident = m[0];
      if (seen.has(ident)) continue;
      seen.add(ident);
      const declMatch = text.match(new RegExp(`const\\s+${ident}\\s*=([^;]*);`));
      if (!declMatch) continue;
      for (const lit of literalsIn(declMatch[1] ?? "")) addTokensFrom(lit);
    }
  }

  return out;
}
