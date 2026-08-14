// DEC-104 chunk sweep, agenda lane: source-scan guard. Ensures
// loadAcceptedSessions batches its three inArray(...) fan-outs over `ids` via
// chunkIds (DEC-078) instead of passing the full accepted-submissions id list
// directly (which 500s on D1 at scale). The 850-line src/server/repo/
// agenda.ts was decomposed into src/server/repo/agenda/*.ts (wave 64
// custodian); loadAcceptedSessions and its row fan-outs live in rows.ts, so
// this scan follows the function to its new home rather than the old path.
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const agendaSrcPath = fileURLToPath(new URL("../src/server/repo/agenda/rows.ts", import.meta.url));
const source = readFileSync(agendaSrcPath, "utf-8");

function extractFunction(src: string, name: string): string {
  const startIdx = src.indexOf(`function ${name}(`);
  expect(startIdx, `expected to find function ${name} in agenda/rows.ts`).toBeGreaterThan(-1);
  // Find the opening brace of the function body, then walk to its matching close.
  const braceStart = src.indexOf("{", startIdx);
  let depth = 0;
  let i = braceStart;
  for (; i < src.length; i++) {
    if (src[i] === "{") depth++;
    else if (src[i] === "}") {
      depth--;
      if (depth === 0) break;
    }
  }
  return src.slice(startIdx, i + 1);
}

describe("DEC-104 chunk sweep: agenda lane", () => {
  it("imports chunkIds from the canonical lib", () => {
    // One directory deeper than the old monolith: ../../../lib/chunk.
    expect(source).toMatch(/import\s*\{\s*chunkIds\s*\}\s*from\s*"\.\.\/\.\.\/\.\.\/lib\/chunk"/);
  });

  it("loadAcceptedSessions batches ids via chunkIds", () => {
    const fn = extractFunction(source, "loadAcceptedSessions");
    expect(fn).toContain("chunkIds(");
  });

  it("the three former unbounded inArray sites now use per-table batch inArrays, none against the full ids list", () => {
    const fn = extractFunction(source, "loadAcceptedSessions");

    expect(fn).toMatch(/inArray\(schema\.submissionTrack\.submissionId,\s*batch\)/);
    expect(fn).toMatch(/inArray\(schema\.participant\.submissionId,\s*batch\)/);
    expect(fn).toMatch(/inArray\(schema\.scheduleSlot\.submissionId,\s*batch\)/);

    // No remaining inArray(..., ids) call within loadAcceptedSessions.
    expect(fn).not.toMatch(/inArray\([^)]*,\s*ids\)/);
  });
});
