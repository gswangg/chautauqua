// DEC-072 (wave-67 amendment): pin the three-branch property of
// requestIpFromHeaders as a machine-checked fact, since three call sites
// previously restated (and got wrong) a fourth property the function does
// not have -- see decisions/DEC-072.md's wave-67 amendment.
import { describe, it, expect } from "vitest";
import { requestIpFromHeaders } from "../src/lib/rate-limit";

function headerMap(headers: Record<string, string>) {
  return (name: string): string | undefined => headers[name];
}

describe("requestIpFromHeaders", () => {
  it("prefers cf-connecting-ip over a present x-forwarded-for", () => {
    const ip = requestIpFromHeaders(
      headerMap({ "cf-connecting-ip": "9.9.9.9", "x-forwarded-for": "1.2.3.4" })
    );
    expect(ip).toBe("9.9.9.9");
  });

  it("falls back to the literal 'unknown' when both headers are absent", () => {
    const ip = requestIpFromHeaders(headerMap({}));
    expect(ip).toBe("unknown");
  });

  it("takes the first hop of a multi-hop x-forwarded-for", () => {
    const ip = requestIpFromHeaders(headerMap({ "x-forwarded-for": "1.2.3.4, 5.6.7.8" }));
    expect(ip).toBe("1.2.3.4");
  });

  it("trims surrounding whitespace off the first hop", () => {
    const ip = requestIpFromHeaders(headerMap({ "x-forwarded-for": "  1.2.3.4  , 5.6.7.8" }));
    expect(ip).toBe("1.2.3.4");
  });

  it("produces two DIFFERENT ids for two different spoofed x-forwarded-for values (NOT one shared bucket)", () => {
    const ipA = requestIpFromHeaders(headerMap({ "x-forwarded-for": "10.0.0.1" }));
    const ipB = requestIpFromHeaders(headerMap({ "x-forwarded-for": "10.0.0.2" }));
    expect(ipA).not.toBe(ipB);
    expect(ipA).toBe("10.0.0.1");
    expect(ipB).toBe("10.0.0.2");
  });
});
