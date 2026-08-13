// Coverage-audit item #1 (docs/eval-findings.md): manual placement is
// click-to-arm (DEC-570), but the only affordance copy said "Drag to a
// slot" and the card's accessible name never mentioned selection — both
// official eval runs failed to discover manual placement even though it
// works. These tests pin the discoverable wording: the tray hint names the
// click path, and a selectable card states the action in its accessible
// name (what an accessibility-tree-driven agent actually reads).

import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

afterEach(cleanup);
import { UnscheduledTray } from "./UnscheduledTray";
import { SessionCard } from "./SessionCard";

const SESSION = {
  submissionId: "sub-1",
  ref: "SES-001",
  title: "Talk One",
  trackIds: [],
  speakers: [],
};

describe("agenda placement discoverability", () => {
  it("tray hint names the click-to-place path, not only dragging", () => {
    render(
      <UnscheduledTray
        sessions={[SESSION as never]}
        tracks={[]}
        conflicts={[]}
        unplacedReasons={[]}
        onDropUnschedule={() => {}}
        armed={null}
        onArm={() => {}}
      />,
    );
    const hint = document.querySelector(".chq-unscheduled-tray-hint");
    expect(hint?.textContent).toMatch(/click a session/i);
    expect(hint?.textContent).toMatch(/click a time slot/i);
  });

  it("selectable card's accessible name states the select-then-place action", () => {
    render(
      <SessionCard session={SESSION as never} tracks={[]} conflicts={[]} onSelect={() => {}} />,
    );
    expect(
      screen.getByRole("button", { name: /SES-001: Talk One — click to select, then choose a time slot/ }),
    ).toBeTruthy();
  });

  it("non-selectable card keeps the plain name", () => {
    render(<SessionCard session={SESSION as never} tracks={[]} conflicts={[]} />);
    expect(screen.getByRole("button", { name: "SES-001: Talk One" })).toBeTruthy();
  });
});
