// DEC-755 (wave 6, task w6-e): neither project set `noUnusedLocals`, so a
// dead import (or a superseded predicate/helper left behind after its one
// caller was rewritten) compiled in silence -- the live symptom was
// src/routes/agenda.ts still importing `roomBelongsToEvent` from
// ../server/repo/agenda long after the route it served switched to
// getRoomEventId. This test pins `noUnusedLocals: true` on BOTH
// tsconfig.json (the worker/pure-core project) and app/tsconfig.json (the
// SPA project) directly from the JSON on disk, so a future config edit
// that quietly drops the flag is caught here rather than by the flag's
// absence going unnoticed for another N waves. Deliberately does NOT read
// via `tsc --showConfig` (that would also succeed for an *inherited*
// flag) -- it asserts the flag is set on THIS file's own
// compilerOptions, since both tsconfig.json files here are root configs
// with no `extends`.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const REPO_ROOT = join(__dirname, "..");

function readCompilerOptions(relPath: string): Record<string, unknown> {
  const raw = readFileSync(join(REPO_ROOT, relPath), "utf8");
  const parsed = JSON.parse(raw) as { compilerOptions?: Record<string, unknown> };
  if (!parsed.compilerOptions) throw new Error(`${relPath}: no compilerOptions block`);
  return parsed.compilerOptions;
}

describe("DEC-755 (wave 6): noUnusedLocals is on in both projects", () => {
  it("tsconfig.json (worker/pure-core) declares noUnusedLocals: true", () => {
    expect(readCompilerOptions("tsconfig.json").noUnusedLocals).toBe(true);
  });

  it("app/tsconfig.json (SPA) declares noUnusedLocals: true", () => {
    expect(readCompilerOptions("app/tsconfig.json").noUnusedLocals).toBe(true);
  });

  it("neither project enables noUnusedParameters (a separate, undecided ruling)", () => {
    expect(readCompilerOptions("tsconfig.json").noUnusedParameters).not.toBe(true);
    expect(readCompilerOptions("app/tsconfig.json").noUnusedParameters).not.toBe(true);
  });
});
