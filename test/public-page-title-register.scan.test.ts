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
// their own copy of the same class with the same numbers.
//
// DEC-990 amendment (wave 5, sha ee8ceffa): the population above was a hand
// walk of src/routes/public/css/* plus three hand-named files. /docs is a
// NEW customer-facing surface whose sheet (src/routes/docs-site.css.ts)
// sits OUTSIDE that population and declares two more h1 registers (docs
// index 40px/30px phone, docs article 38px/28px phone) that the scan never
// saw. The ruling: the population is now DERIVED (every *.css.ts sheet
// under src/routes/** and src/views/**, minus operator chrome named by its
// own DEC), and the two hard-coded size Sets become a REGISTER TABLE where
// every row cites the frame file:line or DEC that rules its number. An
// h1-ish selector with no matching row fails by name; a table row no sheet
// declares fails as a stale row.

import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = join(__dirname, "..");
const PUBLIC_ROOT = join(ROOT, "src", "routes", "public");
const ROUTES_ROOT = join(ROOT, "src", "routes");
const VIEWS_ROOT = join(ROOT, "src", "views");

// Operator chrome is excluded by name, not by convention: DEC-382 rules that
// the three operator surfaces (/, /docs/api, /dev/mailbox) share exactly one
// module, TOOLS_CSS at src/routes/tools.css.ts -- chrome, not a designed,
// customer-facing screen. Nothing else under src/routes/** or src/views/**
// is operator chrome today; if that changes, its exclusion needs its own
// named DEC the same way this one does.
const TOOLS_CSS_FILE = join(ROUTES_ROOT, "tools.css.ts"); // DEC-382

function walkCssTsFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      out.push(...walkCssTsFiles(full));
    } else if (entry.endsWith(".css.ts")) {
      out.push(full);
    }
  }
  return out;
}

// Derived population: every *.css.ts sheet under src/routes/** and
// src/views/**, minus operator chrome (TOOLS_CSS, DEC-382). This
// necessarily includes the whole src/routes/public/css/* family (no need to
// hand-list it separately any more) plus every standalone customer-facing
// module -- including the new src/routes/docs-site.css.ts -- as new ones
// are added.
const TARGET_FILES = [...walkCssTsFiles(ROUTES_ROOT), ...walkCssTsFiles(VIEWS_ROOT)].filter((f) => f !== TOOLS_CSS_FILE);

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

// An h1-ish selector is either a literal element selector (bare "h1", or
// a descendant/compound selector ending in "h1", e.g. ".chq-docs-intro h1")
// or one of the small set of classes this product applies DIRECTLY to an
// <h1> element in markup without the selector text ever spelling "h1" --
// verified against every call site in src/routes/public/*.tsx (see the
// wave-49 amendment above). CSS text alone cannot derive the second case;
// it is named here, with its own citation, the same way TOOLS_CSS is named
// as the file-population exclusion.
const H1_ELEMENT_PATTERN = /(?:^|\s|>|\+|~)h1(?:[.:#[]|\s|$)/;
// .chq-pub-surface-title carries the page-title font-size itself and is
// applied straight to <h1> everywhere (agenda.tsx, speakers.tsx,
// submit-views.tsx, detail.tsx, sessions.tsx, programme.tsx). Its siblings
// .chq-prog-title (programme.tsx) and the CFP wrapper selectors
// (.chq-cfp-intro h1 / .chq-cfp-confirm h1 / .chq-cfp-closed h1,
// cfp.css.ts) are co-applied on the very same <h1 class="chq-pub-surface-
// title"> element but never declare their own font-size (they're layout-
// only: font-family/line-height/margin) -- so they carry no register of
// their own and need no table row. That's not a special case for this
// scan: any h1-ish selector with no font-size declaration is skipped in
// both directions below, the same way it always was.
const H1_STANDIN_CLASSES = new Set([".chq-pub-surface-title"]);

function isH1ishSelector(selector: string): boolean {
  return H1_ELEMENT_PATTERN.test(selector) || H1_STANDIN_CLASSES.has(selector);
}

function fontSizeOf(body: string): string | null {
  const m = /font-size\s*:\s*([^;]+);/.exec(body);
  return m && m[1] !== undefined ? m[1].trim() : null;
}

interface RegisterRow {
  role: string;
  // Matches the h1-ish selector this row governs. Exact-string match on the
  // trimmed selector text (not a fuzzy regex) so a stale row can be detected
  // by "no sheet declares this selector text any more".
  selectorPattern: string;
  desktop: string;
  phone: string;
  source: string;
}

// The register table: every customer-facing h1-ish selector this repo
// declares, with the desktop/phone font-size it is allowed to carry and the
// frame file:line or DEC that rules the number. A selector with no row
// fails by name (test 1); a row no sheet declares any more fails as stale
// (test 2).
const REGISTER_TABLE: RegisterRow[] = [
  {
    role: "page title",
    selectorPattern: ".chq-pub-surface-title",
    desktop: "36px",
    phone: "26px",
    source: "docs/design/README.md typography table (\"Page title (desktop)\"); DEC-990 wave-49 amendment",
  },
  {
    role: "overview headline",
    selectorPattern: ".chq-home-hero h1",
    desktop: "44px",
    phone: "29px",
    source:
      "docs/design/README.md typography table (\"Overview headline\"); docs/design/Chautauqua Home.dc.html:239 (Between-cycles/Fresh-deploy empty states); DEC-990 wave-49 amendment",
  },
  {
    role: "overview headline (event hub state)",
    selectorPattern: ".chq-home-body:has(.chq-home-row) .chq-home-hero h1",
    desktop: "44px",
    phone: "30px",
    source:
      "docs/design/Chautauqua Home.dc.html:124 (the hub's own H1 is the odd one out among the three home states, per home.css.ts:193-198's own note); DEC-990 wave-49 amendment (phone value pre-existing, untouched)",
  },
  {
    role: "page title (CFP intro)",
    selectorPattern: ".chq-cfp-intro h1",
    desktop: "36px",
    phone: "25px",
    source:
      "docs/design/README.md typography table (\"Page title (phone)\", 25-27px range); src/routes/public/cfp.css.ts:216 (pre-existing task-w49-h DEC-990 amendment; desktop size comes from the co-applied .chq-pub-surface-title class, so this selector carries no desktop declaration of its own)",
  },
  {
    role: "page title (CFP confirm)",
    selectorPattern: ".chq-cfp-confirm h1",
    desktop: "36px",
    phone: "27px",
    source:
      "docs/design/README.md typography table (\"Page title (phone)\", 25-27px range); src/routes/public/cfp.css.ts:220 (pre-existing task-w49-h DEC-990 amendment; desktop size comes from the co-applied .chq-pub-surface-title class, so this selector carries no desktop declaration of its own)",
  },
  {
    role: "docs index",
    selectorPattern: ".chq-docs-intro h1",
    desktop: "40px",
    phone: "30px",
    source: "docs/design/Chautauqua Docs.dc.html:134; DEC-990 wave-5 amendment (sha ee8ceffa)",
  },
  {
    role: "docs article",
    selectorPattern: ".chq-docs-article-head h1",
    desktop: "38px",
    phone: "28px",
    source: "docs/design/Chautauqua Docs.dc.html:60 (desktop), :175 (phone); DEC-990 wave-5 amendment (sha ee8ceffa)",
  },
];

function rowFor(selector: string): RegisterRow | undefined {
  return REGISTER_TABLE.find((r) => r.selectorPattern === selector);
}

describe("public page-title register scan (DEC-990 amendment)", () => {
  it("the derived customer-facing CSS population is non-trivial", () => {
    // Guards against a broken walk (e.g. a typo'd root, or a filter that
    // swallows everything) passing vacuously. The known population as of
    // this ruling is 14 files (12 under src/routes minus TOOLS_CSS, plus 2
    // under src/views); pin a floor well below that so new files don't
    // make this brittle, but a walk that returns zero or one file cannot
    // pass.
    expect(TARGET_FILES.length).toBeGreaterThanOrEqual(10);
    // The new docs surface must be part of the derived population -- this
    // is the concrete regression the wave-5 amendment exists to prevent.
    expect(TARGET_FILES).toContain(join(ROUTES_ROOT, "docs-site.css.ts"));
    // TOOLS_CSS must stay excluded (DEC-382): it is operator chrome, not a
    // customer-facing surface, and was never part of this register.
    expect(TARGET_FILES).not.toContain(TOOLS_CSS_FILE);
  });

  it("every h1-ish selector in the customer-facing CSS modules has a register-table row, and its declared size matches that row", () => {
    const badHits: string[] = [];
    for (const file of TARGET_FILES) {
      const src = readFileSync(file, "utf8");
      const rel = relative(ROOT, file).split("\\").join("/");
      const rules = extractRules(src);
      for (const rule of rules) {
        if (!isH1ishSelector(rule.selector)) continue;
        const fontSize = fontSizeOf(rule.body);
        if (fontSize === null) continue; // e.g. .chq-prog-title: layout-only, no register of its own
        const row = rowFor(rule.selector);
        if (!row) {
          badHits.push(`${rel}: "${rule.selector}" declares font-size: ${fontSize} but has no REGISTER_TABLE row -- add one citing the frame or DEC that rules its number`);
          continue;
        }
        const allowed = new Set([row.desktop, row.phone]);
        if (!allowed.has(fontSize)) {
          badHits.push(`${rel}: "${rule.selector}" declares font-size: ${fontSize} (row "${row.role}" allows only ${[...allowed].join(", ")}, source: ${row.source})`);
        }
      }
    }
    expect(badHits, badHits.join("\n") || "no offender found").toHaveLength(0);
  });

  it("every REGISTER_TABLE row is still declared by some customer-facing sheet (no stale rows)", () => {
    const declaredSelectors = new Set<string>();
    for (const file of TARGET_FILES) {
      const src = readFileSync(file, "utf8");
      for (const rule of extractRules(src)) {
        if (isH1ishSelector(rule.selector) && fontSizeOf(rule.body) !== null) {
          declaredSelectors.add(rule.selector);
        }
      }
    }
    const stale = REGISTER_TABLE.filter((r) => !declaredSelectors.has(r.selectorPattern));
    expect(stale.map((r) => `"${r.selectorPattern}" (role: ${r.role}, source: ${r.source})`), "stale REGISTER_TABLE rows -- no sheet declares these any more").toHaveLength(0);
  });

  it("negative control: a synthetic sheet with an off-register h1 is reported by the scan logic", () => {
    const synthetic = `
      .chq-docs-intro h1 { font-size: 41px; font-weight: 700; }
      .chq-totally-unregistered-title h1 { font-size: 19px; }
    `;
    const hits: string[] = [];
    for (const rule of extractRules(synthetic)) {
      if (!isH1ishSelector(rule.selector)) continue;
      const fontSize = fontSizeOf(rule.body);
      if (fontSize === null) continue;
      const row = rowFor(rule.selector);
      if (!row) {
        hits.push(`${rule.selector}: no row (font-size: ${fontSize})`);
        continue;
      }
      if (!new Set([row.desktop, row.phone]).has(fontSize)) {
        hits.push(`${rule.selector}: off-register (font-size: ${fontSize}, allowed: ${row.desktop}/${row.phone})`);
      }
    }
    // Both synthetic offenders must be caught: the off-register known
    // selector, and the entirely unregistered one.
    expect(hits.some((h) => h.startsWith(".chq-docs-intro h1") && h.includes("off-register"))).toBe(true);
    expect(hits.some((h) => h.startsWith(".chq-totally-unregistered-title h1") && h.includes("no row"))).toBe(true);
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

  it("docs registers (index 40/30, article 38/28) are declared exactly as the register table states", () => {
    const src = readFileSync(join(ROUTES_ROOT, "docs-site.css.ts"), "utf8");
    const rules = extractRules(src);
    const indexDesktop = rules.filter((r) => r.selector === ".chq-docs-intro h1" && r.body.includes("font-weight"));
    expect(indexDesktop.length).toBe(1);
    expect(indexDesktop[0]?.body).toContain("font-size: 40px");
    const articleDesktop = rules.filter((r) => r.selector === ".chq-docs-article-head h1" && r.body.includes("font-weight"));
    expect(articleDesktop.length).toBe(1);
    expect(articleDesktop[0]?.body).toContain("font-size: 38px");
    // Phone renditions live inside the file's @media (max-width: 700px)
    // block, where extractRules (media-unaware) captures the same selector
    // text again with just the one declaration.
    const phoneHits = rules.filter((r) => (r.selector === ".chq-docs-intro h1" || r.selector === ".chq-docs-article-head h1") && !r.body.includes("font-weight"));
    const phoneSizes = phoneHits.map((r) => fontSizeOf(r.body));
    expect(phoneSizes).toContain("30px");
    expect(phoneSizes).toContain("28px");
  });
});
