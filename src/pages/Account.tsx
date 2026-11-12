import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";

const fmt = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString(undefined, { year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "Never";

export default function Account() {
  const { user, refreshUser, logout } = useAuth();
  const navigate = useNavigate();
  const [refreshed, setRefreshed] = useState(false);

  useEffect(() => {
    refreshUser()
      .then(() => setRefreshed(true))
      .catch(() => setRefreshed(true));
  }, [refreshUser]);

  if (!user) return null;

  const rows: [string, React.ReactNode][] = [
    ["Name", user.full_name],
    ["Username", user.username],
    [
      "Email",
      <>
        {user.email ?? "None"}{" "}
        {user.email && (
          <span className={`pill ${user.email_verified ? "pill-green" : "pill-red"}`}>{user.email_verified ? "Confirmed" : "Not confirmed"}</span>
        )}
      </>,
    ],
    ["Phone", user.phone_number ?? "None"],
    ["Signs in with", user.auth_provider === "google" ? "Google" : "Username and password"],
    ["Role", user.role === "admin" ? "Administrator" : "User"],
    ["Member since", fmt(user.created_at)],
    ["Last sign-in", fmt(user.last_login_at)],
  ];

  return (
    <>
      <div className="container page-head">
        <h1>Your account</h1>
        <p className="lede">The same account signs you in to the GEE-Assist app.</p>
      </div>
      <div className="container account-layout">
        <section className="panel">
          <dl className="kv">
            {rows.map(([k, v]) => (
              <div key={k}>
                <dt>{k}</dt>
                <dd>{v}</dd>
              </div>
            ))}
          </dl>
          {!refreshed && <p className="muted-note">Checking for changes…</p>}
          <p className="muted-note">
            To change these details, use <strong>Manage account</strong> in the app's account menu once it is available, or ask
            an administrator.
          </p>
        </section>
        <aside className="account-side">
          <Link className="btn btn-secondary btn-block" to="/community?tab=rate">
            Your rating
          </Link>
          <Link className="btn btn-secondary btn-block" to="/community?tab=feedback">
            Your feedback
          </Link>
          <Link className="btn btn-secondary btn-block" to="/community?tab=suggest">
            Your suggestions
          </Link>
          {user.role === "admin" && (
            <Link className="btn btn-primary btn-block" to="/admin">
              Admin dashboard
            </Link>
          )}
          <button
            type="button"
            className="btn btn-danger btn-block"
            onClick={() => {
              logout();
              navigate("/");
            }}
          >
            Sign out
          </button>
        </aside>
      </div>
    </>
  );
}
