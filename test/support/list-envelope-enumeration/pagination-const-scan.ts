import { readFileSync } from "node:fs";
import { listSourceFiles, relativePath, lineNumberAt } from "./scan-utils";

/**
 * DEC-465/480 check (b): finds any DEFAULT*PER_PAGE / MAX*PER_PAGE constant
 * declaration outside src/lib/pagination.ts. Extracted verbatim (no
 * behavior change) from test/list-envelope-enumeration.test.ts.
 */

export function findStrayPerPageConstantDeclarations(
  repoRoot: string,
  paginationFile: string,
  libRoots: string[],
): string[] {
  const declRe = /\b(?:const|let|var|export\s+const)\s+((?:DEFAULT|MAX)\w*PER_PAGE\w*)\s*[:=]/gi;
  const offenders: string[] = [];
  const scanned = new Set<string>();
  for (const root of libRoots) {
    for (const file of listSourceFiles(root, /\.(ts|tsx)$/)) {
      if (scanned.has(file)) continue;
      scanned.add(file);
      if (file === paginationFile) continue;
      const source = readFileSync(file, "utf8");
      let match: RegExpExecArray | null;
      while ((match = declRe.exec(source)) !== null) {
        offenders.push(`  ${relativePath(repoRoot, file)}:${lineNumberAt(source, match.index)}: declares ${match[1]}`);
      }
    }
  }
  return offenders;
}
