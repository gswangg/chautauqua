// DEC-775 amendment (wave 23): ONE SERIALIZER PER WIRE FORMAT -- SCAN-LOCK.
//
// The repo emits five structured text formats, each with its own hard-won
// private escaper: ICS (src/mail/ics.ts), MIME (src/mail/email-binding.ts),
// XML (src/routes/public/feeds.ts), CSV (src/domain/csv.ts) and Markdown->HTML
// (src/lib/markdown.ts). SECOND READER INHERITS NO MANNERS applies here as
// SECOND WRITER: a future wave that hand-rolls a second ICS/CSV/XML builder
// inherits none of the first's escaping rules (control-byte stripping, CRLF
// folding, formula-neutralization, XML-name validation, ...) and nothing
// fails today. This scan enumerates every occurrence of each format's
// unmistakable signature literal across src/** and asserts, in both
// directions, that there is exactly one owner file for each -- and that the
// owner path still exists on disk, so a rename fails loudly instead of
// silently zeroing out the count.
//
// It also asserts that every route setting a text/calendar, text/csv, or
// application|text/xml content type imports the one owner module for that
// format -- catching a second emitter that builds the bytes inline without
// ever tripping the "exactly one file contains the signature literal" scan
// (because it never re-implements the signature literal itself, just skips
// the escaper).
//
// Deliberately a lightweight text scan (same shape as
// test/file-delete-ordering.scan.test.ts, whose stripComments is copied
// verbatim below) -- several of these signature literals also appear inside
// DEC-citation comments (e.g. this very file, and DEC-775.md's amendment
// text), so comments MUST be stripped first or the "exactly one file" count
// is polluted by every file that merely *mentions* BEGIN:VCALENDAR in a
// comment.

import { describe, expect, it } from "vitest";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";

const ROOT = join(__dirname, "..");
const SRC_ROOT = join(ROOT, "src");
const SKIP_DIRS = new Set(["node_modules", "dist", ".wrangler", "build", ".git"]);

/** Strips `//` line comments and `/* *\/` block comments, replacing every
 * stripped character with a space (newlines preserved verbatim) so the
 * output has EXACTLY the same length -- and therefore the same character
 * offsets and line numbers -- as `src`. String/template literals are
 * tracked so a `//` or `/*` inside a string (e.g. a URL) is never mistaken
 * for the start of a comment. Copied verbatim from
 * test/file-delete-ordering.scan.test.ts -- deliberately still a lightweight
 * text pass, not a real lexer. */
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

interface ScannedFile {
  abs: string;
  rel: string; // repo-relative, forward-slashed
  raw: string;
  stripped: string;
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

function scanAllFiles(): ScannedFile[] {
  const files: string[] = [];
  walk(SRC_ROOT, files);
  return files.map((abs) => {
    const raw = readFileSync(abs, "utf8");
    return {
      abs,
      rel: relative(ROOT, abs).split("\\").join("/"),
      raw,
      stripped: stripComments(raw),
    };
  });
}

interface FormatOwner {
  label: string;
  /** Signature literal, matched against comment-stripped source. */
  signature: RegExp;
  /** Repo-relative path of the one file allowed to contain the signature. */
  ownerRel: string;
}

const FORMAT_OWNERS: FormatOwner[] = [
  { label: "ICS (BEGIN:VCALENDAR)", signature: /BEGIN:VCALENDAR/, ownerRel: "src/mail/ics.ts" },
  { label: "MIME (multipart/alternative)", signature: /multipart\/alternative/, ownerRel: "src/mail/email-binding.ts" },
  { label: "XML (<?xml version)", signature: /<\?xml version/, ownerRel: "src/routes/public/feeds.ts" },
  { label: "CSV row serializer (export function toCsv)", signature: /export function toCsv/, ownerRel: "src/domain/csv.ts" },
  { label: "Markdown->HTML (export function renderMarkdown)", signature: /export function renderMarkdown/, ownerRel: "src/lib/markdown.ts" },
];

describe("one serializer per wire format -- signature-literal scan (DEC-775 wave-23 amendment)", () => {
  const files = scanAllFiles();

  for (const owner of FORMAT_OWNERS) {
    it(`${owner.label}: exactly one file under src/** contains the signature, and it is ${owner.ownerRel}`, () => {
      const ownerAbs = join(ROOT, owner.ownerRel);
      expect(
        existsSync(ownerAbs),
        `expected owner path ${owner.ownerRel} does not exist on disk -- it was renamed or deleted without updating ` +
          `this scan (a rename must fail loudly here, not silently zero out the "exactly one file" count below).`,
      ).toBe(true);

      const hits = files.filter((f) => owner.signature.test(f.stripped)).map((f) => f.rel);

      expect(
        hits.length,
        `${owner.label}: expected exactly one file to contain this signature (found ${hits.length}: ` +
          `${hits.join(", ") || "(none)"}). A second file re-implementing this wire format's signature literal ` +
          `inherits none of ${owner.ownerRel}'s escaping/folding manners -- SECOND WRITER INHERITS NO MANNERS. ` +
          `Route the second builder through ${owner.ownerRel} instead of hand-rolling it, or if this really is a ` +
          `deliberate second owner, it needs its own DEC amendment, not a silent second file.`,
      ).toBe(1);

      expect(
        hits[0],
        `${owner.label}: the one file containing this signature is ${hits[0]}, not the designated owner ` +
          `${owner.ownerRel} -- either the owner moved (update ownerRel above) or a second, undocumented ` +
          `serializer for this format has appeared.`,
      ).toBe(owner.ownerRel);
    });
  }
});

// -- content-type -> owner-import cross-check ------------------------------
//
// A second emitter doesn't have to re-implement the signature literal above
// to inherit no manners -- it can build the bytes some other way (e.g. wrap
// an opaque pre-built string) while still declaring the format's content
// type. So: every route/module that sets one of these three content types
// must import the corresponding owner module, UNLESS it IS the owner module,
// or it is named in CONTENT_TYPE_IMPORT_LEDGER below with a stated reason.

interface ContentTypeRule {
  label: string;
  contentType: RegExp;
  ownerRel: string;
}

const CONTENT_TYPE_RULES: ContentTypeRule[] = [
  { label: "text/calendar", contentType: /text\/calendar/, ownerRel: "src/mail/ics.ts" },
  { label: "text/csv", contentType: /text\/csv/, ownerRel: "src/domain/csv.ts" },
  { label: "application/xml or text/xml", contentType: /(application|text)\/xml/, ownerRel: "src/routes/public/feeds.ts" },
];

/** Ledgered exceptions: a file that sets one of the three content types
 * above WITHOUT importing the owner module, because it legitimately does
 * not construct the format's bytes itself (it wraps an already-serialized
 * value built upstream by the owner). Two-directional, same shape as the
 * DEC-713 delete-ordering ledger: an entry here that no longer matches a
 * real, currently-unimported content-type site is stale and fails loudly
 * (delete the line), just as an unledgered offender fails loudly (import
 * the owner, or add a ledger line with a reason). */
const CONTENT_TYPE_IMPORT_LEDGER: { file: string; contentType: string; reason: string }[] = [
  {
    file: "src/mail/email-binding.ts",
    contentType: "text/calendar",
    reason:
      "email-binding.ts's buildRawMime base64-wraps an already-serialized ICS string (RenderedEmail.ics.content, " +
      "built upstream by src/mail/ics.ts's buildIcsCalendar) into a MIME attachment part -- it never constructs " +
      "ICS text itself, so importing the ics.ts escaper here would be dead code. It DOES reuse the sibling " +
      "control-byte-stripping rule (headerValue) documented at email-binding.ts:49-65, just not via import.",
  },
];

function resolveImportOwners(file: ScannedFile): Set<string> {
  const owners = new Set<string>();
  const importRe = /\bimport\s+(?:type\s+)?[^;'"]*?from\s+["']([^"']+)["']/g;
  let m: RegExpExecArray | null;
  while ((m = importRe.exec(file.stripped))) {
    const spec = m[1];
    if (!spec || !spec.startsWith(".")) continue;
    const resolvedNoExt = resolve(dirname(file.abs), spec).replace(/\.(ts|tsx)$/, "");
    owners.add(resolvedNoExt);
  }
  return owners;
}

describe("content-type declarations import their format's one owner module (DEC-775 wave-23 amendment)", () => {
  const files = scanAllFiles();

  for (const rule of CONTENT_TYPE_RULES) {
    it(`every file setting ${rule.label} imports from ${rule.ownerRel}, is that owner, or is ledgered`, () => {
      const ownerAbs = join(ROOT, rule.ownerRel);
      const ownerAbsNoExt = ownerAbs.replace(/\.(ts|tsx)$/, "");
      expect(existsSync(ownerAbs), `owner path ${rule.ownerRel} does not exist on disk`).toBe(true);

      const setters = files.filter((f) => rule.contentType.test(f.stripped));
      const offenders: string[] = [];

      for (const f of setters) {
        if (f.abs === ownerAbs) continue; // the owner module setting its own content type is fine
        const importOwners = resolveImportOwners(f);
        if (importOwners.has(ownerAbsNoExt)) continue;
        const ledgered = CONTENT_TYPE_IMPORT_LEDGER.some((e) => e.file === f.rel && e.contentType === rule.label);
        if (ledgered) continue;
        offenders.push(f.rel);
      }

      expect(
        offenders,
        offenders
          .map(
            (rel) =>
              `${rel}: sets a ${rule.label} content type without importing ${rule.ownerRel} -- a second emitter that ` +
              `builds these bytes without the owner's escaping/folding rules inherits none of its manners. Import ` +
              `${rule.ownerRel}, or add a { file, contentType, reason } line to CONTENT_TYPE_IMPORT_LEDGER in ` +
              `test/serializer-single-source.scan.test.ts naming why this site legitimately skips the owner import.`,
          )
          .join("\n"),
      ).toEqual([]);
    });
  }

  it("every CONTENT_TYPE_IMPORT_LEDGER entry still matches a real, currently-unimported content-type site (no stale entries)", () => {
    const stale: string[] = [];
    for (const entry of CONTENT_TYPE_IMPORT_LEDGER) {
      const rule = CONTENT_TYPE_RULES.find((r) => r.label === entry.contentType);
      if (!rule) {
        stale.push(`${entry.file} / ${entry.contentType}: no such content-type rule -- delete this ledger line.`);
        continue;
      }
      const f = files.find((x) => x.rel === entry.file);
      if (!f) {
        stale.push(`${entry.file} / ${entry.contentType}: file no longer exists -- delete this ledger line.`);
        continue;
      }
      if (!rule.contentType.test(f.stripped)) {
        stale.push(`${entry.file} / ${entry.contentType}: file no longer sets this content type -- delete this ledger line.`);
        continue;
      }
      const ownerAbsNoExt = join(ROOT, rule.ownerRel).replace(/\.(ts|tsx)$/, "");
      if (resolveImportOwners(f).has(ownerAbsNoExt)) {
        stale.push(`${entry.file} / ${entry.contentType}: file now imports the owner module -- delete this ledger line, it is no longer an exception.`);
      }
    }
    expect(stale, stale.join("\n")).toEqual([]);
  });
});
