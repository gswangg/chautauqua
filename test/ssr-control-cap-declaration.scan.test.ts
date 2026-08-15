// A hand-written SSR control (an `<input type="text">`/`<input
// type="email">`/`<textarea>` a route module writes directly, never via
// FormFieldsSection/form-render.tsx's field-driven renderer) must disclose
// the same cap the write-side repo enforces (DEC-909; w1-a covered the
// FormFieldDef-driven controls in src/views/form-render.tsx; this scan
// covers the OTHER population -- hand-written portal/auth markup). Verified
// offender this wave: src/routes/portal/edit.tsx's "Add a co-presenter"
// inputs rendered with no maxLength while portal-edit.ts's addCoPresenter
// refuses anything over MAX_NAME_LENGTH server-side -- the speaker only
// learns the cap on submit. Fixed alongside this scan.
//
// Population: every non-test .tsx file under src/routes/portal (recursive,
// DEC-808-style readdirSync enumeration, never a hand-listed manifest) plus
// the top-level src/routes/*.tsx files (non-recursive -- auth-views.tsx,
// account.tsx, etc.).
//
// EXCLUSIONS (named here, not derived from a failing run):
//   - src/routes/public/** is out of population: w1-e already owns the
//     public search box's maxlength/cap parity this wave.
//   - src/views/** is out of population: w1-a already owns the
//     FormFieldDef-driven renderer (form-render.tsx) this wave.
//   - `type="password"` inputs are out of scope: task-w2-a owns the
//     password-length-cap-at-an-anonymous-surface class separately.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const HERE = dirname(fileURLToPath(import.meta.url));
const PORTAL_ROOT = join(HERE, "..", "src", "routes", "portal");
const ROUTES_ROOT = join(HERE, "..", "src", "routes");

/** Every .tsx file under `root`, recursively, excluding test files. */
function allTsxFilesRecursive(root: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(root, { withFileTypes: true, recursive: true })) {
    if (!entry.isFile()) continue;
    if (!entry.name.endsWith(".tsx")) continue;
    if (entry.name.includes(".test.")) continue;
    out.push(join(entry.parentPath, entry.name));
  }
  return out.sort();
}

/** Every non-test .tsx file directly under `root` (no recursion into subdirs). */
function tsxFilesTopLevel(root: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    if (!entry.isFile()) continue;
    if (!entry.name.endsWith(".tsx")) continue;
    if (entry.name.includes(".test.")) continue;
    out.push(join(root, entry.name));
  }
  return out.sort();
}

// Named, live exemption list -- entries excused by shape (never derived from
// a failing scan run), each with its own reason stated beside it.
const EXEMPT_ATTR_PATTERN = /type\s*=\s*["']password["']/;

/**
 * A hand-written `<input .../>` or `<textarea ...>...</textarea>` tag whose
 * type is text/email (or unspecified on a bare `<input>`, which HTML treats
 * as text) or which is a `<textarea>`, and which declares no maxLength (JSX
 * camelCase) / maxlength (raw HTML attribute) prop. Password inputs are
 * exempt by shape (task-w2-a's population), as are hidden/checkbox/file/etc.
 * inputs (never free text a visitor types past a length limit).
 */
function findUncappedControls(src: string): string[] {
  // Strip `/* ... */` block comments and `// ...` line comments first --
  // otherwise a doc comment that merely mentions `<input>` in prose (a real
  // false positive hit in src/routes/portal/profile.tsx) gets scanned as if
  // it were live JSX.
  const withoutComments = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
  const offenders: string[] = [];
  // Match self-closing or open <input ...> tags (JSX inputs are always
  // self-closing/void) and <textarea ...>...</textarea> pairs.
  const tagRe = /<input\b[^>]*\/?>|<textarea\b[^>]*>/g;
  let m: RegExpExecArray | null;
  while ((m = tagRe.exec(withoutComments)) !== null) {
    const tag = m[0];
    const isTextarea = tag.startsWith("<textarea");
    const typeMatch = tag.match(/type\s*=\s*["']([a-zA-Z]+)["']/);
    const type = typeMatch ? typeMatch[1] : isTextarea ? "textarea" : "text";
    const inScopeType = isTextarea || type === "text" || type === "email";
    if (!inScopeType) continue;
    if (EXEMPT_ATTR_PATTERN.test(tag)) continue;
    const hasCap = /maxLength\s*=|maxlength\s*=/i.test(tag);
    if (!hasCap) offenders.push(tag.replace(/\s+/g, " ").trim());
  }
  return offenders;
}

describe("every hand-written SSR text/email/textarea control in src/routes/portal + top-level src/routes discloses a maxLength cap (DEC-909)", () => {
  const PORTAL_FILES = allTsxFilesRecursive(PORTAL_ROOT);
  const TOP_LEVEL_FILES = tsxFilesTopLevel(ROUTES_ROOT);
  const SCANNED_FILES = [...PORTAL_FILES, ...TOP_LEVEL_FILES];

  // Vacuous-scan tripwire: if either enumeration silently returned nothing
  // (a broken path after a rename), every "no offenders" result below would
  // be trivially true.
  it("vacuous-scan tripwire: both populations are non-empty", () => {
    expect(PORTAL_FILES.length).toBeGreaterThan(3);
    expect(TOP_LEVEL_FILES.length).toBeGreaterThan(3);
  });

  it("the portal population reaches into a subdirectory (recursive enumeration is real)", () => {
    expect(PORTAL_FILES.some((p) => p.includes(join("tasks", "")))).toBe(true);
  });

  it("scanned files still exist on disk", () => {
    for (const f of SCANNED_FILES) {
      expect(() => statSync(f), `scanned file missing: ${f}`).not.toThrow();
    }
  });

  it("no in-population file renders an uncapped text/email/textarea control", () => {
    const offenders: string[] = [];
    for (const path of SCANNED_FILES) {
      const src = readFileSync(path, "utf-8");
      const found = findUncappedControls(src);
      if (found.length > 0) {
        offenders.push(`${relative(HERE, path)}:\n  ${found.join("\n  ")}`);
      }
    }
    expect(offenders, `SSR controls with no declared cap:\n${offenders.join("\n")}`).toEqual([]);
  });

  // Both-ways negative control: a synthetic uncapped input IS flagged, and a
  // synthetic capped one is NOT -- confirms the detector isn't matching
  // nothing (or matching everything).
  it("the detector flags a synthetic uncapped input but not a synthetic capped one", () => {
    const uncapped = `<input type="text" name="foo" value="" />`;
    expect(findUncappedControls(uncapped)).toEqual([uncapped]);

    const capped = `<input type="text" name="foo" value="" maxLength={40} />`;
    expect(findUncappedControls(capped)).toEqual([]);
  });

  // Password inputs are exempt by shape, not silently unmatched -- confirm
  // the exemption is excusing a real match, not just failing to match at all.
  it("a synthetic uncapped password input is exempt (task-w2-a's population), but a same-shape text input is not", () => {
    const password = `<input type="password" name="secret" required />`;
    expect(findUncappedControls(password)).toEqual([]);

    const text = `<input type="text" name="secret" required />`;
    expect(findUncappedControls(text)).toEqual([text]);
  });

  it("a synthetic uncapped textarea is flagged", () => {
    const textarea = `<textarea name="bio">hello</textarea>`;
    expect(findUncappedControls(textarea)).toEqual([`<textarea name="bio">`]);
  });
});
