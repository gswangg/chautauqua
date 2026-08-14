// DEC-711 wave-33 amendment (durable half): a figure the server computes but
// no page renders is a hot-route tax with zero payoff (see stats.ts's
// getContactStats — total/topCompanies/speakerCount are each endpoint-backed
// against a real consumer; eventCount and returningSpeakers were deleted
// because nothing under app/src/** ever read them, and duplicateCount was
// dropped in wave 41 because it duplicated an O(N) org scan already
// performed by GET /contacts/duplicates for the rail/tab preview). This test
// scans the OTHER direction from the usual endpoint-shape guard: for every
// field the app/src/pages/contacts/types.ts ContactStats interface declares,
// at least one non-test module under app/src/** must reference it by name.
// Endpoint -> consumer is the direction that drifted; two-directional
// binding is not required here.

import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { resolve, extname } from "node:path";
import { fileURLToPath } from "node:url";

const TYPES_PATH = resolve(fileURLToPath(import.meta.url), "../../app/src/pages/contacts/types.ts");
const APP_SRC_DIR = resolve(fileURLToPath(import.meta.url), "../../app/src");

function extractContactStatsFields(source: string): string[] {
  const match = /export interface ContactStats \{([^}]*)\}/.exec(source);
  if (!match) throw new Error("ContactStats interface not found in types.ts — has it moved or been renamed?");
  const body = match[1]!;
  const fields: string[] = [];
  for (const rawLine of body.split("\n")) {
    const line = rawLine.trim();
    if (line === "" || line.startsWith("//")) continue;
    const fieldMatch = /^(\w+)\??:/.exec(line);
    if (fieldMatch) fields.push(fieldMatch[1]!);
  }
  return fields;
}

function isTestFile(path: string): boolean {
  return /\.(test|render\.test|spec)\.(ts|tsx)$/.test(path);
}

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = resolve(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules") continue;
      out.push(...walk(full));
    } else if (entry.isFile() && [".ts", ".tsx"].includes(extname(entry.name))) {
      out.push(full);
    }
  }
  return out;
}

describe("DEC-711 wave-33 amendment: every ContactStats field has a non-test app/src consumer", () => {
  const typesSource = readFileSync(TYPES_PATH, "utf-8");
  const fields = extractContactStatsFields(typesSource);

  it("found at least one field to check", () => {
    expect(fields.length).toBeGreaterThan(0);
  });

  const allFiles = walk(APP_SRC_DIR);
  const consumerFiles = allFiles.filter((path) => path !== TYPES_PATH && !isTestFile(path));

  it("scanned at least one non-test consumer file", () => {
    expect(consumerFiles.length).toBeGreaterThan(0);
  });

  for (const field of fields) {
    it(`ContactStats.${field} is referenced by a non-test module under app/src/**`, () => {
      const pattern = new RegExp(`\\b${field}\\b`);
      const consumers = consumerFiles.filter((path) => pattern.test(readFileSync(path, "utf-8")));
      if (consumers.length === 0) {
        throw new Error(
          `ContactStats.${field} (declared in app/src/pages/contacts/types.ts) has no rendering consumer under app/src/** — it is orphaned and should be deleted end-to-end (query, interface member, route serializer field, and every test fixture that names it).`,
        );
      }
      expect(consumers.length).toBeGreaterThan(0);
    });
  }
});
