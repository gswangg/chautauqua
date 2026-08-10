import { NavLink } from 'react-router-dom';
import { SubmissionsTable } from './submissions/SubmissionsTable';

export function SubmissionsPage() {
  return (
    <div>
      <div className="chq-submissions-tabs">
        <NavLink to="/submissions/forms">Forms</NavLink>
      </div>
      <SubmissionsTable />
    </div>
  );
}
