// Contention decomposition (custodian, wave 44): the product-file population
// walk extracted verbatim from test/tap-floor-exempt-premise.scan.test.ts,
// no behavior change. POPULATION (never a hand list, DEC-367/DEC-808): every
// `.ts`, `.tsx` and `.css` file under src/** and app/src/**, excluding
// `*.test.ts(x)` (test infrastructure, not a product sheet) and this
// campaign's own scan-library directories (app/src/phone-tap-target-scan/,
// app/src/phone-overflow-scan/ -- their prose ABOUT the `tap-floor-exempt:`
// grammar contains the literal token as documentation, not as a real
// receipt).
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

export const REPO_ROOT = join(__dirname, "..", "..");
export const ROOTS = ["src", "app/src"];
export const SKIP_DIRS = new Set(["node_modules", "dist", ".wrangler"]);
export const EXTS = [".ts", ".tsx", ".css"];
export const SKIP_PATH_FRAGMENTS = ["/phone-tap-target-scan/", "/phone-overflow-scan/"];

export interface ProductFile {
  path: string;
  text: string;
}

export function listProductFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      out.push(...listProductFiles(full));
    } else if (
      EXTS.some((e) => entry.endsWith(e)) &&
      !entry.endsWith(".test.ts") &&
      !entry.endsWith(".test.tsx") &&
      !SKIP_PATH_FRAGMENTS.some((f) => full.split(sep).join("/").includes(f))
    ) {
      out.push(full);
    }
  }
  return out;
}

export function productFiles(): ProductFile[] {
  const files = ROOTS.flatMap((r) => listProductFiles(join(REPO_ROOT, r)));
  return files
    .map((full) => ({ path: relative(REPO_ROOT, full).split(sep).join("/"), text: readFileSync(full, "utf8") }))
    .sort((a, b) => a.path.localeCompare(b.path));
}
