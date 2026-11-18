import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { Reveal, useScrollProgress } from "../motion/motion";

/** The chapters of the Features page, in page order. */
export const FEATURE_CHAPTERS = [
  { id: "basics", label: "The basics", blurb: "Plain-language requests, the parameter form, large downloads, the terminal and accounts." },
  { id: "workflow", label: "Workflow", blurb: "One request from the first sign-in to a PDF report, step by step." },
  {
    id: "viewer",
    label: "GeoTIFF viewer",
    blurb: "True colour, false colour, NDVI, NDWI and land cover, with the value under your pointer.",
  },
  {
    id: "ai-explanation",
    label: "AI explanation",
    blurb: "Gemini reads the result GeoTIFF, its previews and metadata, and explains it in plain words.",
  },
  {
    id: "reports",
    label: "PDF reports",
    blurb: "Turn an explanation into an A4 PDF with the result's pictures, colour bars and tables.",
  },
];

/** The opening of a chapter: eyebrow, title, lede, and an illustration that drifts as you scroll. */
export function Chapter({
  id,
  eyebrow,
  title,
  lede,
  children,
  art,
}: {
  id: string;
  eyebrow: string;
  title: ReactNode;
  lede: ReactNode;
  children?: ReactNode;
  art?: ReactNode;
}) {
  const [ref] = useScrollProgress<HTMLElement>();
  return (
    <section className="new-hero chapter" id={id} ref={ref}>
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
            <h2 className="chapter-title">{title}</h2>
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
    </section>
  );
}

/** Section heading used inside the chapters. */
export function SectionHead({ title, children }: { title: ReactNode; children?: ReactNode }) {
  return (
    <Reveal className="new-section-head">
      <h3 className="new-section-title">{title}</h3>
      {children && <p className="lede">{children}</p>}
    </Reveal>
  );
}

/** Cards linking to the chapters of the Features page. */
export function ChapterCards({ from = 2 }: { from?: number }) {
  return (
    <div className="feature-grid">
      {FEATURE_CHAPTERS.slice(from).map((c, i) => (
        <Reveal key={c.id} delay={i * 80}>
          <Link to={`/features#${c.id}`} className="feature-card">
            <span className="feature-card-n">{String(i + 1).padStart(2, "0")}</span>
            <h3>{c.label}</h3>
            <p>{c.blurb}</p>
            <span className="feature-card-go" aria-hidden="true">
              →
            </span>
          </Link>
        </Reveal>
      ))}
    </div>
  );
}

/** The block on the home page that leads into the Features page. */
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
          <Link className="btn btn-secondary" to="/features#workflow">
            See all features
          </Link>
        </Reveal>
        <ChapterCards />
      </div>
    </section>
  );
}
