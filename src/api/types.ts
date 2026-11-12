/** Shapes returned by GEE-Assist-Backend (see the dto.py file in each of its app modules). */

export type Role = "admin" | "user";

export interface User {
  id: string;
  username: string;
  full_name: string;
  email: string | null;
  phone_number: string | null;
  email_verified: boolean;
  auth_provider: string;
  role: Role;
  is_active: boolean;
  created_at: string;
  last_login_at: string | null;
}

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
}

export interface LoginResponse extends TokenResponse {
  user: User;
}

export interface SignupRequest {
  full_name: string;
  email: string;
  phone_number: string;
  username: string;
  password: string;
}

export interface SignupResponse {
  message: string;
  user: User;
  verification_token: string;
  email_sent: boolean;
  email_delivery: "email" | "console";
}

export interface VerificationRequiredDetail {
  code: "VERIFICATION_REQUIRED";
  message: string;
  email_verified: boolean;
  verification_token: string;
}

export interface VerificationStatus {
  email_verified: boolean;
  is_verified: boolean;
  email: string | null;
}

export interface GoogleStartResponse {
  session_id: string;
  authorization_url: string;
  expires_in: number;
  poll_interval: number;
}

export interface Page<T> {
  total: number;
  skip: number;
  limit: number;
  items: T[];
}

export interface Rating {
  id: string;
  user_id: string;
  score: number;
  comment: string | null;
  app_version: string | null;
  created_at: string;
  updated_at: string;
}

export interface RatingSummary {
  count: number;
  average: number | null;
  distribution: Record<string, number>;
}

export type FeedbackCategory = "bug" | "ui" | "performance" | "other";
export type FeedbackStatus = "open" | "in_review" | "resolved";

export interface Feedback {
  id: string;
  user_id: string;
  category: FeedbackCategory;
  message: string;
  app_version: string | null;
  status: FeedbackStatus;
  admin_note: string | null;
  created_at: string;
  updated_at: string;
}

export type SuggestionStatus = "pending" | "planned" | "implemented" | "rejected";

export interface Suggestion {
  id: string;
  user_id: string;
  title: string;
  description: string;
  status: SuggestionStatus;
  admin_note: string | null;
  created_at: string;
  updated_at: string;
}

export interface UserList {
  total: number;
  items: User[];
}
