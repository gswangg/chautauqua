// DEC-433 (wave 69 amendment): trimOrNullBounded (src/routes/public/query.ts)
// degrades any `?q=` value over MAX_PUBLIC_QUERY_VALUE_LENGTH to null (a
// silent un-filter), so PublicSearchBox's rendered <input> must declare that
// same cap via `maxlength` or a visitor can type past it and watch the list
// silently reset. Both assertions read MAX_PUBLIC_QUERY_VALUE_LENGTH from its
// one home (src/server/repo/public/bounds.ts) so this test fails loudly if
// either the markup or the parser drifts off that constant.

import { describe, expect, it } from "vitest";
import { PublicSearchBox } from "../src/routes/public/filters";
import { parseNameQuery } from "../src/routes/public/query";
import { MAX_PUBLIC_QUERY_VALUE_LENGTH } from "../src/server/repo/public/bounds";

describe("PublicSearchBox declares the cap parseNameQuery enforces (DEC-433)", () => {
  it("renders maxlength equal to MAX_PUBLIC_QUERY_VALUE_LENGTH", () => {
    const html = String(PublicSearchBox({ action: "/e/conf/sessions", q: null }));
    expect(html).toContain(`maxlength="${MAX_PUBLIC_QUERY_VALUE_LENGTH}"`);
  });

  it("a value exactly at the declared cap still parses non-null (the control and the parser agree)", () => {
    const atCap = "a".repeat(MAX_PUBLIC_QUERY_VALUE_LENGTH);
    expect(parseNameQuery(atCap)).toBe(atCap);
  });

  it("a value one character over the declared cap degrades to null (why the maxlength matters)", () => {
    const overCap = "a".repeat(MAX_PUBLIC_QUERY_VALUE_LENGTH + 1);
    expect(parseNameQuery(overCap)).toBeNull();
  });
});
