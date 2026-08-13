import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * Generic source-tree scanning helpers used by
 * test/list-envelope-enumeration.test.ts (DEC-480). Extracted verbatim
 * (no behavior change) so the top-level test file stays a thin assertions
 * module -- see that file's header comment for the rule these support.
 */

export function listSourceFiles(dir: string, extRe: RegExp): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      out.push(...listSourceFiles(full, extRe));
    } else if (extRe.test(entry) && !entry.endsWith(".test.ts") && !entry.endsWith(".test.tsx")) {
      out.push(full);
    }
  }
  return out;
}

export function relativePath(repoRoot: string, file: string): string {
  return file.slice(repoRoot.length + 1);
}

export function lineNumberAt(source: string, index: number): number {
  let line = 1;
  for (let i = 0; i < index; i++) {
    if (source[i] === "\n") line++;
  }
  return line;
}

/** Finds the matching close-paren for a `c.json(` call starting at
 * `openParenIndex` (the index of the '(' itself), returning the index just
 * past it. Parens are balanced independently of string/template contents
 * the same way test/query-scoping-invariant.test.ts's walker does -- good
 * enough here because no c.json(...) call in this codebase embeds a raw
 * unbalanced paren inside a string literal. */
export function findCallEnd(source: string, openParenIndex: number): number {
  let depth = 1;
  let j = openParenIndex + 1;
  while (j < source.length && depth > 0) {
    if (source[j] === "(") depth++;
    else if (source[j] === ")") depth--;
    j++;
  }
  return j;
}
