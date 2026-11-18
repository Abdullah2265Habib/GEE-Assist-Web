import type { ReactNode } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { Reveal, ScrollProgress, useScrollProgress } from "../motion/motion";

export const NEW_PAGES = [
  { to: "/whats-new", label: "Overview", blurb: "Everything added to the desktop app since the first release." },
  {
    to: "/projects",
    label: "Projects",
    blurb: "Work inside a project folder: downloads, results, explanations and reports kept together.",
  },
  {
    to: "/analysis",
    label: "Analysis",
    blurb: "Four analyses, 79 indices and methods, run on your GPU or CPU, saved only when you ask.",
  },
  {
    to: "/viewer",
    label: "GeoTIFF viewer",
    blurb: "True colour, false colour, NDVI, NDWI and land cover, with the value under your pointer.",
  },
  {
    to: "/ai-explanation",
    label: "AI explanation",
    blurb: "Gemini reads the result GeoTIFF, its previews and metadata, and explains it in plain words.",
  },
  {
    to: "/reports",
    label: "PDF reports",
    blurb: "Turn an explanation into an A4 PDF with the result's pictures, colour bars and tables.",
  },
];

/** The strip of links between the new pages, sticky under the site header. */
export function NewNav() {
  return (
    <nav className="new-nav" aria-label="New features">
      <div className="container new-nav-inner">
        <span className="new-badge" aria-hidden="true">
          New
        </span>
        <ul>
          {NEW_PAGES.map((p) => (
            <li key={p.to}>
              <NavLink to={p.to} end>
                {p.label}
              </NavLink>
            </li>
          ))}
        </ul>
      </div>
    </nav>
  );
}

/** The top of every new page: eyebrow, title, lede, and an illustration that drifts as you scroll. */
export function NewHero({
  eyebrow,
  title,
  lede,
  children,
  art,
}: {
  eyebrow: string;
  title: ReactNode;
  lede: ReactNode;
  children?: ReactNode;
  art?: ReactNode;
}) {
  const [ref] = useScrollProgress<HTMLElement>();
  return (
    <>
      <ScrollProgress />
      <NewNav />
      <header className="new-hero" ref={ref}>
        <div className="new-hero-glow" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
        <div className="container new-hero-grid">
          <div className="new-hero-copy">
            <Reveal variant="down">
              <p className="eyebrow">
                <span className="eyebrow-dot" aria-hidden="true" />
                {eyebrow}
              </p>
            </Reveal>
            <Reveal delay={80}>
              <h1>{title}</h1>
            </Reveal>
            <Reveal delay={160}>
              <p className="lede">{lede}</p>
            </Reveal>
            {children && <Reveal delay={240}>{children}</Reveal>}
          </div>
          {art && (
            <Reveal variant="scale" delay={200} className="new-hero-art">
              {art}
            </Reveal>
          )}
        </div>
        <a className="scroll-cue" href="#content" aria-label="Scroll to the content">
          <span aria-hidden="true" />
        </a>
      </header>
      <span id="content" />
    </>
  );
}

/** Section heading with a number, used down the new pages. */
export function SectionHead({ n, title, children }: { n?: string; title: ReactNode; children?: ReactNode }) {
  return (
    <Reveal className="new-section-head">
      {n && (
        <span className="new-section-n" aria-hidden="true">
          {n}
        </span>
      )}
      <h2>{title}</h2>
      {children && <p className="lede">{children}</p>}
    </Reveal>
  );
}

/** The link to the next new page, at the bottom of each one. */
export function NextUp() {
  const { pathname } = useLocation();
  const i = NEW_PAGES.findIndex((p) => p.to === pathname);
  const next = NEW_PAGES[(i + 1) % NEW_PAGES.length];
  return (
    <section className="section next-up">
      <div className="container">
        <Reveal variant="scale">
          <Link to={next.to} className="next-up-card">
            <span className="next-up-label">Next</span>
            <span className="next-up-title">{next.label}</span>
            <span className="next-up-blurb">{next.blurb}</span>
            <span className="next-up-arrow" aria-hidden="true">
              →
            </span>
          </Link>
        </Reveal>
      </div>
    </section>
  );
}

/** A "New in the app" block appended to older pages, linking to the new ones. */
export function NewStrip({ title, intro }: { title: string; intro: string }) {
  return (
    <section className="section new-strip" id="new">
      <div className="container">
        <Reveal className="new-strip-head">
          <div>
            <span className="new-badge">New</span>
            <h2>{title}</h2>
            <p className="lede">{intro}</p>
          </div>
          <Link className="btn btn-secondary" to="/whats-new">
            See what's new
          </Link>
        </Reveal>
        <div className="feature-grid">
          {NEW_PAGES.slice(1).map((p, i) => (
            <Reveal key={p.to} delay={i * 80}>
              <Link to={p.to} className="feature-card">
                <span className="feature-card-n">{String(i + 1).padStart(2, "0")}</span>
                <h3>{p.label}</h3>
                <p>{p.blurb}</p>
                <span className="feature-card-go" aria-hidden="true">
                  →
                </span>
              </Link>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
