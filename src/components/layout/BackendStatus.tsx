import { useEffect, useState } from "react";
import { healthApi } from "../../api/community";

type State = "checking" | "up" | "down";

/** Calls GET /health so visitors (and developers) can see whether sign-in will work. */
export default function BackendStatus() {
  const [state, setState] = useState<State>("checking");

  useEffect(() => {
    let alive = true;
    const check = () =>
      healthApi
        .check()
        .then(() => alive && setState("up"))
        .catch(() => alive && setState("down"));
    check();
    const id = window.setInterval(check, 60_000);
    return () => {
      alive = false;
      window.clearInterval(id);
    };
  }, []);

  const text = {
    checking: "Checking the account server…",
    up: "Account server is online",
    down: "Account server is offline. Signing in is unavailable.",
  }[state];

  return (
    <p className={`backend-status is-${state}`} role="status">
      <span className="status-dot" aria-hidden="true" />
      {text}
    </p>
  );
}
