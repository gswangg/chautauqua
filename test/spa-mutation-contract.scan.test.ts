// DEC-817 amendment (findings wave 13, widened wave 53): the admin SPA and
// its routes are ONE contract, graded executably. Two controls shipped a key
// their route never parsed (PATCH /submissions/:id's `audienceLevel`, PATCH
// .../participants/:participantId's `role` -- both fixed by task-w13-a, on
// which this scan depends to be green), and nothing anywhere compared the
// two sides. A THIRD defect (the user-filed prod P1: "No route matches
// DELETE /api/v1/submissions/:id/participants/:pid") happened because the
// original scan read only apiPost/apiPatch/apiPut and resolved paths through
// a hand-written ROUTE_MODULE_MAP -- a hand-listed population. Wave 53
// widened both: every api* helper is scanned, and resolution goes through
// resolveRegisteredRoute (test/helpers/registered-routes.ts), derived from
// the REAL route table in src/routes/**. This scan re-derives the
// population at test time, from the SPA's own source:
//
//   1. Walk app/src/**/*.{ts,tsx} (excluding *.test.ts(x) -- those exercise
//      the api client itself against synthetic paths that are not live
//      routes, e.g. app/src/lib/useNavExceptions.test.tsx's
//      '/events/ev-1/agenda/resolve', which no route in src/routes/ serves).
//      For every call to apiGet/apiList/apiPost/apiPatch/apiPut/apiDelete/
//      apiUpload/apiPostBlob (an optional `<...>` generic is skipped),
//      extract the request path (relative to API_PREFIX, `/api/v1`, query
//      string and fragment stripped) and -- when the second argument is a
//      literal object `{...}` -- the object's TOP-LEVEL keys.
//   2. Resolve each extracted method+path to its registered route via
//      resolveRegisteredRoute. A path that resolves to no route FAILS the
//      test, naming file:line -- an unresolved path is a hole in the
//      grader, not a pass, unless it is recorded in the UNBUILT_ENDPOINTS
//      array below with a written reason.
//   3. Assert every extracted key appears as a token in that route's own
//      module source, plus that module's one-level relative imports (a
//      simple `\bkey\b` search over the raw file text -- not a real parse,
//      so a key that only appears in a comment would also "pass"; this
//      repo's other *.scan.test.ts files accept the same text-scan honesty
//      tradeoff, e.g. test/route-authz-enumeration.scan.test.ts).
//
// What this scan deliberately does NOT see (so a green run is never mistaken
// for a total proof):
//   - Computed request bodies: a second argument that is not itself a `{`
//     literal. DEC-817's wave-80 amendment resolves what's STATICALLY
//     resolvable -- a ternary whose both branches are `{...}` literals
//     (ResourcesPanel.tsx's `isWiki ? {...} : {...}`), a bare identifier
//     assigned `const x = {...}` in the call's own enclosing function
//     (PlanEditor.tsx's `const body = {...}; ...; apiPost(path, body)`),
//     and a call to a function DECLARED IN THE SAME FILE whose body
//     contains a `return {...}` -- and ledgers the irreducible remainder
//     structurally in UNCHECKED_BODIES below (a function PARAMETER with no
//     in-scope literal assignment, a builder imported from another file,
//     a same-file builder that mutates a local instead of returning a
//     literal, a ternary where either branch isn't a bare object literal).
//     apiUpload's FormData body is ruled out of this check entirely, by
//     kind, in findMutationCalls -- multipart, not JSON, so there is no
//     JSON key to check a route's JSON-body parser against.
//   - Spread and conditional-spread entries inside an otherwise-literal
//     object (`...request`, `...(cond ? { a } : {})`) -- skipped with a
//     `SPREAD_SKIPPED` marker rather than resolved, because their keys are
//     not statically knowable from this text scan. Enumerated (not just
//     floored above zero) in SPREAD_COMPUTED_KEY_ENTRIES below.
//   - Computed keys (`{ [which]: today }`) -- skipped with a
//     `COMPUTED_KEY_SKIPPED` marker for the same reason. Same ledger as
//     the spread entries above.
//   - Keys added to the request body by a helper the SPA calls before
//     apiPost/apiPatch/apiPut, where that helper is not itself resolvable
//     by the rules above (imported from another file, or builds its result
//     via mutation rather than a literal return).
//   - Whether the route's own body PARSER actually reads/validates a
//     matched key correctly (only that the token appears somewhere in the
//     module's source) -- a key present only in a comment, or read but
//     silently ignored deeper in the handler, is not caught here.
//
// A regex/scan over source text, exactly as the sibling *.scan.test.ts files
// in this repo already do (test/route-authz-enumeration.scan.test.ts,
// test/file-delete-ordering.scan.test.ts) -- not a real TypeScript parse.

import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { resolveRegisteredRoute } from "./helpers/registered-routes";

const ROOT = join(__dirname, "..");
const APP_SRC = join(ROOT, "app", "src");
const SKIP_DIRS = new Set(["node_modules", "dist", ".wrangler", "build", ".git"]);

// ---------------------------------------------------------------------------
// stripComments -- copied verbatim from test/route-authz-enumeration.scan.
// test.ts (itself copied verbatim from test/file-delete-ordering.scan.test.
// ts, plus that file's own JSX-apostrophe and regex-literal amendments) so
// line numbers stay accurate and this file carries no second, drifting copy
// of the same lexing edge cases.
// ---------------------------------------------------------------------------
function stripComments(src: string): string {
  let out = "";
  let i = 0;
  const n = src.length;
  while (i < n) {
    const c = src[i];
    const c2 = i + 1 < n ? src[i + 1] : "";
    if (c === "/" && c2 === "/") {
      while (i < n && src[i] !== "\n") {
        out += " ";
        i++;
      }
      continue;
    }
    if (c === "/" && c2 === "*") {
      out += "  ";
      i += 2;
      while (i < n && !(src[i] === "*" && src[i + 1] === "/")) {
        out += src[i] === "\n" ? "\n" : " ";
        i++;
      }
      if (i < n) {
        out += "  ";
        i += 2;
      }
      continue;
    }
    if (c === "'" && /[A-Za-z0-9_]/.test(src[i - 1] ?? "")) {
      out += c;
      i++;
      continue;
    }
    if (c === "/" && c2 !== "/" && c2 !== "*") {
      const prevSignificant = out.trimEnd().slice(-1);
      const isRegexContext = prevSignificant === "" || "(,=:[!&|?;{+-*%^~".includes(prevSignificant);
      if (isRegexContext) {
        let j = i + 1;
        let inClass = false;
        let closed = false;
        while (j < n && src[j] !== "\n") {
          if (src[j] === "\\" && j + 1 < n) {
            j += 2;
            continue;
          }
          if (src[j] === "[") {
            inClass = true;
            j++;
            continue;
          }
          if (src[j] === "]") {
            inClass = false;
            j++;
            continue;
          }
          if (src[j] === "/" && !inClass) {
            j++;
            closed = true;
            break;
          }
          j++;
        }
        if (closed) {
          while (j < n && /[a-z]/i.test(src[j] ?? "")) j++;
          out += "x".repeat(j - i);
          i = j;
          continue;
        }
      }
    }
    if (c === '"' || c === "'" || c === "`") {
      const quote = c;
      out += c;
      i++;
      while (i < n && src[i] !== quote) {
        if (src[i] === "\\" && i + 1 < n) {
          out += (src[i] ?? "") + (src[i + 1] ?? "");
          i += 2;
          continue;
        }
        out += src[i];
        i++;
      }
      if (i < n) {
        out += src[i];
        i++;
      }
      continue;
    }
    out += c;
    i++;
  }
  return out;
}

function walk(dir: string, out: string[]): void {
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      walk(full, out);
    } else if (/\.(ts|tsx)$/.test(entry) && !/\.test\.(ts|tsx)$/.test(entry)) {
      out.push(full);
    }
  }
}

/** Finds the index of the `)`/`}` matching the open bracket at `openIdx`
 * (whatever character is AT openIdx), walking the source and skipping over
 * string/template literal contents so a bracket inside a literal can't
 * desynchronize the count. Handles (), [], {} uniformly via a single depth
 * counter -- callers only ever nest one bracket family for our purposes
 * (an object literal's `{...}`, or a call's `(...)`), and any of the other
 * two families can legally appear (balanced) inside either. */
function findMatchingBracket(src: string, openIdx: number): number {
  const OPEN = "([{";
  const CLOSE = ")]}";
  const open = src[openIdx]!;
  const openPos = OPEN.indexOf(open);
  if (openPos === -1) throw new Error(`not an open bracket at ${openIdx}: ${JSON.stringify(open)}`);
  const close = CLOSE[openPos]!;
  let depth = 0;
  let i = openIdx;
  const n = src.length;
  while (i < n) {
    const c = src[i];
    if (c === open) {
      depth++;
    } else if (c === close) {
      depth--;
      if (depth === 0) return i;
    } else if (OPEN.includes(c ?? "") && c !== open) {
      // A different bracket family opening inside -- skip its whole balanced
      // span in one jump so its interior can't be mistaken for `open`/`close`
      // occurrences of the outer family (relevant when the outer family is
      // `{` and the inner is `(...)` containing a nested object literal, or
      // vice versa).
      i = findMatchingBracket(src, i);
    } else if (c === '"' || c === "'" || c === "`") {
      const quote = c;
      i++;
      while (i < n && src[i] !== quote) {
        if (src[i] === "\\" && i + 1 < n) i++;
        i++;
      }
    }
    i++;
  }
  throw new Error(`unbalanced brackets starting at index ${openIdx}`);
}

/** Reads a string/template literal starting at `quoteIdx` (the index OF the
 * opening quote char), returning its raw (unescaped) contents. */
function readStringLiteral(src: string, quoteIdx: number): string {
  const quote = src[quoteIdx];
  let i = quoteIdx + 1;
  let out = "";
  while (i < src.length && src[i] !== quote) {
    if (src[i] === "\\" && i + 1 < src.length) {
      out += src[i + 1];
      i += 2;
      continue;
    }
    out += src[i];
    i++;
  }
  return out;
}

/** Splits `text` on top-level commas -- depth-tracked across (), [], {} and
 * string/template literal contents, so a comma inside a nested call/object/
 * array/string is never mistaken for an argument or entry separator. */
function splitTopLevel(text: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let start = 0;
  let i = 0;
  const n = text.length;
  while (i < n) {
    const c = text[i];
    if (c === "(" || c === "[" || c === "{") {
      depth++;
    } else if (c === ")" || c === "]" || c === "}") {
      depth--;
    } else if (c === '"' || c === "'" || c === "`") {
      const quote = c;
      i++;
      while (i < n && text[i] !== quote) {
        if (text[i] === "\\" && i + 1 < n) i++;
        i++;
      }
    } else if (c === "," && depth === 0) {
      out.push(text.slice(start, i));
      start = i + 1;
    }
    i++;
  }
  const last = text.slice(start);
  if (last.trim() !== "") out.push(last);
  return out;
}

interface MutationCall {
  file: string; // repo-relative path
  line: number; // 1-indexed line of the call
  method: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  path: string; // API_PREFIX-joined, normalized: ${...} segments become ":param", query/fragment stripped
  keys: string[];
  skipped: { kind: "spread" | "computed-key"; text: string }[];
}

// DEC-817 wave-80 amendment: the BODY-side counterpart of `SkippedPath` --
// a call whose second argument is not a bare `{` literal AND that this scan
// could not statically resolve down to one anyway (see `resolveComputedBody`
// below). Recorded rather than silently treated as `keys: []` (i.e. "checked,
// found nothing"), which is exactly the hole the amendment closes.
interface UncheckedBody {
  file: string; // repo-relative path
  line: number; // 1-indexed line of the call
  kind: "identifier" | "call" | "ternary" | "other";
  text: string; // raw source text of the second argument, truncated
}

// DEC-817 wave-80 amendment: mirrors `buildUnresolvableKey` exactly --
// location-independent (no `line`), discriminating on file + kind + the
// exact expression text, so a blank line inserted above the call can't
// change the key and a renamed/removed expression produces a DIFFERENT key.
function buildUncheckedBodyKey(u: UncheckedBody): string {
  return `${u.file} ${u.kind}: ${u.text}`;
}

// DEC-817's wave-57 amendment: the PATH side of this scan silently dropped
// three shapes the BODY side is scrupulous about -- a call whose first
// argument isn't a string literal, an api* identifier not actually followed
// by a call, and a `${...}` span normalizePath erases with no record. Each
// site now pushes here instead of a bare `continue`, so a hole in the path
// side is as visible as a hole in the body side already was.
interface SkippedPath {
  file: string; // repo-relative path
  line: number; // 1-indexed line of the call (or identifier, for not-a-call)
  reason: "non-literal-path" | "not-a-call" | "interpolation-erased";
  text: string; // raw source text at the site, truncated to a readable length
}

// DEC-967 wave-62 amendment: the ONLY place a `SkippedPath` is turned into an
// UNRESOLVABLE_PATHS ledger key -- deliberately excludes `line` so the key
// is location-independent (surviving lines inserted/removed above the
// exempted call) while still discriminating on file + reason + the exact
// exempted expression text (so a renamed/removed expression produces a
// DIFFERENT key and falls out of the ledger, per the falsifiability controls
// below).
function buildUnresolvableKey(s: SkippedPath): string {
  return `${s.file} ${s.reason}: ${s.text}`;
}

function truncate(text: string, max = 80): string {
  const t = text.trim();
  return t.length > max ? `${t.slice(0, max)}...` : t;
}

/** True when `raw` contains a `${...}` interpolation span NOT immediately
 * preceded by "/" -- the exact shape normalizePath erases silently (see its
 * comment: a trailing computed query string tacked onto the last segment).
 * Duplicated (rather than having normalizePath itself report it) so
 * normalizePath stays a pure string->string function callable from anywhere
 * this file needs a normalized path, including the synthetic controls below. */
function hasErasedInterpolation(raw: string): boolean {
  const stripped = raw.split("?")[0]!.split("#")[0]!;
  let found = false;
  stripped.replace(/(\/)?\$\{[^}]*\}/g, (_match: string, slash: string | undefined) => {
    if (!slash) found = true;
    return "";
  });
  return found;
}

// DEC-817's wave-53 amendment: every api* helper, not just the three that
// carry a JSON body -- an SPA call to a path no route serves is the exact P1
// class (apiDelete's Remove co-presenter), and it can't be seen by scanning
// only the body-bearing verbs.
const CALL_NAME_RE = /\b(apiGet|apiList|apiPost|apiPatch|apiPut|apiDelete|apiUpload|apiPostBlob)\b/g;

const CALL_NAME_TO_METHOD: Record<string, MutationCall["method"]> = {
  apiGet: "GET",
  apiList: "GET",
  apiPost: "POST",
  apiUpload: "POST",
  apiPostBlob: "POST",
  apiPatch: "PATCH",
  apiPut: "PUT",
  apiDelete: "DELETE",
};

// app/src/lib/api.ts's API_PREFIX -- every api* call's path is relative to
// this; the real route table (test/helpers/registered-routes.ts) reports
// full mounted paths that already carry it (src/index.ts mounts every
// api/* sub-app at "/api/v1").
const API_PREFIX = "/api/v1";

function normalizePath(raw: string): string {
  const stripped = raw.split("?")[0]!.split("#")[0]!;
  // A `${...}` span immediately preceded by "/" opens a new path segment --
  // a genuine route param (e.g. `/fields/${id}`) -- and becomes ":param".
  // A `${...}` span NOT preceded by "/" is tacked onto the end of the
  // previous literal segment with no separator (e.g.
  // `` `/events/${eventId}/submissions${qs}` `` where `qs` is a
  // caller-built computed query string, not a path segment) -- this scan
  // can't know its runtime shape, so it's dropped rather than guessed at,
  // the same "invisible to this scan" treatment as any other computed
  // value (see the file header).
  return (
    API_PREFIX +
    stripped.replace(/(\/)?\$\{[^}]*\}/g, (_match, slash) => (slash ? "/:param" : ""))
  );
}

/** Extracts the top-level keys of an object-literal body (the text strictly
 * between the outer `{` and its matching `}`, exclusive of both braces).
 * Spread and computed-key entries are recorded in `skipped` rather than
 * resolved -- see the file header. */
function extractObjectKeys(inner: string): { keys: string[]; skipped: MutationCall["skipped"] } {
  const keys: string[] = [];
  const skipped: MutationCall["skipped"] = [];
  for (const rawEntry of splitTopLevel(inner)) {
    const entry = rawEntry.trim();
    if (entry === "") continue;
    if (entry.startsWith("...")) {
      skipped.push({ kind: "spread", text: entry });
      continue;
    }
    if (entry.startsWith("[")) {
      skipped.push({ kind: "computed-key", text: entry });
      continue;
    }
    if (entry[0] === '"' || entry[0] === "'" || entry[0] === "`") {
      keys.push(readStringLiteral(entry, 0));
      continue;
    }
    const m = /^[A-Za-z_$][\w$]*/.exec(entry);
    if (m) {
      keys.push(m[0]);
      continue;
    }
    // Not a recognized entry shape (e.g. a trailing empty slice) -- ignore.
  }
  return { keys, skipped };
}

// An `import { apiGet, apiPost, ... } from "..."` specifier list is a
// structurally distinguishable non-call occurrence of an api* identifier --
// not the ambiguous "re-export vs. parse failure" case the not-a-call
// finding below exists to surface. Every api* call site's file imports the
// helpers it uses, so without this exclusion every such import line would
// fire one not-a-call finding per named import, drowning any genuine
// ambiguous case in noise. Computed once per file, over the same
// comment-stripped `src` the call scan itself walks.
const IMPORT_STMT_RE = /import\s+(?:type\s+)?\{[\s\S]*?\}\s*from\s*["'][^"']*["']/g;

function importSpans(src: string): Array<[number, number]> {
  const spans: Array<[number, number]> = [];
  let m: RegExpExecArray | null;
  IMPORT_STMT_RE.lastIndex = 0;
  while ((m = IMPORT_STMT_RE.exec(src))) {
    spans.push([m.index, m.index + m[0].length]);
  }
  return spans;
}

function insideAnySpan(idx: number, spans: Array<[number, number]>): boolean {
  return spans.some(([start, end]) => idx >= start && idx < end);
}

/** Finds the index (within `text`) of the first top-level (depth-0, outside
 * any string/template literal) occurrence of `target` at or after `from` --
 * used to locate a ternary's `?`/`:` without being fooled by a `?`/`:`
 * nested inside a call, array, or object appearing in a branch. A `?`
 * immediately followed by `.` (optional chaining) never counts as a
 * ternary `?`. */
function findTopLevelChar(text: string, target: string, from: number): number {
  let depth = 0;
  let i = from;
  const n = text.length;
  while (i < n) {
    const c = text[i];
    if (c === "(" || c === "[" || c === "{") {
      depth++;
    } else if (c === ")" || c === "]" || c === "}") {
      depth--;
    } else if (c === '"' || c === "'" || c === "`") {
      const quote = c;
      i++;
      while (i < n && text[i] !== quote) {
        if (text[i] === "\\" && i + 1 < n) i++;
        i++;
      }
    } else if (depth === 0 && c === target && !(target === "?" && text[i + 1] === ".")) {
      return i;
    }
    i++;
  }
  return -1;
}

/** DEC-817 wave-80 amendment, resolution (a): a ternary whose BOTH branches
 * are bare object literals (`cond ? { ... } : { ... }`) resolves to the
 * union of both branches' keys -- ResourcesPanel.tsx's
 * `isWiki ? { title, content } : { title }` is the motivating case. A
 * ternary where either branch is anything else (a variable, `undefined`,
 * a nested ternary) is NOT resolved here -- it falls through to the
 * UncheckedBody ledger as kind "ternary", same as any other computed shape
 * this scan can't prove statically. */
function tryResolveTernaryOfObjects(bodyArg: string): { keys: string[]; skipped: MutationCall["skipped"] } | undefined {
  const qIdx = findTopLevelChar(bodyArg, "?", 0);
  if (qIdx === -1) return undefined;
  const colonIdx = findTopLevelChar(bodyArg, ":", qIdx + 1);
  if (colonIdx === -1) return undefined;
  const trueBranch = bodyArg.slice(qIdx + 1, colonIdx).trim();
  const falseBranch = bodyArg.slice(colonIdx + 1).trim();
  if (trueBranch[0] !== "{" || falseBranch[0] !== "{") return undefined;
  const trueClose = findMatchingBracket(trueBranch, 0);
  const falseClose = findMatchingBracket(falseBranch, 0);
  // Each branch must be EXACTLY a `{...}` literal with nothing trailing --
  // otherwise it's not the two-object-literal shape this rule resolves.
  if (trueBranch.slice(trueClose + 1).trim() !== "" || falseBranch.slice(falseClose + 1).trim() !== "") return undefined;
  const a = extractObjectKeys(trueBranch.slice(1, trueClose));
  const b = extractObjectKeys(falseBranch.slice(1, falseClose));
  const keySet = new Set<string>([...a.keys, ...b.keys]);
  return { keys: [...keySet], skipped: [...a.skipped, ...b.skipped] };
}

/** Enumerates every function-BODY span (`[bodyOpenBraceIdx, bodyCloseBraceIdx]`)
 * in `src`: `function foo(...) { ... }`, `const foo = (...) => { ... }`,
 * `const foo = async (...) => { ... }`, `const foo = function(...) { ... }`.
 * Arrow functions with an implicit-return expression body (no `{`) are not
 * function-BODY spans and are correctly absent. Used to find the nearest
 * enclosing function of a call site, so identifier resolution (below) can't
 * cross into an unrelated sibling function that happens to declare a
 * same-named local (PlanEditor.tsx has three distinct `const body = {...}`/
 * `const body: X = {...}` locals across three different functions). */
function enumerateFunctionBodySpans(src: string): Array<[number, number]> {
  const spans: Array<[number, number]> = [];
  const declRe = /\bfunction\s+[A-Za-z_$][\w$]*\s*\(|\b(?:const|let)\s+[A-Za-z_$][\w$]*\s*(?::[^=]+)?=\s*(?:async\s*)?(?:function\s*)?\(/g;
  let m: RegExpExecArray | null;
  while ((m = declRe.exec(src))) {
    const parenIdx = src.indexOf("(", m.index);
    if (parenIdx === -1) continue;
    let closeParenIdx: number;
    try {
      closeParenIdx = findMatchingBracket(src, parenIdx);
    } catch {
      continue;
    }
    const rest = src.slice(closeParenIdx + 1, closeParenIdx + 200);
    const arrowRel = rest.search(/=>/);
    const braceRel = rest.indexOf("{");
    let bodyOpen = -1;
    if (arrowRel !== -1 && (braceRel === -1 || arrowRel < braceRel)) {
      let j = closeParenIdx + 1 + arrowRel + 2;
      while (j < src.length && /\s/.test(src[j] ?? "")) j++;
      if (src[j] === "{") bodyOpen = j;
      // else: implicit-return arrow (no block body) -- not a function-BODY
      // span, correctly skipped.
    } else if (braceRel !== -1) {
      bodyOpen = closeParenIdx + 1 + braceRel;
    }
    if (bodyOpen === -1) continue;
    let bodyClose: number;
    try {
      bodyClose = findMatchingBracket(src, bodyOpen);
    } catch {
      continue;
    }
    spans.push([bodyOpen, bodyClose]);
  }
  return spans;
}

/** The smallest function-body span in `spans` that strictly contains `pos`
 * -- the nearest enclosing function -- or `undefined` if `pos` is at module
 * top level (inside no function body at all). */
function enclosingFunctionSpan(spans: Array<[number, number]>, pos: number): [number, number] | undefined {
  let best: [number, number] | undefined;
  for (const span of spans) {
    const [s, e] = span;
    if (s < pos && pos < e) {
      if (!best || e - s < best[1] - best[0]) best = span;
    }
  }
  return best;
}

/** DEC-817 wave-80 amendment, resolution (b): a bare identifier second
 * argument (`apiPatch(path, body)`) resolves when the call's OWN nearest
 * enclosing function declares `const body = { ... }` / `let body: X =
 * { ... }` (the nearest such declaration textually preceding the call,
 * WITHIN that same enclosing function) -- PlanEditor.tsx's
 * `const body = {...}; ... apiPost(path, body)` is the motivating case.
 * Scoped to the enclosing function (not "anywhere earlier in the file") so
 * a same-named local in an unrelated sibling function can never be picked
 * up by mistake -- PlanEditor.tsx alone declares three distinct `body`
 * locals in three different functions; picking the textually-nearest one
 * with no scope check would silently attach the wrong function's keys to
 * this call (verified: it would have attached duplicatePlan's
 * name/openDate/closeDate/scale/criteria/maxEvaluations to
 * postReviewerAssignment's actual userId/trackId/submissionId body, and the
 * key-check test would not have caught it -- a false pass, not a hole this
 * scan should ever produce). A declaration whose right-hand side is not
 * itself a `{` literal (e.g. `const patch = buildEventPatch(...)`, `const
 * [draft] = useState(...)`) does not match this rule -- it falls through to
 * the ledger. */
function resolveIdentifierObjectLiteral(src: string, ident: string, callPos: number): { keys: string[]; skipped: MutationCall["skipped"] } | undefined {
  const spans = enumerateFunctionBodySpans(src);
  const enclosing = enclosingFunctionSpan(spans, callPos);
  const searchFrom = enclosing ? enclosing[0] : 0;

  const declRe = new RegExp(`\\b(?:const|let)\\s+${ident}\\b[^=;{}]*=\\s*\\{`, "g");
  let m: RegExpExecArray | null;
  let last: RegExpExecArray | null = null;
  while ((m = declRe.exec(src))) {
    // Only a declaration TEXTUALLY BEFORE the call, AND within the call's
    // own nearest enclosing function (or, if the call is at module top
    // level, anywhere before it), qualifies.
    if (m.index >= searchFrom && m.index < callPos) last = m;
  }
  if (!last) return undefined;
  const braceIdx = last.index + last[0].length - 1;
  const closeIdx = findMatchingBracket(src, braceIdx);
  const inner = src.slice(braceIdx + 1, closeIdx);
  return extractObjectKeys(inner);
}

/** DEC-817 wave-80 amendment, resolution (c): a call to a function DECLARED
 * IN THE SAME FILE (`function foo(...) {...}`, `const foo = (...) => {...}`,
 * `const foo = function(...) {...}`) whose body contains a `return { ... }`
 * statement resolves to that literal's keys. A function whose body builds
 * the object via property assignment and returns a bare identifier (e.g.
 * ComposeWizard.tsx's `composeBody`, which does `base.foo = ...; return
 * base;`) does NOT match -- there is no `return {` for this rule to find --
 * and correctly falls through to the ledger: this scan proves what a
 * literal states, never what a sequence of mutations implies. A function
 * imported from another file (EventSwitcher.tsx's `buildNewEventPayload`,
 * PortalSettingsPanel.tsx's `buildPortalSettingsPayload`) is invisible to
 * this rule by construction -- there is no same-file declaration to find. */
function resolveSameFileFunctionReturnLiteral(src: string, fnName: string): { keys: string[]; skipped: MutationCall["skipped"] } | undefined {
  const fnDeclRe = new RegExp(`\\bfunction\\s+${fnName}\\s*\\(|\\b(?:const|let)\\s+${fnName}\\s*=\\s*(?:function\\s*)?\\(`, "g");
  fnDeclRe.lastIndex = 0;
  const m = fnDeclRe.exec(src);
  if (!m) return undefined;
  const parenIdx = m.index + m[0].length - 1;
  const closeParenIdx = findMatchingBracket(src, parenIdx);
  const braceIdx = src.indexOf("{", closeParenIdx + 1);
  if (braceIdx === -1) return undefined;
  const bodyClose = findMatchingBracket(src, braceIdx);
  const bodyText = src.slice(braceIdx + 1, bodyClose);
  const returnMatch = /\breturn\s*\{/.exec(bodyText);
  if (!returnMatch) return undefined;
  const objOpenRel = returnMatch.index + returnMatch[0].length - 1;
  const objCloseRel = findMatchingBracket(bodyText, objOpenRel);
  const inner = bodyText.slice(objOpenRel + 1, objCloseRel);
  return extractObjectKeys(inner);
}

/** Dispatches a non-`{`-literal body argument to the three resolution rules
 * in turn; `undefined` means genuinely unresolvable by this scan (becomes
 * an UncheckedBody ledger entry). */
function resolveComputedBody(src: string, bodyArg: string, callPos: number): { keys: string[]; skipped: MutationCall["skipped"] } | undefined {
  const ternary = tryResolveTernaryOfObjects(bodyArg);
  if (ternary) return ternary;
  if (/^[A-Za-z_$][\w$]*$/.test(bodyArg)) {
    return resolveIdentifierObjectLiteral(src, bodyArg, callPos);
  }
  const callMatch = /^([A-Za-z_$][\w$]*)\(/.exec(bodyArg);
  if (callMatch && bodyArg.endsWith(")")) {
    return resolveSameFileFunctionReturnLiteral(src, callMatch[1]!);
  }
  return undefined;
}

/** Classifies a body argument shape this scan could not resolve, purely for
 * the UncheckedBody ledger's `kind` column -- never used to decide whether
 * to resolve, only to label what's left. */
function classifyBodyShape(bodyArg: string): UncheckedBody["kind"] {
  if (/^[A-Za-z_$][\w$]*$/.test(bodyArg)) return "identifier";
  if (/^[A-Za-z_$][\w$]*\(/.test(bodyArg) && bodyArg.endsWith(")")) return "call";
  if (findTopLevelChar(bodyArg, "?", 0) !== -1) return "ternary";
  return "other";
}

function findMutationCalls(
  file: string,
  rawSrc: string,
): { calls: MutationCall[]; skippedPaths: SkippedPath[]; uncheckedBodies: UncheckedBody[] } {
  const src = stripComments(rawSrc);
  const out: MutationCall[] = [];
  const skippedPaths: SkippedPath[] = [];
  const uncheckedBodies: UncheckedBody[] = [];
  const relFile = relative(ROOT, file).split("\\").join("/");
  const importedSpans = importSpans(src);
  let match: RegExpExecArray | null;
  CALL_NAME_RE.lastIndex = 0;
  while ((match = CALL_NAME_RE.exec(src))) {
    if (insideAnySpan(match.index, importedSpans)) continue; // an import specifier, not a call site -- structurally distinguishable, not the ambiguous not-a-call case
    const name = match[1] as keyof typeof CALL_NAME_TO_METHOD;
    const lineIdx = src.slice(0, match.index).split("\n").length - 1;
    let j = match.index + name.length;
    while (j < src.length && /\s/.test(src[j] ?? "")) j++;
    // Optional `<...>` generic -- a simple balanced-angle-bracket skip (the
    // generics this codebase's call sites use are plain type literals with
    // no nested `(` inside).
    if (src[j] === "<") {
      let depth = 0;
      while (j < src.length) {
        if (src[j] === "<") depth++;
        else if (src[j] === ">") {
          depth--;
          if (depth === 0) {
            j++;
            break;
          }
        }
        j++;
      }
      while (j < src.length && /\s/.test(src[j] ?? "")) j++;
    }
    if (src[j] !== "(") {
      // Not actually a call -- e.g. a re-export name. Legitimate, but a parse
      // failure (this scan losing track of a real call) would look identical
      // from here, so it's recorded rather than silently dropped.
      skippedPaths.push({
        file: relFile,
        line: lineIdx + 1,
        reason: "not-a-call",
        text: truncate(src.slice(match.index, Math.min(match.index + 80, src.length))),
      });
      continue;
    }
    const openParenIdx = j;
    const closeParenIdx = findMatchingBracket(src, openParenIdx);
    const argsText = src.slice(openParenIdx + 1, closeParenIdx);
    const args = splitTopLevel(argsText);
    const pathArg = (args[0] ?? "").trim();
    if (pathArg[0] !== '"' && pathArg[0] !== "'" && pathArg[0] !== "`") {
      // Computed path (a variable, a ternary, a function result) -- invisible
      // to this scan's route-resolution check, recorded rather than dropped.
      skippedPaths.push({
        file: relFile,
        line: lineIdx + 1,
        reason: "non-literal-path",
        text: truncate(pathArg),
      });
      continue;
    }
    const rawPath = readStringLiteral(pathArg, 0);
    if (!rawPath.startsWith("/")) continue;
    if (hasErasedInterpolation(rawPath)) {
      skippedPaths.push({
        file: relFile,
        line: lineIdx + 1,
        reason: "interpolation-erased",
        text: truncate(rawPath),
      });
    }
    const path = normalizePath(rawPath);

    const bodyArg = (args[1] ?? "").trim();
    let keys: string[] = [];
    let skipped: MutationCall["skipped"] = [];
    if (bodyArg !== "" && bodyArg[0] === "{") {
      // bodyArg[0] is '{' at index 0 of bodyArg (after trimming), but bodyArg
      // is a slice of argsText (itself a slice of src) -- re-locate the real
      // '{' inside `src` via argsOffsetOfIndex (which reuses the SAME depth-
      // tracking splitTopLevel already used to produce `args`, so it can't
      // drift from what `args[1]` actually is) rather than a string search
      // (an object body can legitimately repeat substrings elsewhere in
      // argsText).
      const secondArgOffsetInArgsText = argsOffsetOfIndex(argsText, 1);
      const braceIdxInSrc = openParenIdx + 1 + secondArgOffsetInArgsText + (args[1]!.indexOf("{"));
      const closeBraceIdx = findMatchingBracket(src, braceIdxInSrc);
      const inner = src.slice(braceIdxInSrc + 1, closeBraceIdx);
      const extracted = extractObjectKeys(inner);
      keys = extracted.keys;
      skipped = extracted.skipped;
    } else if (bodyArg !== "" && name === "apiUpload") {
      // DEC-817 wave-80 amendment: apiUpload's body is always a FormData
      // instance (multipart, not JSON) -- ruled out of the key check BY
      // KIND, in this one place, rather than falling into the
      // identifier/call resolution rules below (which would either
      // misfire or, more likely, just dump every apiUpload call into the
      // UncheckedBody ledger for a reason that isn't really "unresolved",
      // it's "not applicable": a multipart body has no JSON keys to check
      // a route's JSON-body parser against in the first place.
    } else if (bodyArg !== "") {
      // The identifier-resolution rule below must only consider a
      // declaration TEXTUALLY BEFORE this call site -- otherwise a same-
      // named local in an unrelated, later-declared function (PlanEditor.tsx
      // has three distinct `const body = {...}`/`const body: X = {...}`
      // locals across three functions) could resolve against the WRONG
      // scope's literal. `callPos` is the position, in `src`, of this
      // call's second argument -- the same offset arithmetic the literal-
      // object branch above already uses to relocate `args[1]` into `src`.
      const secondArgOffsetInArgsText = argsOffsetOfIndex(argsText, 1);
      const callPos = openParenIdx + 1 + secondArgOffsetInArgsText;
      const resolved = resolveComputedBody(src, bodyArg, callPos);
      if (resolved) {
        keys = resolved.keys;
        skipped = resolved.skipped;
      } else {
        uncheckedBodies.push({
          file: relFile,
          line: lineIdx + 1,
          kind: classifyBodyShape(bodyArg),
          text: truncate(bodyArg),
        });
      }
    }
    // No body -- the path is still resolved and checked (that's the whole
    // point of the widened scan); only the key check is invisible for an
    // absent body.

    out.push({
      file: relFile,
      line: lineIdx + 1,
      method: CALL_NAME_TO_METHOD[name]!,
      path,
      keys,
      skipped,
    });
  }
  return { calls: out, skippedPaths, uncheckedBodies };
}

/** Returns the character offset, within `argsText`, of the start of the Nth
 * (0-indexed) top-level comma-separated argument -- recomputed via the same
 * depth-tracking splitTopLevel uses, so it never drifts from what
 * splitTopLevel itself considers argument N's text. */
function argsOffsetOfIndex(argsText: string, index: number): number {
  let depth = 0;
  let argIdx = 0;
  let start = 0;
  let i = 0;
  const n = argsText.length;
  if (index === 0) return 0;
  while (i < n) {
    const c = argsText[i];
    if (c === "(" || c === "[" || c === "{") {
      depth++;
    } else if (c === ")" || c === "]" || c === "}") {
      depth--;
    } else if (c === '"' || c === "'" || c === "`") {
      const quote = c;
      i++;
      while (i < n && argsText[i] !== quote) {
        if (argsText[i] === "\\" && i + 1 < n) i++;
        i++;
      }
    } else if (c === "," && depth === 0) {
      argIdx++;
      start = i + 1;
      if (argIdx === index) return start;
    }
    i++;
  }
  return start;
}

// ---------------------------------------------------------------------------
// DEC-817's wave-53 amendment: resolution is no longer a hand-written map --
// resolveRegisteredRoute (test/helpers/registered-routes.ts) resolves a
// call's method+path against the REAL route table, derived from source. The
// module a key is checked against is that registration's own `file` plus
// its one-level relative imports (so a route that parses its body in a
// sibling helper module still passes honestly).
// ---------------------------------------------------------------------------
const IMPORT_RE = /import\s+(?:[^;'"`]*?)\bfrom\s+["'](\.[^"']+)["']/g;

function resolveRelativeImport(fromFile: string, specifier: string): string | undefined {
  const base = join(dirname(fromFile), specifier);
  for (const candidate of [`${base}.ts`, `${base}.tsx`]) {
    try {
      statSync(candidate);
      return candidate;
    } catch {
      // not this extension -- try the next
    }
  }
  return undefined;
}

/** The resolved registration's own source, concatenated with the source of
 * every relative (`./x` / `../y`) import one level deep -- not a real
 * module-graph walk, just enough for a route that hands its body parsing to
 * a sibling helper to still be checked honestly. */
function moduleSourcesFor(registrationFile: string): string {
  const own = readFileSync(registrationFile, "utf8");
  let combined = own;
  let m: RegExpExecArray | null;
  IMPORT_RE.lastIndex = 0;
  while ((m = IMPORT_RE.exec(own))) {
    const resolved = resolveRelativeImport(registrationFile, m[1]!);
    if (resolved) combined += "\n" + readFileSync(resolved, "utf8");
  }
  return combined;
}

describe("SPA admin mutation <-> route contract (DEC-817 amendment, wave-53 widened scan)", () => {
  const files: string[] = [];
  walk(APP_SRC, files);

  // app/src/lib/api.ts's own apiGet/apiPost/... FUNCTION DECLARATIONS (e.g.
  // `export function apiPost<T>(path: string, body?: unknown)`) match
  // CALL_NAME_RE followed by a `(` -- the declaration's parameter list --
  // and their `path: string` first parameter is not a string literal. That
  // is a real, structural non-call ("declaring the helper" is not "calling
  // the helper"), not the ambiguous case the not-a-call/non-literal-path
  // findings exist to surface, so api.ts itself is excluded from this scan
  // entirely (it never contains a call to one of these helpers).
  const API_TS = join(APP_SRC, "lib", "api.ts");

  const calls: MutationCall[] = [];
  const skippedPaths: SkippedPath[] = [];
  const uncheckedBodies: UncheckedBody[] = [];
  for (const file of files) {
    if (file === API_TS) continue;
    const rawSrc = readFileSync(file, "utf8");
    try {
      const result = findMutationCalls(file, rawSrc);
      calls.push(...result.calls);
      skippedPaths.push(...result.skippedPaths);
      uncheckedBodies.push(...result.uncheckedBodies);
    } catch (err) {
      throw new Error(`${file}: ${(err as Error).message}`);
    }
  }

  it("tripwire: the population doesn't silently collapse", () => {
    // Widened (wave 53) from apiPost/apiPatch/apiPut alone to every api*
    // helper (apiGet/apiList/apiDelete/apiUpload/apiPostBlob too) -- if a
    // future rewrite of api.ts or a mass rename made the regex stop
    // matching, this catches it going quiet.
    expect(calls.length).toBeGreaterThanOrEqual(200);
  });

  // A path a real endpoint doesn't yet serve, recorded here (never as a
  // silent allowlist) with file:line and a written reason -- the unresolved
  // set below must equal exactly this array, so it can never grow silently.
  const UNBUILT_ENDPOINTS: string[] = [];

  // DEC-817's wave-57 amendment: a call site this scan cannot statically
  // resolve a path for (non-literal path argument, an api* identifier not
  // actually followed by a call, or a `${...}` span normalizePath erases
  // with no record) is recorded in `skippedPaths` rather than silently
  // dropped -- see findMutationCalls. An entry below may only be added with
  // a written reason naming why the path genuinely cannot be made statically
  // resolvable; it is a FINDING for a human to read, never a suppression
  // that shrinks what the test below checks.
  //
  // Not empty: the file header already documents this exact shape (see
  // normalizePath's comment) -- a trailing `${qs}`/`${query}` computed query
  // string tacked onto the end of a call's path template with no "/"
  // separator, e.g. `` `/events/${eventId}/submissions${qs}` ``. The path
  // segment BEFORE the interpolation is a literal and is unaffected (this
  // scan still resolves and route-checks it -- only the caller-built
  // trailing suffix is erased/invisible); the interpolated portion is a
  // client-built query string (page/filter params), never a route segment,
  // in every case below, confirmed by reading each call site.
  //
  // DEC-967 wave-62 amendment: entries below are keyed STRUCTURALLY -- file
  // path plus reason plus the exact exempted source expression -- never by
  // line number. A line number drifts every time a line is inserted or
  // removed above the exempted call (this ledger was mechanically re-pinned
  // twice already: a9ccba63 re-pinned PlanEditor.tsx:823 -> 872, and once
  // more the wave before that), and a drifted pin silently exempts whatever
  // expression now happens to sit at that line number instead of the one a
  // human actually adjudicated. buildUnresolvableKey (below) is the ONLY
  // place either side of the comparison is built, so the ledger and the
  // scan's own output can never diverge in shape.
  const UNRESOLVABLE_PATHS: string[] = [
    "app/src/pages/comms/ComposeWizard.tsx interpolation-erased: /events/${eventId}/submissions${qs}",
    "app/src/pages/contacts/MergePage.tsx interpolation-erased: /contacts/duplicates${query}",
    "app/src/pages/review/PlanEditor.tsx interpolation-erased: /plans/${planId}/assignments/distribute/preview${qs}",
    "app/src/pages/submissions/SubmissionDetailPage.tsx interpolation-erased: /events/${detail.eventId}/submissions${buildSubmissionsQuery(listFilters)}",
    "app/src/pages/submissions/SubmissionsTable.tsx interpolation-erased: /events/${eventId}/submissions${qs}",
  ];

  it("every path this scan could not statically resolve is recorded, not silently dropped (no growth beyond UNRESOLVABLE_PATHS)", () => {
    const observedKeys = skippedPaths.map(buildUnresolvableKey);
    const observedLines = skippedPaths.map((s) => `${s.file}:${s.line} ${s.reason}: ${s.text}`).sort();
    // eslint-disable-next-line no-console
    console.log(`spa-mutation-contract: ${observedLines.length} skipped path(s):\n${observedLines.join("\n")}`);

    const ledgerSet = new Set(UNRESOLVABLE_PATHS);
    const unlisted = observedKeys.filter((k) => !ledgerSet.has(k)).sort();
    expect(
      unlisted,
      `paths this scan could not statically resolve to a literal, method-checkable route path, and that are NOT named in UNRESOLVABLE_PATHS (add an entry with a written reason, or fix the call site to use a literal path):\n${unlisted.join("\n")}`,
    ).toEqual([]);

    const observedSet = new Set(observedKeys);
    const stale = UNRESOLVABLE_PATHS.filter((k) => !observedSet.has(k)).sort();
    expect(
      stale,
      `UNRESOLVABLE_PATHS entries the scan no longer produces (the call site was fixed, removed, or renamed) -- delete this line:\n${stale.join("\n")}`,
    ).toEqual([]);
  });

  // DEC-817 wave-80 amendment: the BODY-side counterpart of
  // UNRESOLVABLE_PATHS -- every call whose second argument is not a bare
  // `{` literal and that resolveComputedBody (findMutationCalls) could not
  // statically resolve down to one either. Keyed structurally through
  // buildUncheckedBodyKey (file + kind + exact expression text, no line),
  // exactly mirroring buildUnresolvableKey.
  //
  // DISCHARGE (wave 80): the resolvable subset of the population named in
  // the amendment (ternary-of-literals, same-file `const x = {...}`,
  // same-file builder-returns-literal) is now checked for real --
  // PlanEditor.tsx's `body` locals and ResourcesPanel.tsx's ternary are no
  // longer in this ledger; their keys are asserted against their routes by
  // the key-check test below like any literal body. What remains here is
  // genuinely irreducible by a text scan: a function parameter (no
  // same-file literal assignment exists to find), a builder imported from
  // another file, or a same-file builder that mutates a local instead of
  // returning a literal.
  const UNCHECKED_BODIES: string[] = [
    "app/src/components/EventSwitcher.tsx call: buildNewEventPayload(form)",
    "app/src/pages/comms/ComposeWizard.tsx call: composeBody(overrides)",
    "app/src/pages/comms/ComposeWizard.tsx identifier: body",
    "app/src/pages/comms/TemplatesTab.tsx identifier: draft",
    "app/src/pages/forms/FormsPage.tsx identifier: input",
    "app/src/pages/review/PlanEditor.tsx identifier: body",
    "app/src/pages/review/ProgressPanel.tsx ternary: scope === 'not_started' ? { scope } : undefined",
    "app/src/pages/settings/EventSettingsPanel.tsx identifier: patch",
    "app/src/pages/settings/PortalSettingsPanel.tsx call: buildPortalSettingsPayload(form)",
    "app/src/pages/speakers/OnboardingGrid.tsx identifier: input",
  ];

  it("every request body this scan could not statically resolve to a set of keys is recorded, not silently treated as checked (no growth beyond UNCHECKED_BODIES)", () => {
    const observedKeys = uncheckedBodies.map(buildUncheckedBodyKey);
    const observedLines = uncheckedBodies.map((u) => `${u.file}:${u.line} ${u.kind}: ${u.text}`).sort();
    // eslint-disable-next-line no-console
    console.log(`spa-mutation-contract: ${observedLines.length} unchecked body/bodies:\n${observedLines.join("\n")}`);

    const ledgerSet = new Set(UNCHECKED_BODIES);
    const unlisted = observedKeys.filter((k) => !ledgerSet.has(k)).sort();
    expect(
      unlisted,
      `request bodies this scan could not statically resolve to a checkable set of keys, and that are NOT named in UNCHECKED_BODIES (add an entry with a reason that states a PRINCIPLE, or fix the call site to use a literal/resolvable body):\n${unlisted.join("\n")}`,
    ).toEqual([]);

    const observedSet = new Set(observedKeys);
    const stale = UNCHECKED_BODIES.filter((k) => !observedSet.has(k)).sort();
    expect(
      stale,
      `UNCHECKED_BODIES entries the scan no longer produces (the call site was fixed, resolved, or removed) -- delete this line:\n${stale.join("\n")}`,
    ).toEqual([]);
  });

  // DEC-817 wave-80 amendment falsifiability controls: mirrors the
  // UNRESOLVABLE_PATHS controls exactly, exercised against a real
  // UNCHECKED_BODIES entry (EventSwitcher.tsx's `buildNewEventPayload(form)`
  // call -- the function is imported, not declared in this file, so its
  // "unresolved" verdict does not depend on surrounding file content and a
  // single-line synthetic source reproduces it honestly).
  it("falsifiability: a blank line inserted above an unresolvable body expression does not break the ledger match", () => {
    const expr = "apiPost('/events', buildNewEventPayload(form));";
    const withoutBlankLine = expr;
    const withBlankLines = `\n\n\n${expr}`;
    const file = "app/src/components/EventSwitcher.tsx";

    const r1 = findMutationCalls(file, withoutBlankLine);
    const r2 = findMutationCalls(file, withBlankLines);
    expect(r1.uncheckedBodies).toHaveLength(1);
    expect(r2.uncheckedBodies).toHaveLength(1);

    // Sanity: the raw line number DID move -- this is exactly the drift that
    // used to break a line-keyed ledger.
    expect(r1.uncheckedBodies[0]!.line).not.toBe(r2.uncheckedBodies[0]!.line);

    const key1 = buildUncheckedBodyKey(r1.uncheckedBodies[0]!);
    const key2 = buildUncheckedBodyKey(r2.uncheckedBodies[0]!);
    expect(key1).toBe(key2);
    expect(UNCHECKED_BODIES).toContain(key1);
  });

  it("falsifiability: renaming or removing an unresolvable body expression drops it out of the ledger", () => {
    const file = "app/src/components/EventSwitcher.tsx";
    const renamed = "apiPost('/events', buildRenamedEventPayload(form));";
    const rRenamed = findMutationCalls(file, renamed);
    expect(rRenamed.uncheckedBodies).toHaveLength(1);
    expect(UNCHECKED_BODIES).not.toContain(buildUncheckedBodyKey(rRenamed.uncheckedBodies[0]!));

    const removed = "apiPost('/events', { name: form.name });";
    const rRemoved = findMutationCalls(file, removed);
    expect(rRemoved.uncheckedBodies).toHaveLength(0);
  });

  it("apiUpload's FormData body is ruled out of the key check by kind, not funneled into UncheckedBody", () => {
    const synthetic = "apiUpload(`/contacts/${contactId}/headshot`, form);";
    const result = findMutationCalls("app/src/__synthetic_upload__.tsx", synthetic);
    expect(result.calls).toHaveLength(1);
    expect(result.calls[0]!.keys).toEqual([]);
    expect(result.uncheckedBodies).toHaveLength(0);
  });

  // DEC-967 wave-62 falsifiability controls: the ledger re-key must be
  // provably location-independent (blank lines inserted above an exempted
  // expression don't break the match) AND provably still discriminating (a
  // renamed/removed expression falls OUT of the ledger). Both are exercised
  // against a real UNRESOLVABLE_PATHS entry (ComposeWizard.tsx's), not a
  // synthetic file name, so a future edit to normalizePath/buildUnresolvableKey
  // that broke the real ledger's shape would fail here too.
  it("falsifiability: a blank line inserted above an exempted expression does not break the ledger match", () => {
    const expr = "apiGet(`/events/${eventId}/submissions${qs}`);";
    const withoutBlankLine = expr;
    const withBlankLines = `\n\n\n${expr}`;
    const file = "app/src/pages/comms/ComposeWizard.tsx";

    const r1 = findMutationCalls(file, withoutBlankLine);
    const r2 = findMutationCalls(file, withBlankLines);
    expect(r1.skippedPaths).toHaveLength(1);
    expect(r2.skippedPaths).toHaveLength(1);

    // Sanity: the raw line number DID move -- this is exactly the drift that
    // used to break a line-keyed ledger.
    expect(r1.skippedPaths[0]!.line).not.toBe(r2.skippedPaths[0]!.line);

    const key1 = buildUnresolvableKey(r1.skippedPaths[0]!);
    const key2 = buildUnresolvableKey(r2.skippedPaths[0]!);
    expect(key1).toBe(key2);
    expect(UNRESOLVABLE_PATHS).toContain(key1);
  });

  it("falsifiability: renaming or removing an exempted expression drops it out of the ledger", () => {
    const file = "app/src/pages/comms/ComposeWizard.tsx";
    const renamed = "apiGet(`/events/${eventId}/submissionsRenamed${qs}`);";
    const rRenamed = findMutationCalls(file, renamed);
    expect(rRenamed.skippedPaths).toHaveLength(1);
    expect(UNRESOLVABLE_PATHS).not.toContain(buildUnresolvableKey(rRenamed.skippedPaths[0]!));

    const removed = 'apiGet("/events/fixed-id/submissions");';
    const rRemoved = findMutationCalls(file, removed);
    expect(rRemoved.skippedPaths).toHaveLength(0);
  });

  it("positive control: a non-literal path argument is recorded in skippedPaths with reason non-literal-path, not silently dropped", () => {
    const synthetic = `apiDelete(someVariable);`;
    const result = findMutationCalls("app/src/__synthetic_nonliteral_path__.tsx", synthetic);
    expect(result.calls).toHaveLength(0);
    expect(result.skippedPaths).toHaveLength(1);
    expect(result.skippedPaths[0]!.reason).toBe("non-literal-path");
    expect(result.skippedPaths[0]!.text).toContain("someVariable");
  });

  it("negative control: a literal-path call is not recorded in skippedPaths", () => {
    const synthetic = `apiDelete("/submissions/abc-123");`;
    const result = findMutationCalls("app/src/__synthetic_literal_path__.tsx", synthetic);
    expect(result.calls).toHaveLength(1);
    expect(result.calls[0]!.path).toBe("/api/v1/submissions/abc-123");
    expect(result.skippedPaths).toHaveLength(0);
  });

  it("every extracted call's path resolves to a real route registration (no unmapped path)", () => {
    const unresolved: string[] = [];
    for (const call of calls) {
      if (!resolveRegisteredRoute(call.method, call.path)) {
        unresolved.push(`${call.file}:${call.line} ${call.method} ${call.path}`);
      }
    }
    expect(
      unresolved.sort(),
      `calls whose method+path resolves to no registered route (add the route, or record it in UNBUILT_ENDPOINTS with a reason -- an unmapped path is a hole in the grader, not a pass):\n${unresolved.join("\n")}`,
    ).toEqual([...UNBUILT_ENDPOINTS].sort());
  });

  it("every extracted key appears as a token in its resolved route's module source (or its one-level relative imports)", () => {
    const moduleSrc = new Map<string, string>();
    const gaps: string[] = [];
    for (const call of calls) {
      const route = resolveRegisteredRoute(call.method, call.path);
      if (!route) continue; // reported by the prior test
      if (!moduleSrc.has(route.file)) {
        moduleSrc.set(route.file, moduleSourcesFor(route.file));
      }
      const src = moduleSrc.get(route.file)!;
      for (const key of call.keys) {
        const tokenRe = new RegExp(`\\b${key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`);
        if (!tokenRe.test(src)) {
          gaps.push(`${call.file}:${call.line} ${call.method} ${call.path}: key "${key}" not found in ${relative(ROOT, route.file)}`);
        }
      }
    }
    expect(
      gaps,
      `SPA sends a key its resolved route module never mentions -- a button that 400s (or silently no-ops) on a real server:\n${gaps.join("\n")}`,
    ).toEqual([]);
  });

  it("negative control: a synthetic call sending a key no module could possibly contain fails the key check", () => {
    const synthetic: MutationCall = {
      file: "app/src/__synthetic__.tsx",
      line: 1,
      method: "PATCH",
      path: "/api/v1/submissions/:param",
      keys: ["totallyMadeUpKeyNoRouteHas"],
      skipped: [],
    };
    const route = resolveRegisteredRoute(synthetic.method, synthetic.path)!;
    expect(route).toBeDefined();
    const src = moduleSourcesFor(route.file);
    const tokenRe = new RegExp(`\\b${synthetic.keys[0]}\\b`);
    expect(tokenRe.test(src)).toBe(false);
  });

  it("negative control: an unresolvable synthetic path is reported unresolved, not silently skipped", () => {
    expect(resolveRegisteredRoute("GET", "/this/path/does/not/exist")).toBeUndefined();
  });

  // DEC-817 wave-80 amendment: a real enumeration of every spread/computed-
  // key entry this scan skips inside an otherwise-literal object body --
  // location-independent (file + kind + trimmed text, no line, matching
  // UNRESOLVABLE_PATHS/UNCHECKED_BODIES' own keying convention above), so
  // this is a genuine population ledger, not a floor of one that a whole
  // class of these could silently disappear behind.
  const SPREAD_COMPUTED_KEY_ENTRIES: string[] = [
    "app/src/pages/contacts/ImportWizard.tsx spread: ...plannedRequest",
    "app/src/pages/contacts/ImportWizard.tsx spread: ...request",
    "app/src/pages/settings/CallForPapersPanel.tsx computed-key: [which]: today",
    "app/src/pages/submissions/SubmissionsTable.tsx spread: ...(input.format ? { format: input.format } : {})",
  ];

  it("every spread/computed-key entry this scan skips (inside an otherwise-literal body) is enumerated, not just floored above zero (no growth beyond SPREAD_COMPUTED_KEY_ENTRIES)", () => {
    // Not an allowlist -- a finding, printed for the next reader, never used
    // to shrink the population above. See the file header's "does NOT see"
    // list.
    const skippedDetailed = calls.flatMap((call) =>
      call.skipped.map((s) => ({ file: call.file, line: call.line, kind: s.kind, text: s.text.trim() })),
    );
    const observedLines = skippedDetailed.map((s) => `${s.file}:${s.line} ${s.kind}: ${s.text}`).sort();
    // eslint-disable-next-line no-console
    console.log(`spa-mutation-contract: ${observedLines.length} spread/computed-key entr(y/ies):\n${observedLines.join("\n")}`);

    const observedKeys = skippedDetailed.map((s) => `${s.file} ${s.kind}: ${s.text}`);
    const ledgerSet = new Set(SPREAD_COMPUTED_KEY_ENTRIES);
    const unlisted = [...new Set(observedKeys.filter((k) => !ledgerSet.has(k)))].sort();
    expect(
      unlisted,
      `spread/computed-key entries NOT named in SPREAD_COMPUTED_KEY_ENTRIES (add an entry -- this is a finding, never an allowlist that shrinks what's checked):\n${unlisted.join("\n")}`,
    ).toEqual([]);

    const observedSet = new Set(observedKeys);
    const stale = SPREAD_COMPUTED_KEY_ENTRIES.filter((k) => !observedSet.has(k)).sort();
    expect(
      stale,
      `SPREAD_COMPUTED_KEY_ENTRIES entries the scan no longer produces (the call site was fixed, resolved, or removed) -- delete this line:\n${stale.join("\n")}`,
    ).toEqual([]);
  });
});
