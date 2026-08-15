// DEC-598/DEC-155/DEC-900: settleInDeclarationOrder replaces the three
// hand-maintained `Promise.allSettled` + "re-throw the first rejection in
// declaration order" blocks that used to live at each call site. The
// ordering guarantee is now structural (enforced by this one tested
// helper), not a convention that a field reorder could silently break.
//
// All promises are awaited to completion via Promise.allSettled — never
// Promise.all, which would reject with whichever settles first and could
// surface a different field's error than the caller previously saw, and
// never short-circuit, which would leave a later rejection unhandled. If
// one or more promises reject, the FIRST rejection by array index is
// re-thrown unmodified (byte-identical object reference — an ApiError
// arrives at the caller with the same code/message/fields it always had).
//
// Pure core: no node:/cloudflare imports (DEC-002).
export async function settleInDeclarationOrder<T extends readonly unknown[]>(
  promises: readonly [...{ [K in keyof T]: Promise<T[K]> }],
): Promise<T> {
  const results = await Promise.allSettled(promises);
  for (const result of results) {
    if (result.status === "rejected") {
      throw result.reason;
    }
  }
  return results.map((result) => {
    // Every result is "fulfilled" at this point — the loop above would have
    // thrown on the first "rejected" result before we get here.
    return (result as PromiseFulfilledResult<unknown>).value;
  }) as unknown as T;
}
