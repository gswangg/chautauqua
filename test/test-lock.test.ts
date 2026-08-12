// w1-a: scripts/with-test-lock.sh serializes full-suite test runs (mkdir
// spinlock, trap-based release, stale-lock steal). This is a tripwire test:
// (1) two concurrent wrapper invocations never interleave their critical
// sections, (2) the wrapper forwards a non-zero exit code verbatim, and
// (3) package.json's "test" script still routes through the wrapper (a
// later edit can't quietly unwrap it without failing this test).
import { describe, expect, it } from "vitest";
import { spawn } from "node:child_process";
import { mkdtempSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = fileURLToPath(new URL("..", import.meta.url));
const wrapperPath = join(repoRoot, "scripts", "with-test-lock.sh");

function runWrapper(args: string[], env: NodeJS.ProcessEnv): Promise<number> {
  return new Promise((resolve, reject) => {
    const child = spawn("sh", [wrapperPath, ...args], {
      cwd: repoRoot,
      env,
    });
    child.on("error", reject);
    child.on("close", (code) => resolve(code ?? -1));
  });
}

describe("scripts/with-test-lock.sh", () => {
  it("serializes two concurrent invocations so their critical sections never interleave", async () => {
    const dir = mkdtempSync(join(tmpdir(), "chq-test-lock-"));
    const markerFile = join(dir, "markers.log");
    writeFileSync(markerFile, "");
    const lockDir = join(dir, "lock");

    const env = {
      ...process.env,
      CHQ_TEST_LOCK_DIR: lockDir,
    };

    // Each invocation appends a start marker, sleeps briefly, then appends
    // an end marker. If the lock fails to serialize them, both starts will
    // land before either end.
    const cmd = [
      "sh",
      "-c",
      `echo "start $1 $(date +%s%N)" >> "${markerFile}"; sleep 0.3; echo "end $1 $(date +%s%N)" >> "${markerFile}"`,
    ];

    const [codeA, codeB] = await Promise.all([
      runWrapper([...cmd, "_", "A"], env),
      runWrapper([...cmd, "_", "B"], env),
    ]);

    expect(codeA).toBe(0);
    expect(codeB).toBe(0);

    const lines = readFileSync(markerFile, "utf8").trim().split("\n");
    expect(lines).toHaveLength(4);

    // Parse into { label: "A"|"B", kind: "start"|"end" } in file order and
    // assert the two runs' intervals do not interleave: the sequence must
    // be [start X, end X, start Y, end Y] for some ordering of X/Y.
    const events = lines.map((line) => {
      const [kind, label] = line.split(" ");
      return { kind, label };
    });

    expect(events.length).toBeGreaterThan(0);
    const firstLabel = events[0]!.label;
    const secondLabel = firstLabel === "A" ? "B" : "A";
    expect(events).toEqual([
      { kind: "start", label: firstLabel },
      { kind: "end", label: firstLabel },
      { kind: "start", label: secondLabel },
      { kind: "end", label: secondLabel },
    ]);
  });

  it("forwards a non-zero exit code verbatim", async () => {
    const dir = mkdtempSync(join(tmpdir(), "chq-test-lock-exit-"));
    const env = {
      ...process.env,
      CHQ_TEST_LOCK_DIR: join(dir, "lock"),
    };
    const code = await runWrapper(["sh", "-c", "exit 17"], env);
    expect(code).toBe(17);
  });

  it("routes package.json's full-suite test script through the wrapper", () => {
    const pkg = JSON.parse(readFileSync(join(repoRoot, "package.json"), "utf8"));
    expect(pkg.scripts.test).toContain("scripts/with-test-lock.sh");
    expect(pkg.scripts.test).toContain("vitest run");
    // targeted runs (used by workers) must bypass the lock entirely.
    expect(pkg.scripts["test:targeted"]).toBe("vitest run");
  });

  it("is executable", () => {
    const stat = statSync(wrapperPath);
    // eslint: 0o100 = owner execute bit
    expect(stat.mode & 0o100).not.toBe(0);
  });
});
