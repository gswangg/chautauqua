// DEC-037 amendment (wave 24, task w24-e): every emitted document declares
// its language. The defect that motivated this scan: src/mail/shell.ts --
// the ONE document that leaves the app entirely, into mail clients with no
// other language signal -- emitted a bare `<html>` while every in-app
// server-rendered document (root.tsx, public/shell.tsx, public/
// programme.tsx, public/submit-views.tsx, portal/shared.tsx,
// auth-views.tsx, account.tsx, docs.tsx, dev/mailbox.tsx,
// server/not-found.tsx, server/http.ts) already carried `lang="en"`. Rather
// than hand-list those files (a list drifts the moment a new route is
// added -- FINDINGS "A REF LIST IS A SNAPSHOT"), this scan enumerates
// EVERY .ts/.tsx file under src/ at run time and requires every `<html`
// occurrence -- JSX (`<html lang="en">`) or template-string
// (`<html lang="en">` inside a backtick literal) -- to carry a `lang=`
// attribute in the same opening tag.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = join(__dirname, "..");
const SRC_ROOT = join(ROOT, "src");

function isTestFile(path: string): boolean {
  return /\.(test|spec)\.(ts|tsx)$/.test(path);
}

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      out.push(...walk(full));
    } else if (stat.isFile() && (full.endsWith(".ts") || full.endsWith(".tsx")) && !isTestFile(full)) {
      out.push(full);
    }
  }
  return out;
}

interface Offender {
  file: string;
  line: number;
  tag: string;
}

// Matches an opening `<html ...>` tag, JSX or template-string alike, up to
// its closing `>`. `<html>` (start of the malformed shell) is included by
// this pattern -- it simply has no `lang=` inside its captured tag body.
const HTML_TAG = /<html([^>]*)>/g;

export function findMissingLangDocuments(root: string, repoRoot: string): Offender[] {
  const offenders: Offender[] = [];
  for (const file of walk(root)) {
    const rel = relative(repoRoot, file).split("\\").join("/");
    const contents = readFileSync(file, "utf8");
    HTML_TAG.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = HTML_TAG.exec(contents)) !== null) {
      const tagBody = match[1] ?? "";
      if (!/\blang\s*=/.test(tagBody)) {
        const upTo = contents.slice(0, match.index);
        const line = upTo.split("\n").length;
        offenders.push({ file: rel, line, tag: match[0] });
      }
    }
  }
  return offenders.sort((a, b) => (a.file === b.file ? a.line - b.line : a.file.localeCompare(b.file)));
}

describe("ssr-document-lang scan (DEC-037 amendment, wave 24): every emitted <html> declares lang", () => {
  it("scanned at least 1 file under src/", () => {
    expect(walk(SRC_ROOT).length).toBeGreaterThan(0);
  });

  it("no <html ...> tag under src/ is missing a lang= attribute", () => {
    const offenders = findMissingLangDocuments(SRC_ROOT, ROOT);
    const message = offenders.map((o) => `${o.file}:${o.line} -- ${o.tag}`).join("\n");
    expect(offenders, message).toEqual([]);
  });

  it("src/mail/shell.ts genuinely declares an <html> tag (proves the scan isn't vacuous for the case that motivated it)", () => {
    const contents = readFileSync(join(ROOT, "src/mail/shell.ts"), "utf8");
    expect(/<html\s+lang="en">/.test(contents)).toBe(true);
  });

  it("negative control: a bare <html> tag with no lang= IS detected", () => {
    const synthetic = 'return `<!doctype html>\n<html>\n  <head></head>\n</html>`;';
    const HTML_TAG_LOCAL = /<html([^>]*)>/g;
    let match: RegExpExecArray | null;
    let found = false;
    while ((match = HTML_TAG_LOCAL.exec(synthetic)) !== null) {
      if (!/\blang\s*=/.test(match[1] ?? "")) found = true;
    }
    expect(found).toBe(true);
  });

  it("negative control: an <html lang=...> tag is NOT detected", () => {
    const synthetic = 'return `<!doctype html>\n<html lang="en">\n  <head></head>\n</html>`;';
    const HTML_TAG_LOCAL = /<html([^>]*)>/g;
    let match: RegExpExecArray | null;
    let found = false;
    while ((match = HTML_TAG_LOCAL.exec(synthetic)) !== null) {
      if (!/\blang\s*=/.test(match[1] ?? "")) found = true;
    }
    expect(found).toBe(false);
  });
});
