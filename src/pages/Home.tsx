import { lazy, Suspense, useState } from "react";
import { Link } from "react-router-dom";
import type { SelectedArea } from "../components/globe/Globe";
import CopyButton from "../components/CopyButton";
import EarthLoader from "../components/loader/EarthLoader";
import { ANALYSES, DATASETS, DATASET_CATEGORIES } from "../data/datasets";
import { THEMES, useTheme } from "../theme/ThemeProvider";
import { DOWNLOAD_URL } from "../config";

const Globe = lazy(() => import("../components/globe/Globe"));
const Terminal = lazy(() => import("../components/terminal/Terminal"));
const OrbitStory = lazy(() => import("../components/story/OrbitStory"));

const fmt = (n: number) => n.toFixed(2);

function AreaReadout({ area }: { area: SelectedArea | null }) {
  if (!area) {
    return (
      <p className="area-readout is-empty">
        Select a country on the globe. GEE-Assist takes an area like this as a rectangle, a circle, a drawn polygon or a
        GeoJSON file.
      </p>
    );
  }
  const [w, s, e, n] = area.bbox;
  const crosses = w > e;
  const cmd = `form aoi bbox ${fmt(w)} ${fmt(s)} ${fmt(e)} ${fmt(n)}`;
  return (
    <div className="area-readout" aria-live="polite">
      <p className="area-name">{area.name}</p>
      {crosses ? (
        <p className="area-note">
          {area.name} crosses the 180° meridian, so one rectangle cannot hold it. In the app you would import its outline
          as GeoJSON instead.
        </p>
      ) : (
        <>
          <div className="area-cmd">
            <code>{cmd}</code>
            <CopyButton text={cmd} />
          </div>
          <p className="area-note">Typed into gkonsol, this sets the area of the parameter form.</p>
        </>
      )}
    </div>
  );
}

const STEPS = [
  {
    title: "Describe what you need",
    body: "Write a request such as “NDVI of Lahore for summer 2024 from Sentinel-2”. Gemini, together with GEE-Assist's own recogniser for places, dates, datasets and analyses, fills the parameter form. If the request is unclear, it asks you a question instead of guessing.",
  },
  {
    title: "Check the parameter form",
    body: "Dataset, bands, pixel size, cloud cover, composite, dates, area, projection and analysis are all on one form. Each value is checked against what the chosen dataset supports, so you cannot ask Landsat 5 for 2020 or Sentinel-1 for NDVI.",
  },
  {
    title: "Download the GeoTIFF",
    body: "The request is split into 500 MB chunks and fetched as small requests, eight at a time, well under Earth Engine's 48 MB limit. Chunks are merged as they arrive. Pause, close the app, and pick up where it stopped.",
  },
];

const DEMO = ["ask NDVI of Lahore for summer 2024 from Sentinel-2", "form estimate", "form submit", "download start"];

function ThemePicker() {
  const { theme, setTheme } = useTheme();
  return (
    <div className="theme-picker" role="radiogroup" aria-label="Choose a theme">
      {THEMES.map((t) => (
        <button
          key={t.name}
          type="button"
          role="radio"
          aria-checked={theme === t.name}
          className="theme-card"
          onClick={() => setTheme(t.name)}
        >
          {t.inApp ? (
            <img src={t.icon.replace("-64", "-256")} alt="" width={96} height={96} />
          ) : (
            <span className={`theme-card-disc swatch-${t.name}`} aria-hidden="true" />
          )}
          <span>{t.label}</span>
        </button>
      ))}
    </div>
  );
}

export default function Home() {
  const [area, setArea] = useState<SelectedArea | null>(null);
  const yearsBack = new Date().getFullYear() - 1950;

  return (
    <>
      <section className="hero">
        <div className="container hero-grid">
          <div className="hero-copy">
            <h1>Satellite data, asked for in plain words.</h1>
            <p className="lede">
              GEE-Assist is a Windows app for Google Earth Engine. Describe the imagery you need, check the form it fills
              in, and get a GeoTIFF on your disk. No code editor and no scripts.
            </p>
            <div className="btn-row">
              <a className="btn btn-primary btn-lg" href={DOWNLOAD_URL}>
                Download for Windows
              </a>
              <Link className="btn btn-secondary btn-lg" to="/terminal">
                Try it in your browser
              </Link>
            </div>
            <dl className="hero-facts">
              <div>
                <dt>Datasets</dt>
                <dd>{DATASETS.length}</dd>
              </div>
              <div>
                <dt>Years of imagery</dt>
                <dd>{yearsBack}</dd>
              </div>
              <div>
                <dt>Finest pixel</dt>
                <dd>10 m</dd>
              </div>
            </dl>
          </div>
          <div className="hero-globe">
            <Suspense
              fallback={
                <div className="globe-placeholder">
                  <EarthLoader label="Loading the globe" detail="Fetching the world map" />
                </div>
              }
            >
              <Globe onSelect={setArea} />
            </Suspense>
            <AreaReadout area={area} />
          </div>
        </div>
      </section>

      <Suspense
        fallback={
          <div className="story-placeholder">
            <EarthLoader className="earth-loader-dark" label="Loading the story" detail="Preparing the orbit scenes" />
          </div>
        }
      >
        <OrbitStory />
      </Suspense>

      <section className="section">
        <div className="container">
          <div className="section-intro">
            <h2>From a sentence to a GeoTIFF</h2>
            <p className="lede">Every request goes through the same three steps, whether you type, click or use the terminal.</p>
          </div>
          <ol className="steps">
            {STEPS.map((s) => (
              <li key={s.title}>
                <h3>{s.title}</h3>
                <p>{s.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="section band-dark">
        <div className="container split">
          <div>
            <h2>Everything the window does, you can also type</h2>
            <p>
              gkonsol is a terminal built into GEE-Assist, docked under the page like the one in VS Code. It fills the
              same parameter form, starts the same downloads and checks your Earth Engine set-up step by step.
            </p>
            <p>This one runs in your browser. Watch a request run, then type your own.</p>
            <Link className="btn btn-secondary" to="/terminal">
              Open the full terminal and command list
            </Link>
          </div>
          <Suspense fallback={<div className="term-placeholder" />}>
            <Terminal script={DEMO} height={340} />
          </Suspense>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <div className="section-intro">
            <h2>Fifteen datasets, chosen for what they can answer</h2>
            <p className="lede">
              Optical, radar, temperature, land cover and surface water. Each dataset lists only the analyses its bands
              can compute.
            </p>
          </div>
          <div className="category-list">
            {DATASET_CATEGORIES.map((cat) => {
              const items = DATASETS.filter((d) => d.category === cat);
              return (
                <div key={cat} className="category">
                  <h3>{cat}</h3>
                  <ul>
                    {items.map((d) => (
                      <li key={d.key}>
                        <span>{d.name}</span>
                        <span className="res">{d.scale >= 1000 ? `${(d.scale / 1000).toFixed(d.scale % 1000 ? 1 : 0)} km` : `${d.scale} m`}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
          <p className="more-link">
            <Link to="/datasets">Compare dates, resolution and analyses for every dataset</Link>
          </p>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <div className="section-intro">
            <h2>Analyses that run before the download</h2>
            <p className="lede">Add an analysis to a request and the index is computed in Earth Engine, so you download the result, not the raw bands.</p>
          </div>
          <dl className="analyses">
            {Object.entries(ANALYSES).map(([key, a]) => (
              <div key={key}>
                <dt>{a.label}</dt>
                <dd>
                  {a.processes.map((p) => (
                    <span key={p} className="pill">
                      {p}
                    </span>
                  ))}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <section className="section">
        <div className="container split">
          <div>
            <h2>Pick a theme</h2>
            <p>
              On first start GEE-Assist asks for a theme: light, dark blue-green or dark grey. Each has its own icon for the
              window and taskbar. This website has those three plus two of its own: ocean, forest and sand, and navy and
              sand. Pick one here and the site switches with it.
            </p>
          </div>
          <ThemePicker />
        </div>
      </section>

      <section className="section cta">
        <div className="container cta-inner">
          <h2>Get the app, then tell us what to build next</h2>
          <p className="lede">
            GEE-Assist is free and open source. Sign in to rate it, report a bug or suggest a feature, and follow what
            happens to your suggestion.
          </p>
          <div className="btn-row">
            <Link className="btn btn-primary btn-lg" to="/download">
              Download and set up
            </Link>
            <Link className="btn btn-secondary btn-lg" to="/community">
              Rate or suggest a feature
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
