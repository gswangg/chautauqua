// A page whose phone component draws its own <h1> must not also draw the
// desktop one (meta-fidelity probe C, final pass).
//
// The agenda page rendered its desktop head -- `<h1 class="chq-page-title">
// Agenda</h1>` plus the summary and the action row -- OUTSIDE the
// `isPhone ? <PhoneAgenda/> : <desktop/>` ternary, so at 390 it painted
// above PhoneAgenda's own head band and the page announced itself twice,
// once in the app's vocabulary and once in the frame's. Two <h1> elements
// with the same accessible name also both reach the phone accessibility
// tree, which Comms.tsx:297-300 already calls out in prose as the thing not
// to do.
//
// This is the third leak of one shape found on one page (the day-tab strip
// and the desktop placing bar were the other two), so the shape is worth a
// structural pin rather than another pair of eyes at 390.
//
// The general, mechanical claim -- no page-specific knowledge, no line
// pins, both sides DERIVED from source (DEC-808):
//
//   If a component renders `<h1 className="chq-phone-…">`, it is a
//   phone-only head band. Every OTHER component that imports it is a page
//   that draws two heads, so each <h1> class THAT page renders must be
//   hidden at <=700px by one of the stylesheets that page imports.
//
// Both halves are derived: the phone-h1 components by scanning every
// non-test .tsx under app/src, their parents by scanning those same files'
// import specifiers, and the sheets by reading the parent's own
// `import './….css'` lines. A vacuous-population tripwire fails the scan if
// the derivation stops finding pairs.
//
// LIMIT, stated rather than papered over: only a CLASSED `<h1>` can be
// targeted by a stylesheet, so a bare `<h1>Agenda</h1>` is skipped. On the
// page this scan was written for, the bare ones (Agenda.tsx:283/:292) sit
// in early-return loading/error branches that never mount the phone
// component at all, so they are not duplicates -- but a future bare <h1>
// alongside a phone head band would slip past. The narrower claim is the
// one that can be checked mechanically; a broader one would need to render.
//
// This scan does NOT claim to catch every desktop/phone duplication. The
// same page also drew its summary line and its Auto-schedule button twice,
// and neither is mechanically derivable from source -- "1 unplaced · 2
// conflicts · 93% placed" and "1 unplaced · 2 clash" are the same fact in
// two vocabularies, which is a reading, not a parse. Those are fixed in
// app/src/pages/agenda/agenda.css's terminal phone block with their reasons
// written beside them; pretending a scan proves them would be worse than
// the honest gap.
import { readFileSync, readdirSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const REPO_ROOT = join(__dirname, "..");
const APP_SRC = join(REPO_ROOT, "app/src");

/** Tripwire: the derivation must keep finding phone-head-band pairs. Raise
 * as more pages grow one; never lower it to silence an empty scan. */
const MIN_PAIRS = 1;

function stripCssComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, "");
}

function tsxFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...tsxFiles(full));
    else if (entry.name.endsWith(".tsx") && !entry.name.includes(".test.")) out.push(full);
  }
  return out.sort();
}

/** Class tokens on every `<h1 className="…">` in a .tsx source. */
function h1Classes(source: string): string[] {
  const out: string[] = [];
  const re = /<h1[^>]*\bclassName=(?:"([^"]*)"|\{`([^`]*)`\})/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(source)) !== null) {
    for (const token of (m[1] ?? m[2] ?? "").split(/\s+/)) {
      // template-literal class lists interpolate: `${x}` is not a token
      if (/^chq-[a-z0-9-]+$/.test(token)) out.push(token);
    }
  }
  return [...new Set(out)];
}

/** Relative-import specifiers resolved to absolute paths (no extension). */
function importedModules(file: string, source: string): string[] {
  const out: string[] = [];
  const re = /\bfrom\s+'(\.[^']*)'/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(source)) !== null) out.push(resolve(dirname(file), m[1]!));
  return out;
}

/** Absolute paths of the `import './x.css'` sheets a component pulls in. */
function importedSheets(file: string, source: string): string[] {
  const out: string[] = [];
  const re = /\bimport\s+'(\.[^']*\.css)'/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(source)) !== null) out.push(resolve(dirname(file), m[1]!));
  return out;
}

/** Every class whose OWN box is hidden inside a `max-width: <=700px` block
 * -- credited only when the class is the selector's rightmost compound, so
 * `.chq-agenda-head .chq-page-title` hides the title, not the head. */
function hiddenAtPhoneWidth(css: string): Set<string> {
  const out = new Set<string>();
  const mediaRe = /@media[^{]*max-width:\s*(\d+)px[^{]*\{/g;
  let mm: RegExpExecArray | null;
  while ((mm = mediaRe.exec(css)) !== null) {
    if (Number(mm[1]) > 700) continue;
    const bodyStart = mm.index + mm[0].length;
    let depth = 1;
    let i = bodyStart;
    for (; i < css.length && depth > 0; i++) {
      if (css[i] === "{") depth++;
      else if (css[i] === "}") depth--;
    }
    const block = css.slice(bodyStart, i - 1);
    const ruleRe = /([^{}]+)\{([^{}]*)\}/g;
    let r: RegExpExecArray | null;
    while ((r = ruleRe.exec(block)) !== null) {
      if (!/display\s*:\s*none/.test(r[2] ?? "")) continue;
      for (const part of (r[1] ?? "").split(",")) {
        const subject = part.trim().split(/[\s>+~]+/).filter(Boolean).pop() ?? "";
        for (const cls of subject.match(/\.chq-[a-z0-9-]+/g) ?? []) out.add(cls.slice(1));
      }
    }
  }
  return out;
}

const SOURCES = new Map(tsxFiles(APP_SRC).map((f) => [f, readFileSync(f, "utf-8")]));

/** Components that ARE a phone head band: they render `<h1 class="chq-phone-…">`. */
const PHONE_HEAD_COMPONENTS = [...SOURCES].filter(([, src]) =>
  h1Classes(src).some((c) => c.startsWith("chq-phone-")),
);

/** {page, phoneComponent, desktopH1Classes, sheets} for every page that
 * imports one of them and draws an <h1> of its own. */
const PAIRS = PHONE_HEAD_COMPONENTS.flatMap(([phoneFile]) => {
  const stem = phoneFile.replace(/\.tsx$/, "");
  return [...SOURCES]
    .filter(([page, src]) => page !== phoneFile && importedModules(page, src).includes(stem))
    .map(([page, src]) => ({
      page,
      pageRel: page.slice(REPO_ROOT.length + 1),
      phoneRel: phoneFile.slice(REPO_ROOT.length + 1),
      desktopH1: h1Classes(src).filter((c) => !c.startsWith("chq-phone-")),
      sheets: importedSheets(page, src),
    }))
    .filter((pair) => pair.desktopH1.length > 0);
});

describe("phone head band never doubles the page title", () => {
  it("finds the phone-head-band pairs it scans (vacuous-population tripwire)", () => {
    expect(
      PAIRS.length,
      `no page was found importing a component that renders <h1 class="chq-phone-…"> ` +
        `(phone-head components found: ${PHONE_HEAD_COMPONENTS.map(([f]) => basename(f)).join(", ") || "none"})`,
    ).toBeGreaterThanOrEqual(MIN_PAIRS);
  });

  it("hides every desktop <h1> at <=700px on a page that mounts a phone head band", () => {
    const leaks: string[] = [];
    for (const pair of PAIRS) {
      const hidden = new Set<string>();
      for (const sheet of pair.sheets) {
        for (const cls of hiddenAtPhoneWidth(stripCssComments(readFileSync(sheet, "utf-8")))) hidden.add(cls);
      }
      for (const cls of pair.desktopH1) {
        if (!hidden.has(cls)) {
          leaks.push(`${pair.pageRel}: .${cls} still paints at 390 beside ${pair.phoneRel}'s own <h1>`);
        }
      }
    }
    expect(
      leaks,
      `a desktop page title leaks past a phone head band, so the page announces itself twice ` +
        `and puts two <h1> elements in the phone accessibility tree:\n  ${leaks.join("\n  ")}`,
    ).toEqual([]);
  });
});
