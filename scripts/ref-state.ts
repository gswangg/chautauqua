// DEC-644/DEC-069: generate the "three-sha" receipt block (HEAD, newest
// first-parent product-code-bearing sha, and per-live-ref ancestry) instead
// of hand-deriving it wave over wave. Mirrors scripts/bundle-check-lib.ts /
// scripts/bundle-check.ts: pure logic here takes injected git *output* as
// plain strings and has no node: imports, so it's directly unit-testable
// (see test/ref-state.test.ts). Only the CLI at the bottom of this file
// shells out to git.
//
// Invocation (no package.json script — this wave is frozen, no
// package.json edits allowed):
//
//   npx tsx scripts/ref-state.ts
//
// prints the receipt paragraph ready to paste into a
// docs/verification-log/index/ entry.

export const PRODUCT_PREFIXES = ["src/", "app/src/", "migrations/", "package.json"] as const;

/**
 * True if `path` falls under one of PRODUCT_PREFIXES. Directory prefixes
 * (ending in "/") match via startsWith; "package.json" matches only the
 * exact top-level file, so e.g. "packages/x" does NOT match.
 * Everything else (scripts/**, test/**, docs/**, decisions/**,
 * field-guide/**, etc.) is allow-listed non-product-bearing per DEC-069's
 * wave-28 amendment and DEC-232.
 */
export function isProductPath(path: string): boolean {
  for (const prefix of PRODUCT_PREFIXES) {
    if (prefix.endsWith("/")) {
      if (path.startsWith(prefix)) return true;
    } else if (path === prefix) {
      return true;
    }
  }
  return false;
}

const SHA_LINE = /^[0-9a-f]{40}$/;

/**
 * `log` is the output of `git log --first-parent --pretty=format:%H --name-only`.
 * Walks first-parent history (newest first, as git emits it) and returns the
 * sha of the first commit whose name-only file block contains at least one
 * product path. Returns null if no such commit exists in the log.
 */
export function newestProductBearingSha(log: string): string | null {
  const lines = log.split("\n");
  let currentSha: string | null = null;
  let currentHasProduct = false;

  const flush = (): string | null => {
    if (currentSha !== null && currentHasProduct) return currentSha;
    return null;
  };

  for (const line of lines) {
    if (SHA_LINE.test(line)) {
      const found = flush();
      if (found !== null) return found;
      currentSha = line;
      currentHasProduct = false;
      continue;
    }
    if (line.trim() === "") continue;
    if (currentSha !== null && isProductPath(line)) {
      currentHasProduct = true;
    }
  }
  return flush();
}

export interface RefAncestry {
  ref: string;
  sha: string;
  isAncestor: boolean;
}

/**
 * Emits the exact receipt paragraph shape used by wave-36 receipts, e.g.
 * docs/verification-log/index/0190-2026-08-15-task-w36-b-walkthrough-f5783479.md
 * lines 7-11. Non-ancestor refs are listed explicitly (never silently
 * omitted) — an omitted ref reads as a clean boundary.
 */
export function formatReceiptBlock(input: {
  head: string;
  productSha: string | null;
  refs: readonly RefAncestry[];
}): string {
  const { head, productSha, refs } = input;
  const ancestors = refs.filter((r) => r.isAncestor);
  const nonAncestors = refs.filter((r) => !r.isAncestor);

  const productShaText = productSha === null ? "none found in first-parent history" : `\`${productSha}\``;

  const ancestorText =
    ancestors.length === 0
      ? "no live refs confirmed"
      : `every live ref (${ancestors.map((r) => `\`${r.ref}\``).join(", ")}) confirmed an ancestor of HEAD via \`git merge-base --is-ancestor\``;

  const nonAncestorText =
    nonAncestors.length === 0
      ? "NON-ancestor refs: none."
      : `NON-ancestor refs (NOT confirmed via \`git merge-base --is-ancestor\`): ${nonAncestors
          .map((r) => `\`${r.ref}\``)
          .join(", ")}.`;

  return (
    `DEC-644 three-sha boundary: HEAD \`${head}\`; newest first-parent ` +
    `product-code-bearing sha ${productShaText}; ${ancestorText}. ${nonAncestorText}`
  );
}

async function main(): Promise<void> {
  const { execFileSync } = await import("node:child_process");

  const run = (args: string[]): string => execFileSync("git", args, { encoding: "utf8" });

  const head = run(["rev-parse", "HEAD"]).trim();
  const log = run(["log", "--first-parent", "--pretty=format:%H", "--name-only"]);
  const productSha = newestProductBearingSha(log);

  const forEachRefOutput = run(["for-each-ref", "--format=%(objectname) %(refname:short)", "refs/heads"]);
  const refLines = forEachRefOutput
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const refs: RefAncestry[] = refLines.map((line) => {
    const [sha, ...refParts] = line.split(" ");
    const ref = refParts.join(" ");
    if (!sha || !ref) {
      throw new Error(`ref-state: unparseable for-each-ref line: ${JSON.stringify(line)}`);
    }
    let isAncestor: boolean;
    try {
      execFileSync("git", ["merge-base", "--is-ancestor", sha, head], { encoding: "utf8" });
      isAncestor = true;
    } catch {
      isAncestor = false;
    }
    return { ref, sha, isAncestor };
  });

  console.log(formatReceiptBlock({ head, productSha, refs }));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error(err instanceof Error ? err.message : String(err));
    process.exitCode = 1;
  });
}
