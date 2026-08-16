// DEC-757 wave-5 amendment: one owner for a person's display name. A
// mononym (only firstName OR only lastName present -- DEC-986's single
// public Name control never rejects such a name) must read as a name, not
// as "no name".

import { describe, expect, it } from "vitest";
import { personName, personNameOrEmail } from "../src/domain/person-name";

describe("personName", () => {
  it("joins both parts with a single space when both are present", () => {
    expect(personName({ firstName: "Jamie", lastName: "Reviewer" })).toBe("Jamie Reviewer");
  });

  it("a mononym (only firstName) reads as the name", () => {
    expect(personName({ firstName: "Prince", lastName: "" })).toBe("Prince");
  });

  it("a mononym (only lastName) reads as the name", () => {
    expect(personName({ firstName: "", lastName: "Prince" })).toBe("Prince");
  });

  it("null/undefined parts are treated the same as empty", () => {
    expect(personName({ firstName: "Prince", lastName: null })).toBe("Prince");
    expect(personName({ firstName: undefined, lastName: "Prince" })).toBe("Prince");
  });

  it("whitespace-only parts are dropped like empties", () => {
    expect(personName({ firstName: "  ", lastName: "Prince" })).toBe("Prince");
    expect(personName({ firstName: "Prince", lastName: "   " })).toBe("Prince");
  });

  it("both empty returns the empty string", () => {
    expect(personName({ firstName: "", lastName: "" })).toBe("");
    expect(personName({})).toBe("");
  });

  it("trims each part before joining", () => {
    expect(personName({ firstName: "  Jamie  ", lastName: "  Reviewer  " })).toBe("Jamie Reviewer");
  });
});

describe("personNameOrEmail", () => {
  it("prefers the person's name when present", () => {
    expect(personNameOrEmail({ firstName: "Jamie", lastName: "Reviewer", email: "jamie@example.com" })).toBe(
      "Jamie Reviewer",
    );
  });

  it("a mononym still beats the email fallback", () => {
    expect(personNameOrEmail({ firstName: "Prince", lastName: "", email: "prince@example.com" })).toBe("Prince");
  });

  it("falls back to email when both name parts are empty", () => {
    expect(personNameOrEmail({ firstName: "", lastName: "", email: "prince@example.com" })).toBe(
      "prince@example.com",
    );
  });

  it("falls back to email when both name parts are whitespace-only", () => {
    expect(personNameOrEmail({ firstName: "  ", lastName: "  ", email: "prince@example.com" })).toBe(
      "prince@example.com",
    );
  });
});
