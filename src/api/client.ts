/**
 * Small fetch wrapper for GEE-Assist-Backend.
 *
 * - Adds `Authorization: Bearer <access token>` when one is stored.
 * - On a 401 it tries POST /auth/refresh once, then retries the request.
 * - Turns FastAPI error bodies (`{"detail": ...}`) into an ApiError with a
 *   readable message and the raw detail (login's VERIFICATION_REQUIRED needs it).
 */

import type { TokenResponse } from "./types";

export const API_BASE_URL: string = (import.meta.env.VITE_API_BASE_URL as string | undefined) || "/api";

const ACCESS_KEY = "gee-assist.access_token";
const REFRESH_KEY = "gee-assist.refresh_token";

export class ApiError extends Error {
  status: number;
  detail: unknown;
  retryAfter: number | null;

  constructor(status: number, message: string, detail: unknown, retryAfter: number | null = null) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.detail = detail;
    this.retryAfter = retryAfter;
  }
}

export const tokenStore = {
  get access(): string | null {
    try {
      return localStorage.getItem(ACCESS_KEY);
    } catch {
      return null;
    }
  },
  get refresh(): string | null {
    try {
      return localStorage.getItem(REFRESH_KEY);
    } catch {
      return null;
    }
  },
  set(tokens: Pick<TokenResponse, "access_token" | "refresh_token">) {
    try {
      localStorage.setItem(ACCESS_KEY, tokens.access_token);
      localStorage.setItem(REFRESH_KEY, tokens.refresh_token);
    } catch {
      /* private mode: session will not survive a reload */
    }
  },
  clear() {
    try {
      localStorage.removeItem(ACCESS_KEY);
      localStorage.removeItem(REFRESH_KEY);
    } catch {
      /* ignore */
    }
  },
};

/** Turns a FastAPI/pydantic error body into one readable sentence. */
export function describeDetail(detail: unknown, fallback = "Something went wrong."): string {
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    // pydantic 422: [{loc: ["body", "password"], msg: "...", type: "..."}]
    const parts = detail.map((d) => {
      if (d && typeof d === "object" && "msg" in d) {
        const loc = Array.isArray((d as { loc?: unknown[] }).loc) ? (d as { loc: unknown[] }).loc : [];
        const field = loc.filter((l) => l !== "body").join(".");
        const msg = String((d as { msg: unknown }).msg).replace(/^Value error, /, "");
        return field ? `${field}: ${msg}` : msg;
      }
      return String(d);
    });
    return parts.join(" ");
  }
  if (detail && typeof detail === "object" && "message" in detail) {
    return String((detail as { message: unknown }).message);
  }
  return fallback;
}

interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  /** Bearer token to use instead of the stored access token (verification token flows). */
  token?: string;
  /** Skip the automatic refresh-and-retry on 401. */
  noRefresh?: boolean;
  signal?: AbortSignal;
}

let refreshing: Promise<boolean> | null = null;

async function tryRefresh(): Promise<boolean> {
  if (refreshing) return refreshing;
  refreshing = (async () => {
    const refresh = tokenStore.refresh;
    if (!refresh) return false;
    try {
      const res = await fetch(`${API_BASE_URL}/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: refresh }),
      });
      if (!res.ok) {
        tokenStore.clear();
        return false;
      }
      const tokens = (await res.json()) as TokenResponse;
      tokenStore.set(tokens);
      return true;
    } catch {
      return false;
    } finally {
      refreshing = null;
    }
  })();
  return refreshing;
}

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = "GET", body, token, noRefresh = false, signal } = options;

  const send = async (bearer: string | null): Promise<Response> => {
    const headers: Record<string, string> = { Accept: "application/json" };
    if (body !== undefined) headers["Content-Type"] = "application/json";
    if (bearer) headers.Authorization = `Bearer ${bearer}`;
    return fetch(`${API_BASE_URL}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal,
    });
  };

  let res: Response;
  try {
    res = await send(token ?? tokenStore.access);
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") throw err;
    throw new ApiError(0, "Could not reach the server. Check that the backend is running.", null);
  }

  if (res.status === 401 && !token && !noRefresh && tokenStore.refresh) {
    const ok = await tryRefresh();
    if (ok) res = await send(tokenStore.access);
  }

  if (res.status === 204) return undefined as T;

  const text = await res.text();
  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }

  if (!res.ok) {
    const detail = data && typeof data === "object" && "detail" in data ? (data as { detail: unknown }).detail : data;
    const retryAfter = res.headers.get("Retry-After");
    throw new ApiError(
      res.status,
      describeDetail(detail, `Request failed (${res.status}).`),
      detail,
      retryAfter ? Number(retryAfter) : null,
    );
  }

  return data as T;
}

export function withQuery(path: string, params: Record<string, string | number | undefined | null>): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== "") q.set(k, String(v));
  }
  const s = q.toString();
  return s ? `${path}?${s}` : path;
}
