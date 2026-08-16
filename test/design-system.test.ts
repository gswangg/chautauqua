import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ThemeStyles, THEME_CSS } from "../src/views/theme";

const REPO_ROOT = join(__dirname, "..");
const STYLES_CSS_PATH = join(REPO_ROOT, "app/src/styles.css");
const PAGES_DIR = join(REPO_ROOT, "app/src/pages");
const APP_SRC_DIR = join(REPO_ROOT, "app/src");

function listFilesWithExt(dir: string, ext: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      out.push(...listFilesWithExt(full, ext));
    } else if (entry.endsWith(ext) && !entry.includes(".test.")) {
      out.push(full);
    }
  }
  return out;
}

function extractClassNameTokens(source: string): Set<string> {
  const tokens = new Set<string>();
  const classNameRe = /className=(\{`[^`]*`\}|\{"[^"]*"\}|"[^"]*"|\{[^}]*\})/g;
  const tokenRe = /chq-[a-z0-9-]+/g;
  let cm: RegExpExecArray | null;
  while ((cm = classNameRe.exec(source))) {
    const chunk = cm[1];
    if (chunk === undefined) continue;
    let tm: RegExpExecArray | null;
    tokenRe.lastIndex = 0;
    while ((tm = tokenRe.exec(chunk))) {
      const token = tm[0];
      if (token.endsWith("-")) continue;
      tokens.add(token);
    }
  }
  return tokens;
}

function readTokenNames(css: string): Set<string> {
  const names = new Set<string>();
  const re = /--chq-[a-z0-9-]+(?=\s*:)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(css))) {
    names.add(m[0]);
  }
  return names;
}

function readTokenValues(css: string): Map<string, string> {
  const values = new Map<string, string>();
  const re = /(--chq-[a-z0-9-]+)\s*:\s*([^;]+);/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(css))) {
    if (m[1] === undefined || m[2] === undefined) continue;
    values.set(m[1], m[2].trim());
  }
  return values;
}

function listCssFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      out.push(...listCssFiles(full));
    } else if (entry.endsWith(".css")) {
      out.push(full);
    }
  }
  return out;
}

describe("design system token parity (DEC-367/372)", () => {
  const stylesCss = readFileSync(STYLES_CSS_PATH, "utf8");

  // DEC-989 Amendment (wave 37) is the one NAMED exception to DEC-372's set
  // equality: the table measure (1440) is an admin-SPA-only class -- nothing
  // server-rendered is table class -- so --chq-measure-table is declared in
  // app/src/styles.css only and deliberately NOT in THEME_CSS (a token
  // declared and consumed by nobody is a lie). test/ssr-public-measure.test.ts
  // asserts the other half: that THEME_CSS never re-declares it. Every other
  // name must still match exactly, so unintended drift still fails here.
  const SPA_ONLY_TOKENS = ["--chq-measure-table"];

  it("app/src/styles.css and THEME_CSS declare the identical --chq-* name set (except the DEC-989 wave-37 SPA-only measure)", () => {
    const stylesNames = readTokenNames(stylesCss);
    const themeNames = readTokenNames(THEME_CSS);
    const onlyInStyles = [...stylesNames]
      .filter((n) => !themeNames.has(n) && !SPA_ONLY_TOKENS.includes(n))
      .sort();
    const onlyInTheme = [...themeNames].filter((n) => !stylesNames.has(n)).sort();
    expect(onlyInStyles).toEqual([]);
    expect(onlyInTheme).toEqual([]);
    // The exception is exactly that: styles.css must still declare it.
    for (const token of SPA_ONLY_TOKENS) {
      expect(stylesNames.has(token), `${token} must still be declared in app/src/styles.css`).toBe(
        true,
      );
      expect(themeNames.has(token), `${token} must NOT be declared in THEME_CSS`).toBe(false);
    }
  });

  it("shared token values match between the two files, and match DEC-367", () => {
    const stylesValues = readTokenValues(stylesCss);
    const themeValues = readTokenValues(THEME_CSS);
    const expected: Record<string, string> = {
      "--chq-on-ink": "#f4f1e8",
      "--chq-on-ink-muted": "#b5afa2",
      "--chq-on-ink-hairline": "#3a3d32",
      "--chq-r-ctl": "4px",
      "--chq-r-ctl-phone": "6px",
      "--chq-r-card": "5px",
      "--chq-r-pill": "99px",
    };
    for (const [name, expectedValue] of Object.entries(expected)) {
      expect(stylesValues.get(name)?.toLowerCase()).toBe(expectedValue);
      expect(themeValues.get(name)?.toLowerCase()).toBe(expectedValue);
    }
    // Every colour hex shared between the two files must agree
    // (case-insensitive: THEME_CSS uses uppercase hex, styles.css uses
    // lowercase).
    for (const [name, value] of stylesValues) {
      if (/^#[0-9a-f]{6}$/i.test(value) && themeValues.has(name)) {
        expect(themeValues.get(name)?.toLowerCase()).toBe(value.toLowerCase());
      }
    }
  });

  it("no legacy --chq-ink-secondary token remains anywhere", () => {
    expect(stylesCss).not.toMatch(/--chq-ink-secondary/);
    expect(THEME_CSS).not.toMatch(/--chq-ink-secondary/);
  });
});

// DEC-372 originally ruled the pill on-state ink-filled; superseded by the
// user-filed v12 fix per frame 09--07 and DEC-730's control vocabulary
// (filled OLIVE = on/confirmed; ink is reserved for outlined caps states),
// which repainted .chq-pill.is-active to the brand fill.
describe(".chq-pill active state is olive-filled (DEC-730 vocabulary, frame 09--07 v12; supersedes DEC-372's ink fill)", () => {
  it("styles.css .chq-pill.is-active/.active use the brand fill", () => {
    const css = readFileSync(STYLES_CSS_PATH, "utf8");
    const m = css.match(/\.chq-pill\.is-active,\s*\n\.chq-pill\.active\s*\{([^}]*)\}/);
    expect(m).not.toBeNull();
    const body = m![1];
    expect(body).toMatch(/background:\s*var\(--chq-brand\)/);
    expect(body).toMatch(/color:\s*var\(--chq-on-brand\)/);
    expect(body).toMatch(/border-color:\s*var\(--chq-brand\)/);
  });
});

describe("DEC-374 THEME_CSS is inlined via dangerouslySetInnerHTML", () => {
  it("rendered <style> contains the literal 'Familjen Grotesk' string, unescaped", () => {
    const rendered = String(ThemeStyles());
    expect(rendered).toContain("<style");
    const openIdx = rendered.indexOf(">") + 1;
    const closeIdx = rendered.indexOf("</style>");
    const body = rendered.slice(openIdx, closeIdx);
    expect(body).toContain("'Familjen Grotesk'");
    expect(body).not.toContain("&#39;");
    expect(body).not.toContain("&quot;");
    expect(body).not.toContain("&gt;");
  });
});

describe("font sizes stay within the 10px floor (DEC-367)", () => {
  it("every font-size: Npx in styles.css and page css is >= 10", () => {
    const files = [STYLES_CSS_PATH, ...listCssFiles(PAGES_DIR)];
    const offenders: string[] = [];
    for (const file of files) {
      const css = readFileSync(file, "utf8");
      const re = /font-size:\s*(\d+(?:\.\d+)?)px/g;
      let m: RegExpExecArray | null;
      while ((m = re.exec(css))) {
        const n = Number(m[1]);
        if (n < 10) {
          offenders.push(`${file}: ${m[0]}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});

describe("nav active-state uses inset box-shadow, never border-bottom (DEC-367)", () => {
  it("styles.css .chq-nav-link.is-active uses box-shadow: inset 0 -2px 0", () => {
    const css = readFileSync(STYLES_CSS_PATH, "utf8");
    const m = css.match(/\.chq-nav-link\.is-active\s*\{([^}]*)\}/);
    expect(m).not.toBeNull();
    expect(m![1]).toMatch(/box-shadow:\s*inset 0 -2px 0/);
    expect(m![1]).not.toMatch(/border-bottom/);
  });

  it("no rule anywhere targeting .chq-nav-link.is-active uses border-bottom", () => {
    const files = [STYLES_CSS_PATH, ...listCssFiles(PAGES_DIR)];
    for (const file of files) {
      const css = readFileSync(file, "utf8");
      const re = /\.chq-nav-link\.is-active[^{]*\{([^}]*)\}/g;
      let m: RegExpExecArray | null;
      while ((m = re.exec(css))) {
        expect(m[1]).not.toMatch(/border-bottom/);
      }
    }
  });
});

describe("page stylesheets never redefine a DEC-368 shared class name (DEC-368)", () => {
  const SHARED_CLASSES = [
    "chq-steps",
    "chq-step",
    "chq-bar",
    "chq-bar-fill",
    "chq-dot",
    "chq-bulkbar",
    "chq-rail",
    "chq-rail-link",
    "chq-panel",
    "chq-kv",
    "chq-pager",
    "chq-scrim",
  ];

  it("no selector under app/src/pages/**/*.css has a shared class as its only class", () => {
    const offenders: string[] = [];
    for (const file of listCssFiles(PAGES_DIR)) {
      const css = readFileSync(file, "utf8");
      // Strip comments before scanning selectors.
      const stripped = css.replace(/\/\*[\s\S]*?\*\//g, "");
      const ruleRe = /([^{}]+)\{/g;
      let m: RegExpExecArray | null;
      while ((m = ruleRe.exec(stripped))) {
        const selectorList = m[1];
        if (selectorList === undefined) continue;
        for (const rawSelector of selectorList.split(",")) {
          const selector = rawSelector.trim();
          if (!selector) continue;
          for (const shared of SHARED_CLASSES) {
            // Matches selectors like ".chq-kv" or ".chq-kv:hover" or
            // ".chq-kv.is-x" but not ".chq-kv-foo" (a different class) and
            // not ".chq-kv .child" (a descendant selector, which is fine).
            const soleClassRe = new RegExp(`^\\.${shared}(?:[.:][a-zA-Z0-9_-]+)*$`);
            if (soleClassRe.test(selector)) {
              offenders.push(`${file}: "${selector}"`);
            }
          }
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});

describe("DEC-379: styles.css closes the SPA's chq-* class vocabulary", () => {
  function allDefinedCssClasses(): Set<string> {
    const defined = new Set<string>();
    const defRe = /\.(chq-[a-z0-9-]+)/g;
    for (const file of listFilesWithExt(APP_SRC_DIR, ".css")) {
      const css = readFileSync(file, "utf8");
      let m: RegExpExecArray | null;
      while ((m = defRe.exec(css))) {
        const name = m[1];
        if (name !== undefined) defined.add(name);
      }
    }
    return defined;
  }

  it("every chq-* class referenced in a .tsx className has a rule somewhere under app/src/**/*.css", () => {
    const defined = allDefinedCssClasses();
    const missing: string[] = [];
    for (const file of listFilesWithExt(APP_SRC_DIR, ".tsx")) {
      const source = readFileSync(file, "utf8");
      for (const token of extractClassNameTokens(source)) {
        if (!defined.has(token)) {
          missing.push(`${file}: ${token}`);
        }
      }
    }
    expect(missing).toEqual([]);
  });

  it("--chq-ink-strong is defined in both token files (DEC-379)", () => {
    const stylesCss = readFileSync(STYLES_CSS_PATH, "utf8");
    expect(stylesCss).toMatch(/--chq-ink-strong\s*:\s*#2e2a24/i);
    expect(THEME_CSS).toMatch(/--chq-ink-strong\s*:\s*#2e2a24/i);
  });
});
