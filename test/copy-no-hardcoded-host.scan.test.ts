// DEC-296 (amendment, w7-d): this is an MIT open-source product whose
// premise is that the running instance belongs to the operator, not to
// chautauqua.cc. Product/comment code must never hard-code that (or any
// other) deployment's hostname -- display text is derived from
// window.location.host (see app/src/pages/settings/YourDataPanel.tsx's
// apiDocsDisplay, following app/src/pages/forms/FormsPage.tsx's precedent),
// while hrefs stay root-relative. This scan walks every non-test source
// file under src/ and app/src/ and fails loudly, naming the offending file
// and line, if the literal `chautauqua.cc` reappears anywhere -- including
// comments, since a comment mentioning the literal host is exactly how this
// defect crept back in once already.
import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = join(__dirname, "..");
const SRC_ROOT = join(ROOT, "src");
const APP_SRC_ROOT = join(ROOT, "app", "src");
const DECISIONS_DATA_DIR = join(SRC_ROOT, "decisions-data");
const DECISIONS_TS = join(SRC_ROOT, "decisions.ts");

const HARDCODED_HOST = "chautauqua.cc";

function isTestFile(path: string): boolean {
  return /\.test\./.test(path);
}

function isExcluded(path: string): boolean {
  if (isTestFile(path)) return true;
  if (path.startsWith(DECISIONS_DATA_DIR + "/") || path === DECISIONS_DATA_DIR) return true;
  if (path === DECISIONS_TS) return true;
  return false;
}

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...walk(full));
    } else if (entry.isFile() && (full.endsWith(".ts") || full.endsWith(".tsx")) && !isExcluded(full)) {
      out.push(full);
    }
  }
  return out;
}

describe("no hard-coded deployment hostname in product code (DEC-296)", () => {
  it("no file under src/ or app/src/ (excluding tests, src/decisions-data/, src/decisions.ts) contains the literal 'chautauqua.cc'", () => {
    const files = [...walk(SRC_ROOT), ...walk(APP_SRC_ROOT)];
    const offenders: string[] = [];

    for (const file of files) {
      const source = readFileSync(file, "utf8");
      const lines = source.split("\n");
      lines.forEach((line, index) => {
        if (line.includes(HARDCODED_HOST)) {
          const rel = relative(ROOT, file);
          offenders.push(
            `${rel}:${index + 1} hard-codes the deployment hostname "${HARDCODED_HOST}" ` +
              `(DEC-296: this is an MIT open-source product -- every instance is the ` +
              `operator's own host, derive display text from window.location.host instead)`,
          );
        }
      });
    }

    expect(offenders).toEqual([]);
  });

  it("sanity: the detector fires on a positive control containing the literal", () => {
    const source = "const x = 'chautauqua.cc/docs/api';";
    expect(source.includes(HARDCODED_HOST)).toBe(true);
  });
});
