import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import CopyButton from "../components/CopyButton";
import { ANALYSES, COMPOSITE_METHODS, DATASETS, DATASET_CATEGORIES, type AnalysisGroup, type Dataset } from "../data/datasets";

const START_YEAR = 1950;
const now = new Date();
const END = now.getFullYear() + now.getMonth() / 12;
const SPAN = END - START_YEAR;

const yearOf = (iso: string) => {
  const d = new Date(iso);
  return d.getFullYear() + d.getMonth() / 12 + d.getDate() / 365;
};

const pct = (year: number) => ((year - START_YEAR) / SPAN) * 100;

const resolution = (m: number) => (m >= 1000 ? `${(m / 1000).toFixed(m % 1000 ? 1 : 0)} km` : `${m} m`);

const fmtDate = (iso: string) => new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });

const TICKS = [1950, 1960, 1970, 1980, 1990, 2000, 2010, 2020];

function CoverageChart({ datasets }: { datasets: Dataset[] }) {
  const [hover, setHover] = useState<{ d: Dataset; x: number; y: number } | null>(null);
  const groups = DATASET_CATEGORIES.map((c) => ({ c, items: datasets.filter((d) => d.category === c) })).filter((g) => g.items.length);

  if (datasets.length === 0) return <p className="empty">No dataset matches these filters. Clear a filter to see more.</p>;

  return (
    <figure className="coverage" onPointerLeave={() => setHover(null)}>
      <figcaption className="visually-hidden">Years covered by each dataset, from {START_YEAR} to today.</figcaption>
      <div className="coverage-axis" aria-hidden="true">
        <span className="coverage-label-col" />
        <div className="coverage-track">
          {TICKS.map((t) => (
            <span key={t} className="tick" style={{ left: `${pct(t)}%` }}>
              {t}
            </span>
          ))}
          <span className="tick tick-now" style={{ left: "100%" }}>
            now
          </span>
        </div>
      </div>
      {groups.map((g) => (
        <div key={g.c} className="coverage-group">
          <div className="coverage-group-name">{g.c}</div>
          {g.items.map((d) => {
            const from = pct(yearOf(d.since));
            const to = d.until ? pct(yearOf(d.until)) : 100;
            return (
              <div key={d.key} className="coverage-row">
                <span className="coverage-label-col" title={d.name}>
                  {d.name.replace(/\s*\(.*\)$/, "")}
                </span>
                <div className="coverage-track">
                  {TICKS.map((t) => (
                    <span key={t} className="gridline" style={{ left: `${pct(t)}%` }} aria-hidden="true" />
                  ))}
                  <span
                    className={`coverage-bar${d.until ? " ended" : ""}`}
                    style={{ left: `${from}%`, width: `${Math.max(0.6, to - from)}%` }}
                    tabIndex={0}
                    aria-label={`${d.name}: ${fmtDate(d.since)} to ${d.until ? fmtDate(d.until) : "today"}, ${resolution(d.scale)} pixels`}
                    onPointerEnter={(e) => {
                      const r = (e.currentTarget.closest(".coverage") as HTMLElement).getBoundingClientRect();
                      const b = e.currentTarget.getBoundingClientRect();
                      setHover({ d, x: b.left - r.left + b.width / 2, y: b.top - r.top });
                    }}
                    onFocus={(e) => {
                      const r = (e.currentTarget.closest(".coverage") as HTMLElement).getBoundingClientRect();
                      const b = e.currentTarget.getBoundingClientRect();
                      setHover({ d, x: b.left - r.left + b.width / 2, y: b.top - r.top });
                    }}
                    onBlur={() => setHover(null)}
                  />
                </div>
              </div>
            );
          })}
        </div>
      ))}
      {hover && (
        <div className="chart-tip" style={{ left: hover.x, top: hover.y }} role="tooltip">
          <strong>{hover.d.name}</strong>
          <span>
            {fmtDate(hover.d.since)} to {hover.d.until ? fmtDate(hover.d.until) : "today"}
          </span>
          <span>{resolution(hover.d.scale)} pixels</span>
        </div>
      )}
    </figure>
  );
}

export default function Datasets() {
  const [category, setCategory] = useState<string>("all");
  const [analysis, setAnalysis] = useState<AnalysisGroup | "all">("all");
  const [query, setQuery] = useState("");
  const [cloudOnly, setCloudOnly] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return DATASETS.filter(
      (d) =>
        (category === "all" || d.category === category) &&
        (analysis === "all" || d.analyses.includes(analysis)) &&
        (!cloudOnly || d.cloudFilter) &&
        (!q || d.name.toLowerCase().includes(q) || d.key.includes(q) || d.collectionId.toLowerCase().includes(q)),
    );
  }, [category, analysis, query, cloudOnly]);

  const filtersActive = category !== "all" || analysis !== "all" || query !== "" || cloudOnly;

  return (
    <>
      <div className="container page-head">
        <h1>Datasets</h1>
        <p className="lede">
          The {DATASETS.length} Earth Engine collections GEE-Assist can download, with the dates each one covers, its pixel
          size, and the analyses its bands support.
        </p>
      </div>

      <div className="container">
        <div className="filters" role="search">
          <label className="field">
            <span>Search</span>
            <input className="input" type="search" placeholder="Landsat, MODIS, COPERNICUS/…" value={query} onChange={(e) => setQuery(e.target.value)} />
          </label>
          <label className="field">
            <span>Kind of data</span>
            <select className="select" value={category} onChange={(e) => setCategory(e.target.value)}>
              <option value="all">All kinds</option>
              {DATASET_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Supports analysis</span>
            <select className="select" value={analysis} onChange={(e) => setAnalysis(e.target.value as AnalysisGroup | "all")}>
              <option value="all">Any analysis</option>
              {Object.entries(ANALYSES).map(([k, a]) => (
                <option key={k} value={k}>
                  {a.label}
                </option>
              ))}
            </select>
          </label>
          <label className="check">
            <input type="checkbox" checked={cloudOnly} onChange={(e) => setCloudOnly(e.target.checked)} />
            <span>Has a cloud-cover filter</span>
          </label>
          {filtersActive && (
            <button
              type="button"
              className="btn btn-quiet"
              onClick={() => {
                setCategory("all");
                setAnalysis("all");
                setQuery("");
                setCloudOnly(false);
              }}
            >
              Clear filters
            </button>
          )}
        </div>

        <section aria-labelledby="coverage-h" className="coverage-section">
          <h2 id="coverage-h">Years covered</h2>
          <p className="muted-note">
            Showing {filtered.length} of {DATASETS.length}. A bar that stops short of today belongs to a satellite or product that has ended.
          </p>
          <CoverageChart datasets={filtered} />
        </section>

        <section aria-labelledby="table-h" className="dataset-table-section">
          <h2 id="table-h">Details</h2>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th scope="col">Dataset</th>
                  <th scope="col">Pixel size</th>
                  <th scope="col">Dates</th>
                  <th scope="col">Analyses</th>
                  <th scope="col">Earth Engine ID</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((d) => (
                  <tr key={d.key}>
                    <th scope="row">
                      <span className="ds-name">{d.name}</span>
                      <span className="ds-note">{d.note}</span>
                    </th>
                    <td className="num">{resolution(d.scale)}</td>
                    <td className="nowrap">
                      {d.since.slice(0, 4)} to {d.until ? d.until.slice(0, 4) : "today"}
                    </td>
                    <td>
                      <span className="pill-row">
                        {d.analyses.map((a) => (
                          <span key={a} className="pill">
                            {a === "LST" ? "Temperature" : a === "LULC" ? "Land cover" : a}
                          </span>
                        ))}
                        {d.cloudFilter && <span className="pill pill-blue">Cloud filter</span>}
                      </span>
                    </td>
                    <td>
                      <span className="id-cell">
                        <code>{d.collectionId}</code>
                        <CopyButton text={d.collectionId} />
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="dataset-extra">
          <div>
            <h2>Combining images</h2>
            <p>
              A date range usually holds many images. GEE-Assist combines them into one with the composite you choose:{" "}
              {COMPOSITE_METHODS.join(", ")}. Median is the default and removes most clouds and shadows. Mosaic keeps the most
              recent pixel and is the lightest for Earth Engine to compute.
            </p>
          </div>
          <div>
            <h2>Output</h2>
            <p>
              Every download is a float32 GeoTIFF in WGS 84, the UTM zone of your area, or Web Mercator. Its folder and file
              are named after the satellite, the centre of the area and the dates, so you can find it again.
            </p>
            <p>
              <Link to="/features#downloads">How large downloads are split and merged</Link>
            </p>
          </div>
        </section>
      </div>
    </>
  );
}
