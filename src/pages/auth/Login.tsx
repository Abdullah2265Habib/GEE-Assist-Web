import { useState, type FormEvent } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { ApiError } from "../../api/client";
import { useAuth } from "../../auth/AuthProvider";
import AuthShell from "./AuthShell";
import GoogleButton from "./GoogleButton";
import PasswordInput from "./PasswordInput";

export default function Login() {
  const { login, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? "/community";
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to={from} replace />;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await login(username.trim(), password);
      navigate(from, { replace: true });
    } catch (err) {
      if (err instanceof ApiError && err.status === 403 && (err.detail as { code?: string })?.code === "VERIFICATION_REQUIRED") {
        navigate("/verify", { state: { from } });
        return;
      }
      if (err instanceof ApiError && err.status === 401) setError("The username or password is wrong.");
      else setError(err instanceof Error ? err.message : "Could not sign in.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell
      title="Sign in"
      intro={
        <p>
          Use the account you created in the GEE-Assist app. New here? <Link to="/signup" state={{ from }}>Create an account</Link>.
        </p>
      }
    >
      <GoogleButton redirectTo={from} />
      <div className="or" role="separator">
        <span>or</span>
      </div>
      <form onSubmit={submit} noValidate>
        {error && (
          <div className="notice notice-error" role="alert">
            <p>{error}</p>
          </div>
        )}
        <div className="field">
          <label htmlFor="username">Username</label>
          <input
            id="username"
            className="input"
            autoComplete="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            autoFocus
          />
        </div>
        <div className="field">
          <label htmlFor="password">Password</label>
          <PasswordInput id="password" autoComplete="current-password" value={password} onChange={setPassword} />
        </div>
        <button type="submit" className="btn btn-primary btn-block" disabled={busy || !username || !password}>
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </AuthShell>
  );
}
