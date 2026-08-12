// DEC-539: this repo's invariants (DEC-511/518/523/527/528, and others) are
// enforced by tests that glob src/**/*.{ts,tsx} and app/src/**/*.{ts,tsx}
// and scan the matched files with regex/string checks. ripgrep — and any
// naive line-oriented text scan — silently classifies a file containing a
// raw control byte (e.g. NUL) as "binary" and skips it by default, which
// means a stray control byte anywhere in a source file silently removes
// that file from the population every one of those globbed guards
// enumerates over (this happened for real: src/server/repo/exports.ts
// carried a raw NUL byte as a composite-key separator, invisible to `rg`
// scans until this test named it). This test guards the guards: it globs
// every TypeScript source file and asserts none contains a disallowed
// control byte, naming the offending byte and file on failure.

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const REPO_ROOT = join(__dirname, "..");
const SRC_ROOTS = [join(REPO_ROOT, "src"), join(REPO_ROOT, "app/src")];

/** Recursively collect `.ts`/`.tsx` files under `dir`. */
function glob(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      out.push(...glob(full));
    } else if (entry.endsWith(".ts") || entry.endsWith(".tsx")) {
      out.push(full);
    }
  }
  return out;
}

const files = SRC_ROOTS.flatMap(glob);

// Disallowed: C0 control bytes other than the ordinary whitespace ones a
// text source file legitimately contains — tab (0x09), LF (0x0A), CR
// (0x0D), and ESC-adjacent bytes are not excluded here on purpose (ESC,
// 0x1B, is still disallowed; no legitimate TS source needs it). The
// allowed set is exactly {0x09, 0x0A, 0x0D}; everything else in 0x00-0x1F
// is disallowed.
function findDisallowedControlByte(bytes: Buffer): { offset: number; byte: number } | null {
  for (let i = 0; i < bytes.length; i++) {
    const b = bytes.at(i);
    if (b === undefined) continue;
    if (b <= 0x1f && b !== 0x09 && b !== 0x0a && b !== 0x0d) {
      return { offset: i, byte: b };
    }
  }
  return null;
}

describe("source files contain no raw control bytes", () => {
  it(`scanned at least one file (found ${files.length})`, () => {
    expect(files.length).toBeGreaterThan(0);
  });

  for (const file of files) {
    it(`no control byte in ${file.slice(REPO_ROOT.length + 1)}`, () => {
      const bytes = readFileSync(file);
      const hit = findDisallowedControlByte(bytes);
      if (hit) {
        const hex = hit.byte.toString(16).padStart(2, "0");
        throw new Error(
          `${file} contains disallowed control byte 0x${hex} at offset ${hit.offset}`,
        );
      }
      expect(hit).toBeNull();
    });
  }
});
