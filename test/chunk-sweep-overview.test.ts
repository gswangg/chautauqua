// DEC-104 source-scan guard: overview.ts's participant fan-out query must be
// chunked via the canonical DEC-078 chunkIds pattern, not a single-shot
// inArray over an unbounded id list (which 500s on D1 at DEC-088 perf scale).
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const overviewSrc = readFileSync(
  join(__dirname, "..", "src", "server", "repo", "overview.ts"),
  "utf-8",
);

describe("chunk-sweep: overview.ts participant fan-out (DEC-104/DEC-078)", () => {
  it("imports chunkIds from ../../lib/chunk", () => {
    expect(overviewSrc).toMatch(/import\s*\{\s*chunkIds\s*\}\s*from\s*"\.\.\/\.\.\/lib\/chunk";/);
  });

  it("calls chunkIds( in the getOverviewPayload body", () => {
    const bodyStart = overviewSrc.indexOf("export async function getOverviewPayload");
    expect(bodyStart).toBeGreaterThan(-1);
    const body = overviewSrc.slice(bodyStart);
    expect(body).toContain("chunkIds(");
  });

  it("no longer has the single-shot unbounded inArray over placedIds", () => {
    expect(overviewSrc).not.toContain(
      "inArray(schema.participant.submissionId, placedIds)",
    );
    expect(overviewSrc).toContain(
      "inArray(schema.participant.submissionId, batch)",
    );
  });
});
