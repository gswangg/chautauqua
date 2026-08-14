// DEC-006 amendment (wave 51): a catch block around mailer.send(/makeMailer(
// that swallows the failure must not leave the CALLER (and, through it, the
// page/response the caller renders) claiming a delivery that didn't happen.
// Wave 51-b fixed src/routes/public/submit.tsx's confirmation page, which
// asserted "Check your email." even when the send threw. This scan makes
// that class of bug a scanned property, not a per-wave rediscovery: every
// catch block under src/routes/** guarding a try body that calls
// mailer.send( or makeMailer( must EITHER surface the outcome to its caller
// (pushes to a failed[]-shaped array, returns a failure-bearing response
// body, or sets an emailDelivered-shaped flag consumed by the response) OR
// be ledgered in KNOWN_SWALLOWS below with a one-line reason.
//
// Two-directional, same shape as test/serial-write-scan.test.ts: an
// unledgered, unsurfaced hit fails naming file:line; a ledger entry matching
// no hit fails as stale. Deliberately a lightweight brace-matching text scan
// -- no parser dependency added.

import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = join(__dirname, "..");
const SCAN_DIR = "src/routes";
const SKIP_DIRS = new Set(["node_modules", "dist", ".wrangler", "build", ".git"]);

interface TryCatchBlock {
  tryBodyStart: number;
  tryBodyEnd: number;
  catchBodyStart: number;
  catchBodyEnd: number;
}

interface SwallowHit {
  file: string; // repo-relative path
  line: number; // 1-indexed line of the `try` keyword
  functionOrNearestExport: string;
}

function walk(dir: string, out: string[]): void {
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      walk(full, out);
    } else if (stat.isFile() && /\.(ts|tsx)$/.test(entry)) {
      out.push(full);
    }
  }
}

function matchBraceBlock(src: string, openBraceIdx: number): number {
  let depth = 1;
  let i = openBraceIdx + 1;
  while (i < src.length && depth > 0) {
    if (src[i] === "{") depth++;
    else if (src[i] === "}") depth--;
    i++;
  }
  return i; // index just past the matching close brace
}

/** Locates every `try { ... } catch (...) { ... }` block in `src`. Skips
 * `try`s not immediately followed by a `{` block, and requires a `catch`
 * (with its own `{` block) to immediately follow the try body's close brace
 * (ignoring whitespace) -- no such case (try/finally with no catch guarding
 * a mailer call) exists in this codebase's routes layer. */
function findTryCatchBlocks(src: string): { start: number; block: TryCatchBlock }[] {
  const out: { start: number; block: TryCatchBlock }[] = [];
  const re = /\btry\s*\{/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) {
    const tryOpenBrace = m.index + m[0].length - 1;
    const tryBodyStart = tryOpenBrace + 1;
    const tryBodyEnd = matchBraceBlock(src, tryOpenBrace) - 1;

    let j = tryBodyEnd + 1;
    while (j < src.length && /\s/.test(src[j] ?? "")) j++;
    const catchMatch = /^catch\s*(?:\([^)]*\))?\s*\{/.exec(src.slice(j));
    if (!catchMatch) continue; // no catch immediately following -- not our shape
    const catchOpenBrace = j + catchMatch[0].length - 1;
    const catchBodyStart = catchOpenBrace + 1;
    const catchBodyEnd = matchBraceBlock(src, catchOpenBrace) - 1;

    out.push({ start: m.index, block: { tryBodyStart, tryBodyEnd, catchBodyStart, catchBodyEnd } });
  }
  return out;
}

const MAIL_CALL = /\b(?:mailer\.send|makeMailer)\s*\(/;

// Any of these appearing in the catch body counts as "surfaces the outcome
// to the caller": a failed[]-shaped array push, a direct response with a
// failure-bearing body, or an emailDelivered/emailSent-shaped flag flip.
const SURFACE_PATTERNS = [
  /\w*[Ff]ailed\w*\.push\(/,
  /return\s+c\.json\(/,
  /\b\w*(?:Sent|Delivered)\w*\s*=\s*false\b/,
];

function catchSurfacesOutcome(catchBody: string): boolean {
  return SURFACE_PATTERNS.some((re) => re.test(catchBody));
}

const FUNCTION_DECL = /^(?:export\s+)?(?:async\s+)?function\s+([A-Za-z0-9_]+)\s*\(/;
const ROUTE_HANDLER_DECL = /\.(?:post|get|put|patch|delete)\s*\(\s*["'`][^"'`]*["'`]/;

function nearestEnclosingFunction(lines: string[], startLineIdx: number): string {
  for (let i = startLineIdx; i >= 0; i--) {
    const line = lines[i] ?? "";
    const fnMatch = FUNCTION_DECL.exec(line);
    if (fnMatch?.[1]) return fnMatch[1];
    if (ROUTE_HANDLER_DECL.test(line)) return `(route handler near line ${i + 1})`;
  }
  return "(module scope)";
}

function scanForMailSwallows(): SwallowHit[] {
  const files: string[] = [];
  const abs = join(ROOT, SCAN_DIR);
  walk(abs, files);

  const hits: SwallowHit[] = [];
  for (const file of files) {
    const src = readFileSync(file, "utf8");
    const lines = src.split("\n");
    const blocks = findTryCatchBlocks(src);

    for (const { start, block } of blocks) {
      const tryBody = src.slice(block.tryBodyStart, block.tryBodyEnd);
      if (!MAIL_CALL.test(tryBody)) continue;

      const catchBody = src.slice(block.catchBodyStart, block.catchBodyEnd);
      if (catchSurfacesOutcome(catchBody)) continue;

      const lineIdx = src.slice(0, start).split("\n").length - 1;
      hits.push({
        file: relative(ROOT, file).split("\\").join("/"),
        line: lineIdx + 1,
        functionOrNearestExport: nearestEnclosingFunction(lines, lineIdx),
      });
    }
  }
  return hits;
}

// The ledger. Every hit that doesn't surface its outcome must have exactly
// one entry here (matched on file + functionOrNearestExport, stable across
// line-number drift). A hit with no matching entry fails the scan; an entry
// matching no hit fails as a stale ledger line.
const KNOWN_SWALLOWS: { file: string; functionOrNearestExport: string; reason: string }[] = [
  {
    file: "src/routes/api/users.ts",
    functionOrNearestExport: "(route handler near line 63)",
    reason:
      "POST /api/v1/users: the welcome-email send failure is caught and logged, but the 201 response already returns the freshly generated one-time password on screen -- nothing is claimed that did not happen (the account creation itself succeeded; the welcome notice is a best-effort courtesy copy of information the caller already has in hand).",
  },
  {
    file: "src/routes/auth.tsx",
    functionOrNearestExport: "(route handler near line 777)",
    reason:
      "POST /forgot: surfacing this outcome is what DEC-014's wave-25 amendment forbids -- the anti-enumeration rule is that the response is the same 'Check your email' card whether or not a user row exists and 'never branches its response', so a send failure cannot reach the caller without also disclosing that the address resolved to an account. The failure is logged server-side, and the reset token is still minted, so a user who asks again gets a fresh link.",
  },
];

describe("mail-swallow catch blocks surface their outcome or are ledgered (DEC-006 wave 51)", () => {
  it("the scan itself finds try/catch blocks under src/routes (not vacuous)", () => {
    const files: string[] = [];
    walk(join(ROOT, SCAN_DIR), files);
    expect(files.length).toBeGreaterThan(0);
  });

  it("every catch guarding a mailer.send(/makeMailer( try body either surfaces the outcome or is ledgered", () => {
    const hits = scanForMailSwallows();
    const offenders = hits.filter(
      (hit) =>
        !KNOWN_SWALLOWS.some(
          (entry) => entry.file === hit.file && entry.functionOrNearestExport === hit.functionOrNearestExport,
        ),
    );

    expect(
      offenders,
      offenders
        .map(
          (o) =>
            `${o.file}:${o.line} (in ${o.functionOrNearestExport}) -- catch block swallows a mailer.send(/makeMailer( ` +
            `failure without surfacing the outcome to its caller. Either push to a failed[]-shaped array / return a ` +
            `failure-bearing body / set an emailDelivered-shaped flag consumed by the response, or add a ` +
            `{ file, functionOrNearestExport, reason } line to KNOWN_SWALLOWS in test/mail-swallow-honesty.scan.test.ts.`,
        )
        .join("\n"),
    ).toEqual([]);
  });

  it("every KNOWN_SWALLOWS ledger entry still matches a real hit (no stale lines)", () => {
    const hits = scanForMailSwallows();
    const stale = KNOWN_SWALLOWS.filter(
      (entry) => !hits.some((hit) => hit.file === entry.file && hit.functionOrNearestExport === entry.functionOrNearestExport),
    );

    expect(
      stale,
      stale
        .map(
          (entry) =>
            `${entry.file} / ${entry.functionOrNearestExport}: stale ledger entry -- delete this line ` +
            `(test/mail-swallow-honesty.scan.test.ts) -- no matching catch block was found by the scan.`,
        )
        .join("\n"),
    ).toEqual([]);
  });
});
