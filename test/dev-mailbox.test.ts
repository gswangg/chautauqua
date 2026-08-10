import { describe, expect, it } from "vitest";
import { shouldMountDevMailbox } from "../src/routes/dev/mailbox";

describe("shouldMountDevMailbox (DEC-005 mounting predicate)", () => {
  it("mounts only when DEV_MODE is exactly '1'", () => {
    expect(shouldMountDevMailbox({ DEV_MODE: "1" })).toBe(true);
  });

  it("does not mount when DEV_MODE is unset", () => {
    expect(shouldMountDevMailbox({})).toBe(false);
  });

  it("does not mount for any other DEV_MODE value", () => {
    expect(shouldMountDevMailbox({ DEV_MODE: "true" })).toBe(false);
    expect(shouldMountDevMailbox({ DEV_MODE: "0" })).toBe(false);
    expect(shouldMountDevMailbox({ DEV_MODE: "" })).toBe(false);
    expect(shouldMountDevMailbox({ DEV_MODE: "yes" })).toBe(false);
  });
});
