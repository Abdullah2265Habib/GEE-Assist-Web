import type { ReactNode } from "react";
import { Link, Navigate, useLocation } from "react-router-dom";
import Loading from "../components/Loading";
import { useAuth } from "./AuthProvider";

/** Sends visitors who are not signed in to /login, and back here afterwards. */
export default function RequireAuth({ children, admin = false }: { children: ReactNode; admin?: boolean }) {
  const { user, ready } = useAuth();
  const location = useLocation();

  if (!ready) return <Loading />;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
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
