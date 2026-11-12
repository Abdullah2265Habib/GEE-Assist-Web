import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { adminApi, ratingsApi } from "../../api/community";
import type { Feedback, FeedbackCategory, FeedbackStatus, Rating, RatingSummary, Suggestion, SuggestionStatus, User } from "../../api/types";
import { useAuth } from "../../auth/AuthProvider";
import Loading from "../../components/Loading";
import RatingBreakdown from "../../components/community/RatingBreakdown";
import { StarsDisplay } from "../../components/community/Stars";
import {
  FEEDBACK_STATUS_LABELS,
  FeedbackStatusPill,
  SUGGESTION_STATUS_LABELS,
  SuggestionStatusPill,
} from "../../components/community/StatusPill";

type Tab = "overview" | "feedback" | "suggestions" | "ratings" | "users";
const TABS: { id: Tab; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "feedback", label: "Feedback" },
  { id: "suggestions", label: "Suggestions" },
  { id: "ratings", label: "Ratings" },
  { id: "users", label: "Users" },
];

const PAGE = 20;
const fmt = (iso: string) => new Date(iso).toLocaleString(undefined, { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });

/** Admin endpoints return user ids only; this loads names once so rows can show who wrote them. */
function useUserNames() {
  const [users, setUsers] = useState<User[]>([]);
  const reload = useCallback(() => {
    adminApi
      .users(0, 200)
      .then((r) => setUsers(r.items))
      .catch(() => setUsers([]));
  }, []);
  useEffect(reload, [reload]);
  const byId = useMemo(() => new Map(users.map((u) => [u.id, u])), [users]);
  return { users, byId, reload };
}

function Who({ id, byId }: { id: string; byId: Map<string, User> }) {
  const u = byId.get(id);
  return <span className="who">{u ? `${u.full_name} (@${u.username})` : `User ${id.slice(-6)}`}</span>;
}

function Pager({ skip, total, onChange }: { skip: number; total: number; onChange: (skip: number) => void }) {
  if (total <= PAGE) return null;
  return (
    <div className="pager">
      <button className="btn btn-secondary" disabled={skip === 0} onClick={() => onChange(Math.max(0, skip - PAGE))}>
        Previous
      </button>
      <span>
        {skip + 1} to {Math.min(skip + PAGE, total)} of {total}
      </span>
      <button className="btn btn-secondary" disabled={skip + PAGE >= total} onClick={() => onChange(skip + PAGE)}>
        Next
      </button>
    </div>
  );
}

/** One editable row for feedback or a suggestion: status select plus a note the user will see. */
function ReviewEditor<S extends string>({
  status,
  note,
  options,
  onSave,
}: {
  status: S;
  note: string | null;
  options: Record<S, { label: string }>;
  onSave: (status: S, note: string) => Promise<void>;
}) {
  const [s, setS] = useState<S>(status);
  const [n, setN] = useState(note ?? "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const dirty = s !== status || n !== (note ?? "");
  return (
    <form
      className="review-editor"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setErr(null);
        try {
          await onSave(s, n);
        } catch (ex) {
          setErr(ex instanceof Error ? ex.message : "Could not save.");
        } finally {
          setBusy(false);
        }
      }}
    >
      <label>
        <span className="visually-hidden">Status</span>
        <select className="select" value={s} onChange={(e) => setS(e.target.value as S)}>
          {(Object.keys(options) as S[]).map((k) => (
            <option key={k} value={k}>
              {options[k].label}
            </option>
          ))}
        </select>
      </label>
      <label className="grow">
        <span className="visually-hidden">Note to the user</span>
        <input className="input" placeholder="Note the user will see (optional)" maxLength={1000} value={n} onChange={(e) => setN(e.target.value)} />
      </label>
      <button className="btn btn-primary" disabled={busy || !dirty}>
        {busy ? "Saving…" : "Save"}
      </button>
      {err && <span className="error-text">{err}</span>}
    </form>
  );
}

/* --------------------------------------------------------------- Overview */

function Overview({ go }: { go: (t: Tab) => void }) {
  const [data, setData] = useState<{
    users: number;
    openFeedback: number;
    reviewFeedback: number;
    pendingSuggestions: number;
    plannedSuggestions: number;
    summary: RatingSummary | null;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      adminApi.users(0, 1),
      adminApi.feedback({ status: "open", limit: 1 }),
      adminApi.feedback({ status: "in_review", limit: 1 }),
      adminApi.suggestions({ status: "pending", limit: 1 }),
      adminApi.suggestions({ status: "planned", limit: 1 }),
      ratingsApi.summary().catch(() => null),
    ])
      .then(([u, fo, fr, sp, spl, sum]) =>
        setData({
          users: u.total,
          openFeedback: fo.total,
          reviewFeedback: fr.total,
          pendingSuggestions: sp.total,
          plannedSuggestions: spl.total,
          summary: sum,
        }),
      )
      .catch((e) => setError(e instanceof Error ? e.message : "Could not load the overview."));
  }, []);

  if (error) return <div className="notice notice-error"><p>{error}</p></div>;
  if (!data) return <Loading />;

  const tiles: { label: string; value: number; hint: string; tab: Tab }[] = [
    { label: "Feedback waiting", value: data.openFeedback, hint: `${data.reviewFeedback} being looked at`, tab: "feedback" },
    { label: "Suggestions to review", value: data.pendingSuggestions, hint: `${data.plannedSuggestions} planned`, tab: "suggestions" },
    { label: "Accounts", value: data.users, hint: "Manage roles and access", tab: "users" },
  ];

  return (
    <div className="overview">
      <div className="tiles">
        {tiles.map((t) => (
          <button key={t.label} type="button" className="tile" onClick={() => go(t.tab)}>
            <span className="tile-value">{t.value}</span>
            <span className="tile-label">{t.label}</span>
            <span className="tile-hint">{t.hint}</span>
          </button>
        ))}
      </div>
      <section className="panel">
        <h3>Ratings</h3>
        {data.summary ? <RatingBreakdown summary={data.summary} /> : <p className="empty">Could not load ratings.</p>}
      </section>
    </div>
  );
}

/* --------------------------------------------------------------- Feedback */

function FeedbackAdmin({ byId }: { byId: Map<string, User> }) {
  const [status, setStatus] = useState<FeedbackStatus | "">("open");
  const [category, setCategory] = useState<FeedbackCategory | "">("");
  const [skip, setSkip] = useState(0);
  const [page, setPage] = useState<{ total: number; items: Feedback[] } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setPage(null);
    adminApi
      .feedback({ status: status || undefined, category: category || undefined, skip, limit: PAGE })
      .then(setPage)
      .catch((e) => setError(e.message));
  }, [status, category, skip]);
  useEffect(load, [load]);

  return (
    <>
      <div className="filters compact">
        <label className="field">
          <span>Status</span>
          <select className="select" value={status} onChange={(e) => { setSkip(0); setStatus(e.target.value as FeedbackStatus | ""); }}>
            <option value="">Any status</option>
            {Object.entries(FEEDBACK_STATUS_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v.label}</option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Category</span>
          <select className="select" value={category} onChange={(e) => { setSkip(0); setCategory(e.target.value as FeedbackCategory | ""); }}>
            <option value="">Any category</option>
            <option value="bug">Bug</option>
            <option value="ui">Hard to use</option>
            <option value="performance">Slow</option>
            <option value="other">Other</option>
          </select>
        </label>
      </div>
      {error && <div className="notice notice-error"><p>{error}</p></div>}
      {!page ? (
        <Loading />
      ) : page.items.length === 0 ? (
        <p className="empty">No feedback matches these filters.</p>
      ) : (
        <ul className="entry-list">
          {page.items.map((f) => (
            <li key={f.id} className="entry">
              <div className="entry-head">
                <span className="entry-cat">{f.category === "ui" ? "Hard to use" : f.category === "performance" ? "Slow" : f.category === "bug" ? "Bug" : "Other"}</span>
                <FeedbackStatusPill status={f.status} />
              </div>
              <p className="entry-body">{f.message}</p>
              <p className="entry-meta">
                <Who id={f.user_id} byId={byId} /> · {fmt(f.created_at)}
                {f.app_version && ` · version ${f.app_version}`}
              </p>
              <ReviewEditor
                status={f.status}
                note={f.admin_note}
                options={FEEDBACK_STATUS_LABELS}
                onSave={async (s, n) => {
                  const u = await adminApi.updateFeedback(f.id, { status: s, admin_note: n });
                  setPage((p) => p && { ...p, items: p.items.map((x) => (x.id === u.id ? u : x)) });
                }}
              />
            </li>
          ))}
        </ul>
      )}
      {page && <Pager skip={skip} total={page.total} onChange={setSkip} />}
    </>
  );
}

/* ------------------------------------------------------------ Suggestions */

function SuggestionsAdmin({ byId }: { byId: Map<string, User> }) {
  const [status, setStatus] = useState<SuggestionStatus | "">("pending");
  const [skip, setSkip] = useState(0);
  const [page, setPage] = useState<{ total: number; items: Suggestion[] } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setPage(null);
    adminApi
      .suggestions({ status: status || undefined, skip, limit: PAGE })
      .then(setPage)
      .catch((e) => setError(e.message));
  }, [status, skip]);
  useEffect(load, [load]);

  return (
    <>
      <div className="filters compact">
        <label className="field">
          <span>Status</span>
          <select className="select" value={status} onChange={(e) => { setSkip(0); setStatus(e.target.value as SuggestionStatus | ""); }}>
            <option value="">Any status</option>
            {Object.entries(SUGGESTION_STATUS_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v.label}</option>
            ))}
          </select>
        </label>
      </div>
      {error && <div className="notice notice-error"><p>{error}</p></div>}
      {!page ? (
        <Loading />
      ) : page.items.length === 0 ? (
        <p className="empty">No suggestions match this filter.</p>
      ) : (
        <ul className="entry-list">
          {page.items.map((s) => (
            <li key={s.id} className="entry">
              <div className="entry-head">
                <strong className="entry-title">{s.title}</strong>
                <SuggestionStatusPill status={s.status} />
              </div>
              <p className="entry-body">{s.description}</p>
              <p className="entry-meta">
                <Who id={s.user_id} byId={byId} /> · {fmt(s.created_at)}
              </p>
              <ReviewEditor
                status={s.status}
                note={s.admin_note}
                options={SUGGESTION_STATUS_LABELS}
                onSave={async (st, n) => {
                  const u = await adminApi.updateSuggestion(s.id, { status: st, admin_note: n });
                  setPage((p) => p && { ...p, items: p.items.map((x) => (x.id === u.id ? u : x)) });
                }}
              />
            </li>
          ))}
        </ul>
      )}
      {page && <Pager skip={skip} total={page.total} onChange={setSkip} />}
    </>
  );
}

/* ---------------------------------------------------------------- Ratings */

function RatingsAdmin({ byId }: { byId: Map<string, User> }) {
  const [score, setScore] = useState<number | "">("");
  const [skip, setSkip] = useState(0);
  const [page, setPage] = useState<{ total: number; items: Rating[] } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setPage(null);
    adminApi
      .ratings({ score: score || undefined, skip, limit: PAGE })
      .then(setPage)
      .catch((e) => setError(e.message));
  }, [score, skip]);

  return (
    <>
      <div className="filters compact">
        <label className="field">
          <span>Score</span>
          <select className="select" value={score} onChange={(e) => { setSkip(0); setScore(e.target.value ? Number(e.target.value) : ""); }}>
            <option value="">Any score</option>
            {[5, 4, 3, 2, 1].map((s) => (
              <option key={s} value={s}>{s} star{s > 1 ? "s" : ""}</option>
            ))}
          </select>
        </label>
      </div>
      {error && <div className="notice notice-error"><p>{error}</p></div>}
      {!page ? (
        <Loading />
      ) : page.items.length === 0 ? (
        <p className="empty">No ratings match this filter.</p>
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th scope="col">Score</th>
                <th scope="col">Comment</th>
                <th scope="col">From</th>
                <th scope="col">Version</th>
                <th scope="col">Updated</th>
              </tr>
            </thead>
            <tbody>
              {page.items.map((r) => (
                <tr key={r.id}>
                  <td><StarsDisplay value={r.score} size={14} /></td>
                  <td>{r.comment ?? <span className="muted-note">No comment</span>}</td>
                  <td><Who id={r.user_id} byId={byId} /></td>
                  <td>{r.app_version ?? "Not given"}</td>
                  <td className="nowrap">{fmt(r.updated_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {page && <Pager skip={skip} total={page.total} onChange={setSkip} />}
    </>
  );
}

/* ------------------------------------------------------------------ Users */

function UsersAdmin({ onChanged }: { onChanged: () => void }) {
  const { user: me } = useAuth();
  const [skip, setSkip] = useState(0);
  const [page, setPage] = useState<{ total: number; items: User[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState("");

  useEffect(() => {
    setPage(null);
    adminApi
      .users(skip, PAGE)
      .then(setPage)
      .catch((e) => setError(e.message));
  }, [skip]);

  const update = (u: User) => {
    setPage((p) => p && { ...p, items: p.items.map((x) => (x.id === u.id ? u : x)) });
    onChanged();
  };

  const act = async (fn: () => Promise<User>, confirmText: string) => {
    if (!window.confirm(confirmText)) return;
    setError(null);
    try {
      update(await fn());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not update the user.");
    }
  };

  const q = filter.trim().toLowerCase();
  const items = page?.items.filter((u) => !q || u.username.includes(q) || u.full_name.toLowerCase().includes(q) || (u.email ?? "").includes(q)) ?? [];

  return (
    <>
      <div className="filters compact">
        <label className="field">
          <span>Find on this page</span>
          <input className="input" type="search" value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Name, username or email" />
        </label>
      </div>
      {error && <div className="notice notice-error"><p>{error}</p></div>}
      {!page ? (
        <Loading />
      ) : (
        <div className="table-wrap">
          <table className="data-table users-table">
            <thead>
              <tr>
                <th scope="col">User</th>
                <th scope="col">Email</th>
                <th scope="col">Role</th>
                <th scope="col">Access</th>
                <th scope="col">Last sign-in</th>
                <th scope="col"><span className="visually-hidden">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {items.map((u) => {
                const self = u.id === me?.id;
                return (
                  <tr key={u.id}>
                    <th scope="row">
                      <span className="ds-name">{u.full_name}</span>
                      <span className="ds-note">@{u.username}{self && " (you)"}</span>
                    </th>
                    <td>
                      {u.email ?? "None"}{" "}
                      {u.email && !u.email_verified && <span className="pill pill-red">Not confirmed</span>}
                    </td>
                    <td>{u.role === "admin" ? <span className="pill pill-blue">Administrator</span> : "User"}</td>
                    <td>{u.is_active ? <span className="pill pill-green">Can sign in</span> : <span className="pill pill-red">Disabled</span>}</td>
                    <td className="nowrap">{u.last_login_at ? fmt(u.last_login_at) : "Never"}</td>
                    <td className="row-actions">
                      {!self && (
                        <>
                          <button
                            className="btn btn-quiet"
                            onClick={() =>
                              act(
                                () => adminApi.setRole(u.id, u.role === "admin" ? "user" : "admin"),
                                u.role === "admin" ? `Make ${u.username} a regular user?` : `Make ${u.username} an administrator?`,
                              )
                            }
                          >
                            {u.role === "admin" ? "Make user" : "Make admin"}
                          </button>
                          <button
                            className={`btn ${u.is_active ? "btn-danger" : "btn-secondary"}`}
                            onClick={() =>
                              act(
                                () => adminApi.setActive(u.id, !u.is_active),
                                u.is_active ? `Stop ${u.username} from signing in?` : `Let ${u.username} sign in again?`,
                              )
                            }
                          >
                            {u.is_active ? "Disable" : "Enable"}
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {page && <Pager skip={skip} total={page.total} onChange={setSkip} />}
    </>
  );
}

/* ------------------------------------------------------------------- Page */

export default function Admin() {
  const [params, setParams] = useSearchParams();
  const tab = (TABS.find((t) => t.id === params.get("tab"))?.id ?? "overview") as Tab;
  const { byId, reload } = useUserNames();
  const go = (t: Tab) => setParams({ tab: t }, { replace: true });

  return (
    <>
      <div className="container page-head">
        <h1>Admin dashboard</h1>
        <p className="lede">Review what users send, reply to them, and manage who can sign in.</p>
      </div>
      <div className="container">
        <div className="tabs" role="tablist" aria-label="Admin sections">
          {TABS.map((t) => (
            <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} className="tab" onClick={() => go(t.id)}>
              {t.label}
            </button>
          ))}
        </div>
        <div role="tabpanel" className="tab-panel">
          {tab === "overview" && <Overview go={go} />}
          {tab === "feedback" && <FeedbackAdmin byId={byId} />}
          {tab === "suggestions" && <SuggestionsAdmin byId={byId} />}
          {tab === "ratings" && <RatingsAdmin byId={byId} />}
          {tab === "users" && <UsersAdmin onChanged={reload} />}
        </div>
      </div>
    </>
  );
}
