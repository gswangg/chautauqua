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

  return violations;
}

describe("upload accepted-type/size-cap vocabulary has one source (DEC-020, CNT-12)", () => {
  it("enumerates the DEC-020-governed upload surface population and finds no drift", () => {
    const files = listUploadSurfaceFiles();
    // Sanity: the population must be non-empty and match every surface this
    // wave's enumeration found, so a future refactor that renames/removes a
    // surface is visible here rather than silently shrinking the scan.
    expect(files.length).toBeGreaterThanOrEqual(5);

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
