import { describe, expect, it } from "vitest";
import { CsvParseError, parseCsv, toCsv } from "../src/domain/csv";

describe("parseCsv - golden RFC 4180 samples", () => {
  it("parses a simple unquoted CSV", () => {
    expect(parseCsv("a,b,c\n1,2,3")).toEqual([
      ["a", "b", "c"],
      ["1", "2", "3"],
    ]);
  });

  it("parses CRLF row endings", () => {
    expect(parseCsv("a,b\r\n1,2\r\n3,4")).toEqual([
      ["a", "b"],
      ["1", "2"],
      ["3", "4"],
    ]);
  });

  it("parses quoted fields with embedded commas", () => {
    expect(parseCsv('a,"b,c",d')).toEqual([["a", "b,c", "d"]]);
  });

  it("parses quoted fields with embedded newlines", () => {
    expect(parseCsv('a,"line1\nline2",c')).toEqual([["a", "line1\nline2", "c"]]);
  });

  it("parses escaped double-quotes inside quoted fields", () => {
    expect(parseCsv('"a""b",c')).toEqual([['a"b', "c"]]);
  });

  it("strips a leading UTF-8 BOM", () => {
    expect(parseCsv("﻿a,b\n1,2")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });

  it("ignores a single trailing empty line", () => {
    expect(parseCsv("a,b\n1,2\n")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });

  it("preserves additional trailing blank lines beyond the single ignored one", () => {
    expect(parseCsv("a,b\n1,2\n\n")).toEqual([
      ["a", "b"],
      ["1", "2"],
      [""],
    ]);
  });

  it("returns an empty array for empty input", () => {
    expect(parseCsv("")).toEqual([]);
  });

  it("handles a lone final field with no trailing newline", () => {
    expect(parseCsv("a,b,c")).toEqual([["a", "b", "c"]]);
  });
});

describe("parseCsv - malformed input", () => {
  it("throws CsvParseError with a line number for an unterminated quote", () => {
    let caught: unknown;
    try {
      parseCsv('a,b\n1,"unterminated');
      throw new Error("expected parseCsv to throw");
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(CsvParseError);
    expect((caught as CsvParseError).line).toBe(2);
  });

  it("reports the line the unterminated quote opened on, even spanning multiple lines", () => {
    try {
      parseCsv('a,b\nc,"unterminated\nstill going\nand going');
      throw new Error("expected parseCsv to throw");
    } catch (err) {
      expect(err).toBeInstanceOf(CsvParseError);
      expect((err as CsvParseError).line).toBe(2);
    }
  });
});

describe("parseCsv/toCsv - round-trip on tricky fixtures", () => {
  const fixtures: (string | number | null)[][][] = [
    [["a", "b", "c"]],
    [["quote\"inside", "plain"]],
    [['"already quoted"', "x"]],
    [["comma,here", "newline\nhere", "crlf\r\nhere"]],
    [["unicode 🎤 café résumé", "日本語", "emoji 👍"]],
    [
      ["header1", "header2"],
      ["nested \"\"double\"\" quotes", "trailing,comma"],
    ],
    [["", "", ""]],
  ];

  for (const [idx, fixture] of fixtures.entries()) {
    it(`round-trips fixture #${idx}`, () => {
      const csvText = toCsv(fixture);
      const parsed = parseCsv(csvText);
      expect(parsed).toEqual(fixture);
    });
  }

  it("round-trips a BOM-prefixed export back through parseCsv", () => {
    const rows = [["a", "b"], ["1", "2"]];
    const csvText = "﻿" + toCsv(rows);
    expect(parseCsv(csvText)).toEqual(rows);
  });
});

describe("toCsv", () => {
  it("only quotes fields that need it", () => {
    expect(toCsv([["plain", "has,comma", 'has"quote', "has\nnewline"]])).toBe(
      'plain,"has,comma","has""quote","has\nnewline"',
    );
  });

  it("uses CRLF between rows", () => {
    expect(toCsv([["a"], ["b"]])).toBe("a\r\nb");
  });

  it("renders null cells as empty strings", () => {
    expect(toCsv([["a", null, "c"]])).toBe("a,,c");
  });

  it("stringifies numeric cells", () => {
    expect(toCsv([[1, 2.5, -3]])).toBe("1,2.5,-3");
  });

  describe("DEC-179 formula injection neutralization", () => {
    it("prefixes an apostrophe on a leading =", () => {
      expect(toCsv([["=SUM(A1)"]])).toBe("'=SUM(A1)");
    });

    it("prefixes an apostrophe on a leading +", () => {
      expect(toCsv([["+1 (555) 0100"]])).toBe("'+1 (555) 0100");
    });

    it("prefixes an apostrophe on a leading -", () => {
      expect(toCsv([["-foo"]])).toBe("'-foo");
    });

    it("prefixes an apostrophe on a leading @", () => {
      expect(toCsv([["@cmd"]])).toBe("'@cmd");
    });

    it("prefixes an apostrophe on a leading tab", () => {
      expect(toCsv([["\tfoo"]])).toBe("'\tfoo");
    });

    it("prefixes an apostrophe on a leading CR", () => {
      expect(toCsv([["\rfoo"]])).toBe('"\'\rfoo"');
    });

    it("neutralizes and quotes a formula cell that also needs quoting", () => {
      expect(toCsv([["=a,b"]])).toBe('"\'=a,b"');
    });

    it("leaves negative numeric cells unchanged", () => {
      expect(toCsv([[-42]])).toBe("-42");
    });
  });
});
