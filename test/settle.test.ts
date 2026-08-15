import { describe, expect, it, vi } from "vitest";
import { settleInDeclarationOrder } from "../src/lib/settle";

describe("settleInDeclarationOrder", () => {
  it("returns all values in declaration order when everything fulfills", async () => {
    const result = await settleInDeclarationOrder([
      Promise.resolve(1),
      Promise.resolve("two"),
      Promise.resolve(true),
    ]);
    expect(result).toEqual([1, "two", true]);
  });

  it("throws when only the LAST promise rejects", async () => {
    const err = new Error("last one failed");
    await expect(
      settleInDeclarationOrder([Promise.resolve("a"), Promise.resolve("b"), Promise.reject(err)]),
    ).rejects.toBe(err);
  });

  it("throws the earlier-declared rejection when TWO promises reject", async () => {
    const earlier = new Error("earlier rejection");
    const later = new Error("later rejection");
    await expect(
      settleInDeclarationOrder([Promise.resolve("a"), Promise.reject(earlier), Promise.reject(later)]),
    ).rejects.toBe(earlier);
  });

  it("throws the identical object reference, unmodified", async () => {
    class CustomError extends Error {
      code = "custom";
      fields = { foo: "bar" };
    }
    const err = new CustomError("boom");
    try {
      await settleInDeclarationOrder([Promise.reject(err), Promise.resolve(1)]);
      throw new Error("expected settleInDeclarationOrder to throw");
    } catch (caught) {
      expect(caught).toBe(err);
      expect((caught as CustomError).code).toBe("custom");
      expect((caught as CustomError).fields).toEqual({ foo: "bar" });
    }
  });

  it("produces no unhandled rejection when an earlier index rejects and a later one rejects too", async () => {
    const unhandled = vi.fn();
    process.on("unhandledRejection", unhandled);
    try {
      const earlier = new Error("earlier");
      const later = new Error("later");
      await expect(
        settleInDeclarationOrder([Promise.reject(earlier), Promise.reject(later)]),
      ).rejects.toBe(earlier);
      // Give the event loop a tick to surface any unhandledRejection that
      // Promise.allSettled's internal handling would have missed.
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(unhandled).not.toHaveBeenCalled();
    } finally {
      process.off("unhandledRejection", unhandled);
    }
  });
});
