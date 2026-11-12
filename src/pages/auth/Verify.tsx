import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { authApi } from "../../api/auth";
import { ApiError } from "../../api/client";
import { useAuth } from "../../auth/AuthProvider";
import AuthShell from "./AuthShell";
import PasswordInput from "./PasswordInput";

const POLL_MS = 4000;

/** "Check your email": polls the server until the link is opened, then signs in. */
export default function Verify() {
  const { pending, setPending, finishVerification, user, clearPending } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? "/community";

  const [email, setEmail] = useState<string | null>(pending?.email ?? null);
  const [verified, setVerified] = useState(false);
  const [needsPassword, setNeedsPassword] = useState(false);
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const [changing, setChanging] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const signingIn = useRef(false);

  // Poll the verification status.
  useEffect(() => {
    if (!pending || verified) return;
    let alive = true;
    const check = async () => {
      try {
        const s = await authApi.verificationStatus(pending.token);
        if (!alive) return;
        if (s.email) setEmail(s.email);
        if (s.is_verified) setVerified(true);
      } catch (err) {
        if (alive && err instanceof ApiError && err.status === 401) {
          setMessage({ kind: "err", text: "This verification session has expired. Sign in again to get a new one." });
        }
      }
    };
    void check();
    const id = window.setInterval(check, POLL_MS);
    const onFocus = () => void check();
    window.addEventListener("focus", onFocus);
    return () => {
      alive = false;
      window.clearInterval(id);
      window.removeEventListener("focus", onFocus);
    };
  }, [pending, verified]);

  // Once verified, sign in with the password typed on this visit, or ask for it.
  useEffect(() => {
    if (!verified || signingIn.current) return;
    signingIn.current = true;
    finishVerification()
      .then((ok) => {
        if (ok) navigate(from, { replace: true });
        else setNeedsPassword(true);
      })
      .catch(() => setNeedsPassword(true));
  }, [verified, finishVerification, navigate, from]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = window.setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => window.clearTimeout(id);
  }, [cooldown]);

  if (user) return <Navigate to={from} replace />;
  if (!pending) {
    return (
      <AuthShell title="Nothing to verify">
        <p>There is no account waiting for email confirmation in this browser tab.</p>
        <div className="btn-row">
          <Link className="btn btn-primary" to="/login">
            Sign in
          </Link>
          <Link className="btn btn-secondary" to="/signup">
            Create an account
          </Link>
        </div>
      </AuthShell>
    );
  }

  const resend = async (changeTo?: string) => {
    setMessage(null);
    setBusy(true);
    try {
      const res = await authApi.resendVerification(pending.token, changeTo);
      if (changeTo) {
        setEmail(changeTo.trim().toLowerCase());
        setPending({ ...pending, email: changeTo.trim().toLowerCase() });
        setChanging(false);
      }
      setMessage({ kind: "ok", text: res.message });
      setCooldown(60);
    } catch (err) {
      if (err instanceof ApiError && err.status === 429) {
        setCooldown(err.retryAfter ?? 60);
        setMessage({ kind: "err", text: err.message });
      } else if (err instanceof ApiError && err.status === 409 && err.message.toLowerCase().includes("already verified")) {
        setVerified(true);
      } else {
        setMessage({ kind: "err", text: err instanceof Error ? err.message : "Could not send the email." });
      }
    } finally {
      setBusy(false);
    }
  };

  const signIn = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      await finishVerification(pending.username ?? "", password);
      navigate(from, { replace: true });
    } catch (err) {
      setMessage({ kind: "err", text: err instanceof ApiError && err.status === 401 ? "The password is wrong." : err instanceof Error ? err.message : "Could not sign in." });
    } finally {
      setBusy(false);
    }
  };

  if (verified) {
    return (
      <AuthShell title="Email confirmed">
        {needsPassword ? (
          <form onSubmit={signIn}>
            <p>
              Your email is confirmed. Enter the password for <strong>{pending.username}</strong> to sign in.
            </p>
            {message && (
              <div className={`notice ${message.kind === "err" ? "notice-error" : "notice-success"}`} role="alert">
                <p>{message.text}</p>
              </div>
            )}
            <div className="field">
              <label htmlFor="vpw">Password</label>
              <PasswordInput id="vpw" autoComplete="current-password" value={password} onChange={setPassword} />
            </div>
            <button className="btn btn-primary btn-block" disabled={busy || !password}>
              {busy ? "Signing in…" : "Sign in"}
            </button>
          </form>
        ) : (
          <p role="status">Signing you in…</p>
        )}
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Check your email">
      <p>
        We sent a confirmation link to <strong>{email ?? "your email address"}</strong>. Open it, and this page signs you in by
        itself.
      </p>
      {pending.consoleMode && (
        <div className="notice">
          <p>
            The account server is running without email set up, so the link was printed in the server's log instead. Open it
            from there.
          </p>
        </div>
      )}
      <p className="waiting" role="status">
        <span className="pulse" aria-hidden="true" /> Waiting for the link to be opened
      </p>
      {message && (
        <div className={`notice ${message.kind === "err" ? "notice-error" : "notice-success"}`} role="alert">
          <p>{message.text}</p>
        </div>
      )}
      {changing ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void resend(newEmail);
          }}
        >
          <div className="field">
            <label htmlFor="newEmail">New email address</label>
            <input id="newEmail" className="input" type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} autoFocus required />
          </div>
          <div className="btn-row">
            <button className="btn btn-primary" disabled={busy || cooldown > 0 || !newEmail}>
              {cooldown > 0 ? `Send to the new address in ${cooldown} s` : "Send to the new address"}
            </button>
            <button type="button" className="btn btn-quiet" onClick={() => setChanging(false)}>
              Keep {email}
            </button>
          </div>
        </form>
      ) : (
        <div className="btn-row">
          <button type="button" className="btn btn-secondary" onClick={() => resend()} disabled={busy || cooldown > 0}>
            {cooldown > 0 ? `Resend in ${cooldown} s` : "Resend the email"}
          </button>
          <button type="button" className="btn btn-quiet" onClick={() => setChanging(true)}>
            Change email address
          </button>
        </div>
      )}
      <p className="auth-foot">
        Wrong account?{" "}
        <button
          type="button"
          className="link-btn"
          onClick={() => {
            clearPending();
            navigate("/login");
          }}
        >
          Start again
        </button>
      </p>
    </AuthShell>
  );
}
