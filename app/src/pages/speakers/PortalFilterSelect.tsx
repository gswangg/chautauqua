// The Speakers toolbar's portal filter (Portals frame, flow 1): "Any portal"
// is the onboarding grid, "Not in any portal" the list of participations no
// portal covers (/speakers?portal=none).
export type PortalFilterValue = 'any' | 'none';

export function PortalFilterSelect({ value, onChange }: { value: PortalFilterValue; onChange: (v: PortalFilterValue) => void }) {
  return (
    <select
      className="chq-select"
      aria-label="Filter by portal"
      value={value}
      onChange={(e) => onChange(e.target.value === 'none' ? 'none' : 'any')}
    >
      <option value="any">Any portal</option>
      <option value="none">Not in any portal</option>
    </select>
  );
}
