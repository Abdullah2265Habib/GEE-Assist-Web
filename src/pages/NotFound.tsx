import { Link } from "react-router-dom";

export default function NotFound() {
  return (
    <div className="container page-head not-found">
      <span className="globe-badge" aria-hidden="true">
        <img src="/media/earth-globe-icon.gif" alt="" width={96} height={96} />
      </span>
      <h1>No imagery at this address</h1>
      <p className="lede">The page you asked for does not exist. It may have moved, or the link may be mistyped.</p>
      <div className="btn-row">
        <Link className="btn btn-primary" to="/">
          Go to the home page
        </Link>
        <Link className="btn btn-secondary" to="/datasets">
          Browse datasets
        </Link>
      </div>
    </div>
  );
}
