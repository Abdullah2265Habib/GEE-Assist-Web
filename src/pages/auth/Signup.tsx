import { useState, type FormEvent } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { ApiError } from "../../api/client";
import type { SignupRequest } from "../../api/types";
import { useAuth } from "../../auth/AuthProvider";
import AuthShell from "./AuthShell";
import GoogleButton from "./GoogleButton";
import PasswordInput from "./PasswordInput";

type Field = keyof SignupRequest | "confirm";

/** The same rules the server applies (app/auth/signup/dto.py), checked before sending. */
function validate(v: SignupRequest & { confirm: string }): Partial<Record<Field, string>> {
  const e: Partial<Record<Field, string>> = {};
  const name = v.full_name.trim().replace(/\s+/g, " ");
  if (name.length < 2) e.full_name = "Enter your full name.";
  else if (!/^[\p{L}'-]+( [\p{L}'-]+)*$/u.test(name)) e.full_name = "Use letters, spaces, hyphens and apostrophes only.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.email.trim())) e.email = "Enter an email address like name@example.com.";
  const phone = v.phone_number.replace(/[\s\-()]/g, "").replace(/^00/, "+");
  if (!/^\+[1-9][0-9]{9,14}$/.test(phone)) e.phone_number = "Start with + and your country code, e.g. +923001234567.";
  if (!/^[a-zA-Z0-9_.]{3,30}$/.test(v.username.trim())) e.username = "3 to 30 letters, digits, dots or underscores.";
  if (v.password.length < 8) e.password = "At least 8 characters.";
  else if (!v.password.trim()) e.password = "The password cannot be only spaces.";
  if (v.confirm !== v.password) e.confirm = "The passwords do not match.";
  return e;
}

/** Map a 409 conflict message from the server to the field it is about. */
function conflictField(message: string): Field | null {
  const m = message.toLowerCase();
  if (m.includes("username")) return "username";
  if (m.includes("email")) return "email";
  if (m.includes("phone")) return "phone_number";
  return null;
}

export default function Signup() {
  const { signup, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? "/community";
  const [values, setValues] = useState({ full_name: "", email: "", phone_number: "", username: "", password: "", confirm: "" });
  const [touched, setTouched] = useState<Partial<Record<Field, boolean>>>({});
  const [serverErrors, setServerErrors] = useState<Partial<Record<Field, string>>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to={from} replace />;

  const errors = { ...validate(values), ...serverErrors };
  const set = (k: Field) => (v: string) => {
    setValues((s) => ({ ...s, [k]: v }));
    setServerErrors((s) => ({ ...s, [k]: undefined }));
  };
  const show = (k: Field) => (touched[k] ? errors[k] : undefined);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setTouched({ full_name: true, email: true, phone_number: true, username: true, password: true, confirm: true });
    setError(null);
    if (Object.values(validate(values)).some(Boolean)) return;
    setBusy(true);
    try {
      const { confirm: _confirm, ...data } = values;
      void _confirm;
      await signup({ ...data, full_name: data.full_name.trim(), email: data.email.trim(), username: data.username.trim() });
      navigate("/verify", { state: { from } });
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        const f = conflictField(err.message);
        if (f) setServerErrors({ [f]: err.message });
        else setError(err.message);
      } else {
        setError(err instanceof Error ? err.message : "Could not create the account.");
      }
    } finally {
      setBusy(false);
    }
  };

  const field = (k: Field, label: string, input: React.ReactNode, hint?: string) => (
    <div className="field">
      <label htmlFor={k}>{label}</label>
      {input}
      {show(k) ? (
        <span className="error-text" id={`${k}-err`}>
          {show(k)}
        </span>
      ) : (
        hint && (
          <span className="hint" id={`${k}-hint`}>
            {hint}
          </span>
        )
      )}
    </div>
  );

  const text = (k: Exclude<Field, "password" | "confirm">, type: string, autoComplete: string) => (
    <input
      id={k}
      className="input"
      type={type}
      autoComplete={autoComplete}
      value={values[k]}
      onChange={(e) => set(k)(e.target.value)}
      onBlur={() => setTouched((t) => ({ ...t, [k]: true }))}
      aria-invalid={!!show(k) || undefined}
      aria-describedby={show(k) ? `${k}-err` : `${k}-hint`}
      required
    />
  );

  return (
    <AuthShell
      title="Create an account"
      intro={
        <p>
          Already have one? <Link to="/login" state={{ from }}>Sign in</Link>.
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
        {field("full_name", "Full name", text("full_name", "text", "name"))}
        {field("email", "Email", text("email", "email", "email"), "We send a link to confirm it.")}
        {field("phone_number", "Phone number", text("phone_number", "tel", "tel"), "With your country code, e.g. +923001234567.")}
        {field("username", "Username", text("username", "text", "username"), "3 to 30 letters, digits, dots or underscores.")}
        <div className="field-pair">
          {field(
            "password",
            "Password",
            <PasswordInput
              id="password"
              autoComplete="new-password"
              value={values.password}
              onChange={(v) => {
                set("password")(v);
                setTouched((t) => ({ ...t, password: true }));
              }}
              invalid={!!show("password")}
              describedBy={show("password") ? "password-err" : "password-hint"}
            />,
            "At least 8 characters.",
          )}
          {field(
            "confirm",
            "Repeat password",
            <PasswordInput
              id="confirm"
              autoComplete="new-password"
              value={values.confirm}
              onChange={(v) => {
                set("confirm")(v);
                setTouched((t) => ({ ...t, confirm: true }));
              }}
              invalid={!!show("confirm")}
              describedBy={show("confirm") ? "confirm-err" : undefined}
            />,
          )}
        </div>
        <button type="submit" className="btn btn-primary btn-block" disabled={busy}>
          {busy ? "Creating your account…" : "Create account"}
        </button>
      </form>
    </AuthShell>
  );
}
