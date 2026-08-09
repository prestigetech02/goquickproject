import { Link } from "react-router-dom";

export function ProfileSubHeader({ title, backTo = "/profile" }: { title: string; backTo?: string }) {
  return (
    <div className="page-header-row profile-subhead">
      <div>
        <Link to={backTo} className="profile-back">
          ← Back
        </Link>
        <h1>{title}</h1>
      </div>
    </div>
  );
}
