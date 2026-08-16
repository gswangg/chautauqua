// DEC-020 (wave-46 amendment, CNT-12): "Upload UI must state the accepted
// types and size caps verbatim from this list" is a contract with nothing
// mechanically enforcing it. This is that enforcement: a scan-lock over
// every DEC-020-governed upload surface (any file rendering a real
// `<input type="file">` whose `accept` is drawn from the DEC-020/DEC-028
// extension vocabulary -- not an unrelated upload domain like the CSV
// import wizard) that asserts its accepted-type list and size-cap text are
// interpolated from src/domain/files.ts's exported constants/helpers,
// never a second hand-written literal.
//
// The scan is mechanical: it walks src/routes/** and app/src/** at test
// run time and evaluates every matching file, so a surface added later
// that hand-types its own extension list or "NN MB" sentence fails this
// test the moment it lands -- it is never grandfathered by a fixed file
// list the scan happens to know about today.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const REPO_ROOT = resolve(__dirname, "..");
const SCAN_ROOTS = ["src/routes", "app/src"];

// The ONE set of identifiers a DEC-020-governed surface may use to render
// its accept list / cap text -- anything else appearing as a hand-typed
// extension or "<number> MB" sentence on such a surface is drift.
const ALLOWED_DERIVATION_IDENTIFIERS = [
  "allowedUploadExtensions",
  "HEADSHOT_EXTENSIONS",
  "uploadHintText",
  "headshotHintText",
  "archiveCapMessage",
  "DOCUMENT_MAX_BYTES",
  "IMAGE_MAX_BYTES",
  "TEXT_MAX_BYTES",
  "VIDEO_MAX_BYTES",
  "HEADSHOT_MAX_BYTES",
  "ARCHIVE_MAX_TOTAL_BYTES",
  "ARCHIVE_MAX_FILES",
];

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      if (entry === "node_modules" || entry === "dist") continue;
      walk(full, out);
    } else if (/\.(ts|tsx)$/.test(entry) && !/\.test\.(ts|tsx)$/.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

function listUploadSurfaceFiles(): string[] {
  const files: string[] = [];
  for (const root of SCAN_ROOTS) {
    walk(join(REPO_ROOT, root), files);
  }
  return files.filter((f) => {
    const content = readFileSync(f, "utf8");
    if (!/type=["']file["']|type=\{["']file["']\}/.test(content)) return false;
    const acceptMatch = content.match(/accept=(\{[^}]*\}|"[^"]*")/);
    if (!acceptMatch) return false;
    const acceptValue = acceptMatch[1]!;
    // A csv-only accept ("text/csv"/".csv") names a wholly different upload
    // domain (tabular event-data import, e.g. the Sessionboard/contacts CSV
    // wizards) that DEC-020's binary-file vocabulary never governs -- the
    // only exclusion this population builder makes, and it's decided by the
    // accept value itself, not a hand-maintained file list.
    if (/csv/i.test(acceptValue)) return false;
    return true;
  });
}

/** All argument strings (trimmed) passed to every call of `fnName(...)` in
 * `text`. A crude regex, not a parser -- fine for this scan's simple call
 * shapes (a bare identifier, a string literal, or no arg at all). */
function extractKindArgs(text: string, fnName: string): string[] {
  const re = new RegExp(`${fnName}\\(([^)]*)\\)`, "g");
  const args: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    args.push(m[1]!.trim());
  }
  return args;
}

interface ScanResult {
  file: string;
  violations: string[];
}

/** Pure check, exported implicitly via the closure below so it can be unit
 * tested directly against a synthetic fixture, not just the real tree. */
function scanFileContent(relPath: string, content: string): string[] {
  const violations: string[] = [];

  const acceptMatch = content.match(/accept=(\{[^}]*\}|"[^"]*")/);
  if (acceptMatch) {
    const acceptValue = acceptMatch[1]!;
    const isExpression = acceptValue.startsWith("{");
    if (!isExpression) {
      // A plain string literal naming a governed extension is never
      // allowed -- it must be an expression deriving from the exported
      // vocabulary.
      violations.push(
        `${relPath}: accept="..." is a hand-written string literal (${acceptValue}), not derived from allowedUploadExtensions/HEADSHOT_EXTENSIONS`,
      );
    } else {
      const derivesFromAllowed = ALLOWED_DERIVATION_IDENTIFIERS.some((id) => acceptValue.includes(id));
      if (!derivesFromAllowed) {
        violations.push(
          `${relPath}: accept={...} expression (${acceptValue}) does not reference an allowed derivation identifier`,
        );
      }
    }
  }

  // Every non-comment line stating a byte-size cap (an "NN MB" or "NN.N MB"
  // sentence) on a governed surface must derive from an exported *_MAX_BYTES
  // constant or one of the hint-text helper functions -- never a bare
  // hand-typed number.
  const lines = content.split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith("//") || trimmed.startsWith("*") || trimmed.startsWith("/*")) continue;
    if (!/\d+(\.\d+)?\s*MB\b/.test(line)) continue;
    const derivesFromAllowed = ALLOWED_DERIVATION_IDENTIFIERS.some((id) => line.includes(id));
    if (!derivesFromAllowed) {
      violations.push(`${relPath}: hand-typed size-cap text (${trimmed}) does not derive from an exported *_MAX_BYTES constant or hint-text helper`);
    }
  }

  // DEC-879 (wave-54 amendment): the picker's accept list and its visible
  // hint text must name the SAME FileKind -- a bare no-arg
  // allowedUploadExtensions() beside a kinded uploadHintText('handout') call
  // (or vice versa, or two different kind expressions) filters a type out of
  // the picker that the hint and the server both admit. This is decided
  // textually: the kind expression passed to allowedUploadExtensions must be
  // identical to every kind expression passed to uploadHintText in the same
  // file.
  if (acceptMatch && acceptMatch[1]!.includes("allowedUploadExtensions")) {
    const acceptKindArgs = extractKindArgs(acceptMatch[1]!, "allowedUploadExtensions");
    const hintKindArgs = extractKindArgs(content, "uploadHintText");
    if (acceptKindArgs.length > 0 && hintKindArgs.length > 0) {
      const acceptKind = acceptKindArgs[0]!;
      const mismatched = hintKindArgs.find((h) => h !== acceptKind);
      if (mismatched !== undefined) {
        violations.push(
          `${relPath}: allowedUploadExtensions kind arg (${JSON.stringify(acceptKind)}) does not match sibling uploadHintText kind arg (${JSON.stringify(mismatched)})`,
        );
      }
    }
  }

  return violations;
}

describe("upload accepted-type/size-cap vocabulary has one source (DEC-020, CNT-12)", () => {
  it("enumerates the DEC-020-governed upload surface population and finds no drift", () => {
    const files = listUploadSurfaceFiles();
    // Sanity: the population must be non-empty and match every surface this
    // wave's enumeration found, so a future refactor that renames/removes a
    // surface is visible here rather than silently shrinking the scan.
    // G13 A20: the floor drops 5 -> 4 because the Contacts drawer's HEADSHOT
    // row -- native file input and all -- was removed as unframed (frame
    // 08-contacts--02 draws PROFILE as bio + links). The four remaining
    // governed surfaces are content/UploadZone.tsx,
    // settings/ResourcesPanel.tsx, portal/profile.tsx (HEADSHOT_EXTENSIONS)
    // and portal/tasks/views.tsx. Adjusted deliberately, with the removal
    // named, rather than left to shrink silently.
    expect(files.length).toBeGreaterThanOrEqual(4);

    const results: ScanResult[] = files.map((f) => ({
      file: f,
      violations: scanFileContent(f.slice(REPO_ROOT.length + 1), readFileSync(f, "utf8")),
    }));

    const allViolations = results.flatMap((r) => r.violations);
    expect(allViolations, allViolations.join("\n")).toEqual([]);
  });

  it("the CSV import wizard's accept is out of DEC-020's scope (different upload domain)", () => {
    const files = listUploadSurfaceFiles();
    const csvFiles = files.filter((f) => f.includes("ImportWizard") || f.includes("SessionboardImportPanel"));
    // The CSV surfaces don't name a DEC-020 extension in their accept, so
    // the population builder above must not have swept them in.
    expect(csvFiles).toEqual([]);
  });

  it("fails the scan on a synthetic surface that hand-types the extension list instead of deriving it", () => {
    const drifting = `
      export function Bad() {
        return <input type="file" accept=".pdf,.ppt,.pptx,.key,.odp" />;
      }
    `;
    const violations = scanFileContent("fixtures/synthetic-bad-accept.tsx", drifting);
    expect(violations.length).toBeGreaterThan(0);
    expect(violations[0]).toContain("hand-written string literal");
  });

  it("fails the scan on a synthetic surface that hand-types a size cap sentence instead of deriving it", () => {
    const drifting = `
      export function Bad() {
        return (
          <input type="file" accept={allowedUploadExtensions('handout').map((e) => '.' + e).join(',')} />
        );
      }
      const hint = "Max 25 MB.";
    `;
    const violations = scanFileContent("fixtures/synthetic-bad-cap.tsx", drifting);
    expect(violations.length).toBeGreaterThan(0);
    expect(violations.some((v) => v.includes("hand-typed size-cap text"))).toBe(true);
  });

  it("fails the scan when the accept kind arg doesn't match uploadHintText's sibling kind arg", () => {
    const drifting = `
      import { allowedUploadExtensions, uploadHintText } from '../../../src/domain/files';
      export function Bad() {
        return (
          <>
            <input type="file" accept={allowedUploadExtensions().map((e) => '.' + e).join(',')} />
            <span>{uploadHintText('handout')}</span>
          </>
        );
      }
    `;
    const violations = scanFileContent("fixtures/synthetic-bad-kind-mismatch.tsx", drifting);
    expect(violations.length).toBeGreaterThan(0);
    expect(violations.some((v) => v.includes("does not match sibling uploadHintText"))).toBe(true);
  });

  it("passes the scan when the accept kind arg textually matches uploadHintText's sibling kind arg", () => {
    const clean = `
      import { allowedUploadExtensions, uploadHintText, CFP_FILE_FIELD_KIND } from '../../../src/domain/files';
      export function Good() {
        return (
          <>
            <input type="file" accept={allowedUploadExtensions(CFP_FILE_FIELD_KIND).map((e) => '.' + e).join(',')} />
            <span>{uploadHintText(CFP_FILE_FIELD_KIND)}</span>
          </>
        );
      }
    `;
    const violations = scanFileContent("fixtures/synthetic-good-kind-match.tsx", clean);
    expect(violations).toEqual([]);
  });

  it("passes the scan on a synthetic surface that derives both from the exported vocabulary", () => {
    const clean = `
      import { allowedUploadExtensions, uploadHintText } from '../../../src/domain/files';
      export function Good({ kind }) {
        return (
          <>
            <input type="file" accept={allowedUploadExtensions(kind).map((e) => '.' + e).join(',')} />
            <span>{uploadHintText(kind)}</span>
          </>
        );
      }
    `;
    const violations = scanFileContent("fixtures/synthetic-good.tsx", clean);
    expect(violations).toEqual([]);
  });
});
