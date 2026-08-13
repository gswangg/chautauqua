// DEC-881: worklistStatusLabel is the ONE predicate the worklist row and the
// header's re-uploaded count both read — precedence: approved -> reuploaded
// -> changes_requested -> not reviewed.
import { describe, expect, it } from 'vitest';
import { worklistStatusLabel } from './worklist';

describe('worklistStatusLabel (DEC-881)', () => {
  it("returns 'Approved' when contentStatus is approved, regardless of reUploaded", () => {
    expect(worklistStatusLabel('approved', false)).toBe('Approved');
  });

  it("returns 'Approved' even when the approved submission's latest file was re-uploaded", () => {
    expect(worklistStatusLabel('approved', true)).toBe('Approved');
  });

  it("returns 'Re-uploaded' when reUploaded is true and contentStatus isn't approved", () => {
    expect(worklistStatusLabel('pending', true)).toBe('Re-uploaded');
    expect(worklistStatusLabel('changes_requested', true)).toBe('Re-uploaded');
  });

  it("returns 'Changes requested' when contentStatus is changes_requested and not reUploaded", () => {
    expect(worklistStatusLabel('changes_requested', false)).toBe('Changes requested');
  });

  it("returns 'Not reviewed' otherwise (pending, not reUploaded)", () => {
    expect(worklistStatusLabel('pending', false)).toBe('Not reviewed');
  });
});
