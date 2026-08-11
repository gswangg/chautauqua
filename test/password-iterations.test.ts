// DEC-237: production login 500'd because a stored PBKDF2 hash used 600,000
// iterations — workerd's PBKDF2 implementation rejects anything above 100,000
// with NotSupportedError. ITERATIONS was fixed to 100_000; this test pins
// that regression so it can never silently creep back up.
import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword, ITERATIONS } from "../src/auth/password";

describe("PBKDF2 iteration count (DEC-237, workerd 100k cap)", () => {
  it("ITERATIONS constant is at or under the workerd cap", () => {
    expect(ITERATIONS).toBeLessThanOrEqual(100_000);
  });

  it("hashPassword produces 'pbkdf2$v1$100000$<salt>$<hash>'", async () => {
    const stored = await hashPassword("correct horse battery staple");
    const parts = stored.split("$");
    expect(parts).toHaveLength(5);
    const [algorithm, version, iterations, salt, hash] = parts;
    expect(algorithm).toBe("pbkdf2");
    expect(version).toBe("v1");
    expect(iterations).toBe("100000");
    expect(Number(iterations)).toBeLessThanOrEqual(100_000);
    expect(salt).toBeTruthy();
    expect(hash).toBeTruthy();
  });

  it("verifyPassword honors the iteration count embedded in the stored hash", async () => {
    const stored = await hashPassword("hunter2-hunter2");
    expect(await verifyPassword("hunter2-hunter2", stored)).toBe(true);
    expect(await verifyPassword("wrong-password", stored)).toBe(false);

    // A hash minted with a different (still-valid) embedded iteration count
    // still verifies correctly — the format self-describes iterations.
    const parts = stored.split("$");
    const lowerIterHash = [parts[0], parts[1], "50000", parts[3], parts[4]].join("$");
    // Different iteration count derives a different key, so this specific
    // re-stamped hash should NOT verify against the original password (it
    // was never actually derived with 50000 iterations) — this proves
    // verifyPassword is actually reading and using the embedded count
    // rather than a hardcoded constant.
    expect(await verifyPassword("hunter2-hunter2", lowerIterHash)).toBe(false);
  });
});
