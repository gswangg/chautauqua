// w3-b (DEC-945 + DEC-939 amendments): a button FACE class
// (chq-btn-primary/-secondary/-tertiary) never ships without the button BOX
// class (chq-btn) in the same class/className string literal -- the box
// supplies the shared control geometry (min-height, padding, font) that the
// face classes alone do not. Five faces (src/routes/account.tsx and
// src/routes/auth-views.tsx x4) shipped bare `chq-btn-primary` with no
// `chq-btn`, producing a 19px-tall submit button whose label overflowed.
//
// This scan walks every class/className string literal under src/routes/**
// and src/server/** and asserts: if the literal contains a face token, it
// also contains the bare `chq-btn` token.

import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, resolve, relative } from "node:path";
import { fileURLToPath } from "node:url";

const SRC_DIR = resolve(fileURLToPath(import.meta.url), "../../src");
const ROUTES_DIR = join(SRC_DIR, "routes");
const SERVER_DIR = join(SRC_DIR, "server");

const FACE_TOKEN_RE = /\bchq-btn-(?:primary|secondary|tertiary)\b/;
// The bare box token, matched as its own word -- must not be satisfied by
// matching inside `chq-btn-primary` etc, hence the negative lookahead on a
// trailing hyphen.
const BOX_TOKEN_RE = /\bchq-btn\b(?!-)/;

/** Recursively lists every .tsx file under `dir`, excluding *.test.tsx. */
function listTsxFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      out.push(...listTsxFiles(full));
    } else if (entry.endsWith(".tsx") && !entry.endsWith(".test.tsx")) {
      out.push(full);
    }
  }
  return out;
}

/** Finds every `class="..."` / `className="..."` (and template-literal
 * backtick) string literal in `text`, returning the literal's inner text
 * plus its 1-based line number. */
function findClassLiterals(text: string): Array<{ value: string; lineNumber: number }> {
  const out: Array<{ value: string; lineNumber: number }> = [];
  const re = /\bclassName\s*=\s*(?:"([^"]*)"|'([^']*)'|`([^`]*)`)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const value = m[1] ?? m[2] ?? m[3] ?? "";
    const lineNumber = text.slice(0, m.index).split("\n").length;
    out.push({ value, lineNumber });
  }
  return out;
}

const dirs = [ROUTES_DIR, SERVER_DIR].filter((d) => existsSync(d));
const files = dirs.flatMap((d) => listTsxFiles(d));

describe("ssr-button-vocabulary.scan: every chq-btn-{primary,secondary,tertiary} face carries the chq-btn box", () => {
  expect(files.length).toBeGreaterThan(0);

  for (const file of files) {
    const rel = relative(SRC_DIR, file);
    const text = readFileSync(file, "utf8");
    const literals = findClassLiterals(text).filter((lit) => FACE_TOKEN_RE.test(lit.value));

    if (literals.length === 0) continue;

    it(`${rel}: every className carrying a chq-btn face also carries chq-btn`, () => {
      for (const lit of literals) {
        expect(
          BOX_TOKEN_RE.test(lit.value),
          `${rel}:${lit.lineNumber} className="${lit.value}" has a chq-btn-{primary,secondary,tertiary} ` +
            `face with no bare chq-btn box class -- a face without its box is paint with no geometry.`,
        ).toBe(true);
      }
    });
  }
});
