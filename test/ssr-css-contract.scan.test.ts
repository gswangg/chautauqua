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
// Both scans ENUMERATE their inputs via readdirSync (mirroring DEC-937/
// DEC-808) rather than a hand-listed manifest, so a new SSR stylesheet or
// page is checked automatically. This test does NOT add the reverse check
// (a CSS rule no markup uses) -- see DEC-970's note on work in flight.
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

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

/** Strips /* ... *\/ block comments so a decision note quoting CSS-shaped
 * text is never mistaken for a real rule. */
function stripComments(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, "");
}

/**
 * Extracts the exported `..._CSS` template-literal CSS text from an SSR
 * stylesheet module, and resolves any `${IDENT[N]}` interpolation (e.g.
 * public.css.ts's `${ACCENT_BOUND_CLASSES[1]}`, DEC-838) against an
 * `IDENT`-named array-literal constant declared in the same file, so an
 * interpolated selector's class name is visible to the scan just like a
 * literal one.
 */
function extractCssText(filePath: string): string {
  const raw = readFileSync(filePath, "utf-8");
  const cssMatch = raw.match(/export const \w+_CSS = `([\s\S]*?)\n`;/);
  if (!cssMatch) throw new Error(`no exported *_CSS template literal found in ${filePath}`);
  const css = cssMatch[1] ?? "";
  return css.replace(/\$\{(\w+)\[(\d+)\]\}/g, (full, ident: string, idxStr: string) => {
    const arrMatch = raw.match(new RegExp(`const\\s+${ident}\\s*=\\s*\\[([^\\]]*)\\]`));
    if (!arrMatch) return full;
    const items = [...(arrMatch[1] ?? "").matchAll(/"([^"]*)"|'([^']*)'/g)].map((m) => m[1] ?? m[2] ?? "");
    return items[Number(idxStr)] ?? full;
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
      "chq-pub-picks-only-input",
      "agenda.tsx: the checkbox is already fully styled by theme.ts's global " +
        "input[type=checkbox] rule (accent-color/size/margin); the class is a behavioral/selector hook only " +
        "(the actual JS hook uses the sibling #chq-picks-only id, not this class).",
    ],
    [
      "chq-pub-agenda-list-wrap",
      "agenda.tsx: the <section> exists to host the day's aria-label; every visual treatment lives on its " +
        "children (.chq-pub-agenda-list, .chq-pub-agenda-list-item, etc.), not the wrapper itself.",
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
