import { request, withQuery } from "./client";
import type {
  Feedback,
  FeedbackCategory,
  FeedbackStatus,
  Page,
  Rating,
  RatingSummary,
  Suggestion,
  SuggestionStatus,
  User,
  UserList,
} from "./types";

/* Everything here needs a signed-in user (access token). */

export const ratingsApi = {
  mine: () => request<Rating>("/ratings/me"),
  rate: (score: number, comment?: string, app_version?: string) =>
    request<Rating>("/ratings/me", {
      method: "PUT",
      body: { score, comment: comment || null, app_version: app_version || null },
    }),
  remove: () => request<void>("/ratings/me", { method: "DELETE" }),
  summary: () => request<RatingSummary>("/ratings/summary"),
};

export const feedbackApi = {
  mine: (skip = 0, limit = 50) => request<Page<Feedback>>(withQuery("/feedback/me", { skip, limit })),
  send: (category: FeedbackCategory, message: string, app_version?: string) =>
    request<Feedback>("/feedback", { method: "POST", body: { category, message, app_version: app_version || null } }),
};

export const suggestionsApi = {
  mine: (skip = 0, limit = 50) => request<Page<Suggestion>>(withQuery("/suggestions/me", { skip, limit })),
  send: (title: string, description: string) =>
    request<Suggestion>("/suggestions", { method: "POST", body: { title, description } }),
};

/* Admin only (role = admin). */

export const adminApi = {
  users: (skip = 0, limit = 50) => request<UserList>(withQuery("/admin/users", { skip, limit })),
  setRole: (userId: string, role: "admin" | "user") =>
    request<User>(`/admin/users/${userId}/role`, { method: "PATCH", body: { role } }),
  setActive: (userId: string, is_active: boolean) =>
    request<User>(`/admin/users/${userId}/status`, { method: "PATCH", body: { is_active } }),

  ratings: (params: { score?: number; user_id?: string; skip?: number; limit?: number } = {}) =>
    request<Page<Rating>>(withQuery("/admin/ratings", params)),

  feedback: (params: { status?: FeedbackStatus; category?: FeedbackCategory; user_id?: string; skip?: number; limit?: number } = {}) =>
    request<Page<Feedback>>(withQuery("/admin/feedback", params)),
  updateFeedback: (id: string, data: { status?: FeedbackStatus; admin_note?: string }) =>
    request<Feedback>(`/admin/feedback/${id}`, { method: "PATCH", body: data }),

  suggestions: (params: { status?: SuggestionStatus; user_id?: string; skip?: number; limit?: number } = {}) =>
    request<Page<Suggestion>>(withQuery("/admin/suggestions", params)),
  updateSuggestion: (id: string, data: { status?: SuggestionStatus; admin_note?: string }) =>
    request<Suggestion>(`/admin/suggestions/${id}`, { method: "PATCH", body: data }),
};

export const healthApi = {
  check: () => request<{ status: string }>("/health", { noRefresh: true }),
};
