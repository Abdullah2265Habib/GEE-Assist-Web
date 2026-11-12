import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ApiError } from "../api/client";
import { feedbackApi, ratingsApi, suggestionsApi } from "../api/community";
import type { Feedback, FeedbackCategory, Rating, RatingSummary, Suggestion } from "../api/types";
import { useAuth } from "../auth/AuthProvider";
import { APP_VERSION } from "../config";
import Loading from "../components/Loading";
import Stars from "../components/community/Stars";
import RatingBreakdown from "../components/community/RatingBreakdown";
import { FeedbackStatusPill, SuggestionStatusPill } from "../components/community/StatusPill";

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

/* ---------------------------------------------------------------- Rate */

function RatePanel() {
  const [mine, setMine] = useState<Rating | null>(null);
  const [summary, setSummary] = useState<RatingSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [score, setScore] = useState(0);
  const [comment, setComment] = useState("");
  const [version, setVersion] = useState(APP_VERSION);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const load = useCallback(async () => {
    const [r, s] = await Promise.allSettled([ratingsApi.mine(), ratingsApi.summary()]);
    if (r.status === "fulfilled") {
      setMine(r.value);
      setScore(r.value.score);
      setComment(r.value.comment ?? "");
      setVersion(r.value.app_version ?? APP_VERSION);
    } else {
      setMine(null);
    }
    if (s.status === "fulfilled") setSummary(s.value);
    setLoading(false);
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
      const r = await ratingsApi.rate(score, comment.trim(), version.trim());
      setMine(r);
      setMsg({ ok: true, text: mine ? "Rating updated." : "Thanks. Your rating is saved." });
      setSummary(await ratingsApi.summary().catch(() => summary));
    } catch (err) {
      setMsg({ ok: false, text: errorText(err, "Could not save the rating.") });
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!window.confirm("Delete your rating?")) return;
    setBusy(true);
    try {
      await ratingsApi.remove();
      setMine(null);
      setScore(0);
      setComment("");
      setMsg({ ok: true, text: "Rating deleted." });
      setSummary(await ratingsApi.summary().catch(() => summary));
    } catch (err) {
      setMsg({ ok: false, text: errorText(err, "Could not delete the rating.") });
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <Loading label="Loading your rating…" />;

  return (
    <div className="community-grid">
      <form className="panel" onSubmit={save}>
        <h3>{mine ? "Your rating" : "How would you rate GEE-Assist?"}</h3>
        {mine && <p className="muted-note">Last changed {fmtDate(mine.updated_at)}. Saving again replaces it.</p>}
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
          <textarea id="r-comment" className="textarea" maxLength={1000} value={comment} onChange={(e) => setComment(e.target.value)} />
          <span className="hint">{comment.length} / 1000</span>
        </div>
        <div className="field narrow">
          <label htmlFor="r-ver">App version</label>
          <input id="r-ver" className="input" maxLength={30} value={version} onChange={(e) => setVersion(e.target.value)} />
          <span className="hint">Shown under Help → About GEE-Assist.</span>
        </div>
        <div className="btn-row">
          <button className="btn btn-primary" disabled={busy || !score}>
            {mine ? "Update rating" : "Save rating"}
          </button>
          {mine && (
            <button type="button" className="btn btn-danger" onClick={remove} disabled={busy}>
              Delete rating
            </button>
          )}
        </div>
      </form>
      <div className="panel">
        <h3>What everyone thinks</h3>
        {summary ? <RatingBreakdown summary={summary} /> : <p className="muted-note">The summary could not be loaded.</p>}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------ Feedback */

function FeedbackPanel() {
  const [items, setItems] = useState<Feedback[] | null>(null);
  const [category, setCategory] = useState<FeedbackCategory>("bug");
  const [message, setMessage] = useState("");
  const [version, setVersion] = useState(APP_VERSION);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    feedbackApi
      .mine()
      .then((p) => setItems(p.items))
      .catch(() => setItems([]));
  }, []);

  const tooShort = message.trim().length < 10;

  const send = async (e: FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (tooShort) return;
    setBusy(true);
    setMsg(null);
    try {
      const f = await feedbackApi.send(category, message.trim(), version.trim());
      setItems((prev) => [f, ...(prev ?? [])]);
      setMessage("");
      setTouched(false);
      setMsg({ ok: true, text: "Feedback sent. Its status shows in the list." });
    } catch (err) {
      setMsg({ ok: false, text: errorText(err, "Could not send the feedback.") });
    } finally {
      setBusy(false);
    }
  };

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
        <div className="field narrow">
          <label htmlFor="f-ver">App version</label>
          <input id="f-ver" className="input" maxLength={30} value={version} onChange={(e) => setVersion(e.target.value)} />
        </div>
        <button className="btn btn-primary" disabled={busy}>
          {busy ? "Sending…" : "Send feedback"}
        </button>
      </form>
      <div>
        <h3 className="list-title">Your feedback</h3>
        {items === null ? (
          <Loading label="Loading…" />
        ) : items.length === 0 ? (
          <p className="empty">Nothing sent yet. What you send appears here with its status.</p>
        ) : (
          <ul className="entry-list">
            {items.map((f) => (
              <li key={f.id} className="entry">
                <div className="entry-head">
                  <span className="entry-cat">{CATEGORIES.find((c) => c.value === f.category)?.label}</span>
                  <FeedbackStatusPill status={f.status} />
                </div>
                <p className="entry-body">{f.message}</p>
                {f.admin_note && (
                  <p className="admin-note">
                    <strong>Reply from the team:</strong> {f.admin_note}
                  </p>
                )}
                <p className="entry-meta">
                  Sent {fmtDate(f.created_at)}
                  {f.app_version && ` · version ${f.app_version}`}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

/* --------------------------------------------------------- Suggestions */

function SuggestPanel() {
  const [items, setItems] = useState<Suggestion[] | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [touched, setTouched] = useState({ title: false, description: false });

  useEffect(() => {
    suggestionsApi
      .mine()
      .then((p) => setItems(p.items))
      .catch(() => setItems([]));
  }, []);

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
        <h3 className="list-title">Your suggestions</h3>
        {items === null ? (
          <Loading label="Loading…" />
        ) : items.length === 0 ? (
          <p className="empty">No suggestions yet. Yours will appear here with what we decided.</p>
        ) : (
          <ul className="entry-list">
            {items.map((s) => (
              <li key={s.id} className="entry">
                <div className="entry-head">
                  <strong className="entry-title">{s.title}</strong>
                  <SuggestionStatusPill status={s.status} />
                </div>
                <p className="entry-body">{s.description}</p>
                {s.admin_note && (
                  <p className="admin-note">
                    <strong>Reply from the team:</strong> {s.admin_note}
                  </p>
                )}
                <p className="entry-meta">Sent {fmtDate(s.created_at)}</p>
              </li>
            ))}
          </ul>
        )}
      </div>
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
