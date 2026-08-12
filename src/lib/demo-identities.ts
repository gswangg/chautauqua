// DEC-583: demo credentials live in exactly one importable, pure module —
// hand-copying them into the login route is the drift the field guide
// forbids (DEC-518 enumeration rule). test/demo-identities.test.ts reads
// docs/fixtures/sample-data.json and asserts this matches it exactly in
// both directions, so an added/removed/edited fixture identity fails the
// build instead of silently drifting.
//
// Pure module: no node:/cf imports (DEC-002).

export interface DemoIdentity {
  role: "organizer" | "reviewer" | "speaker";
  label: string;
  email: string;
  password: string;
}

export const DEMO_IDENTITIES: readonly DemoIdentity[] = [
  {
    role: "organizer",
    label: "Use demo organizer",
    email: "sbek-organizer@example.com",
    password: "SbekTest!2027-org",
  },
  {
    role: "reviewer",
    label: "Use demo reviewer",
    email: "sbek-reviewer@example.com",
    password: "SbekTest!2027-rev",
  },
  {
    role: "speaker",
    label: "Use demo speaker",
    email: "sbek-speaker@example.com",
    password: "SbekTest!2027-spk",
  },
];
