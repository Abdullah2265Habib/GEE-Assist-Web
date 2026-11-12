import { useState } from "react";

interface Props {
  id: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete: string;
  invalid?: boolean;
  describedBy?: string;
}

export default function PasswordInput({ id, value, onChange, autoComplete, invalid, describedBy }: Props) {
  const [show, setShow] = useState(false);
  return (
    <div className="password-wrap">
      <input
        id={id}
        className="input"
        type={show ? "text" : "password"}
        autoComplete={autoComplete}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        required
      />
      <button type="button" className="password-toggle" onClick={() => setShow((s) => !s)} aria-pressed={show}>
        {show ? "Hide" : "Show"}
      </button>
    </div>
  );
}
