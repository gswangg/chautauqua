import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { DEC_383 } from "../src/decisions";

void DEC_383; // wave-100 amendment: strip comments before judging a stylesheet's hex literals

// DEC-577 (w1-i): the SPA never styled native form controls, so a judge's
// first sighting of Content was a browser-default file input beside a fully
// designed table. This guard enumerates every input[type=file] and <select>
// actually rendered by the SPA (never hand-listed -- a hand-listed manifest
// desyncs, per the field guide) and
// asserts each carries the shared shell class that app/src/styles.css's
// "Native control styling (DEC-577)" section styles, plus that that CSS
// section only references the frozen --chq-* tokens (no new hex literals).

const REPO_ROOT = join(__dirname, "..");
const APP_SRC = join(REPO_ROOT, "app/src");
const STYLES_PATH = join(APP_SRC, "styles.css");

function glob(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      out.push(...glob(full));
    } else if (entry.endsWith(".tsx") && !entry.endsWith(".test.tsx") && !entry.endsWith(".render.test.tsx")) {
      out.push(full);
    }
  }
  return out;
}

/** Blank out comments so a `<select>` mentioned in a docblock (e.g.
 * PipelineBoard.tsx's DEC-157 comment) is never mistaken for a live
 * control. Same approach as test/control-class-conformance.test.ts. */
function stripComments(src: string): string {
  let out = "";
  let i = 0;
  while (i < src.length) {
    const two = src.slice(i, i + 2);
    if (two === "//") {
      while (i < src.length && src[i] !== "\n") {
        out += " ";
        i++;
      }
      continue;
    }
    if (two === "/*") {
      out += "  ";
      i += 2;
      while (i < src.length && src.slice(i, i + 2) !== "*/") {
        out += src[i] === "\n" ? "\n" : " ";
        i++;
      }
      out += "  ";
      i += 2;
      continue;
    }
    const ch = src[i]!;
    if (ch === '"' || ch === "'" || ch === "`") {
      out += ch;
      i++;
      while (i < src.length && src[i] !== ch) {
        out += src[i];
        if (src[i] === "\\" && i + 1 < src.length) {
          i++;
          out += src[i];
        }
        i++;
      }
      if (i < src.length) {
        out += src[i];
        i++;
      }
      continue;
    }
    out += ch;
    i++;
  }
  return out;
}

/** Same top-level-`>` scanner as test/control-class-conformance.test.ts,
 * duplicated narrowly here because that file's helpers aren't exported. */
function findTagEnd(src: string, start: number): number {
  let i = start;
  let braceDepth = 0;
  while (i < src.length) {
    const ch = src[i]!;
    if (ch === "{") {
      braceDepth++;
    } else if (ch === "}") {
      braceDepth--;
    } else if (ch === '"' || ch === "'" || ch === "`") {
      const quote = ch;
      i++;
      while (i < src.length && src[i] !== quote) {
        if (src[i] === "\\") i++;
        i++;
      }
    } else if (ch === ">" && braceDepth === 0) {
      return i;
    }
    i++;
  }
  return -1;
}

interface FoundControl {
  file: string;
  line: number;
  kind: "file" | "date" | "select";
  attrs: string;
}

function scanFile(file: string): FoundControl[] {
  const src = stripComments(readFileSync(file, "utf8"));
  const found: FoundControl[] = [];
  const tagRe = /<(input|select)(?=[\s/>])/g;
  let m: RegExpExecArray | null;
  while ((m = tagRe.exec(src))) {
    const tagName = m[1]!;
    const tagStart = m.index;
    const tagEnd = findTagEnd(src, tagStart);
    if (tagEnd === -1) throw new Error(`${file}: unterminated <${tagName}> at offset ${tagStart}`);
    const attrs = src.slice(tagStart, tagEnd + 1);
    const lineNumber = src.slice(0, tagStart).split("\n").length;

    if (tagName === "select") {
      found.push({ file, line: lineNumber, kind: "select", attrs });
      continue;
    }
    if (/type\s*=\s*["']file["']/.test(attrs)) {
      found.push({ file, line: lineNumber, kind: "file", attrs });
    } else if (/type\s*=\s*["']date["']/.test(attrs)) {
      found.push({ file, line: lineNumber, kind: "date", attrs });
    }
  }
  return found;
}

const allControls = glob(APP_SRC).flatMap(scanFile);
// This task's scope (w1-i) is the Content deliverable upload zones and
// Settings resources file inputs; other surfaces with their own
// type="file" inputs (e.g. app/src/pages/contacts/*) belong to their own
// page's redesign lane and are deliberately left out of this guard.
const IN_SCOPE_FILE_DIRS = [join(APP_SRC, "pages/content"), join(APP_SRC, "pages/settings")];
const fileControls = allControls.filter(
  (c) => c.kind === "file" && IN_SCOPE_FILE_DIRS.some((dir) => c.file.startsWith(dir)),
);
// DEC-146 (wave-44 amendment) retired this guard's date arm: the SPA no
// longer renders ANY native input[type=date] -- date entry is the text
// DateField speaking "11 May 2028" (app/src/components/DateField.tsx),
// which defaults to the same chq-input class this arm used to assert. The
// population is now permanently empty, so asserting over it would be a
// vacuous guard; the replacement (zero native date inputs under app/src)
// is enforced by app/src/components/DateField.render.test.tsx's source
// scan. The scanner still classifies kind: "date" so that guard has a
// single shared definition of "native date input" to point at.
const selectControls = allControls.filter((c) => c.kind === "select");

/** Does this tag's className -- literal OR braced expression -- name `cls`?
 *
 * A control whose class list varies (e.g. UploadZone.tsx adds
 * chq-field-invalid when the file is rejected) writes
 * `className={cond ? 'chq-file a' : 'chq-file b'}`, which a
 * `className="..."`-only regex reads as "no chq-file at all". The shell
 * class is still on every branch, so the guard has to look inside the
 * expression rather than declare a false offender. Rule: every string
 * literal in the expression that names ANY chq- class must name `cls`
 * (fragments with no chq- class at all -- ' is-current', a stray key --
 * are not class-list alternatives and are ignored), and at least one must
 * exist. That keeps "the shell class is unconditional" enforced on every
 * branch instead of accepting one lucky branch. */
function carriesClass(attrs: string, cls: string): boolean {
  const has = new RegExp(`\\b${cls}\\b`);
  const m = /className\s*=\s*/.exec(attrs);
  if (!m) return false;
  let i = m.index + m[0].length;
  const opener = attrs[i];
  if (opener === '"' || opener === "'") {
    const end = attrs.indexOf(opener, i + 1);
    if (end === -1) throw new Error(`unterminated className literal in: ${attrs}`);
    return has.test(attrs.slice(i + 1, end));
  }
  if (opener !== "{") return false;
  // Walk the balanced brace expression, collecting its string literals.
  const literals: string[] = [];
  let depth = 0;
  for (; i < attrs.length; i++) {
    const ch = attrs[i]!;
    if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) break;
    } else if (ch === '"' || ch === "'" || ch === "`") {
      const quote = ch;
      let lit = "";
      i++;
      while (i < attrs.length && attrs[i] !== quote) {
        if (attrs[i] === "\\") i++;
        lit += attrs[i];
        i++;
      }
      literals.push(lit);
    }
  }
  const classLists = literals.filter((l) => l.includes("chq-"));
  return classLists.length > 0 && classLists.every((l) => has.test(l));
}

describe("input[type=file]/select share the DEC-577 classes", () => {
  it("enumerated at least one control of each kind (the guard isn't vacuous)", () => {
    expect(fileControls.length).toBeGreaterThan(0);
    expect(selectControls.length).toBeGreaterThan(0);
  });

  it("every in-scope (content/settings) input[type=file] carries chq-file", () => {
    const offenders = fileControls.filter((c) => !carriesClass(c.attrs, "chq-file"));
    expect(offenders.map((c) => `${c.file}:${c.line}`)).toEqual([]);
  });

  it("every select carries chq-select", () => {
    const offenders = selectControls.filter((c) => !carriesClass(c.attrs, "chq-select"));
    expect(offenders.map((c) => `${c.file}:${c.line}`)).toEqual([]);
  });
});

describe("app/src/styles.css DEC-577 controls section", () => {
  const css = readFileSync(STYLES_PATH, "utf8");
  const sectionStart = css.indexOf("Native control styling (DEC-577)");
  // Skip past the header comment block itself (ends at the blank line
  // following its closing "/* ---- */" divider) before looking for the
  // *next* section's divider.
  const headerBlockEnd = css.indexOf("*/\n\n", sectionStart) + 4;
  const sectionEnd = css.indexOf("/* ----", headerBlockEnd);
  const section = css.slice(sectionStart, sectionEnd === -1 ? undefined : sectionEnd);

  it("the section exists", () => {
    expect(sectionStart).toBeGreaterThan(-1);
  });

  it("styles .chq-file, its ::file-selector-button, input[type=date]'s calendar indicator, and .chq-select's appearance reset", () => {
    expect(section).toMatch(/\.chq-file\s*\{/);
    expect(section).toMatch(/::file-selector-button/);
    expect(section).toMatch(/input\[type=['"]date['"]\]::-webkit-calendar-picker-indicator/);
    expect(section).toMatch(/\.chq-select\s*\{[^}]*appearance:\s*none/);
  });

  it("draws the select caret from CSS gradients, not an SVG/image asset", () => {
    expect(section).toMatch(/background-image:\s*\n?\s*linear-gradient/);
    expect(section).not.toMatch(/url\(/);
  });

  it("references only existing --chq-* custom properties, never a new hex literal", () => {
    // DEC-383 (wave-100 amendment): the DEC-976 frame-citation campaign
    // quotes v12 frame hex literals (e.g. #4E5C31) inside COMMENTS in this
    // section, to document which frame a rule matches. A comment is not a
    // declaration -- strip comments before matching, same shape as
    // test/design-token-reader.scan.test.ts:21-23.
    const stripped = stripComments(section);
    const hexLiterals = stripped.match(/#[0-9a-fA-F]{3,8}\b/g) ?? [];
    expect(hexLiterals).toEqual([]);
    // and it does lean on the frozen token set (not styled with no color at all)
    expect(section).toMatch(/var\(--chq-surface-sunk\)/);
    expect(section).toMatch(/var\(--chq-border-strong\)/);
  });

  it("falsifiability control: a real hex literal in a real declaration is still reported (the comment strip cannot silently disable the rule)", () => {
    const fixture = `
      /* a v12 frame cites #4E5C31 here, just a comment */
      .chq-synthetic-offender {
        color: #4E5C31;
      }
    `;
    const hexLiterals = stripComments(fixture).match(/#[0-9a-fA-F]{3,8}\b/g) ?? [];
    expect(hexLiterals).toEqual(["#4E5C31"]);
  });
});
