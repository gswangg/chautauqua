// DEC-738 (wave-77 amendment): contact.custom_fields_json now has ONE
// declared parser, parseContactCustomFields (src/server/repo/contacts/
// crud.ts, immediately beside the declared serializer customFieldsJsonOf),
// mirroring the declared-serializer-with-no-parser gap wave 76 closed for
// social_links_json. Eight hand-parses previously gave three different
// answers for a null/empty column (`null`, `{}`, or the key omitted
// entirely). This file proves (a) the parser's own contract and (b) that no
// OTHER non-test file under src/ still hand-parses customFieldsJson.
import { readFileSync, readdirSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { describe, expect, it } from "vitest";
import { parseContactCustomFields } from "../src/server/repo/contacts/crud";

const ROOT = join(__dirname, "..");
const SRC_ROOT = join(ROOT, "src");
const OWNER_ABS = join(SRC_ROOT, "server", "repo", "contacts", "crud.ts");

function isTestFile(path: string): boolean {
  return /\.(test|spec)\.(ts|tsx)$/.test(path);
}

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...walk(full));
    } else if (
      entry.isFile() &&
      (full.endsWith(".ts") || full.endsWith(".tsx")) &&
      !isTestFile(full)
    ) {
      out.push(full);
    }
  }
  return out;
}

// A hand-parse of the customFieldsJson column: JSON.parse applied directly
// to something spelled `customFieldsJson` (the column's own name, on a row/
// variable), rather than going through parseContactCustomFields. Matches
// both `JSON.parse(x.customFieldsJson)` and `x.customFieldsJson ? JSON.parse(x.customFieldsJson) : ...`
// shapes across a line break, so a reformatted copy still trips it.
function handParsesCustomFieldsJson(source: string): boolean {
  return /JSON\.parse\([^)]*customFieldsJson[^)]*\)/.test(source);
}

describe("contact.custom_fields_json single parser (DEC-738, wave 77)", () => {
  it("null/undefined/empty string all parse to {}", () => {
    expect(parseContactCustomFields(null)).toEqual({});
    expect(parseContactCustomFields(undefined)).toEqual({});
    expect(parseContactCustomFields("")).toEqual({});
  });

  it("a populated column parses to the stored object", () => {
    expect(parseContactCustomFields('{"dietary":"Vegan","role":"keynote"}')).toEqual({
      dietary: "Vegan",
      role: "keynote",
    });
  });

  it("malformed JSON throws rather than silently falling back", () => {
    expect(() => parseContactCustomFields("{not json")).toThrow();
  });

  it("non-object JSON (array, string, number) throws rather than silently coercing", () => {
    expect(() => parseContactCustomFields("[1,2,3]")).toThrow();
    expect(() => parseContactCustomFields('"just a string"')).toThrow();
    expect(() => parseContactCustomFields("42")).toThrow();
    expect(() => parseContactCustomFields("null")).toThrow();
  });

  it("positive control: the detector fires on a hand-parse shape", () => {
    expect(handParsesCustomFieldsJson("const x = row.customFieldsJson ? JSON.parse(row.customFieldsJson) : {};")).toBe(true);
    expect(handParsesCustomFieldsJson("JSON.parse(target.customFieldsJson)")).toBe(true);
  });

  it("no non-test file under src/ other than the declaring module hand-parses customFieldsJson", () => {
    const files = walk(SRC_ROOT).filter((f) => f !== OWNER_ABS);
    const offenders = files
      .filter((f) => handParsesCustomFieldsJson(readFileSync(f, "utf8")))
      .map((f) => relative(ROOT, f).split(sep).join("/"));
    expect(offenders).toEqual([]);
  });

  it("sanity: the owner path referenced above matches the real relative path", () => {
    expect(relative(ROOT, OWNER_ABS).split(sep).join("/")).toBe("src/server/repo/contacts/crud.ts");
  });
});
