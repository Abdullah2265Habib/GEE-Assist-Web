import type { ReactNode } from "react";
import { Link, Navigate, useLocation } from "react-router-dom";
import Loading from "../components/Loading";
import { useAuth } from "./AuthProvider";

/** Sends visitors who are not signed in to /login, and back here afterwards. */
export default function RequireAuth({ children, admin = false }: { children: ReactNode; admin?: boolean }) {
  const { user, ready, signedOut } = useAuth();
  const location = useLocation();

  if (!ready) return <Loading />;
  // Someone who just pressed Sign out on this page goes home, not to a sign-in form that would bring them back here.
  if (!user) return signedOut ? <Navigate to="/" replace /> : <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  if (admin && user.role !== "admin") {
    return (
      <div className="container page-head">
        <h1>Administrators only</h1>
        <p className="lede">This page is for GEE-Assist administrators. Your account is a regular user account.</p>
        <Link className="btn btn-secondary" to="/">
          Go to the home page
        </Link>
      </div>
    );
  }
  return <>{children}</>;
}
