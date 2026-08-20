// Decomposed out of phone-horizontal-overflow.scan.test.ts (contention
// hotspot decomposition, no behavior change): file/module population
// discovery and CSS-in-TS literal extraction. See that test file's own
// header comment for the full population/derivation rationale (DEC-808).
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

/** Every file under `root` whose name ends with `extension`, enumerated rather than named (DEC-808). */
export function allFiles(root: string, extension: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(root, { withFileTypes: true, recursive: true })) {
    if (!entry.isFile() || !entry.name.endsWith(extension)) continue;
    out.push(join(entry.parentPath, entry.name));
  }
  return out.sort();
}

/**
 * Every `src/**\/*.ts` module (readdirSync recursive, DEC-808 -- never a
 * hand-listed manifest) whose SOURCE TEXT exports a CSS template-literal
 * constant (`export const X_CSS = ...`), excluding test files. Population is
 * derived from what a module's content actually declares, not from a
 * `.css.ts` filename convention -- src/views/theme.ts exports THEME_CSS
 * (loaded by every SSR surface, and the sheet that carries the SSR 44px
 * phone floor) but does not carry the `.css.ts` suffix, and a filename glob
 * silently drops it (DEC-808, wave-96 finding).
 */
export const CSS_EXPORT_RE = /export const [A-Z0-9_]*CSS\s*=\s*/;

export function cssModuleFiles(root: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(root, { withFileTypes: true, recursive: true })) {
    if (!entry.isFile() || !entry.name.endsWith('.ts') || entry.name.includes('.test.')) continue;
    const absPath = join(entry.parentPath, entry.name);
    if (CSS_EXPORT_RE.test(readFileSync(absPath, 'utf-8'))) out.push(absPath);
  }
  return out.sort();
}

/**
 * Parses `import { A, B } from "./relative"` statements in a CSS-in-TS
 * module's raw source and, for each imported name, resolves a same-repo
 * `export const NAME = [...]` string-literal array from the imported
 * module -- used to turn a selector-position `.${NAME[N]}` interpolation
 * back into its real class name instead of a bare `.`.
 */
export function resolveImportedArrayConstants(raw: string, fileDir: string): Map<string, string[]> {
  const out = new Map<string, string[]>();
  const importRe = /import\s*\{\s*([^}]+?)\s*\}\s*from\s*["'](\.[^"']+)["']/g;
  let m: RegExpExecArray | null;
  while ((m = importRe.exec(raw)) !== null) {
    const names = (m[1] ?? '').split(',').map((s) => s.trim()).filter(Boolean);
    const modPath = m[2] ?? '';
    const abs = join(fileDir, modPath.endsWith('.ts') ? modPath : `${modPath}.ts`);
    let modSrc: string;
    try {
      modSrc = readFileSync(abs, 'utf-8');
    } catch {
      continue; // module resolves outside this simple relative-.ts lookup (e.g. a barrel) -- not this scan's concern
    }
    for (const name of names) {
      const arrMatch = modSrc.match(new RegExp(`export const ${name}\\s*=\\s*\\[([^\\]]*)\\]`));
      if (!arrMatch) continue;
      const values = [...(arrMatch[1] ?? '').matchAll(/["']([^"']*)["']/g)].map((v) => v[1] ?? '');
      if (values.length > 0) out.set(name, values);
    }
  }
  return out;
}

/**
 * Extracts the literal CSS text out of a `export const X_CSS = \`...\`;`
 * module. A selector-position interpolation (`.${NAME[N]}`, e.g. agenda.css.ts's
 * `.${ACCENT_BOUND_CLASSES[0]}`) is RESOLVED to its real class name via
 * `resolveImportedArrayConstants` rather than stripped -- stripping it
 * produces a bare `.` selector that both hides the rule's true identity and
 * (worse) makes an unrelated rule's declarations collide with it under a
 * meaningless selector. Any interpolation that cannot be resolved this way
 * (content fragments like `${ERROR_STATES_CSS}`, which name another
 * module's own exported CSS constant, itself enumerated and scanned
 * separately as that file) is stripped exactly as before -- that stripping
 * is intentional there, never a silent drop of a selector's identity.
 * Unresolved selector-position interpolations (`.${...}` that isn't a
 * `NAME[N]` array-index this resolver can chase down) are recorded in
 * `skipped` so they surface loudly instead of silently becoming `.`.
 */
export function extractCssTsLiteral(raw: string, fileDir: string): { css: string; skipped: string[] } {
  const arrayConsts = resolveImportedArrayConstants(raw, fileDir);
  const skipped: string[] = [];
  const literals = [...raw.matchAll(/`([\s\S]*?)`/g)].map((m) => m[1] ?? '');
  const joined = literals.join('\n');
  const withSelectorsResolved = joined.replace(
    /\.\$\{\s*([A-Za-z0-9_]+)\[(\d+)\]\s*\}/g,
    (whole: string, name: string, idxStr: string) => {
      const values = arrayConsts.get(name);
      const value = values?.[Number(idxStr)];
      if (value === undefined) {
        skipped.push(whole);
        return whole; // left in place so the generic strip below still avoids a false "." ; recorded above for visibility
      }
      return `.${value}`;
    },
  );
  // Any remaining `.${...}` (unresolved) is a selector-position interpolation
  // this resolver could not chase down -- already loudly recorded above, so
  // it is safe to fold it into the generic content-fragment strip below
  // rather than let it leak through as a literal `${...}` token.
  return { css: withSelectorsResolved.replace(/\$\{[^}]*\}/g, ''), skipped };
}

/**
 * Neutralises `{`/`}` characters that appear INSIDE comments (e.g. this
 * codebase's own convention of quoting a design frame's Handlebars-ish
 * placeholder text in a comment, `/* Frame line 201: \`{{ h.when }}\` *\/`)
 * without changing the string's length or any other character -- every
 * later regex assumes brace nesting is exactly one level deep
 * (selector/body inside an @media, nothing inside a comment), and a
 * literal brace hiding in a comment breaks that assumption, which is not
 * merely wrong but catastrophically slow (the brace-balancing patterns
 * backtrack combinatorially over an unbalanced file). Length is
 * preserved so every character offset computed downstream still points at
 * the same place in the original file.
 */
export function sanitizeCommentBraces(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, (comment) => comment.replace(/[{}]/g, '·'));
}

export interface SourceFile {
  absPath: string;
  label: string;
  css: string;
}
