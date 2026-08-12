import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// DEC-406/DEC-410: every interactive control in the admin SPA carries a
// design-system shell class. DEC-406 fixed the vocabulary and split the
// three surfaces that still rendered browser defaults across three wave-8
// lanes; DEC-410 lands the repo-wide guard those lanes deliberately left
// out (a guard cut from a tree with known offenders would either land red
// or duplicate the lanes' work). This is that guard, plus whatever
// straggler it names.
//
// Scope is app/src ONLY. Server-rendered surfaces under src/ are
// deliberately out of scope: src/views/theme.ts:95-129 styles bare
// button/input/select/textarea at the ELEMENT level, so an unclassed
// server-rendered control is still on the design system, while an SPA
// control without a class is not (app/src/styles.css tiers everything by
// class, never by bare element selector). Do not "fix" that omission by
// widening this guard to src/ — it would be scanning a surface where the
// invariant it enforces does not hold.
//
// Fixed vocabulary (DEC-406): chq-btn plus a tier (chq-btn-primary |
// chq-btn-secondary | chq-btn-tertiary), chq-link-button, chq-input,
// chq-select, chq-textarea, chq-check, chq-checkbox-label, or a
// page-prefixed chq-<area>-* class. chq-pill (app/src/styles.css:514) is
// also accepted: DEC-406's own survey names contacts/settings/review/
// content/agenda/speakers/templates as "already conformant" ahead of this
// guard, and those surfaces' tab/filter controls are exclusively styled
// via bare `chq-pill`/`chq-pill is-active` (no page-prefixed second
// class) — excluding it would turn dozens of decision-certified controls
// into false positives on day one. <input type="hidden"> is the one
// exemption (it renders nothing, so it carries no visual tier).

const REPO_ROOT = join(__dirname, "..");
const APP_SRC = join(REPO_ROOT, "app/src");

/** Recursively collect `.tsx` files under `dir`, skipping test files. */
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

const tsxFiles = glob(APP_SRC);

const CONTROL_TAGS = ["button", "input", "select", "textarea"];

/**
 * Blank out `//` and `/* *\/` comments (keeping newlines, so line numbers
 * stay accurate) so a JSX example inside a comment — e.g. the `<select>`
 * mentioned in a docblock — is never mistaken for a live control.
 * String/template contents are left alone (comment markers inside strings
 * don't occur in this codebase's control markup).
 */
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

/** From `start` (index of `<`), find the index of the top-level `>` that
 * closes the opening tag, skipping over `{...}` JS expressions and quoted
 * strings so an embedded `>` (e.g. `disabled={x > 5}`) doesn't terminate
 * the scan early. */
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

/** Find the value substring for `attrName="..."` / `attrName={...}` within
 * an opening-tag's attribute text, returning null if the attribute is
 * absent. */
function extractAttrValue(attrs: string, attrName: string): string | null {
  const re = new RegExp(`\\b${attrName}\\s*=\\s*`, "g");
  const m = re.exec(attrs);
  if (!m) return null;
  const start = m.index + m[0]!.length;
  const opener = attrs[start];
  if (opener === '"' || opener === "'") {
    const end = attrs.indexOf(opener, start + 1);
    return attrs.slice(start, end + 1);
  }
  if (opener === "{") {
    let depth = 0;
    let i = start;
    for (; i < attrs.length; i++) {
      if (attrs[i] === "{") depth++;
      else if (attrs[i] === "}") {
        depth--;
        if (depth === 0) break;
      }
    }
    return attrs.slice(start, i + 1);
  }
  return null;
}

/** Every class token found inside quoted-string/template-literal fragments
 * of a className value. A bare identifier (`className={cellClass}`) with
 * no quoted literal anywhere contributes no tokens — the guard can't
 * introspect a variable's runtime value, so such controls are trusted
 * (this is a source-regex guard, not a type checker). */
function extractClassTokens(classValue: string): string[] {
  const tokens: string[] = [];
  const literalRe = /"([^"]*)"|'([^']*)'|`([^`]*)`/g;
  let m: RegExpExecArray | null;
  while ((m = literalRe.exec(classValue))) {
    const literal = (m[1] ?? m[2] ?? m[3] ?? "").replace(/\$\{[^}]*\}/g, " ");
    tokens.push(...literal.split(/\s+/).filter(Boolean));
  }
  return tokens;
}

const TIER_CLASSES = new Set(["chq-btn-primary", "chq-btn-secondary", "chq-btn-tertiary"]);
const DIRECT_CLASSES = new Set([
  "chq-link-button",
  "chq-input",
  "chq-select",
  "chq-textarea",
  "chq-check",
  "chq-checkbox-label",
  "chq-pill",
]);
const PAGE_PREFIXED_RE = /^chq-[a-z]+-[a-z0-9-]+$/;

function passesVocab(tokens: string[]): boolean {
  if (tokens.length === 0) return true; // unresolvable identifier — trusted, see extractClassTokens
  const set = new Set(tokens);
  for (const c of set) {
    if (DIRECT_CLASSES.has(c)) return true;
  }
  if (set.has("chq-btn") && [...set].some((c) => TIER_CLASSES.has(c))) return true;
  for (const c of set) {
    if (TIER_CLASSES.has(c)) continue; // a tier alone doesn't count; needs the `chq-btn` base too
    if (PAGE_PREFIXED_RE.test(c)) return true;
  }
  return false;
}

interface Violation {
  file: string;
  line: number;
  tag: string;
}

function scanFile(file: string): Violation[] {
  const rawSrc = readFileSync(file, "utf8");
  const src = stripComments(rawSrc);
  const violations: Violation[] = [];
  const tagRe = new RegExp(`<(${CONTROL_TAGS.join("|")})(?=[\\s/>])`, "g");
  let m: RegExpExecArray | null;
  while ((m = tagRe.exec(src))) {
    const tagName = m[1]!;
    const tagStart = m.index;
    const tagEnd = findTagEnd(src, tagStart);
    if (tagEnd === -1) {
      throw new Error(`${file}: unterminated <${tagName}> starting at offset ${tagStart}`);
    }
    const attrs = src.slice(tagStart, tagEnd + 1);
    const lineNumber = src.slice(0, tagStart).split("\n").length;

    if (tagName === "input") {
      const typeValue = extractAttrValue(attrs, "type");
      if (typeValue === '"hidden"' || typeValue === "'hidden'") {
        continue;
      }
    }

    const classValue = extractAttrValue(attrs, "className");
    if (classValue === null) {
      violations.push({ file, line: lineNumber, tag: tagName });
      continue;
    }
    const tokens = extractClassTokens(classValue);
    if (!passesVocab(tokens)) {
      violations.push({ file, line: lineNumber, tag: tagName });
    }
  }
  return violations;
}

describe("interactive control class conformance (DEC-406/DEC-410)", () => {
  it("scanned at least 1 tsx file", () => {
    expect(tsxFiles.length).toBeGreaterThanOrEqual(1);
  });

  it("every button/input/select/textarea carries a design-system shell class", () => {
    const violations: Violation[] = [];
    for (const file of tsxFiles) {
      violations.push(...scanFile(file));
    }
    const message = violations
      .map((v) => `${v.file}:${v.line} <${v.tag}> missing a DEC-406 vocabulary class`)
      .join("\n");
    expect(violations, `\n${message}`).toEqual([]);
  });
});
