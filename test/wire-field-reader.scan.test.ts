// DEC-851/DEC-358 (w1-d): "a declared response field with no reader is a
// lie." Every previous run of the declared-with-no-reader grep (DEC-851/
// DEC-988) walked settings and query KNOBS only. DEC-851's unnumbered
// amendment ("the declared-with-no-reader rule extends to RESPONSE fields")
// generalises it to the WIRE: a field placed on a response-shaped interface
// and never read anywhere under app/src is the mirror case wave 82 found
// with `perDropdown` -- either the server is computing something nobody can
// see, or a screen is missing a fact it was promised.
//
// SCOPE (DEC-851 wave-5 amendment: derive the population, don't hand-list
// it -- a hand-limited schedule is not a principle): every `app/src/pages/
// **/types.ts` module, discovered by a directory walk (sorted, so a failure
// is stable across runs), not the three files this scan used to name by
// hand.
//
// DEC-851 (wave 12): the wave-5 amendment was still a FILENAME convention
// ("every types.ts under pages/"), not a population -- ten confirmed
// response-shaped interfaces live outside it (SpeakerDetailResponse,
// SavedEmbedRow/EventDetail in EmbedsPanel.tsx, EventDetail in
// EventSettingsPanel.tsx, OverviewAggregatesPayload, DeliverableHeaderDetail,
// ReminderResult, ScheduleBreakRow, AnswerRow's siblings, and more), and
// `perDropdown` -- the defect this scan exists for -- would have been
// equally invisible one directory over. The population is now defined by
// the WIRE ITSELF: every `interface` (exported or module-local) declared
// anywhere under app/src that is used as a type argument to apiGet<T>,
// apiList<T>, apiPost<T>, apiPatch<T> or apiPut<T> (see app/src/lib/api.ts)
// -- directly at the call site, or reached through a named `type X = ...`
// alias chain (e.g. ComposeSendResult = Omit<SendResult, 'skipped'> & {...}
// pulls in SendResult). That is what "on the wire" means: it admits every
// interface above by construction (each is the literal type argument some
// apiGet/apiList/apiPost/apiPatch/apiPut call names), and excludes a
// SPA-internal derived/draft type (PublicPageRow, HistoryRow, AnswerRow,
// PlanDraft, ...) by the same construction -- none of those are ever
// themselves passed to the API client, they are built FROM a wire response
// after the fact. No allowlist, so the population cannot be narrowed by
// moving a file.
//
// The wave-5 `pages/**/types.ts` walk is KEPT as the baseline half of the
// population (see BASELINE_TARGET_FILES below) and proven a strict subset
// of the widened one by its own test, so the widening is provably additive,
// never a narrowing in disguise.
//
// For every field declared on a RESPONSE-shaped `interface` in the widened
// population, this scan asserts at least one reader exists somewhere under
// app/src -- a property access (`x.field`), a destructure (`{ field }`/
// `{ other, field }`), or a quoted string key (`'field'`/`"field"`).
// Request-only / SPA-internal-draft types (documented as such in their own
// file, e.g. PlanDraft) are excluded from the population with a written
// reason, never silently skipped.
//
// VERDICT KEY:
//   'read'      -- a reader exists; this row exists so the ledger stays a
//                  total function of the population (every member gets
//                  exactly one row), not because a scan needs one to pass.
//   'exempt'    -- no reader exists, and the field is out of THIS task's
//                  scope for a named principled reason (never a schedule,
//                  never a branch name -- exemption-reason-is-a-principle.
//                  scan.test.ts machine-checks that against this file too).
//   'fixed'     -- this task wired a reader (or deleted the field from both
//                  the wire type and its server projection) as one of its
//                  up-to-three real closures.
import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = dirname(HERE); // test/ -> repo root
const APP_SRC_DIR = join(ROOT, 'app', 'src');

/** Every `app/src/pages/<page>/types.ts` module, discovered by a walk (not
 * hand-listed) and sorted so a broken walk fails the same way every run. */
function findPagesTypesFiles(): string[] {
  const pagesDir = join(APP_SRC_DIR, 'pages');
  const out: string[] = [];
  for (const pageName of readdirSync(pagesDir).sort()) {
    const pageDir = join(pagesDir, pageName);
    if (!statSync(pageDir).isDirectory()) continue;
    const typesFile = join(pageDir, 'types.ts');
    try {
      if (statSync(typesFile).isFile()) out.push(relPath(typesFile));
    } catch {
      // no types.ts in this page directory -- not every page has one.
    }
  }
  return out;
}

const TARGET_FILES = findPagesTypesFiles();

// ---------------------------------------------------------------------------
// A tiny string/comment-aware scanner: strips comments, then splits an
// interface body into top-level (depth-0) `;`-terminated members, tracking
// nesting via {[(< so a nested inline object type (e.g. `roundMeta: { name:
// string; ... }`) or a generic (`Record<string, number>`) doesn't fracture
// a single member into several.
// ---------------------------------------------------------------------------
type Mode = 'CODE' | 'SINGLE' | 'DOUBLE' | 'TEMPLATE';

function stripComments(src: string): string {
  let out = '';
  const modeStack: Mode[] = ['CODE'];
  for (let i = 0; i < src.length; i++) {
    const top = modeStack[modeStack.length - 1];
    const ch = src[i];
    if (top === 'CODE') {
      if (ch === '/' && src[i + 1] === '/') {
        const nl = src.indexOf('\n', i);
        i = nl === -1 ? src.length : nl - 1;
        continue;
      }
      if (ch === '/' && src[i + 1] === '*') {
        const end = src.indexOf('*/', i + 2);
        i = end === -1 ? src.length : end + 1;
        continue;
      }
      if (ch === "'") modeStack.push('SINGLE');
      else if (ch === '"') modeStack.push('DOUBLE');
      else if (ch === '`') modeStack.push('TEMPLATE');
      out += ch;
      continue;
    }
    out += ch;
    if (ch === '\\') {
      i++;
      out += src[i] ?? '';
      continue;
    }
    if ((top === 'SINGLE' && ch === "'") || (top === 'DOUBLE' && ch === '"') || (top === 'TEMPLATE' && ch === '`')) {
      modeStack.pop();
    }
  }
  return out;
}

/** From `src[openIdx]` (must be `{`), finds the matching `}` (comment/string
 * already stripped by the caller, so this is a plain depth counter that
 * still respects quotes for safety). */
function findMatchingBrace(src: string, openIdx: number): string {
  let depth = 0;
  const modeStack: Mode[] = ['CODE'];
  for (let i = openIdx; i < src.length; i++) {
    const top = modeStack[modeStack.length - 1];
    const ch = src[i];
    if (top === 'CODE') {
      if (ch === "'") modeStack.push('SINGLE');
      else if (ch === '"') modeStack.push('DOUBLE');
      else if (ch === '`') modeStack.push('TEMPLATE');
      else if (ch === '{') depth++;
      else if (ch === '}') {
        depth--;
        if (depth === 0) return src.slice(openIdx, i + 1);
      }
      continue;
    }
    if (ch === '\\') {
      i++;
      continue;
    }
    if ((top === 'SINGLE' && ch === "'") || (top === 'DOUBLE' && ch === '"') || (top === 'TEMPLATE' && ch === '`')) {
      modeStack.pop();
    }
  }
  return src.slice(openIdx);
}

/** Splits an interface body (without the outer `{`/`}`) into top-level
 * (depth-0) `;`-terminated member segments, tracking {[(< nesting so a
 * generic or an inline nested object type stays inside one member. */
function topLevelMembers(body: string): string[] {
  const segments: string[] = [];
  let depth = 0;
  let start = 0;
  const modeStack: Mode[] = ['CODE'];
  for (let i = 0; i < body.length; i++) {
    const top = modeStack[modeStack.length - 1];
    const ch = body[i];
    if (top === 'CODE') {
      if (ch === "'") modeStack.push('SINGLE');
      else if (ch === '"') modeStack.push('DOUBLE');
      else if (ch === '`') modeStack.push('TEMPLATE');
      else if (ch === '{' || ch === '[' || ch === '(' || ch === '<') depth++;
      else if (ch === '}' || ch === ']' || ch === ')' || ch === '>') depth--;
      else if (ch === ';' && depth === 0) {
        segments.push(body.slice(start, i));
        start = i + 1;
      }
      continue;
    }
    if (ch === '\\') {
      i++;
      continue;
    }
    if ((top === 'SINGLE' && ch === "'") || (top === 'DOUBLE' && ch === '"') || (top === 'TEMPLATE' && ch === '`')) {
      modeStack.pop();
    }
  }
  const last = body.slice(start);
  if (last.trim() !== '') segments.push(last);
  return segments;
}

const MEMBER_NAME_RE = /^\s*(?:readonly\s+)?([A-Za-z_$][A-Za-z0-9_$]*)\??\s*:/;

interface InterfaceDecl {
  name: string;
  fields: string[];
}

/** Every `export interface Name { ... }` (or `export interface Name extends
 * X { ... }`) declaration in `src`, with its top-level field names. Index
 * signatures / call signatures (no leading identifier) are skipped -- they
 * aren't a NAMED field with a reader to find. */
function scanInterfaces(src: string): InterfaceDecl[] {
  const stripped = stripComments(src);
  const out: InterfaceDecl[] = [];
  const RE = /export interface (\w+)(?:\s+extends\s+[\w<>,\s]+)?\s*\{/g;
  let m: RegExpExecArray | null;
  while ((m = RE.exec(stripped))) {
    const openIdx = m.index + m[0].length - 1;
    const block = findMatchingBrace(stripped, openIdx);
    const body = block.slice(1, -1);
    const fields: string[] = [];
    for (const seg of topLevelMembers(body)) {
      const nm = MEMBER_NAME_RE.exec(seg);
      if (nm) fields.push(nm[1] as string);
    }
    out.push({ name: m[1] as string, fields });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Population -- every (file, interface, field) triple from a RESPONSE-shaped
// interface anywhere in the wire (DEC-851 wave 12). Request-only /
// SPA-internal-draft interfaces are excluded, with a written reason, never
// silently dropped.
// ---------------------------------------------------------------------------
const EXCLUDED_INTERFACES: Record<string, string> = {
  PlanDraft:
    "the file's own comment (app/src/pages/review/types.ts:80-82) states this type keeps SPA-internal field names for the editor's draft state, distinct from the wire response shape (EvaluationPlan) it maps to/from on load/save -- it is never itself a server response.",
};

interface PopulationMember {
  key: string; // "file#Interface.field"
  file: string;
  iface: string;
  field: string;
}

/** BASELINE half of the population (DEC-851 wave-5 amendment): every
 * `export interface` in a `pages/**\/types.ts` module. Deliberately left as
 * its own function, scanned by the ORIGINAL (export-only) `scanInterfaces`,
 * so the wave-12 widening below can be proven a strict superset of exactly
 * what this scan used to check -- see the subset-check test. */
function scanBaselinePopulation(): PopulationMember[] {
  const members: PopulationMember[] = [];
  for (const relFile of TARGET_FILES) {
    const src = readFileSync(join(ROOT, relFile), 'utf8');
    for (const decl of scanInterfaces(src)) {
      if (decl.name in EXCLUDED_INTERFACES) continue;
      for (const field of decl.fields) {
        members.push({ key: `${relFile}#${decl.name}.${field}`, file: relFile, iface: decl.name, field });
      }
    }
  }
  return members;
}

// ---------------------------------------------------------------------------
// WIRE half (DEC-851 wave 12) -- every `interface` (exported OR module-local
// -- most of the newly-admitted ones, e.g. EmbedsPanel.tsx's EventDetail,
// are declared without `export` and used only in their own file) declared
// anywhere under app/src, reached from an apiGet<T>/apiList<T>/apiPost<T>/
// apiPatch<T>/apiPut<T> call site -- directly, or through a named `type X =
// ...` alias chain.
// ---------------------------------------------------------------------------

/** Same depth-tracking approach as findMatchingBrace, generalised to all
 * four bracket pairs so it can find the matching `>` that closes a generic
 * call's type argument (which may itself contain `{`, `[`, `(`, or a nested
 * `<...>`, e.g. `apiPost<{ items: FormField[] }>` or `Record<string,
 * number>`). */
function findMatchingAngle(src: string, openIdx: number): number {
  let depth = 0;
  const modeStack: Mode[] = ['CODE'];
  for (let i = openIdx; i < src.length; i++) {
    const top = modeStack[modeStack.length - 1];
    const ch = src[i];
    if (top === 'CODE') {
      if (ch === "'") modeStack.push('SINGLE');
      else if (ch === '"') modeStack.push('DOUBLE');
      else if (ch === '`') modeStack.push('TEMPLATE');
      else if (ch === '<' || ch === '{' || ch === '[' || ch === '(') depth++;
      else if (ch === '>' || ch === '}' || ch === ']' || ch === ')') {
        depth--;
        if (depth === 0) return i;
      }
      continue;
    }
    if (ch === '\\') {
      i++;
      continue;
    }
    if ((top === 'SINGLE' && ch === "'") || (top === 'DOUBLE' && ch === '"') || (top === 'TEMPLATE' && ch === '`')) {
      modeStack.pop();
    }
  }
  return -1;
}

/** Every `(apiGet|apiList|apiPost|apiPatch|apiPut)<...>(` call site's raw
 * type-argument text, across every non-test .ts/.tsx file under app/src. */
const WIRE_CALL_RE = /\b(?:apiGet|apiList|apiPost|apiPatch|apiPut)</g;
function findWireCallTypeArgs(strippedSrc: string): string[] {
  const out: string[] = [];
  WIRE_CALL_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = WIRE_CALL_RE.exec(strippedSrc))) {
    const openIdx = m.index + m[0].length - 1;
    const closeIdx = findMatchingAngle(strippedSrc, openIdx);
    if (closeIdx === -1) continue;
    out.push(strippedSrc.slice(openIdx + 1, closeIdx));
  }
  return out;
}

/** `export interface Name {...}` OR module-local `interface Name {...}` --
 * the wire population admits both, unlike the export-only baseline scan
 * above (most newly-admitted interfaces, e.g. EmbedsPanel.tsx's local
 * `EventDetail`, are never exported -- they're declared and consumed in the
 * same file). */
function scanInterfaceDecls(strippedSrc: string): InterfaceDecl[] {
  const out: InterfaceDecl[] = [];
  const RE = /(?:export\s+)?\binterface\s+(\w+)(?:\s+extends\s+[\w<>,\s]+)?\s*\{/g;
  let m: RegExpExecArray | null;
  while ((m = RE.exec(strippedSrc))) {
    const openIdx = m.index + m[0].length - 1;
    const block = findMatchingBrace(strippedSrc, openIdx);
    const body = block.slice(1, -1);
    const fields: string[] = [];
    for (const seg of topLevelMembers(body)) {
      const nm = MEMBER_NAME_RE.exec(seg);
      if (nm) fields.push(nm[1] as string);
    }
    out.push({ name: m[1] as string, fields });
  }
  return out;
}

/** `(export )?type Name = <rhs>;`, `<rhs>` captured raw (not parsed) up to
 * the terminating top-level `;` -- resolved only to extract identifiers
 * from it (see resolveWireInterfaceNames), never to reproduce its shape. */
function scanTypeAliasRhs(strippedSrc: string): Map<string, string> {
  const out = new Map<string, string>();
  const RE = /(?:export\s+)?type\s+(\w+)(?:<[^=]*>)?\s*=\s*/g;
  let m: RegExpExecArray | null;
  while ((m = RE.exec(strippedSrc))) {
    const startIdx = m.index + m[0].length;
    let depth = 0;
    let end = -1;
    for (let i = startIdx; i < strippedSrc.length; i++) {
      const ch = strippedSrc[i];
      if (ch === '{' || ch === '[' || ch === '(' || ch === '<') depth++;
      else if (ch === '}' || ch === ']' || ch === ')' || ch === '>') depth--;
      else if (ch === ';' && depth === 0) {
        end = i;
        break;
      }
    }
    if (end === -1) continue;
    out.set(m[1] as string, strippedSrc.slice(startIdx, end));
  }
  return out;
}

// Utility/generic type names that are never themselves a wire interface --
// excluded so e.g. `Omit<SendResult, 'skipped'>` resolves to SendResult, not
// to a bogus "Omit" lookup (which would no-op anyway, since no `interface
// Omit` exists, but naming the exclusion makes the intent explicit).
const NON_WIRE_TYPE_NAMES = new Set([
  'Array', 'Record', 'Promise', 'Partial', 'Omit', 'Pick', 'Readonly', 'Required', 'Exclude', 'Extract',
  'NonNullable', 'ReturnType', 'InstanceType', 'Map', 'Set', 'Date', 'Error', 'Object', 'Function',
  'Uint8Array', 'FormData', 'Blob', 'ArrayBuffer', 'JSON', 'Math', 'String', 'Number', 'Boolean',
]);

/** Every capitalised identifier in `text` (string literals stripped first,
 * so a union-of-literals member like `'sent' | 'failed'` never contributes
 * a bogus name) -- a cheap net; only names that resolve against a REAL
 * interface/alias declaration below ever do anything. */
function extractCapitalizedIdentifiers(text: string): string[] {
  const stripped = text.replace(/'(?:\\.|[^'\\])*'/g, "''").replace(/"(?:\\.|[^"\\])*"/g, '""');
  const names = new Set<string>();
  const RE = /\b([A-Z][A-Za-z0-9_]*)\b/g;
  let m: RegExpExecArray | null;
  while ((m = RE.exec(stripped))) names.add(m[1] as string);
  return [...names];
}

interface WireRegistry {
  /** interface name -> every file that declares it (name collisions across
   * files, e.g. `Track` in review/types.ts and submissions/types.ts, are
   * resolved by admitting ALL of them -- safe over-inclusion for a scan
   * whose job is to catch a missing reader, never under-inclusion). */
  interfaceOwners: Map<string, string[]>;
  interfaceFields: Map<string, string[]>; // "file#Name" -> fields
  aliasRhs: Map<string, string>; // alias name -> raw RHS text (last writer wins)
  callSiteTypeArgs: string[];
}

let wireRegistryCache: WireRegistry | null = null;
function buildWireRegistry(): WireRegistry {
  if (wireRegistryCache) return wireRegistryCache;
  const interfaceOwners = new Map<string, string[]>();
  const interfaceFields = new Map<string, string[]>();
  const aliasRhs = new Map<string, string>();
  const callSiteTypeArgs: string[] = [];

  for (const absPath of walk(APP_SRC_DIR)) {
    const file = relPath(absPath);
    const stripped = stripComments(readFileSync(absPath, 'utf8'));

    for (const decl of scanInterfaceDecls(stripped)) {
      if (!interfaceOwners.has(decl.name)) interfaceOwners.set(decl.name, []);
      interfaceOwners.get(decl.name)!.push(file);
      interfaceFields.set(`${file}#${decl.name}`, decl.fields);
    }
    for (const [name, rhs] of scanTypeAliasRhs(stripped)) {
      aliasRhs.set(name, rhs);
    }
    callSiteTypeArgs.push(...findWireCallTypeArgs(stripped));
  }

  wireRegistryCache = { interfaceOwners, interfaceFields, aliasRhs, callSiteTypeArgs };
  return wireRegistryCache;
}

/** Resolves every call-site type argument to the set of interface names it
 * reaches -- directly (`apiGet<Foo>`), through an inline reference buried in
 * an object-literal/array type argument (`apiGet<{ items: Foo[] }>`), or
 * through a named type alias chain (`apiPost<ComposeSendResult>` where
 * `ComposeSendResult = Omit<SendResult, 'skipped'> & {...}` resolves to
 * SendResult). Cycle-safe via visitedAlias. */
function resolveWireInterfaceNames(registry: WireRegistry): Set<string> {
  const result = new Set<string>();
  const visitedAlias = new Set<string>();
  function visit(name: string): void {
    if (NON_WIRE_TYPE_NAMES.has(name)) return;
    if (registry.interfaceOwners.has(name)) result.add(name);
    if (registry.aliasRhs.has(name) && !visitedAlias.has(name)) {
      visitedAlias.add(name);
      for (const n of extractCapitalizedIdentifiers(registry.aliasRhs.get(name) as string)) visit(n);
    }
  }
  for (const argText of registry.callSiteTypeArgs) {
    for (const n of extractCapitalizedIdentifiers(argText)) visit(n);
  }
  return result;
}

/** WIRE half of the population: every field on every interface
 * resolveWireInterfaceNames finds, from every file that declares it. */
function scanWirePopulation(): PopulationMember[] {
  const registry = buildWireRegistry();
  const wireNames = resolveWireInterfaceNames(registry);
  const members: PopulationMember[] = [];
  for (const name of wireNames) {
    if (name in EXCLUDED_INTERFACES) continue;
    for (const file of registry.interfaceOwners.get(name) ?? []) {
      const fields = registry.interfaceFields.get(`${file}#${name}`) ?? [];
      for (const field of fields) {
        members.push({ key: `${file}#${name}.${field}`, file, iface: name, field });
      }
    }
  }
  return members;
}

/** DEC-851 (wave 12): the population is now the UNION of the baseline
 * (`pages/**\/types.ts`, export-only -- unchanged from wave 5) and the WIRE
 * half above, deduplicated by key so a name that lives in both (e.g.
 * `EvaluationPlan`, already in review/types.ts AND reachable from a call
 * site) contributes exactly one row. */
function scanPopulation(): PopulationMember[] {
  const byKey = new Map<string, PopulationMember>();
  for (const m of scanBaselinePopulation()) byKey.set(m.key, m);
  for (const m of scanWirePopulation()) byKey.set(m.key, m);
  return [...byKey.values()];
}

// ---------------------------------------------------------------------------
// Reader search -- every non-test .ts/.tsx file under app/src (excluding the
// three target files themselves, which only DECLARE the fields) is searched
// for a property access, a destructure, or a quoted string key naming the
// field.
// ---------------------------------------------------------------------------
function isTestFile(path: string): boolean {
  return /\.(test|spec)\.(ts|tsx)$/.test(path);
}

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === 'dist' || name === '.git') continue;
    const full = join(dir, name);
    const stat = statSync(full);
    if (stat.isDirectory()) out.push(...walk(full));
    else if (/\.(ts|tsx)$/.test(name) && !isTestFile(name)) out.push(full);
  }
  return out;
}

function relPath(absPath: string): string {
  return relative(ROOT, absPath).split('\\').join('/');
}

/** Blanks out the BODY of every `interface Name { ... }` declaration
 * (export or module-local) in `src`, replacing non-newline characters with
 * spaces so line numbers are unaffected. DEC-851 (wave 12): the widened
 * population admits module-local interfaces that are declared AND consumed
 * in the SAME file (e.g. EmbedsPanel.tsx's local `EventDetail`) -- unlike
 * the baseline population, whose declaring files (pages/**\/types.ts) are
 * wholesale-excluded from the reader search, these declaring files stay IN
 * the search pool (real usage lives right below the declaration). Without
 * this mask, a field's own FIRST position in its interface body
 * self-matches the destructure/shorthand reader pattern (`{\s*id` matches
 * the interface's own opening `{` immediately followed by its first
 * member) -- a false "read" that would have hidden a real DEC-851 finding
 * the moment the population widened past pages/**\/types.ts. */
/** Same as stripComments, but LENGTH-PRESERVING (comment characters become
 * spaces rather than being dropped) -- used only to find brace boundaries
 * safely (a comment like "// see the { legacy shape }" must never unbalance
 * findMatchingBrace's depth count) while keeping the blanked span aligned
 * with the original src for the actual masking below. */
function blankCommentsPreserveLength(src: string): string {
  let out = '';
  const modeStack: Mode[] = ['CODE'];
  for (let i = 0; i < src.length; i++) {
    const top = modeStack[modeStack.length - 1];
    const ch = src[i];
    if (top === 'CODE') {
      if (ch === '/' && src[i + 1] === '/') {
        const nl = src.indexOf('\n', i);
        const end = nl === -1 ? src.length : nl;
        out += ' '.repeat(end - i);
        i = end - 1;
        continue;
      }
      if (ch === '/' && src[i + 1] === '*') {
        const end = src.indexOf('*/', i + 2);
        const stop = end === -1 ? src.length : end + 2;
        out += src.slice(i, stop).replace(/[^\n]/g, ' ');
        i = stop - 1;
        continue;
      }
      if (ch === "'") modeStack.push('SINGLE');
      else if (ch === '"') modeStack.push('DOUBLE');
      else if (ch === '`') modeStack.push('TEMPLATE');
      out += ch;
      continue;
    }
    out += ch;
    if (ch === '\\') {
      i++;
      out += src[i] ?? '';
      continue;
    }
    if ((top === 'SINGLE' && ch === "'") || (top === 'DOUBLE' && ch === '"') || (top === 'TEMPLATE' && ch === '`')) {
      modeStack.pop();
    }
  }
  return out;
}

function maskInterfaceBodies(src: string): string {
  const commentSafe = blankCommentsPreserveLength(src);
  const RE = /(?:export\s+)?\binterface\s+\w+(?:\s+extends\s+[\w<>,\s]+)?\s*\{/g;
  let out = src;
  let m: RegExpExecArray | null;
  RE.lastIndex = 0;
  while ((m = RE.exec(commentSafe))) {
    const openIdx = m.index + m[0].length - 1;
    const block = findMatchingBrace(commentSafe, openIdx);
    const masked = block.replace(/[^\n]/g, ' ');
    out = out.slice(0, openIdx) + masked + out.slice(openIdx + block.length);
    RE.lastIndex = openIdx + block.length;
  }
  return out;
}

let candidateFilesCache: { path: string; src: string }[] | null = null;
function candidateFiles(): { path: string; src: string }[] {
  if (candidateFilesCache) return candidateFilesCache;
  candidateFilesCache = walk(APP_SRC_DIR)
    .map((abs) => ({ path: relPath(abs), src: maskInterfaceBodies(readFileSync(abs, 'utf8')) }))
    .filter((f) => !TARGET_FILES.includes(f.path));
  return candidateFilesCache;
}

function readerPatterns(field: string): RegExp[] {
  const esc = field.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return [
    new RegExp(`\\.${esc}\\b`), // property access: x.field
    new RegExp(`[{,]\\s*${esc}\\b`), // destructure / shorthand: { field } / { a, field }
    new RegExp(`['"]${esc}['"]`), // quoted string key: 'field' / "field"
  ];
}

/** True if any non-test app/src file (other than the three target type
 * files) contains a reader for `field`. Exported so the population/ledger
 * honesty tests below can reuse it. */
function hasReader(field: string, files: { path: string; src: string }[] = candidateFiles()): boolean {
  const patterns = readerPatterns(field);
  return files.some((f) => patterns.some((re) => re.test(f.src)));
}

// ---------------------------------------------------------------------------
// Ledger -- every field STILL unread as of this task's own closing run of the
// scan, each with an 'exempt' verdict and a principled reason (never a
// branch, never "unreviewed"/"later wave" -- see the DEFERRAL_RE check
// below). Fields this task WIRED a reader for, or DELETED from the wire
// entirely, are proven by their own dedicated tests further down and never
// appear here, because after the fix they are no longer unread.
// ---------------------------------------------------------------------------
interface LedgerEntry {
  key: string;
  verdict: 'exempt';
  reason: string;
}

const LEDGER: LedgerEntry[] = [
  {
    key: 'app/src/pages/comms/types.ts#EmailLogDetail.bodyHtml',
    verdict: 'exempt',
    reason:
      "DEC-833's own text is explicit that GET .../email-log/:emailId 'returns the full stored row' as the audit record ('it is shown as sent, including for a failed attempt') -- the route (src/routes/comms/email-log.ts) deliberately spreads the whole row rather than a narrowed projection, so deleting bodyHtml here would contradict the ruling's own full-row API contract. What DEC-833/DEC-846 mandate for DISPLAY is narrower: 'renders the stored subject and body verbatim' names bodyText only, and RecentSends.tsx's disclosure does exactly that -- rendering a second, HTML-vs-plaintext toggle inside the SPA's audit disclosure (the dev mailbox at src/routes/dev/mailbox.tsx already owns that view, unredacted, dev-only) is a distinct product surface no decision or design mock asks for.",
  },
  {
    key: 'app/src/pages/comms/types.ts#EmailLogDetail.icsText',
    verdict: 'exempt',
    reason:
      "same DEC-833 'full stored row is the audit record' rationale as bodyHtml above -- the API contract intentionally returns it, but no decision or design mock asks the SPA's 'Show what was sent' disclosure to render a raw ICS body or offer a download; that surface already exists, dev-only, at src/routes/dev/mailbox.tsx's calendar-invite download link.",
  },
  {
    key: 'app/src/pages/comms/types.ts#EmailLogDetail.icsFilename',
    verdict: 'exempt',
    reason:
      "same DEC-833 'full stored row' rationale as icsText immediately above -- it names the file icsText would download as, so it stands or falls with that field's own exemption; no SPA surface downloads the ICS body this filename would label.",
  },
  {
    key: 'app/src/pages/overview/types.ts#SpeakersAggregate.contactsOwing',
    verdict: 'exempt',
    reason:
      "DEC-370's own text names the v1 aggregate keys (including speakers, which carries this field) as 'RETAINED verbatim so the nav badge (DEC-369) and any other reader keep working' -- a payload-stability contract, not an oversight. overdueAssignments (this interface's sibling field) IS read by useNavExceptions.ts; contactsOwing has no design mock asking for a second, distinct roster-population number on Overview's nav badge or headline, so wiring one would be inventing a UI fact DEC-370 never asked for.",
  },
  {
    key: 'app/src/pages/overview/types.ts#ContentAggregate.awaitingApproval',
    verdict: 'exempt',
    reason:
      "same DEC-370 'v1 aggregate keys RETAINED verbatim' rationale as SpeakersAggregate.contactsOwing above -- content.awaitingApproval is one of the same named-and-retained v1 keys, kept for payload-contract stability rather than because a v2 screen currently displays it (contentApproval.total, a distinct v2 field, is what Overview's own worklist section reads instead).",
  },
  {
    key: 'app/src/pages/speakers/types.ts#OnboardingGridCounts.outstandingContacts',
    verdict: 'exempt',
    reason:
      "DEC-340 names counts:{speakers, outstandingRequired, overdue, outstandingContacts} as the binding GET .../onboarding wire contract, and DEC-776 rules outstandingContacts governs the SAME chase-predicate population as outstandingRequired/the portal task list -- it is a contractually-named aggregate, not a display number the header row was ever asked to print alongside 'N accepted / M tasks open / K overdue' (OnboardingGrid.tsx renders exactly those three, by DEC-776's own text).",
  },
  {
    key: 'app/src/pages/review/types.ts#ResultsRow.perCriterion',
    verdict: 'exempt',
    reason:
      "superseded by an existing design ruling, not an oversight: DEC-737 explicitly moved per-criterion detail off the results row (removing the 'column per rating criterion' spreadsheet) and INTO the per-review Reviews disclosure, which renders each evaluation's own criterion/score pairs from SubmissionEvaluationItem.criteria+scores instead -- this field's plan-wide MEAN per criterion has no design-sanctioned surface left to land on; inventing one is a product decision, not a missing wire-up.",
  },
  {
    key: 'app/src/pages/content/types.ts#DeliverableFile.contentType',
    verdict: 'exempt',
    reason:
      "no decision or design mock documents a UI obligation for a file's MIME type (unlike authorRole, which DEC-020's own header explicitly promised and this task wired) -- a content type is ordinarily spent server-side as the HTTP response header when a file is streamed/downloaded, not a fact a person reads on screen; inventing a text display for it is a product decision outside this task's narrow scope, flagged in this task's report rather than decided here.",
  },
  {
    key: 'app/src/pages/content/types.ts#DeliverableFile.uploadedByContactId',
    verdict: 'exempt',
    reason:
      "uploaderName already satisfies this row's author-attribution fact (DEC-020); the raw contact id carries no documented UI obligation, and this repo's authz invariant enforces every ownership-gated write server-side (never inferred client-side from an id sitting on a list row) -- inventing a client-side identity comparison here would be a product/security decision outside this task's narrow scope, flagged in this task's report rather than decided here.",
  },
  {
    key: 'app/src/pages/content/types.ts#EventFileChainItem.versionCount',
    verdict: 'exempt',
    reason:
      "DEC-902 explicitly rules this field OUT as the library's VERSION column value ('never versionCount, a chain-length marker') and names versionNo as the one that IS the identity shown -- no design mock or decision asks for a separate 'N versions in this chain' count display, so there is no documented UI obligation this task can wire a reader against without inventing new copy, which is a product decision outside this task's narrow scope.",
  },
  {
    key: 'app/src/pages/forms/types.ts#CfpForm.isDefault',
    verdict: 'exempt',
    reason:
      "DEC-851 wave-12 finding, uncovered only once the interface-body mask closed a false-positive match on a documentation comment (app/src/pages/speakers/TaskModal.tsx's '{id, title, isDefault}' prose, never real code). DEC-398's own text names the field's one obligation: listFormsForEvent (src/server/repo/forms.ts:107-121) returns the event's forms 'default first then title' -- a SORT KEY the server already spends so every array-order consumer gets it for free, never a boolean a screen was asked to render as a '(Default)' badge or use to preselect a control. No decision or design mock documents that second, distinct UI obligation.",
  },
  {
    key: 'app/src/pages/speakers/types.ts#EventForm.isDefault',
    verdict: 'exempt',
    reason:
      "same DEC-398 'default first then title is a server-spent sort key, not a client-rendered fact' rationale as CfpForm.isDefault above -- EventForm is the sibling wire shape {id, title, isDefault} DEC-398's own header names for exactly this list (GET .../forms's additive `forms` key), consumed by TaskModal.tsx's form-task picker in array order; no decision or design mock asks that select to badge or preselect the default entry.",
  },
];

describe('wire-field-reader.scan (DEC-851/DEC-358 w1-d): a declared response field with no reader is a lie', () => {
  const population = scanPopulation();

  // DEC-851 wave-5 amendment: the population is now a directory walk of all
  // nine app/src/pages/**/types.ts modules (was three, hand-listed) -- the
  // tripwire is raised proportionally (measured population is 645) so a
  // broken walk (e.g. one that silently falls back to zero, or only finds
  // a handful of pages) fails loudly instead of passing vacuously.
  //
  // DEC-851 (wave 12): the population is now the WIRE, not the filename
  // convention -- the baseline (pages/**/types.ts) is proven a strict
  // subset below, and the union is measurably larger (~840+), so the
  // tripwire is raised again for the same reason: a broken alias/call-site
  // resolver silently falling back to "baseline only" must fail loudly.
  it('tripwire: the widened wire population declares at least 800 response-shaped fields, never hardcoded', () => {
    expect(population.length).toBeGreaterThanOrEqual(800);
  });

  // DEC-851 (wave 12): the widening must be provably ADDITIVE, never a
  // narrowing in disguise -- every (file, interface, field) key the OLD
  // (export-only, pages/**/types.ts-only) scan found is still present in
  // the widened population.
  it('the widened population is a strict superset of the wave-5 baseline (pages/**/types.ts, export-only)', () => {
    const baselineKeys = new Set(scanBaselinePopulation().map((m) => m.key));
    const widenedKeys = new Set(population.map((m) => m.key));
    const missing = [...baselineKeys].filter((k) => !widenedKeys.has(k));
    expect(missing, missing.join('\n')).toEqual([]);
    expect(widenedKeys.size).toBeGreaterThan(baselineKeys.size);
  });

  // DEC-851 (wave 12): the widening actually admits interfaces that live
  // OUTSIDE pages/**/types.ts -- proves the population is the wire, not
  // still secretly bounded by the old directory walk.
  it('the widened population includes at least one interface declared outside pages/**/types.ts', () => {
    const outside = population.filter((m) => !TARGET_FILES.includes(m.file));
    expect(outside.length).toBeGreaterThan(0);
    const outsideFiles = new Set(outside.map((m) => m.file));
    // Spot-check three of the ten confirmed-outside modules from this
    // task's own evidence.
    expect(outsideFiles.has('app/src/pages/speakers/speakerDetail.ts')).toBe(true);
    expect(outsideFiles.has('app/src/lib/useNavExceptions.ts')).toBe(true);
    expect(outsideFiles.has('app/src/pages/agenda/BreaksPanel.tsx')).toBe(true);
  });

  it('the excluded-interfaces list only names interfaces that actually exist in the target files (an exclusion for a dead name hides nothing)', () => {
    const allInterfaceNames = new Set<string>();
    for (const relFile of TARGET_FILES) {
      const src = readFileSync(join(ROOT, relFile), 'utf8');
      for (const decl of scanInterfaces(src)) allInterfaceNames.add(decl.name);
    }
    for (const name of Object.keys(EXCLUDED_INTERFACES)) {
      expect(allInterfaceNames.has(name), `excluded interface ${name} not found in any target file`).toBe(true);
    }
  });

  it('every excluded interface has a non-empty reason', () => {
    for (const [name, reason] of Object.entries(EXCLUDED_INTERFACES)) {
      expect(reason.trim().length, `excluded interface ${name} has an empty reason`).toBeGreaterThan(0);
    }
  });

  it("every population member the scan finds unread has exactly one ledger row, and no ledger row cites a field that reads clean (a ledger row exists ONLY for a real finding)", () => {
    const unread = population.filter((m) => !hasReader(m.field));
    const unreadKeys = new Set(unread.map((m) => m.key));

    const problems: string[] = [];
    for (const m of unread) {
      const count = LEDGER.filter((e) => e.key === m.key).length;
      if (count === 0) problems.push(`unread field with no ledger row: ${m.key}`);
      else if (count > 1) problems.push(`unread field with ${count} ledger rows (must be exactly 1): ${m.key}`);
    }
    for (const entry of LEDGER) {
      if (!unreadKeys.has(entry.key)) {
        problems.push(`ledger row cites a field that is NOT unread (stale row, or the fix already landed and the row wasn't deleted): ${entry.key}`);
      }
    }
    expect(problems, problems.join('\n')).toEqual([]);
  });

  it('every ledger row has a non-empty reason', () => {
    for (const entry of LEDGER) {
      expect(entry.reason.trim().length, `ledger row ${entry.key} has an empty reason`).toBeGreaterThan(0);
    }
  });

  it('the FileComment.authorRole finding is fixed: CommentThread.tsx now reads authorRole', () => {
    const files = candidateFiles();
    expect(hasReader('authorRole', files)).toBe(true);
    const commentThread = files.find((f) => f.path === 'app/src/pages/content/CommentThread.tsx');
    expect(commentThread, 'CommentThread.tsx not found under app/src').toBeTruthy();
    expect(commentThread!.src.includes('c.authorRole')).toBe(true);
  });

  it('the ReviewerQueueItem.ratingsCount finding is fixed: ReviewerQueue.tsx now reads ratingsCount (DEC-239/DEC-251 re-closure)', () => {
    const files = candidateFiles();
    expect(hasReader('ratingsCount', files)).toBe(true);
    const reviewerQueue = files.find((f) => f.path === 'app/src/pages/review/ReviewerQueue.tsx');
    expect(reviewerQueue, 'ReviewerQueue.tsx not found under app/src').toBeTruthy();
    expect(reviewerQueue!.src.includes('item.ratingsCount')).toBe(true);
  });

  it('latestFileVersionNo was deleted from ContentSubmissionListItem (the other real closure this task made -- server projection matched to the wire deletion)', () => {
    const src = readFileSync(join(ROOT, 'app/src/pages/content/types.ts'), 'utf8');
    const decl = scanInterfaces(src).find((d) => d.name === 'ContentSubmissionListItem');
    expect(decl).toBeTruthy();
    expect(decl!.fields).not.toContain('latestFileVersionNo');
    const serverSrc = readFileSync(join(ROOT, 'src/server/repo/submissions/list.ts'), 'utf8');
    // The server still computes the number as a LOCAL (it derives `reuploaded`
    // from it) but must not put it back on the wire object literal returned
    // to the client.
    expect(/^\s*latestFileVersionNo,\s*$/m.test(serverSrc)).toBe(false);
  });

  it('the SavedView.createdByUserId finding is fixed (DEC-851 wave 12, DEC-975): ViewTabs.tsx now reads it to gate the per-row Delete control the same way the server does', () => {
    const files = candidateFiles();
    expect(hasReader('createdByUserId', files)).toBe(true);
    const viewTabs = files.find((f) => f.path === 'app/src/pages/submissions/ViewTabs.tsx');
    expect(viewTabs, 'ViewTabs.tsx not found under app/src').toBeTruthy();
    expect(viewTabs!.src.includes('view.createdByUserId')).toBe(true);
  });
});

describe('wire-field-reader.scan internals (negative controls, DEC-518 wave-35 amendment: every scan ships one)', () => {
  it('scanInterfaces finds a simple interface\'s top-level fields, ignoring a nested inline object type\'s own sub-fields', () => {
    const src = `
      export interface Simple {
        id: string;
        nested: { inner: number; other: string };
        optional?: boolean;
      }
    `;
    const decls = scanInterfaces(src);
    expect(decls).toHaveLength(1);
    expect(decls[0]!.name).toBe('Simple');
    expect(decls[0]!.fields).toEqual(['id', 'nested', 'optional']);
  });

  it('scanInterfaces does not fracture a generic type argument list on its internal commas/semicolons-free structure', () => {
    const src = `
      export interface WithGeneric {
        scores: Record<string, number | string>;
        perDropdown: Record<string, { counts: Record<string, number>; modal: string | null }>;
      }
    `;
    const decls = scanInterfaces(src);
    expect(decls[0]!.fields).toEqual(['scores', 'perDropdown']);
  });

  it('scanInterfaces handles `extends`', () => {
    const src = `
      export interface Base { id: string; }
      export interface Child extends Base {
        extra: number;
      }
    `;
    const decls = scanInterfaces(src);
    expect(decls.map((d) => d.name)).toEqual(['Base', 'Child']);
    expect(decls[1]!.fields).toEqual(['extra']);
  });

  it('hasReader finds a property-access reader', () => {
    const files = [{ path: 'a.tsx', src: 'function f(x: T) { return x.myField; }' }];
    expect(hasReader('myField', files)).toBe(true);
  });

  it('hasReader finds a destructure reader', () => {
    const files = [{ path: 'a.tsx', src: 'const { other, myField } = res;' }];
    expect(hasReader('myField', files)).toBe(true);
  });

  it('hasReader finds a quoted-string-key reader', () => {
    const files = [{ path: 'a.tsx', src: "const v = row['myField'];" }];
    expect(hasReader('myField', files)).toBe(true);
  });

  it('hasReader returns false when the field name never appears', () => {
    const files = [{ path: 'a.tsx', src: 'function f(x: T) { return x.otherField; }' }];
    expect(hasReader('myField', files)).toBe(false);
  });

  it('hasReader is not fooled by a field name that is only a substring of a longer identifier', () => {
    const files = [{ path: 'a.tsx', src: 'const myFieldExtra = 1; function f(x: T) { return x.myFieldWithSuffix; }' }];
    expect(hasReader('myField', files)).toBe(false);
  });
});
