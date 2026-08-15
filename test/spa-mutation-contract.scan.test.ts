// DEC-817 amendment (findings wave 13): the admin SPA and its routes are ONE
// contract, graded executably. Two controls shipped a key their route never
// parsed (PATCH /submissions/:id's `audienceLevel`, PATCH .../participants/
// :participantId's `role` -- both fixed by task-w13-a, on which this scan
// depends to be green), and nothing anywhere compared the two sides. This
// scan re-derives the population at test time, from the SPA's own source:
//
//   1. Walk app/src/**/*.{ts,tsx} (excluding *.test.ts(x) -- those exercise
//      the api client itself against synthetic paths that are not live
//      routes, e.g. app/src/lib/useNavExceptions.test.tsx's
//      '/events/ev-1/agenda/resolve', which no route in src/routes/ serves).
//      For every call to apiPost/apiPatch/apiPut (an optional `<...>`
//      generic is skipped) whose second argument is a literal object `{...}`,
//      extract the request path and the object's TOP-LEVEL keys.
//   2. Resolve each extracted path to the route module that serves it, via
//      an explicit path-prefix -> module map declared below. A path the map
//      cannot resolve FAILS the test, naming the path -- an unmapped path is
//      a hole in the grader, not a pass.
//   3. Assert every extracted key appears as a token in that module's source
//      (a simple `\bkey\b` search over the raw file text -- not a real
//      parse, so a key that only appears in a comment would also "pass";
//      this repo's other *.scan.test.ts files accept the same text-scan
//      honesty tradeoff, e.g. test/route-authz-enumeration.scan.test.ts).
//
// What this scan deliberately does NOT see (so a green run is never mistaken
// for a total proof):
//   - Computed request bodies: a second argument that is not itself a `{`
//     literal (a variable, a function call, a ternary of two objects, an
//     object spread of another value with no literal keys of its own --
//     e.g. TemplatesTab.tsx's `apiPost(path, draft)`,
//     PortalSettingsPanel.tsx's `apiPut(path, buildPortalSettingsPayload
//     (form))`, ResourcesPanel.tsx's `apiPatch(path, isWiki ? {...} : {...})`
//     ,OnboardingGrid.tsx's `contactIds ? { contactIds } : {}`). These calls
//     are invisible to this scan entirely.
//   - Spread and conditional-spread entries inside an otherwise-literal
//     object (`...request`, `...(cond ? { a } : {})`) -- skipped with a
//     `SPREAD_SKIPPED` marker rather than resolved, because their keys are
//     not statically knowable from this text scan.
//   - Computed keys (`{ [which]: today }`) -- skipped with a
//     `COMPUTED_KEY_SKIPPED` marker for the same reason.
//   - Keys added to the request body by a helper the SPA calls before
//     apiPost/apiPatch/apiPut (e.g. anything a builder function mixes in
//     that isn't visible as a literal key at the call site).
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
import { join, relative } from "node:path";

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
  method: "POST" | "PATCH" | "PUT";
  path: string; // normalized: ${...} segments become ":param"
  keys: string[];
  skipped: { kind: "spread" | "computed-key"; text: string }[];
}

const CALL_NAME_RE = /\b(apiPost|apiPatch|apiPut)\b/g;

function normalizePath(raw: string): string {
  return raw.replace(/\$\{[^}]*\}/g, ":param");
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

function findMutationCalls(file: string, rawSrc: string): MutationCall[] {
  const src = stripComments(rawSrc);
  const out: MutationCall[] = [];
  let match: RegExpExecArray | null;
  CALL_NAME_RE.lastIndex = 0;
  while ((match = CALL_NAME_RE.exec(src))) {
    const name = match[1] as "apiPost" | "apiPatch" | "apiPut";
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
    if (src[j] !== "(") continue; // not actually a call (e.g. a re-export name)
    const openParenIdx = j;
    const closeParenIdx = findMatchingBracket(src, openParenIdx);
    const argsText = src.slice(openParenIdx + 1, closeParenIdx);
    const args = splitTopLevel(argsText);
    const pathArg = (args[0] ?? "").trim();
    if (pathArg[0] !== '"' && pathArg[0] !== "'" && pathArg[0] !== "`") continue; // computed path -- invisible to this scan
    const rawPath = readStringLiteral(pathArg, 0);
    if (!rawPath.startsWith("/")) continue;
    const path = normalizePath(rawPath);

    const lineIdx = src.slice(0, match.index).split("\n").length - 1;
    const bodyArg = (args[1] ?? "").trim();
    if (bodyArg === "" || bodyArg[0] !== "{") {
      // No body, or a computed body (variable/call/ternary/etc) -- invisible
      // to this scan, per the file header.
      continue;
    }
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
    const { keys, skipped } = extractObjectKeys(inner);

    const method = name === "apiPost" ? "POST" : name === "apiPatch" ? "PATCH" : "PUT";
    out.push({
      file: relative(ROOT, file).split("\\").join("/"),
      line: lineIdx + 1,
      method,
      path,
      keys,
      skipped,
    });
  }
  return out;
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
// Path-prefix -> route module map, declared explicitly here (not derived --
// DEC-817's own instruction). Order matters: more specific prefixes are
// listed before their broader parents where both could otherwise match, but
// every entry below is actually a distinct literal-segment prefix so there
// is no real overlap in practice.
// ---------------------------------------------------------------------------
const ROUTE_MODULE_MAP: { prefix: RegExp; module: string }[] = [
  { prefix: /^\/embeds\/:param$/, module: "src/routes/api/embeds.ts" },
  { prefix: /^\/events\/:param\/embeds$/, module: "src/routes/api/embeds.ts" },
  { prefix: /^\/events\/:param\/submissions\/status$/, module: "src/routes/api/submissions.ts" },
  { prefix: /^\/events\/:param\/submissions\/content-status$/, module: "src/routes/api/submissions.ts" },
  { prefix: /^\/events\/:param\/submissions\/delete$/, module: "src/routes/api/submissions.ts" },
  { prefix: /^\/events\/:param\/submissions$/, module: "src/routes/api/submissions.ts" },
  { prefix: /^\/submissions\/:param\/participants\/:param$/, module: "src/routes/api/submissions.ts" },
  { prefix: /^\/submissions\/:param\/participants$/, module: "src/routes/api/submissions.ts" },
  { prefix: /^\/submissions\/:param\/content-status$/, module: "src/routes/files.ts" },
  { prefix: /^\/submissions\/:param\/content-note$/, module: "src/routes/content-notes.ts" },
  { prefix: /^\/submissions\/:param$/, module: "src/routes/api/submissions.ts" },
  { prefix: /^\/task-assignments\/:param$/, module: "src/routes/tasks.ts" },
  { prefix: /^\/events\/:param\/tasks$/, module: "src/routes/tasks.ts" },
  { prefix: /^\/events\/:param\/onboarding\/remind\/preview$/, module: "src/routes/tasks.ts" },
  { prefix: /^\/events\/:param\/onboarding\/remind$/, module: "src/routes/tasks.ts" },
  { prefix: /^\/tasks\/:param$/, module: "src/routes/tasks.ts" },
  { prefix: /^\/events\/:param\/resources$/, module: "src/routes/api/portal-config.ts" },
  { prefix: /^\/resources\/:param$/, module: "src/routes/api/portal-config.ts" },
  { prefix: /^\/events\/:param\/portal-settings$/, module: "src/routes/api/portal-config.ts" },
  { prefix: /^\/events\/:param\/portal-invites$/, module: "src/routes/comms/portal-invites.ts" },
  { prefix: /^\/events\/:param\/tracks$/, module: "src/routes/api/events.ts" },
  { prefix: /^\/tracks\/:param$/, module: "src/routes/api/events.ts" },
  { prefix: /^\/events\/:param\/rooms$/, module: "src/routes/api/events.ts" },
  { prefix: /^\/rooms\/:param$/, module: "src/routes/api/events.ts" },
  { prefix: /^\/events\/:param\/agenda\/auto-schedule$/, module: "src/routes/agenda.ts" },
  { prefix: /^\/events\/:param\/agenda\/publish$/, module: "src/routes/agenda.ts" },
  { prefix: /^\/submissions\/:param\/slot$/, module: "src/routes/agenda.ts" },
  { prefix: /^\/contacts\/duplicates\/dismiss$/, module: "src/routes/api/contacts/duplicates.ts" },
  { prefix: /^\/contacts\/merge$/, module: "src/routes/api/contacts/merge.ts" },
  { prefix: /^\/contacts\/bulk-email\/preview$/, module: "src/routes/api/contacts/bulk-email.ts" },
  { prefix: /^\/contacts\/bulk-email$/, module: "src/routes/api/contacts/bulk-email.ts" },
  { prefix: /^\/contacts\/import$/, module: "src/routes/api/contacts/import.ts" },
  { prefix: /^\/contacts\/:param\/add-to-event$/, module: "src/routes/api/contacts/crud.ts" },
  { prefix: /^\/contacts\/:param$/, module: "src/routes/api/contacts/crud.ts" },
  { prefix: /^\/contacts$/, module: "src/routes/api/contacts/crud.ts" },
  { prefix: /^\/segments\/:param$/, module: "src/routes/api/contacts/segments.ts" },
  { prefix: /^\/segments$/, module: "src/routes/api/contacts/segments.ts" },
  { prefix: /^\/pipeline\/:param\/notes$/, module: "src/routes/api/pipeline.ts" },
  { prefix: /^\/pipeline\/:param$/, module: "src/routes/api/pipeline.ts" },
  { prefix: /^\/pipeline$/, module: "src/routes/api/pipeline.ts" },
  { prefix: /^\/events\/:param\/templates$/, module: "src/routes/comms/templates.ts" },
  { prefix: /^\/templates\/:param$/, module: "src/routes/comms/templates.ts" },
  { prefix: /^\/review\/plans\/:param\/evaluations\/:param$/, module: "src/routes/review/reviewer.ts" },
  { prefix: /^\/review\/plans\/:param\/recusals\/:param$/, module: "src/routes/review/recusals.ts" },
  { prefix: /^\/breaks\/:param$/, module: "src/routes/api/breaks.ts" },
  { prefix: /^\/events\/:param\/breaks$/, module: "src/routes/api/breaks.ts" },
  { prefix: /^\/events\/:param$/, module: "src/routes/api/events.ts" },
  { prefix: /^\/events$/, module: "src/routes/api/events.ts" },
  { prefix: /^\/events\/:param\/import\/sessionboard$/, module: "src/routes/api/import.ts" },
  { prefix: /^\/users\/:param\/reset-password$/, module: "src/routes/api/users.ts" },
  { prefix: /^\/users\/:param$/, module: "src/routes/api/users.ts" },
  { prefix: /^\/users$/, module: "src/routes/api/users.ts" },
  { prefix: /^\/tokens\/:param$/, module: "src/routes/api/tokens.ts" },
  { prefix: /^\/tokens$/, module: "src/routes/api/tokens.ts" },
  { prefix: /^\/forms\/:param\/fields\/reorder$/, module: "src/routes/api/forms.ts" },
  { prefix: /^\/forms\/:param\/fields$/, module: "src/routes/api/forms.ts" },
  { prefix: /^\/fields\/:param$/, module: "src/routes/api/forms.ts" },
  { prefix: /^\/forms\/:param$/, module: "src/routes/api/forms.ts" },
  { prefix: /^\/plans\/:param\/remind$/, module: "src/routes/review/plans-progress.ts" },
  { prefix: /^\/plans\/:param\/advance-round$/, module: "src/routes/review/plans-crud.ts" },
  { prefix: /^\/plans\/:param\/waves$/, module: "src/routes/review/plans-crud.ts" },
  { prefix: /^\/plans\/:param$/, module: "src/routes/review/plans-crud.ts" },
  { prefix: /^\/events\/:param\/plans$/, module: "src/routes/review/plans-crud.ts" },
  { prefix: /^\/plans\/:param\/assignments\/distribute$/, module: "src/routes/review/plans-distribute.ts" },
  { prefix: /^\/plans\/:param\/reviewers\/:param$/, module: "src/routes/review/plans-reviewers.ts" },
  { prefix: /^\/plans\/:param\/reviewers$/, module: "src/routes/review/plans-reviewers.ts" },
  { prefix: /^\/events\/:param\/submissions\/delete-plan$/, module: "src/routes/api/submissions.ts" },
  { prefix: /^\/events\/:param\/views$/, module: "src/routes/api/views.ts" },
  { prefix: /^\/views\/:param$/, module: "src/routes/api/views.ts" },
  { prefix: /^\/submissions\/:param\/clone$/, module: "src/routes/api/submissions.ts" },
  { prefix: /^\/submissions\/:param\/revisions\/:param\/restore$/, module: "src/routes/api/submissions.ts" },
  { prefix: /^\/events\/:param\/compose\/preview$/, module: "src/routes/comms/preview.ts" },
  { prefix: /^\/events\/:param\/compose\/send$/, module: "src/routes/comms/send.ts" },
];

function resolveModule(path: string): string | undefined {
  return ROUTE_MODULE_MAP.find((e) => e.prefix.test(path))?.module;
}

describe("SPA admin mutation <-> route contract (DEC-817 amendment, findings wave 13)", () => {
  const files: string[] = [];
  walk(APP_SRC, files);

  const calls: MutationCall[] = [];
  for (const file of files) {
    const rawSrc = readFileSync(file, "utf8");
    try {
      calls.push(...findMutationCalls(file, rawSrc));
    } catch (err) {
      throw new Error(`${file}: ${(err as Error).message}`);
    }
  }

  it("tripwire: the population doesn't silently collapse", () => {
    // As of this task, 40+ apiPost/apiPatch/apiPut call sites in app/src
    // pass a literal-object body -- if a future rewrite of api.ts or a mass
    // rename made the regex stop matching, this catches it going quiet.
    expect(calls.length).toBeGreaterThanOrEqual(30);
  });

  it("every extracted call's path resolves to a route module (no unmapped path)", () => {
    const unresolved: string[] = [];
    for (const call of calls) {
      if (!resolveModule(call.path)) {
        unresolved.push(`${call.file}:${call.line} ${call.method} ${call.path}`);
      }
    }
    expect(
      unresolved,
      `calls whose path is not in ROUTE_MODULE_MAP (add a mapping -- an unmapped path is a hole in the grader, not a pass):\n${unresolved.join("\n")}`,
    ).toEqual([]);
  });

  it("every extracted key appears as a token in its resolved route module's source", () => {
    const moduleSrc = new Map<string, string>();
    const gaps: string[] = [];
    for (const call of calls) {
      const mod = resolveModule(call.path);
      if (!mod) continue; // reported by the prior test
      if (!moduleSrc.has(mod)) {
        moduleSrc.set(mod, readFileSync(join(ROOT, mod), "utf8"));
      }
      const src = moduleSrc.get(mod)!;
      for (const key of call.keys) {
        const tokenRe = new RegExp(`\\b${key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`);
        if (!tokenRe.test(src)) {
          gaps.push(`${call.file}:${call.line} ${call.method} ${call.path}: key "${key}" not found in ${mod}`);
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
      path: "/submissions/:param",
      keys: ["totallyMadeUpKeyNoRouteHas"],
      skipped: [],
    };
    const mod = resolveModule(synthetic.path)!;
    const src = readFileSync(join(ROOT, mod), "utf8");
    const tokenRe = new RegExp(`\\b${synthetic.keys[0]}\\b`);
    expect(tokenRe.test(src)).toBe(false);
  });

  it("negative control: an unmapped synthetic path is reported unresolved, not silently skipped", () => {
    expect(resolveModule("/this/path/does/not/exist/:param")).toBeUndefined();
  });

  it("documents (does not suppress) every spread/computed-key entry this scan skipped", () => {
    // Not an allowlist -- a finding, printed for the next reader, never used
    // to shrink the population above. See the file header's "does NOT see"
    // list.
    const skipped = calls.flatMap((call) => call.skipped.map((s) => `${call.file}:${call.line} ${s.kind}: ${s.text.trim()}`));
    // At least the two known cases (SubmissionsTable.tsx's conditional
    // ...({format}) spread, CallForPapersPanel.tsx's/FormsPage.tsx's
    // computed [which] key) must still be present -- if this count drops to
    // zero, either the code changed shape or the extractor regressed; either
    // way it's worth a human look, not a silent pass.
    expect(skipped.length).toBeGreaterThan(0);
  });
});
