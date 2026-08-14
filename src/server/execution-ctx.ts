// Hono's `c.executionCtx` getter THROWS (rather than returning undefined)
// when the runtime handed no ExecutionContext/FetchEvent to this request
// (e.g. under vitest's node test environment, or a synthetic Context built
// without one). `executionCtxOf` is the ONE deliberate try/catch for that
// specific, expected absence -- not a catch-all -- and every caller that
// needs to know whether an ExecutionContext is available must go through
// this single reader rather than re-probing the throwing getter itself.
import type { Context, ExecutionContext } from "hono";
import type { AppEnv } from "./env";

export function executionCtxOf(c: Context<AppEnv>): ExecutionContext | undefined {
  try {
    return c.executionCtx;
  } catch {
    return undefined;
  }
}
