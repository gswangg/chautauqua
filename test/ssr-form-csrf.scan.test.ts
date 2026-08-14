// DEC-628 (wave 17 amendment): DEC-628 already enumerates the SERVER half of
// CSRF from source — test/security-invariants.test.ts scans src/routes/**
// for mutating registrations and fails loudly when one carries no CSRF
// middleware. Nothing enumerated the RENDERED half: src/routes/portal/
// shared.tsx:152 emitted `name="chq_csrf"` as a re-typed string literal
// instead of the imported CSRF_COOKIE_NAME (src/auth/cookies.ts) — a second
// copy of a name with one source of truth, silently stale the day that
// constant changes.
//
// Division of labour: test/security-invariants.test.ts owns the ROUTE side
// (every mutating registration carries csrf middleware, with CSRF_EXEMPT).
// THIS file owns the FORM side: every server-rendered `<form method="post">`
// in src/**/*.tsx must render a hidden input whose `name` is the constant
// expression `{CSRF_COOKIE_NAME}`, never a re-typed string literal, and the
// module emitting the form must import CSRF_COOKIE_NAME rather than
// declaring its own copy.

import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve, relative } from "node:path";
import { fileURLToPath } from "node:url";

const SRC_DIR = resolve(fileURLToPath(import.meta.url), "../../src");

/** Deliberate exceptions: forms whose CSRF token is rendered by an invoked
 * child component (so the token-bearing `<input>` never appears in the same
 * file as the `<form method="post">` open tag). Empty because every current
 * post form renders its own token inline — kept as a reviewable seam. */
const FORM_CSRF_ALLOWLIST: Array<{ file: string; formActionOrLineMarker: string; reason: string }> = [];

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

/** A `<form ...>` opening tag, captured as the whole tag text (which may
 * span multiple lines for multi-attribute forms) plus its start offset. */
interface FormOpenTag {
  tagText: string;
  startIndex: number;
  lineNumber: number;
}

/** Finds every `<form ...>` opening tag in `text`, non-greedy up to the
 * first `>` that isn't part of a `/>` self-close (forms are never
 * self-closing in JSX). */
function findFormOpenTags(text: string): FormOpenTag[] {
  const tags: FormOpenTag[] = [];
  const re = /<form\b[\s\S]*?>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const tagText = m[0];
    const startIndex = m.index;
    const lineNumber = text.slice(0, startIndex).split("\n").length;
    tags.push({ tagText, startIndex, lineNumber });
  }
  return tags;
}

/** Extracts the `method` attribute value from a form open tag, or null if
 * absent (JSX/HTML default GET). */
function extractMethod(tagText: string): string | null {
  const m = tagText.match(/\bmethod\s*=\s*["']([^"']+)["']/i);
  return m ? m[1]!.toLowerCase() : null;
}

/** Finds the index just past the matching `</form>` for a form opened at
 * `startIndex`, accounting for nested `<form` (never expected in JSX, but
 * counted defensively so a false negative can't hide a real gap). */
function findMatchingFormClose(text: string, afterOpenTagIndex: number): number {
  let depth = 1;
  const re = /<form\b[\s\S]*?>|<\/form\s*>/g;
  re.lastIndex = afterOpenTagIndex;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m[0].startsWith("</form")) {
      depth--;
      if (depth === 0) return m.index + m[0].length;
    } else {
      depth++;
    }
  }
  throw new Error(`unterminated <form> starting at index ${afterOpenTagIndex}`);
}

describe("ssr-form-csrf.scan: every rendered POST form carries the imported CSRF constant", () => {
  const files = listTsxFiles(SRC_DIR);
  expect(files.length).toBeGreaterThan(0);

  for (const file of files) {
    const rel = relative(SRC_DIR, file);
    const text = readFileSync(file, "utf8");
    const opens = findFormOpenTags(text);
    const postForms = opens.filter((tag) => extractMethod(tag.tagText) === "post");

    if (postForms.length === 0) continue;

    it(`${rel}: every method="post" form carries name={CSRF_COOKIE_NAME}`, () => {
      // The module must import the constant, never declare its own copy of
      // the cookie name literal.
      const importsConstant = /import\s*\{[^}]*\bCSRF_COOKIE_NAME\b[^}]*\}\s*from\s*["'][^"']*auth\/cookies["']/.test(
        text,
      );
      expect(
        importsConstant,
        `${rel} renders a POST form but does not import CSRF_COOKIE_NAME from auth/cookies — ` +
          `a form emitting its own token name literal desyncs from src/auth/cookies.ts the day that constant moves.`,
      ).toBe(true);

      for (const tag of postForms) {
        const closeIndex = findMatchingFormClose(text, tag.startIndex + tag.tagText.length);
        const body = text.slice(tag.startIndex, closeIndex);

        const allowlisted = FORM_CSRF_ALLOWLIST.some(
          (entry) => entry.file === rel && body.includes(entry.formActionOrLineMarker),
        );
        if (allowlisted) continue;

        const hasConstantNamedInput = /name=\{CSRF_COOKIE_NAME\}/.test(body);
        const hasReTypedLiteral = /name=["']chq_csrf["']/.test(body);

        expect(
          hasReTypedLiteral,
          `${rel}:${tag.lineNumber} form re-types the CSRF cookie name as a string ` +
            `literal instead of the imported CSRF_COOKIE_NAME constant.`,
        ).toBe(false);

        expect(
          hasConstantNamedInput,
          `${rel}:${tag.lineNumber} method="post" form has no hidden input named ` +
            `{CSRF_COOKIE_NAME} — either add one, or add a reasoned entry to ` +
            `FORM_CSRF_ALLOWLIST in test/ssr-form-csrf.scan.test.ts if the token is ` +
            `rendered by an invoked child component.`,
        ).toBe(true);
      }
    });
  }
});

describe("ssr-form-csrf.scan: allowlist entries are reviewable, not silent", () => {
  it("every allowlist entry states a reason", () => {
    for (const entry of FORM_CSRF_ALLOWLIST) {
      expect(entry.reason.length).toBeGreaterThan(20);
    }
  });
});
