import { describe, expect, it } from "vitest";
import { MAIL_FANOUT_CONCURRENCY, mapWithConcurrency } from "../src/lib/fanout";

describe("mapWithConcurrency", () => {
  it("returns results in input order, not completion order", async () => {
    const items = [50, 10, 30, 5, 40];
    const delays: number[] = [];
    const results = await mapWithConcurrency(items, 3, async (ms) => {
      delays.push(ms);
      await new Promise((resolve) => setTimeout(resolve, ms));
      return ms;
    });
    expect(results.map((r) => (r.status === "fulfilled" ? r.value : undefined))).toEqual(items);
  });

  it("never has more than `limit` in-flight at once", async () => {
    let inFlight = 0;
    let maxInFlight = 0;
    const items = Array.from({ length: 20 }, (_, i) => i);
    await mapWithConcurrency(items, MAIL_FANOUT_CONCURRENCY, async (i) => {
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise((resolve) => setTimeout(resolve, 1));
      inFlight -= 1;
      return i;
    });
    expect(maxInFlight).toBeLessThanOrEqual(MAIL_FANOUT_CONCURRENCY);
  });

  it("one rejection does not cancel siblings, and settles as a rejected result at its own index", async () => {
    const items = [1, 2, 3, 4];
    const results = await mapWithConcurrency(items, 2, async (i) => {
      if (i === 2) throw new Error("boom");
      return i * 10;
    });
    expect(results).toEqual([
      { status: "fulfilled", value: 10 },
      { status: "rejected", reason: expect.any(Error) },
      { status: "fulfilled", value: 30 },
      { status: "fulfilled", value: 40 },
    ]);
  });

  it("handles an empty items array", async () => {
    const results = await mapWithConcurrency([], MAIL_FANOUT_CONCURRENCY, async (i) => i);
    expect(results).toEqual([]);
  });

  it("handles limit <= 1 by running sequentially in order", async () => {
    const order: number[] = [];
    const items = [3, 1, 2];
    const results = await mapWithConcurrency(items, 1, async (i) => {
      order.push(i);
      await new Promise((resolve) => setTimeout(resolve, i));
      return i;
    });
    expect(order).toEqual(items);
    expect(results.map((r) => (r.status === "fulfilled" ? r.value : undefined))).toEqual(items);
  });

  it("handles limit of 0 the same as limit of 1", async () => {
    const results = await mapWithConcurrency([7, 8], 0, async (i) => i);
    expect(results.map((r) => (r.status === "fulfilled" ? r.value : undefined))).toEqual([7, 8]);
  });
});
