// DEC-367/DEC-808 (wave 57): "population" scans that ban a CSS pattern
// (e.g. the phone-only 44px tap floor, fractional-px geometry) must sweep
// every module that exports SSR CSS, not a hand-picked directory. A prior
// scan swept only src/routes/public/** and missed src/views/theme.ts -- the
// ~500-line THEME_CSS module that OWNS the phone tap floor for shared
// chrome -- plus six other base-scope modules, because nothing walked the
// whole src/ tree. This helper is the DERIVED population: it walks src/
// recursively and returns every `.ts` file whose source contains a
// top-level `export const <NAME>_CSS = \`` template literal. Never hand-list
// the module names here; if a new *_CSS module is added anywhere under
// src/, it is picked up automatically.

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

const REPO_ROOT = join(__dirname, "..", "..");
const SRC_ROOT = join(REPO_ROOT, "src");

const SKIP_DIRS = new Set(["node_modules", "dist", ".wrangler"]);

const CSS_EXPORT_RE = /^export const [A-Z0-9_]+_CSS = `/m;

export interface SsrCssSource {
  path: string;
  text: string;
}

function listTsFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      out.push(...listTsFiles(full));
    } else if (entry.endsWith(".ts")) {
      out.push(full);
    }
  }
  return out;
}

export function ssrCssSources(): SsrCssSource[] {
  const files = listTsFiles(SRC_ROOT);
  const out: SsrCssSource[] = [];
  for (const full of files) {
    const text = readFileSync(full, "utf8");
    if (CSS_EXPORT_RE.test(text)) {
      out.push({ path: relative(REPO_ROOT, full).split(sep).join("/"), text });
    }
  }
  return out.sort((a, b) => a.path.localeCompare(b.path));
}
