import { describe, expect, it } from "vitest";
import {
  WALKTHROUGH_AREAS,
  buildSpawnArgs,
  formatAreaPass,
  formatFailureMessage,
  formatMissingModulesMessage,
  modulePath,
  parseUrlArg,
} from "../scripts/walkthrough-lib";

describe("WALKTHROUGH_AREAS", () => {
  it("is the fixed DEC-062/DEC-089 order: producer, review, speaker, public, data, scale", () => {
    expect(WALKTHROUGH_AREAS).toEqual(["producer", "review", "speaker", "public", "data", "scale"]);
  });
});

describe("modulePath", () => {
  it("builds the DEC-060 module path for each area", () => {
    expect(modulePath("producer")).toBe("scripts/walkthrough/producer.ts");
    expect(modulePath("review")).toBe("scripts/walkthrough/review.ts");
    expect(modulePath("speaker")).toBe("scripts/walkthrough/speaker.ts");
    expect(modulePath("public")).toBe("scripts/walkthrough/public.ts");
    expect(modulePath("data")).toBe("scripts/walkthrough/data.ts");
    expect(modulePath("scale")).toBe("scripts/walkthrough/scale.ts");
  });
});

describe("buildSpawnArgs", () => {
  it("builds tsx argv with --url", () => {
    expect(buildSpawnArgs("producer", "http://localhost:8787")).toEqual([
      "tsx",
      "scripts/walkthrough/producer.ts",
      "--url",
      "http://localhost:8787",
    ]);
  });

  it("passes an arbitrary url through unmodified", () => {
    expect(buildSpawnArgs("data", "http://example.test:1234")).toEqual([
      "tsx",
      "scripts/walkthrough/data.ts",
      "--url",
      "http://example.test:1234",
    ]);
  });
});

describe("parseUrlArg", () => {
  it("returns the default when --url is absent", () => {
    expect(parseUrlArg([], "http://localhost:8787")).toBe("http://localhost:8787");
  });

  it("parses --url <value>", () => {
    expect(parseUrlArg(["--url", "http://localhost:9999"], "http://localhost:8787")).toBe(
      "http://localhost:9999",
    );
  });

  it("throws when --url is given with no value", () => {
    expect(() => parseUrlArg(["--url"], "http://localhost:8787")).toThrow(/no value/);
  });
});

describe("formatAreaPass / formatFailureMessage / formatMissingModulesMessage", () => {
  it("formats a PASS line per area", () => {
    expect(formatAreaPass("review")).toBe("PASS review");
  });

  it("formats the required failure message", () => {
    expect(formatFailureMessage("speaker")).toBe("WALKTHROUGH FAILED at speaker");
  });

  it("formats a missing-module message naming the missing files", () => {
    expect(formatMissingModulesMessage(["scripts/walkthrough/producer.ts"])).toBe(
      "walkthrough: missing module file(s): scripts/walkthrough/producer.ts",
    );
    expect(
      formatMissingModulesMessage([
        "scripts/walkthrough/producer.ts",
        "scripts/walkthrough/data.ts",
      ]),
    ).toBe(
      "walkthrough: missing module file(s): scripts/walkthrough/producer.ts, scripts/walkthrough/data.ts",
    );
  });
});
