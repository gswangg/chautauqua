// DEC-919 (wave-74 amendment): the hidden-submit exemption is licensed by
// the paired select's `onchange="this.form.submit()"` auto-submit -- a form
// whose ONLY `type="submit"` control is `.chq-visually-hidden` must ALSO
// carry that auto-submit somewhere in the same form, or its narrowing
// control is unreachable by a pointer (exactly the defect this wave found
// and fixed in src/routes/public/speakers.tsx's TrackFacetSelect). This scan
// walks every .tsx under src/routes/public/, finds each `<form ... method=
// "get"` block, and enforces the pairing on every one whose visible submit
// is missing.
//
// Copied conventions from test/serial-write-straightline.scan.test.ts (file
// header): walk-all-of-a-directory, brace/tag-matched block extraction, and
// a synthetic positive/negative control proving the detector's logic
// independent of any real file's current shape.

import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = join(__dirname, "..");
const PUBLIC_ROOT = join(ROOT, "src", "routes", "public");
const SKIP_DIRS = new Set(["node_modules", "dist", ".wrangler", "build", ".git"]);

function walkTsx(dir: string, out: string[]): void {
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      walkTsx(full, out);
    } else if (stat.isFile() && entry.endsWith(".tsx")) {
      out.push(full);
    }
  }
}

/** Finds every `<form ... method="get"` opening tag and returns the
 * substring from that tag through its matching `</form>` close, using a
 * simple depth counter over `<form` / `</form>` tokens (JSX never nests a
 * <form> inside another <form>, so this is sufficient -- no need for a full
 * tag-matcher). */
function findGetFormBlocks(src: string): { start: number; block: string }[] {
  const out: { start: number; block: string }[] = [];
  const openRe = /<form\b[^>]*method="get"[^>]*>/g;
  let m: RegExpExecArray | null;
  while ((m = openRe.exec(src))) {
    const start = m.index;
    // Walk forward counting nested <form ...> opens vs </form> closes.
    const tagRe = /<form\b[^>]*>|<\/form>/g;
    tagRe.lastIndex = start;
    let depth = 0;
    let end = -1;
    let t: RegExpExecArray | null;
    while ((t = tagRe.exec(src))) {
      if (t[0] === "</form>") {
        depth--;
        if (depth === 0) {
          end = t.index + t[0].length;
          break;
        }
      } else {
        depth++;
      }
    }
    if (end === -1) continue; // unterminated -- skip, not this scan's concern
    out.push({ start, block: src.slice(start, end) });
  }
  return out;
}

interface FormCheck {
  hasVisibleSubmit: boolean;
  hiddenSubmitOnly: boolean;
  hasAutoSubmit: boolean;
}

/** A form's ONLY `type="submit"` control being `.chq-visually-hidden`
 * (matched with the class in either attribute order, same as the button
 * markup in filters.tsx/agenda-controls.tsx/speakers.tsx) is the trigger
 * condition; `onchange="this.form.submit()"` anywhere in the block is the
 * required pairing. */
function checkForm(block: string): FormCheck {
  const submitButtons = [...block.matchAll(/<button\b([^>]*)type="submit"([^>]*)>|<button\b([^>]*)>[^<]*<\/button>/g)];
  // Simpler, robust approach: find every <button ... type="submit" ...> tag
  // (attribute order for `class`/`type` may vary), and classify each as
  // hidden (carries chq-visually-hidden) or visible.
  const buttonTagRe = /<button\b[^>]*>/g;
  const submitTags = [...block.matchAll(buttonTagRe)].map((mm) => mm[0]).filter((tag) => /type="submit"/.test(tag));
  const hiddenSubmits = submitTags.filter((tag) => /class="[^"]*\bchq-visually-hidden\b[^"]*"/.test(tag));
  const visibleSubmits = submitTags.filter((tag) => !/class="[^"]*\bchq-visually-hidden\b[^"]*"/.test(tag));
  void submitButtons;
  const hasVisibleSubmit = visibleSubmits.length > 0;
  const hiddenSubmitOnly = submitTags.length > 0 && hiddenSubmits.length === submitTags.length;
  const hasAutoSubmit = /onchange="this\.form\.submit\(\)"/.test(block);
  return { hasVisibleSubmit, hiddenSubmitOnly, hasAutoSubmit };
}

interface Offender {
  file: string;
  line: number;
}

function scanPublicGetForms(): { offenders: Offender[]; totalForms: number } {
  const files: string[] = [];
  walkTsx(PUBLIC_ROOT, files);
  const offenders: Offender[] = [];
  let totalForms = 0;

  for (const file of files) {
    const src = readFileSync(file, "utf8");
    const relFile = relative(ROOT, file).split("\\").join("/");
    const blocks = findGetFormBlocks(src);
    for (const { start, block } of blocks) {
      totalForms++;
      const check = checkForm(block);
      // Only a form whose only submit control is visually-hidden (or has no
      // submit control at all -- equally unreachable) is in scope for the
      // pairing rule; a form with a real visible submit satisfies DEC-919
      // on its own.
      if (check.hasVisibleSubmit) continue;
      if (!check.hasAutoSubmit) {
        const line = src.slice(0, start).split("\n").length;
        offenders.push({ file: relFile, line });
      }
    }
  }
  return { offenders, totalForms };
}

describe("public GET-form submit pairing (DEC-919 wave-74 amendment)", () => {
  it("walks a non-vacuous set of public .tsx files and finds at least one GET form", () => {
    const files: string[] = [];
    walkTsx(PUBLIC_ROOT, files);
    expect(files.length).toBeGreaterThan(3);
    const { totalForms } = scanPublicGetForms();
    expect(totalForms).toBeGreaterThan(0);
  });

  it("every GET form whose only submit is visually-hidden also carries an auto-submitting select (no dead controls)", () => {
    const { offenders } = scanPublicGetForms();
    expect(
      offenders,
      offenders
        .map(
          (o) =>
            `${o.file}:${o.line} -- a GET form's only submit control is .chq-visually-hidden with no ` +
            `onchange="this.form.submit()" anywhere in the form: DEC-919's hidden-submit exemption is licensed by ` +
            `the select's change event, and a form with neither an auto-submitting select nor a visible submit is ` +
            `unreachable by a pointer.`,
        )
        .join("\n"),
    ).toEqual([]);
  });

  describe("synthetic control", () => {
    const SYNTHETIC_PAIRED_FORM = `
<form class="chq-pub-select-form" method="get" action={basePath}>
  <label class="chq-visually-hidden" for="x">Track</label>
  <select class="chq-pub-select" id="x" name="trackId" onchange="this.form.submit()">
    <option value="">All tracks</option>
  </select>
  <button class="chq-visually-hidden" type="submit">Apply</button>
</form>
`;
    const SYNTHETIC_UNPAIRED_FORM = `
<form class="chq-pub-select-form" method="get" action={basePath}>
  <label class="chq-visually-hidden" for="x">Track</label>
  <select class="chq-pub-select" id="x" name="trackId">
    <option value="">All tracks</option>
  </select>
  <button class="chq-visually-hidden" type="submit">Filter</button>
</form>
`;
    const SYNTHETIC_VISIBLE_SUBMIT_FORM = `
<form class="chq-pub-searchform" method="get" action={basePath} role="search">
  <input type="search" name="q" />
  <button class="chq-pub-search-submit" type="submit" aria-label="Search">go</button>
</form>
`;

    function offendersOf(src: string): number {
      const blocks = findGetFormBlocks(src);
      let n = 0;
      for (const { block } of blocks) {
        const check = checkForm(block);
        if (check.hasVisibleSubmit) continue;
        if (!check.hasAutoSubmit) n++;
      }
      return n;
    }

    it("does not flag a form pairing a hidden submit with an auto-submitting select", () => {
      expect(offendersOf(SYNTHETIC_PAIRED_FORM)).toBe(0);
    });

    it("flags a form with a hidden-only submit and no auto-submit as an offender (positive control)", () => {
      expect(offendersOf(SYNTHETIC_UNPAIRED_FORM)).toBe(1);
    });

    it("does not flag a form with a real visible submit button", () => {
      expect(offendersOf(SYNTHETIC_VISIBLE_SUBMIT_FORM)).toBe(0);
    });
  });
});
