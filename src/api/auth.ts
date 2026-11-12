import { request } from "./client";
import type {
  GoogleStartResponse,
  LoginResponse,
  SignupRequest,
  SignupResponse,
  TokenResponse,
  User,
  VerificationStatus,
} from "./types";

export const authApi = {
  signup: (data: SignupRequest) => request<SignupResponse>("/auth/signup", { method: "POST", body: data, noRefresh: true }),

  login: (username: string, password: string) =>
    request<LoginResponse>("/auth/login", { method: "POST", body: { username, password }, noRefresh: true }),

  refresh: (refresh_token: string) =>
    request<TokenResponse>("/auth/refresh", { method: "POST", body: { refresh_token }, noRefresh: true }),

  me: () => request<User>("/auth/me"),

  /** Needs the verification token from signup or from the login 403. */
  verificationStatus: (verificationToken: string) =>
    request<VerificationStatus>("/auth/verification-status", { token: verificationToken }),

  resendVerification: (verificationToken: string, email?: string) =>
    request<{ message: string }>("/auth/verify-email/resend", {
      method: "POST",
      token: verificationToken,
      body: email ? { email } : {},
    }),

  googleStart: () => request<GoogleStartResponse>("/auth/google/start", { method: "POST", noRefresh: true }),

  /** 200 with tokens when done, or a 202 "pending" body while the user is still signing in. */
  googlePoll: (session_id: string) =>
    request<LoginResponse | { status: "pending" }>("/auth/google/poll", {
      method: "POST",
      body: { session_id },
      noRefresh: true,
    }),
};
