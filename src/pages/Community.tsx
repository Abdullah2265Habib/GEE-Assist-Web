import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ApiError } from "../api/client";
import { adminApi, feedbackApi, ratingsApi, suggestionsApi } from "../api/community";
import type { Feedback, FeedbackCategory, Page, Rating, RatingSummary, Suggestion } from "../api/types";
import { useAuth } from "../auth/AuthProvider";
import Loading from "../components/Loading";
import Stars from "../components/community/Stars";
import RatingBreakdown from "../components/community/RatingBreakdown";
import { FeedbackStatusPill } from "../components/community/StatusPill";

type Tab = "rate" | "feedback" | "suggest";

const TABS: { id: Tab; label: string; blurb: string }[] = [
  { id: "rate", label: "Rate the app", blurb: "Give GEE-Assist one to five stars. You can change your rating whenever you like." },
  { id: "feedback", label: "Send feedback", blurb: "Report a bug, a confusing screen or something slow. You'll see when we look at it." },
  { id: "suggest", label: "Suggest a feature", blurb: "Tell us what to build next. Suggestions are marked planned, implemented or declined." },
];

const CATEGORIES: { value: FeedbackCategory; label: string }[] = [
  { value: "bug", label: "Something is broken" },
  { value: "ui", label: "Something is hard to use" },
  { value: "performance", label: "Something is slow" },
  { value: "other", label: "Something else" },
];

const fmtDate = (iso: string) => new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });

function errorText(err: unknown, fallback: string): string {
  if (err instanceof ApiError && err.status === 429) return `${err.message} The limit resets 24 hours after your earliest message.`;
  return err instanceof Error ? err.message : fallback;
}

const PAGE_SIZE = 10;

function ModalPager({
  skip,
  total,
  limit,
  onChange,
}: {
  skip: number;
  total: number;
  limit: number;
  onChange: (skip: number) => void;
}) {
  if (total <= limit) return null;
  return (
    <div className="pager" style={{ marginTop: "16px" }}>
      <button
        className="btn btn-secondary"
        disabled={skip === 0}
        onClick={() => onChange(Math.max(0, skip - limit))}
      >
        Previous
      </button>
      <span>
        {skip + 1} to {Math.min(skip + limit, total)} of {total}
      </span>
      <button
        className="btn btn-secondary"
        disabled={skip + limit >= total}
        onClick={() => onChange(skip + limit)}
      >
        Next
      </button>
    </div>
  );
}

/* ---------------------------------------------------------------- Rate */

function AllRatingsModal({ onClose }: { onClose: () => void }) {
  const [skip, setSkip] = useState(0);
  const [page, setPage] = useState<Page<Rating> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    ratingsApi
      .list({ skip, limit: PAGE_SIZE })
      .then((p) => {
        setPage(p);
        setLoading(false);
      })
      .catch(() => {
        setPage(null);
        setLoading(false);
      });
  }, [skip]);

  return (
    <div className="modal-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>All Community Ratings</h3>
          <button type="button" className="modal-close-btn" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        <div className="modal-body">
          {loading ? (
            <Loading label="Loading ratings…" />
          ) : !page || page.items.length === 0 ? (
            <p className="empty">No ratings found.</p>
          ) : (
            <>
              <ul className="entry-list">
                {page.items.map((r) => (
                  <li key={r.id} className="entry">
                    <div className="entry-head">
                      <Stars value={r.score} onChange={() => { }} />
                      <span className="entry-meta">{fmtDate(r.created_at)}</span>
                    </div>
                    {r.comment && <p className="entry-body">{r.comment}</p>}
                    <p className="entry-meta">
                      By {r.username ? `@${r.username}` : r.email ? r.email : `User ${r.user_id.slice(-6)}`}
                      {r.app_version && ` · app v${r.app_version}`}
                    </p>
                  </li>
                ))}
              </ul>
              <ModalPager
                skip={skip}
                total={page.total}
                limit={PAGE_SIZE}
                onChange={setSkip}
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function RatePanel() {
  const [items, setItems] = useState<Rating[] | null>(null);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [summary, setSummary] = useState<RatingSummary | null>(null);
  const [score, setScore] = useState(0);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [showAllModal, setShowAllModal] = useState(false);

  const load = useCallback(async () => {
    const [listRes, summaryRes] = await Promise.allSettled([
      ratingsApi.list({ limit: 10 }),
      ratingsApi.summary(),
    ]);
    if (listRes.status === "fulfilled") {
      setItems(listRes.value.items);
      setTotalCount(listRes.value.total);
    } else {
      setItems([]);
      setTotalCount(0);
    }
    if (summaryRes.status === "fulfilled") setSummary(summaryRes.value);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (!score) return;
    setBusy(true);
    setMsg(null);
    try {
      const r = await ratingsApi.rate(score, comment.trim());
      setItems((prev) => [r, ...(prev ?? [])]);
      setTotalCount((c) => c + 1);
      setScore(0);
      setComment("");
      setMsg({ ok: true, text: "Thanks! Your rating and comment have been posted." });
      setSummary(await ratingsApi.summary().catch(() => summary));
    } catch (err) {
      setMsg({ ok: false, text: errorText(err, "Could not save the rating.") });
    } finally {
      setBusy(false);
    }
  };

  const previewItems = (items ?? []).slice(0, 2);

  return (
    <div className="community-grid">
      <form className="panel" onSubmit={save}>
        <h3>How would you rate GEE-Assist?</h3>
        {msg && (
          <div className={`notice ${msg.ok ? "notice-success" : "notice-error"}`} role="status">
            <p>{msg.text}</p>
          </div>
        )}
        <fieldset className="field">
          <legend>Stars</legend>
          <Stars value={score} onChange={setScore} />
        </fieldset>
        <div className="field">
          <label htmlFor="r-comment">What made you choose this? (optional)</label>
          <textarea
            id="r-comment"
            className="textarea"
            maxLength={1000}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Share your thoughts or experience with the app..."
          />
          <span className="hint">{comment.length} / 1000</span>
        </div>
        <div className="btn-row">
          <button className="btn btn-primary" disabled={busy || !score}>
            {busy ? "Saving…" : "Submit rating"}
          </button>
        </div>
      </form>
      <div>
        <div className="panel" style={{ marginBottom: "16px" }}>
          <h3>What everyone thinks</h3>
          {summary ? <RatingBreakdown summary={summary} /> : <p className="muted-note">The summary could not be loaded.</p>}
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
          <h3 className="list-title" style={{ margin: 0 }}>Community ratings</h3>
          {totalCount > 2 && (
            <button
              type="button"
              className="btn btn-secondary"
              style={{ fontSize: "var(--text-xs)", padding: "4px 10px" }}
              onClick={() => setShowAllModal(true)}
            >
              View all ({totalCount})
            </button>
          )}
        </div>

        {items === null ? (
          <Loading label="Loading ratings…" />
        ) : previewItems.length === 0 ? (
          <p className="empty">No ratings yet. Yours will be the first!</p>
        ) : (
          <ul className="entry-list">
            {previewItems.map((r) => (
              <li key={r.id} className="entry">
                <div className="entry-head">
                  <Stars value={r.score} onChange={() => { }} />
                  <span className="entry-meta">{fmtDate(r.created_at)}</span>
                </div>
                {r.comment && <p className="entry-body">{r.comment}</p>}
                <p className="entry-meta">
                  By {r.username ? `@${r.username}` : r.email ? r.email : `User ${r.user_id.slice(-6)}`}
                  {r.app_version && ` · app v${r.app_version}`}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>

      {showAllModal && <AllRatingsModal onClose={() => setShowAllModal(false)} />}
    </div>
  );
}

/* ------------------------------------------------------------ Feedback */

function FeedbackEmailReplyModal({
  feedback,
  onClose,
  onSuccess,
}: {
  feedback: Feedback;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [emailText, setEmailText] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const recipientEmail = feedback.email;

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailText.trim()) return;
    setBusy(true);
    setErr(null);
    try {
      await adminApi.updateFeedback(feedback.id, {
        reply_email: emailText.trim(),
      });
      onSuccess();
      onClose();
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : "Failed to send email reply.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Reply to User via Email</h3>
          <button type="button" className="modal-close-btn" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        <form onSubmit={handleSend} style={{ display: "flex", flexDirection: "column", height: "100%" }}>
          <div className="modal-body">
            {err && (
              <div className="notice notice-error" style={{ marginBottom: "12px" }}>
                <p>{err}</p>
              </div>
            )}
            <div style={{ marginBottom: "12px", fontSize: "var(--text-sm)" }}>
              <p style={{ margin: "0 0 6px 0" }}>
                <strong>Recipient:</strong> {recipientEmail || "No email available for this user"}
              </p>
              <p style={{ margin: "0 0 6px 0" }}>
                <strong>User:</strong> {feedback.username ? `@${feedback.username}` : feedback.user_id}
              </p>
              <div style={{ background: "var(--surface-sunken, rgba(0,0,0,0.15))", padding: "10px", borderRadius: "var(--radius)", marginTop: "8px" }}>
                <strong>Feedback message:</strong>
                <p style={{ margin: "4px 0 0 0", whiteSpace: "pre-wrap" }}>{feedback.message}</p>
              </div>
            </div>

            <div className="field">
              <label htmlFor="reply-msg-community" style={{ fontWeight: 600 }}>Your Reply Email</label>
              <textarea
                id="reply-msg-community"
                className="textarea"
                rows={6}
                maxLength={4000}
                placeholder="Type your response to the user here..."
                value={emailText}
                onChange={(e) => setEmailText(e.target.value)}
                required
              />
            </div>
          </div>
          <div className="modal-header" style={{ justifyContent: "flex-end", gap: "10px", borderTop: "1px solid var(--border)", borderBottom: "none" }}>
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={busy}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={busy || !emailText.trim() || !recipientEmail}>
              {busy ? "Sending…" : "Send Email Reply"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function AllFeedbackModal({
  onClose,
  isAdmin,
  onReply,
}: {
  onClose: () => void;
  isAdmin: boolean;
  onReply: (f: Feedback) => void;
}) {
  const [skip, setSkip] = useState(0);
  const [page, setPage] = useState<Page<Feedback> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    feedbackApi
      .list(skip, PAGE_SIZE)
      .then((p) => {
        setPage(p);
        setLoading(false);
      })
      .catch(() => {
        setPage(null);
        setLoading(false);
      });
  }, [skip]);

  return (
    <div className="modal-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>All Community Feedback</h3>
          <button type="button" className="modal-close-btn" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        <div className="modal-body">
          {loading ? (
            <Loading label="Loading feedback…" />
          ) : !page || page.items.length === 0 ? (
            <p className="empty">No feedback found.</p>
          ) : (
            <>
              <ul className="entry-list">
                {page.items.map((f) => (
                  <li key={f.id} className="entry">
                    <div className="entry-head">
                      <span className="entry-cat">{CATEGORIES.find((c) => c.value === f.category)?.label}</span>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <FeedbackStatusPill status={f.status} appVersion={f.app_version} isAdmin={isAdmin} />
                        {isAdmin && (
                          <button
                            type="button"
                            className="btn btn-secondary"
                            style={{ fontSize: "var(--text-xs)", padding: "2px 8px" }}
                            onClick={() => onReply(f)}
                          >
                            Reply via Email
                          </button>
                        )}
                      </div>
                    </div>
                    <p className="entry-body">{f.message}</p>
                    {f.admin_note && (
                      <p className="admin-note">
                        <strong>Reply from the team:</strong> {f.admin_note}
                      </p>
                    )}
                    <p className="entry-meta">
                      By {f.username ? `@${f.username}` : f.email ? f.email : `User ${f.user_id.slice(-6)}`} · {fmtDate(f.created_at)}
                    </p>
                  </li>
                ))}
              </ul>
              <ModalPager
                skip={skip}
                total={page.total}
                limit={PAGE_SIZE}
                onChange={setSkip}
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function FeedbackPanel() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [items, setItems] = useState<Feedback[] | null>(null);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [category, setCategory] = useState<FeedbackCategory>("bug");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [touched, setTouched] = useState(false);
  const [showAllModal, setShowAllModal] = useState(false);
  const [replyTarget, setReplyTarget] = useState<Feedback | null>(null);

  useEffect(() => {
    feedbackApi
      .list(0, 10)
      .then((p) => {
        setItems(p.items);
        setTotalCount(p.total);
      })
      .catch(() => {
        setItems([]);
        setTotalCount(0);
      });
  }, []);

  const tooShort = message.trim().length < 10;

  const send = async (e: FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (tooShort) return;
    setBusy(true);
    setMsg(null);
    try {
      const f = await feedbackApi.send(category, message.trim());
      setItems((prev) => [f, ...(prev ?? [])]);
      setTotalCount((c) => c + 1);
      setMessage("");
      setTouched(false);
      setMsg({ ok: true, text: "Feedback sent. It is now visible to the community." });
    } catch (err) {
      setMsg({ ok: false, text: errorText(err, "Could not send the feedback.") });
    } finally {
      setBusy(false);
    }
  };

  const previewItems = (items ?? []).slice(0, 3);

  return (
    <div className="community-grid">
      <form className="panel" onSubmit={send} noValidate>
        <h3>Send feedback</h3>
        {msg && (
          <div className={`notice ${msg.ok ? "notice-success" : "notice-error"}`} role="status">
            <p>{msg.text}</p>
          </div>
        )}
        <fieldset className="field">
          <legend>What is it about?</legend>
          <div className="radio-cards">
            {CATEGORIES.map((c) => (
              <label key={c.value} className="radio-card">
                <input type="radio" name="category" value={c.value} checked={category === c.value} onChange={() => setCategory(c.value)} />
                <span>{c.label}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <div className="field">
          <label htmlFor="f-msg">What happened?</label>
          <textarea
            id="f-msg"
            className="textarea"
            maxLength={2000}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onBlur={() => setTouched(true)}
            aria-invalid={(touched && tooShort) || undefined}
            aria-describedby="f-msg-hint"
            placeholder="What you did, what you expected, and what happened instead."
          />
          <span className={touched && tooShort ? "error-text" : "hint"} id="f-msg-hint">
            {touched && tooShort ? "Write at least 10 characters." : `${message.length} / 2000`}
          </span>
        </div>
        <button className="btn btn-primary" disabled={busy}>
          {busy ? "Sending…" : "Send feedback"}
        </button>
      </form>
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
          <h3 className="list-title" style={{ margin: 0 }}>Recent feedback</h3>
          {totalCount > 3 && (
            <button
              type="button"
              className="btn btn-secondary"
              style={{ fontSize: "var(--text-xs)", padding: "4px 10px" }}
              onClick={() => setShowAllModal(true)}
            >
              View all ({totalCount})
            </button>
          )}
        </div>

        {items === null ? (
          <Loading label="Loading feedback…" />
        ) : previewItems.length === 0 ? (
          <p className="empty">No feedback yet. What you send appears here for everyone.</p>
        ) : (
          <ul className="entry-list">
            {previewItems.map((f) => (
              <li key={f.id} className="entry">
                <div className="entry-head">
                  <span className="entry-cat">{CATEGORIES.find((c) => c.value === f.category)?.label}</span>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <FeedbackStatusPill status={f.status} appVersion={f.app_version} isAdmin={isAdmin} />
                    {isAdmin && (
                      <button
                        type="button"
                        className="btn btn-secondary"
                        style={{ fontSize: "var(--text-xs)", padding: "2px 8px" }}
                        onClick={() => setReplyTarget(f)}
                      >
                        Reply via Email
                      </button>
                    )}
                  </div>
                </div>
                <p className="entry-body">{f.message}</p>
                {f.admin_note && (
                  <p className="admin-note">
                    <strong>Reply from the team:</strong> {f.admin_note}
                  </p>
                )}
                <p className="entry-meta">
                  By {f.username ? `@${f.username}` : f.email ? f.email : `User ${f.user_id.slice(-6)}`} · {fmtDate(f.created_at)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>

      {showAllModal && (
        <AllFeedbackModal
          isAdmin={isAdmin}
          onClose={() => setShowAllModal(false)}
          onReply={(f) => {
            setShowAllModal(false);
            setReplyTarget(f);
          }}
        />
      )}

      {replyTarget && (
        <FeedbackEmailReplyModal
          feedback={replyTarget}
          onClose={() => setReplyTarget(null)}
          onSuccess={() => {
            alert("Email reply sent successfully!");
          }}
        />
      )}
    </div>
  );
}

/* --------------------------------------------------------- Suggestions */

function SuggestionDetailModal({
  suggestion,
  onClose,
}: {
  suggestion: Suggestion;
  onClose: () => void;
}) {
  return (
    <div className="modal-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Suggestion Details</h3>
          <button type="button" className="modal-close-btn" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        <div className="modal-body">
          <div style={{ marginBottom: "16px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "12px", marginBottom: "8px" }}>
              <h4 style={{ margin: 0, fontSize: "var(--text-md)", color: "var(--ink)" }}>{suggestion.title}</h4>
            </div>
            <p className="entry-meta" style={{ marginBottom: "12px" }}>
              Submitted by{" "}
              <strong>
                {suggestion.email || (suggestion.username ? `@${suggestion.username}` : `User ${suggestion.user_id.slice(-6)}`)}
              </strong>
              {suggestion.username && suggestion.email && ` (@${suggestion.username})`} · {fmtDate(suggestion.created_at)}
            </p>
          </div>

          <div className="field" style={{ marginBottom: "16px" }}>
            <label style={{ fontWeight: 600, display: "block", marginBottom: "4px" }}>Description</label>
            <div style={{ background: "var(--surface-sunken, rgba(0,0,0,0.15))", padding: "12px", borderRadius: "var(--radius)", whiteSpace: "pre-wrap", fontSize: "var(--text-sm)" }}>
              {suggestion.description}
            </div>
          </div>

          {suggestion.admin_note && (
            <div className="admin-note" style={{ marginTop: "12px" }}>
              <strong>Admin note:</strong> {suggestion.admin_note}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function SuggestPanel() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [items, setItems] = useState<Suggestion[] | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [touched, setTouched] = useState({ title: false, description: false });
  const [selectedSuggestion, setSelectedSuggestion] = useState<Suggestion | null>(null);

  useEffect(() => {
    const fetchSuggestions = isAdmin ? adminApi.suggestions() : suggestionsApi.mine();
    fetchSuggestions
      .then((p) => setItems(p.items))
      .catch(() => setItems([]));
  }, [isAdmin]);

  const titleErr = title.trim().replace(/\s+/g, " ").length < 5 ? "Write at least 5 characters." : null;
  const descErr = description.trim().length < 10 ? "Write at least 10 characters." : null;

  const send = async (e: FormEvent) => {
    e.preventDefault();
    setTouched({ title: true, description: true });
    if (titleErr || descErr) return;
    setBusy(true);
    setMsg(null);
    try {
      const s = await suggestionsApi.send(title.trim(), description.trim());
      setItems((prev) => [s, ...(prev ?? [])]);
      setTitle("");
      setDescription("");
      setTouched({ title: false, description: false });
      setMsg({ ok: true, text: "Suggestion sent. We mark it planned, implemented or declined once we've looked at it." });
    } catch (err) {
      setMsg({ ok: false, text: errorText(err, "Could not send the suggestion.") });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="community-grid">
      <form className="panel" onSubmit={send} noValidate>
        <h3>Suggest a feature</h3>
        {msg && (
          <div className={`notice ${msg.ok ? "notice-success" : "notice-error"}`} role="status">
            <p>{msg.text}</p>
          </div>
        )}
        <div className="field">
          <label htmlFor="s-title">Your idea in a line</label>
          <input
            id="s-title"
            className="input"
            maxLength={120}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={() => setTouched((t) => ({ ...t, title: true }))}
            placeholder="Export results as a shapefile"
            aria-invalid={(touched.title && !!titleErr) || undefined}
          />
          {touched.title && titleErr && <span className="error-text">{titleErr}</span>}
        </div>
        <div className="field">
          <label htmlFor="s-desc">Why would it help?</label>
          <textarea
            id="s-desc"
            className="textarea"
            maxLength={2000}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            onBlur={() => setTouched((t) => ({ ...t, description: true }))}
            placeholder="What you are trying to do and what gets in the way today."
            aria-invalid={(touched.description && !!descErr) || undefined}
          />
          <span className={touched.description && descErr ? "error-text" : "hint"}>
            {touched.description && descErr ? descErr : `${description.length} / 2000`}
          </span>
        </div>
        <button className="btn btn-primary" disabled={busy}>
          {busy ? "Sending…" : "Send suggestion"}
        </button>
      </form>
      <div>
        <h3 className="list-title">{isAdmin ? "All suggestions" : "Your suggestions"}</h3>
        {items === null ? (
          <Loading label="Loading…" />
        ) : items.length === 0 ? (
          <p className="empty">
            {isAdmin
              ? "No suggestions submitted yet."
              : "No suggestions yet. Yours will appear here with what we decided."}
          </p>
        ) : (
          <ul className="entry-list">
            {items.map((s) => (
              <li key={s.id} className="entry">
                <div className="entry-head">
                  <strong className="entry-title">{s.title}</strong>
                  {isAdmin && (
                    <button
                      type="button"
                      className="btn btn-secondary"
                      style={{ fontSize: "var(--text-xs)", padding: "2px 8px" }}
                      onClick={() => setSelectedSuggestion(s)}
                    >
                      View details
                    </button>
                  )}
                </div>
                <p className="entry-body">{s.description}</p>
                {s.admin_note && (
                  <p className="admin-note">
                    <strong>Reply from the team:</strong> {s.admin_note}
                  </p>
                )}
                <p className="entry-meta">
                  By {s.email || (s.username ? `@${s.username}` : `User ${s.user_id.slice(-6)}`)} · {fmtDate(s.created_at)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>

      {selectedSuggestion && (
        <SuggestionDetailModal
          suggestion={selectedSuggestion}
          onClose={() => setSelectedSuggestion(null)}
        />
      )}
    </div>
  );
}

/* ---------------------------------------------------------------- Page */

export default function Community() {
  const { user, ready } = useAuth();
  const [params, setParams] = useSearchParams();
  const tab = (TABS.find((t) => t.id === params.get("tab"))?.id ?? "rate") as Tab;

  return (
    <>
      <div className="container page-head">
        <h1>Community</h1>
        <p className="lede">
          GEE-Assist is shaped by the people who use it. Rate it, tell us what went wrong, or suggest what to build next.
        </p>
      </div>

      <div className="container community">
        <div className="tabs" role="tablist" aria-label="Community">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              id={`tab-${t.id}`}
              aria-selected={tab === t.id}
              aria-controls={`panel-${t.id}`}
              className="tab"
              onClick={() => setParams({ tab: t.id }, { replace: true })}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`} className="tab-panel">
          <p className="tab-blurb">{TABS.find((t) => t.id === tab)!.blurb}</p>
          {!ready ? (
            <Loading />
          ) : !user ? (
            <div className="signin-prompt panel">
              <h3>Sign in to take part</h3>
              <p>
                Ratings, feedback and suggestions are tied to your GEE-Assist account, so you can change your rating later and
                see our replies. Use the same account as in the app.
              </p>
              <div className="btn-row">
                <Link className="btn btn-primary" to="/login" state={{ from: `/community?tab=${tab}` }}>
                  Sign in
                </Link>
                <Link className="btn btn-secondary" to="/signup" state={{ from: `/community?tab=${tab}` }}>
                  Create an account
                </Link>
              </div>
            </div>
          ) : tab === "rate" ? (
            <RatePanel />
          ) : tab === "feedback" ? (
            <FeedbackPanel />
          ) : (
            <SuggestPanel />
          )}
        </div>
      </div>
    </>
  );
}
