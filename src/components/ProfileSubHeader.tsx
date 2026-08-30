import { Link } from "react-router-dom";
import type { ReactNode } from "react";

export function ProfileSubHeader({
  title,
  backTo = "/profile",
  action,
}: {
  title: string;
  backTo?: string;
  action?: ReactNode;
}) {
  return (
    <div className={`page-header-row profile-subhead${action ? " profile-subhead-with-action" : ""}`}>
      <div>
        <Link to={backTo} className="profile-back">
          ← Back
        </Link>
        <h1>{title}</h1>
      </div>
      {action ? <div className="profile-subhead-action">{action}</div> : null}
    </div>
  );
}
