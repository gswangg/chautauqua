// SSR page-clamp scan (DEC-989 amendment, wave 37). The SPA side's DEC-744/
// DEC-808 already deleted hand-copied px page clamps in favour of a single
// shared `.chq-measure`/`--chq-measure` reading width -- this test carries
// that same rule to the server-rendered surfaces (every `src/**/*.css.ts`
// module plus src/views/theme.ts). A page-level clamp of 800px or wider is
// a hand-copy of the reading measure unless it's a named exception: as of
// wave 48 the only one is bare-page.css.ts's `.chq-bare-page` (DEC-945
// wave-48 amendment), the 820px bare reading shell that IS the reading
// measure rather than a copy of it. auth.css.ts's `.chq-auth-card` USED to
// sit here on DEC-945's wave-1 box math (820/888 as a card BOX); the wave-25
// amendment brought it down to 460 and the wave-48 amendment DELETED
// `.chq-auth-card-narrow` outright, so both rows are gone, not relaxed.
// home.css.ts's `.chq-home-shell`
// USED to hold a standing exception here (its own 900px frame width); the
// DEC-582 wave-48 amendment strips that clamp entirely -- "chrome is always
// full bleed" -- so the exception is gone, not relaxed (same shape as the
// cfp.css.ts/portal.css.ts rows below).
//
// Every input is ENUMERATED via readdirSync (DEC-808/DEC-937 precedent),
// never a hand-listed manifest, so a new SSR stylesheet is scanned
// automatically.
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
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
 * src/views/theme.ts (the shared THEME_CSS token block). */
const CSS_TS_FILES = allFiles(SRC, ".css.ts");
const THEME_FILE = join(SRC, "views", "theme.ts");
const SCAN_FILES = [...CSS_TS_FILES, THEME_FILE].sort();

const PORTAL_CSS_FILE = join(SRC, "routes", "portal", "portal.css.ts");
const CFP_CSS_FILE = join(SRC, "routes", "public", "cfp.css.ts");
const HOME_CSS_FILE = join(SRC, "routes", "public", "home.css.ts");
const AUTH_CSS_FILE = join(SRC, "routes", "auth.css.ts");
const BARE_PAGE_CSS_FILE = join(SRC, "views", "bare-page.css.ts");
const PORTAL_SHARED_FILE = join(SRC, "routes", "portal", "shared.tsx");

/** Strips /* ... *\/ block comments so a decision note quoting CSS-shaped
 * text is never mistaken for a real rule. */
function stripComments(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, "");
}

/**
 * Extracts the exported `..._CSS` template-literal CSS text from an SSR
 * stylesheet module (mirrors ssr-css-contract.scan.test.ts). theme.ts's
 * THEME_CSS is extracted the same way since it's exported the same shape.
 */
function extractCssText(filePath: string): string {
  const raw = readFileSync(filePath, "utf-8");
  // Matches up to the first `` `; `` after the export (not requiring a
  // preceding newline): public.css.ts's own literal (wave-68 contention
  // decomposition) composes its fragments via bare `${CHROME_CSS}` etc.
  // interpolation on one line, with no source-level newline before the
  // closing backtick. Those fragments (src/routes/public/css/*.css.ts) are
  // each independently enumerated and scanned in SCAN_FILES below, so
  // public.css.ts's own (unresolved-placeholder) text contributing nothing
  // real here doesn't create a blind spot.
  const cssMatch = raw.match(/export const \w+_CSS = `([\s\S]*?)`;/);
  if (!cssMatch) throw new Error(`no exported *_CSS template literal found in ${filePath}`);
  return cssMatch[1] ?? "";
}

/**
 * Finds every `max-width: <N>px` DECLARATION (never an @media prelude) in
 * the given CSS/TS source text, paired with the nearest preceding selector
 * it belongs to. `@media (max-width: 900px) { ... }` preludes are stripped
 * first so they're never misread as page clamps.
 */
function findMaxWidthDeclarations(text: string): Array<{ selector: string; px: number }> {
  const noComments = stripComments(text);
  // Strip @media (...) preludes -- keep the body, drop the parenthesized
  // condition itself so a `max-width: 900px` inside the parens is never
  // read as a declaration.
  const noAtRulePreludes = noComments.replace(/@media\s*\([^)]*\)\s*\{/g, "{");

  const out: Array<{ selector: string; px: number }> = [];
  // A declaration is `max-width: <N>px` appearing after a `{` (i.e. inside
  // a rule body). We find each rule block `selector { body }` and scan its
  // body for the declaration -- this keeps selector attribution simple
  // without a full CSS parser.
  const ruleRe = /([^{}]+)\{([^{}]*)\}/g;
  let m: RegExpExecArray | null;
  while ((m = ruleRe.exec(noAtRulePreludes)) !== null) {
    const selector = (m[1] ?? "").trim().replace(/\s+/g, " ");
    const body = m[2] ?? "";
    const declRe = /max-width\s*:\s*(\d+)px/g;
    let dm: RegExpExecArray | null;
    while ((dm = declRe.exec(body)) !== null) {
      out.push({ selector, px: Number(dm[1]) });
    }
  }
  return out;
}

/**
 * Named, individually-justified exceptions to the >=800px page-clamp rule
 * -- never an open allowlist. Each key is `<relative-file-path>::<selector>`
 * and each value is the stated reason a page-level clamp of 800px+ is
 * legitimate there rather than a hand-copy of the reading measure.
 */
const NAMED_EXCEPTIONS: ReadonlyMap<string, string> = new Map([
  // routes/public/home.css.ts::.chq-home-shell used to sit here (900px, the
  // home hub's own frame width). DEC-582's wave-48 amendment strips that
  // clamp entirely -- chrome is always full bleed -- so it is GONE, not
  // relaxed. Asserted below (mirrors the .chq-auth-card precedent).
  //
  // The two .chq-auth-card rows that used to sit here (820px and 888px, on
  // DEC-945's wave-1 box-math) are GONE, not relaxed: DEC-945's wave-25
  // amendment rebuilds the card to V8 frame 11-account--00 at 460px (520px
  // narrow), so those selectors no longer clamp at 800px+ and an exception
  // for them would be a stale row. Asserted below.
  [
    "views/bare-page.css.ts::.chq-bare-page",
    "DEC-945 (wave-48 amendment): the bare reading-page shell IS the reading measure (820px, no card chrome) -- not a hand-copy of it",
  ],
]);

describe("SSR page-clamp scan (DEC-989 amendment, wave 37)", () => {
  it("found more than one SSR stylesheet module to scan", () => {
    expect(SCAN_FILES.length).toBeGreaterThan(5);
  });

  it("every max-width >= 800px declaration is the one named exception", () => {
    const offenders: string[] = [];
    for (const filePath of SCAN_FILES) {
      const relPath = filePath.slice(SRC.length + 1);
      const text = extractCssText(filePath);
      for (const { selector, px } of findMaxWidthDeclarations(text)) {
        if (px < 800) continue;
        const key = `${relPath}::${selector}`;
        if (NAMED_EXCEPTIONS.has(key)) continue;
        offenders.push(`${key} (${px}px)`);
      }
    }
    expect(
      offenders,
      `page clamps >= 800px with no named exception:\n${offenders.join("\n")}`,
    ).toEqual([]);
  });

  // Merge note (wave 48): two rulings land here at once. DEC-582's wave-48
  // amendment removes the home-hub exception OUTRIGHT (chrome is full
  // bleed, so .chq-home-shell has no clamp left to except), and DEC-945's
  // wave-48 amendment adds exactly one new entry -- .chq-bare-page, the
  // 820px reading shell, which IS the reading measure rather than a
  // hand-copy of it. So the map holds exactly one row, not zero and not two.
  it("NAMED_EXCEPTIONS holds exactly the bare-page entry, and its selector still exists", () => {
    expect([...NAMED_EXCEPTIONS.keys()]).toEqual([
      "views/bare-page.css.ts::.chq-bare-page",
    ]);

    const bareCss = extractCssText(BARE_PAGE_CSS_FILE);
    const bareDeclarations = findMaxWidthDeclarations(bareCss);
    const bareDecl = bareDeclarations.find((d) => d.selector === ".chq-bare-page");
    expect(bareDecl, ".chq-bare-page must still declare a max-width in bare-page.css.ts").toBeDefined();
    expect(bareDecl?.px).toBe(820);
  });

  // DEC-582 (wave-48 amendment): the home hub is full bleed now -- no
  // standing max-width exception for .chq-home-shell (or any other selector
  // in home.css.ts) at 800px or wider.
  it("home.css.ts no longer clamps .chq-home-shell (or anything else) to 800px+", () => {
    const homeCss = extractCssText(HOME_CSS_FILE);
    const declarations = findMaxWidthDeclarations(homeCss);
    for (const { px } of declarations) {
      expect(px).toBeLessThan(800);
    }
    expect(declarations.find((d) => d.selector === ".chq-home-shell")).toBeUndefined();
  });

  // DEC-945 (wave-25 amendment): the auth card came DOWN under the clamp
  // rather than being granted a standing exception -- 460px. Kept here so a
  // future widening back over 800px fails this scan and not just the
  // geometry test. (wave-48 amendment: .chq-auth-card-narrow is deleted --
  // the non-credential dead-ends it once sized now use .chq-bare-page,
  // asserted above as its own named exception.)
  it("the auth card needs no exception: its clamp is well under 800px", () => {
    const authDeclarations = findMaxWidthDeclarations(extractCssText(AUTH_CSS_FILE));
    const cardDecl = authDeclarations.find((d) => d.selector === ".chq-auth-card");
    expect(cardDecl, ".chq-auth-card must still declare a max-width in auth.css.ts").toBeDefined();
    expect(cardDecl?.px).toBe(460);
    expect(authDeclarations.some((d) => d.selector.includes("chq-auth-card-narrow"))).toBe(false);
  });

  it("portal/shared.tsx's <main> carries chq-measure", () => {
    const text = readFileSync(PORTAL_SHARED_FILE, "utf-8");
    expect(text).toMatch(/<main class="chq-measure">/);
  });

  it("portal.css.ts no longer clamps the page to 960px", () => {
    const text = extractCssText(PORTAL_CSS_FILE);
    for (const { px } of findMaxWidthDeclarations(text)) {
      expect(px).not.toBe(960);
    }
  });

  it("cfp.css.ts no longer clamps .chq-cfp-shell to 900px", () => {
    const text = extractCssText(CFP_CSS_FILE);
    for (const { selector, px } of findMaxWidthDeclarations(text)) {
      if (selector === ".chq-cfp-shell") {
        expect(px).not.toBe(900);
      }
    }
  });
});
