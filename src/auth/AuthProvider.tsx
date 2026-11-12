import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { authApi } from "../api/auth";
import { ApiError, tokenStore } from "../api/client";
import type { LoginResponse, SignupRequest, User, VerificationRequiredDetail } from "../api/types";

/** An account that exists but whose email link has not been opened yet. */
export interface PendingVerification {
  token: string;
  email: string | null;
  username: string | null;
  /** True when the backend printed the link to its log instead of emailing it (no SMTP configured). */
  consoleMode: boolean;
}

interface AuthContextValue {
  user: User | null;
  /** True until the stored session has been checked once on page load. */
  ready: boolean;
  pending: PendingVerification | null;
  login: (username: string, password: string) => Promise<void>;
  signup: (data: SignupRequest) => Promise<void>;
  /** Opens Google in a new tab and resolves once the user has signed in there. */
  loginWithGoogle: (onOpened?: (url: string) => void) => Promise<void>;
  cancelGoogle: () => void;
  logout: () => void;
  refreshUser: () => Promise<void>;
  clearPending: () => void;
  /** Call after the email link was opened. Uses the password typed on this page load, if any. */
  finishVerification: (username?: string, password?: string) => Promise<boolean>;
  setPending: (p: PendingVerification | null) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const PENDING_KEY = "gee-assist.pending_verification";

function readPending(): PendingVerification | null {
  try {
    const raw = sessionStorage.getItem(PENDING_KEY);
    return raw ? (JSON.parse(raw) as PendingVerification) : null;
  } catch {
    return null;
  }
}

function isVerificationRequired(err: unknown): err is ApiError & { detail: VerificationRequiredDetail } {
  return (
    err instanceof ApiError &&
    err.status === 403 &&
    !!err.detail &&
    typeof err.detail === "object" &&
    (err.detail as { code?: string }).code === "VERIFICATION_REQUIRED"
  );
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  const [pending, setPendingState] = useState<PendingVerification | null>(readPending);
  const googleAbort = useRef<{ cancelled: boolean } | null>(null);
  // Kept in memory only (never in storage) so the verify screen can sign in by itself.
  const credentials = useRef<{ username: string; password: string } | null>(null);

  const setPending = useCallback((p: PendingVerification | null) => {
    setPendingState(p);
    try {
      if (p) sessionStorage.setItem(PENDING_KEY, JSON.stringify(p));
      else sessionStorage.removeItem(PENDING_KEY);
    } catch {
      /* ignore */
    }
  }, []);

  const acceptLogin = useCallback(
    (res: LoginResponse) => {
      tokenStore.set(res);
      setUser(res.user);
      setPending(null);
    },
    [setPending],
  );

  // Restore the session on page load (GET /auth/me, with a refresh on 401 done by the client).
  useEffect(() => {
    let alive = true;
    (async () => {
      if (!tokenStore.access && !tokenStore.refresh) {
        setReady(true);
        return;
      }
      try {
        const me = await authApi.me();
        if (alive) setUser(me);
      } catch {
        tokenStore.clear();
      } finally {
        if (alive) setReady(true);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const login = useCallback(
    async (username: string, password: string) => {
      try {
        const res = await authApi.login(username, password);
        credentials.current = null;
        acceptLogin(res);
      } catch (err) {
        if (isVerificationRequired(err)) {
          credentials.current = { username, password };
          setPending({ token: err.detail.verification_token, email: null, username, consoleMode: false });
          throw new ApiError(403, err.detail.message, err.detail);
        }
        throw err;
      }
    },
    [acceptLogin, setPending],
  );

  const signup = useCallback(
    async (data: SignupRequest) => {
      const res = await authApi.signup(data);
      credentials.current = { username: data.username, password: data.password };
      setPending({
        token: res.verification_token,
        email: res.user.email,
        username: res.user.username,
        consoleMode: res.email_delivery === "console" || !res.email_sent,
      });
    },
    [setPending],
  );

  const finishVerification = useCallback(
    async (username?: string, password?: string) => {
      const creds = username && password ? { username, password } : credentials.current;
      if (!creds) return false;
      const res = await authApi.login(creds.username, creds.password);
      credentials.current = null;
      acceptLogin(res);
      return true;
    },
    [acceptLogin],
  );

  const loginWithGoogle = useCallback(
    async (onOpened?: (url: string) => void) => {
      const start = await authApi.googleStart();
      const popup = window.open(start.authorization_url, "_blank", "noopener");
      onOpened?.(start.authorization_url);
      const state = { cancelled: false };
      googleAbort.current = state;
      const interval = Math.max(2, start.poll_interval) * 1000;
      const deadline = Date.now() + start.expires_in * 1000;
      try {
        while (!state.cancelled && Date.now() < deadline) {
          await new Promise((r) => setTimeout(r, interval));
          if (state.cancelled) break;
          const res = await authApi.googlePoll(start.session_id);
          if ("access_token" in res) {
            acceptLogin(res);
            return;
          }
        }
        if (state.cancelled) throw new ApiError(0, "Google sign-in cancelled.", null);
        throw new ApiError(0, "Google sign-in timed out. Try again.", null);
      } finally {
        googleAbort.current = null;
        if (popup && !popup.closed) {
          try {
            popup.close();
          } catch {
            /* cross-origin: cannot close */
          }
        }
      }
    },
    [acceptLogin],
  );

  const cancelGoogle = useCallback(() => {
    if (googleAbort.current) googleAbort.current.cancelled = true;
  }, []);

  const logout = useCallback(() => {
    credentials.current = null;
    tokenStore.clear();
    setUser(null);
  }, []);

  const refreshUser = useCallback(async () => {
    const me = await authApi.me();
    setUser(me);
  }, []);

  const clearPending = useCallback(() => setPending(null), [setPending]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      ready,
      pending,
      login,
      signup,
      loginWithGoogle,
      cancelGoogle,
      logout,
      refreshUser,
      clearPending,
      finishVerification,
      setPending,
    }),
    [user, ready, pending, login, signup, loginWithGoogle, cancelGoogle, logout, refreshUser, clearPending, finishVerification, setPending],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
