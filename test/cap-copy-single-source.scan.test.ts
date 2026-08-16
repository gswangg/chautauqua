// DEC-422 (amendment): the ONE over-cap refusal grammar lives in
// src/domain/cap-copy.ts (overCapFieldMessage/overCapSentence/
// overCapCountMessage). Two regressions this scan guards against:
//
//   (a) a bare `` `Max ${...}` `` fields-map value -- the terse, unhelpful
//       grammar (names the limit, never what was typed or how far over)
//       that used to be hand-composed at ~50 call sites across src/routes,
//       src/server and src/domain before this task collapsed them all onto
//       cap-copy.ts.
//   (b) a named regex CONSTANT (`const WHATEVER_PATTERN = /.../`) whose
//       source contains literal multi-word English prose -- the shape of
//       the deleted src/routes/public/submit-messages.ts:11
//       `TOO_LONG_PATTERN = /^Too long \(max (\d+) characters\)$/`, which
//       recovered validateAnswers' cap by regex-matching its sibling
//       module's error copy and broke the instant that copy gained a
//       thousands separator. A format/shape regex (an email pattern, a
//       slug pattern, an ISO-date pattern) never embeds a run of plain
//       English words -- only a "parse my sibling's prose" regex does.
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC_DIR = join(HERE, "..", "src");

/** Every .ts/.tsx file under `root`, excluding test files. */
function allSourceFiles(root: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(root, { withFileTypes: true, recursive: true })) {
    if (!entry.isFile()) continue;
    if (!/\.tsx?$/.test(entry.name)) continue;
    if (entry.name.includes(".test.")) continue;
    out.push(join(entry.parentPath, entry.name));
  }
  return out.sort();
}

/** Files that legitimately still say "Max ${...}" -- an informational size
 * ceiling describing MULTIPLE simultaneous caps (document/image/video byte
 * ceilings) in a user-facing MESSAGE string, not a terse fields-map value
 * naming a single field's overage. Not the fields-map grammar this scan
 * bans, and there is no single (length, max) pair to hand overCapFieldMessage
 * for a sentence describing three different ceilings at once. */
const BARE_MAX_TEMPLATE_ALLOWLIST = new Set([join(SRC_DIR, "domain", "files.ts")].map((p) => relative(HERE, p)));

// (b) A named regex constant whose source embeds literal multi-word English
// prose -- two or more runs of 2+ letters separated by a literal space.
// `const NAME = /source/flags;` -- deliberately narrow to actual regex
// CONSTANT declarations (never trips on a `//` comment, which this line
// shape can't match: a comment has no `= /.../;` regex-literal tail).
const REGEX_CONST_DECL_RE = /(?:export\s+)?const\s+[A-Z][A-Z0-9_]*\s*=\s*\/((?:\\.|[^/\\\n])+)\/[a-z]*;/g;
const PROSE_WORDS_RE = /[A-Za-z]{2,} [A-Za-z]{2,}/;

function findBareMaxTemplates(src: string): string[] {
  return src.includes("`Max ${") ? ["`Max ${"] : [];
}

function findProseParsingRegexes(src: string): string[] {
  const found: string[] = [];
  for (const m of src.matchAll(REGEX_CONST_DECL_RE)) {
    const regexSource = m[1] as string;
    if (PROSE_WORDS_RE.test(regexSource)) found.push(m[0]);
  }
  return found;
}

describe("Over-cap refusal copy is single-sourced through src/domain/cap-copy.ts (DEC-422 amendment)", () => {
  const FILES = allSourceFiles(SRC_DIR);

  it("scanned more than one src file", () => {
    expect(FILES.length).toBeGreaterThan(50);
  });

  it("no src/ file (outside the documented allowlist) declares a bare `Max ${...}` fields-map value", () => {
    const offenders: string[] = [];
    for (const path of FILES) {
      const rel = relative(HERE, path);
      if (BARE_MAX_TEMPLATE_ALLOWLIST.has(rel)) continue;
      const src = readFileSync(path, "utf-8");
      if (findBareMaxTemplates(src).length > 0) offenders.push(rel);
    }
    expect(offenders, `files with a bare \`Max \${...}\` template literal:\n${offenders.join("\n")}`).toEqual([]);
  });

  it("no src/ file declares a named regex constant whose source parses another module's error prose", () => {
    const offenders: string[] = [];
    for (const path of FILES) {
      const src = readFileSync(path, "utf-8");
      const found = findProseParsingRegexes(src);
      if (found.length > 0) offenders.push(`${relative(HERE, path)}: ${found.join(", ")}`);
    }
    expect(offenders, `files with a prose-parsing regex constant:\n${offenders.join("\n")}`).toEqual([]);
  });

  // Positive control (a): the detector DOES flag the exact deleted shape.
  it("positive control: the bare `Max ${...}` detector flags the deleted grammar", () => {
    const violating = 'fields.title = `Max ${MAX_NAME_LENGTH}`;';
    expect(findBareMaxTemplates(violating)).toEqual(["`Max ${"]);
    const clean = "fields.title = overCapFieldMessage(title.length, MAX_NAME_LENGTH);";
    expect(findBareMaxTemplates(clean)).toEqual([]);
  });

  // Positive control (b): the detector DOES flag the exact deleted
  // TOO_LONG_PATTERN shape, and does NOT flag a legitimate format/shape
  // regex (no embedded prose) or an ordinary `//` comment line.
  it("positive control: the prose-regex detector flags the deleted TOO_LONG_PATTERN shape but not a format regex or a comment", () => {
    const violating = 'const TOO_LONG_PATTERN = /^Too long \\(max (\\d+) characters\\)$/;';
    expect(findProseParsingRegexes(violating).length).toBe(1);

    const formatRegex = 'const EMAIL_PATTERN = /^[^\\s@]+@[^\\s@.]+(?:\\.[^\\s@.]+)+$/;';
    expect(findProseParsingRegexes(formatRegex)).toEqual([]);

    const comment = "// Referenced for compile-checked dependency per DEC-124/DEC-454.";
    expect(findProseParsingRegexes(comment)).toEqual([]);
  });
});
