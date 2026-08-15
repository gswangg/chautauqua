// w41-c (DEC-644 wave-41 amendment): scripts/with-test-lock.sh grows a
// re-entrancy guard (CHQ_TEST_LOCK_HELD) so that a gate lane which nests
// `npm test`/`npm run test:full` (both ARE this wrapper, package.json:27,29)
// inside another invocation of this wrapper runs inline instead of
// deadlocking for up to the 45-minute stale window. This file exercises
// that guard directly against the wrapper script (never the default lock
// dir -- CHQ_TEST_LOCK_DIR is always a fresh per-test tmp dir, since the
// merge train's own full-suite run owns /tmp/chq-test.lock).
import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = fileURLToPath(new URL("..", import.meta.url));
const wrapperPath = join(repoRoot, "scripts", "with-test-lock.sh");

function freshLockDir(prefix: string): string {
  const dir = mkdtempSync(join(tmpdir(), `chq-with-test-lock-${prefix}-`));
  return join(dir, "lock");
}

// The full suite itself runs under the wrapper (`npm test` IS `sh
// scripts/with-test-lock.sh vitest run`, package.json:27), so vitest's own
// process.env already carries CHQ_TEST_LOCK_HELD=1. Inheriting it would make
// the OUTERMOST wrapper spawned by these tests take the inline branch too,
// which silently voids every assertion below about acquiring and releasing the
// lock directory. Strip it, so each test starts from an un-nested process tree
// and the nesting under test is the one the test itself creates.
function outerEnv(lockDir: string): NodeJS.ProcessEnv {
  const env = { ...process.env, CHQ_TEST_LOCK_DIR: lockDir };
  delete env.CHQ_TEST_LOCK_HELD;
  return env;
}

describe("scripts/with-test-lock.sh re-entrancy guard", () => {
  it("(a) a plain run acquires, runs the command, and releases the lock directory", () => {
    const lockDir = freshLockDir("plain");
    const out = execFileSync("sh", [wrapperPath, "sh", "-c", "echo ran"], {
      cwd: repoRoot,
      env: outerEnv(lockDir),
      timeout: 10_000,
      encoding: "utf8",
    });
    expect(out).toContain("ran");
    expect(existsSync(lockDir)).toBe(false);
  });

  it("(b) a nested invocation completes quickly and the outer lock is removed exactly once", () => {
    const lockDir = freshLockDir("nested");
    const start = Date.now();
    const out = execFileSync(
      "sh",
      [
        wrapperPath,
        "sh",
        "-c",
        `sh ${JSON.stringify(wrapperPath)} true; echo inner-status=$?; echo outer-ran`,
      ],
      {
        cwd: repoRoot,
        env: outerEnv(lockDir),
        timeout: 10_000,
        encoding: "utf8",
      },
    );
    const elapsedMs = Date.now() - start;

    // Must not have blocked on the 45-minute stale window (or anywhere
    // near it) -- a healthy nested run finishes in well under a second of
    // real work, so a few seconds of budget is generous headroom for a
    // loaded CI box.
    expect(elapsedMs).toBeLessThan(10_000);
    expect(out).toContain("inner-status=0");
    expect(out).toContain("outer-ran");
    // The outer acquisition released exactly once: the lock directory is
    // gone after the whole (outer+inner) run completes.
    expect(existsSync(lockDir)).toBe(false);
  });

  it("(c) a failing wrapped command's exit status is forwarded verbatim", () => {
    const lockDir = freshLockDir("exit");
    let threw = false;
    try {
      execFileSync("sh", [wrapperPath, "sh", "-c", "exit 17"], {
        cwd: repoRoot,
        env: outerEnv(lockDir),
        timeout: 10_000,
      });
    } catch (err: unknown) {
      threw = true;
      expect((err as { status?: number }).status).toBe(17);
    }
    expect(threw).toBe(true);
    expect(existsSync(lockDir)).toBe(false);
  });

  it("(d) no arguments exits 2 with the existing message", () => {
    const lockDir = freshLockDir("noargs");
    let threw = false;
    try {
      execFileSync("sh", [wrapperPath], {
        cwd: repoRoot,
        env: outerEnv(lockDir),
        timeout: 10_000,
        encoding: "utf8",
      });
    } catch (err: unknown) {
      threw = true;
      const e = err as { status?: number; stderr?: string };
      expect(e.status).toBe(2);
      expect(e.stderr).toContain("with-test-lock.sh: no command given");
    }
    expect(threw).toBe(true);
    // The lock was never acquired, so there is nothing to clean up; assert
    // it was never created.
    expect(existsSync(lockDir)).toBe(false);
  });

  it("a nested invocation prints a loud stderr warning naming the re-entrancy guard", () => {
    const lockDir = freshLockDir("warning");
    const result = execFileSync(
      "sh",
      ["-c", `sh ${JSON.stringify(wrapperPath)} sh -c 'sh ${JSON.stringify(wrapperPath)} true' 2>&1`],
      {
        cwd: repoRoot,
        env: outerEnv(lockDir),
        timeout: 10_000,
        encoding: "utf8",
      },
    );
    expect(result).toMatch(/already held/i);
    expect(existsSync(lockDir)).toBe(false);
  });
});
