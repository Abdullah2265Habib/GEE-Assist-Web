import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { Reveal, prefersReducedMotion, useInView } from "../../components/motion/motion";
import { NewHero, NextUp, SectionHead } from "../../components/newpages/NewLayout";
import { H, W, render } from "../../components/raster/scene";
import {
  ANALYSIS_INFO,
  BAND_NAMES,
  FORMULAS,
  SAMPLE_DATASETS,
  whyNot,
  type AnalysisKey,
  type Formula,
} from "../../data/analyses";

/** Hero picture: an NDVI result appearing block by block, top to bottom, as the app computes it. */
function BlockArt() {
  const cols = 32;
  const rows = 21;
  const cells = useMemo(() => {
    const { pixels } = render("ndvi");
    const out: string[] = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = Math.floor(((c + 0.5) / cols) * W);
        const y = Math.floor(((r + 0.5) / rows) * H);
        const i = (y * W + x) * 4;
        out.push(`rgb(${pixels[i]} ${pixels[i + 1]} ${pixels[i + 2]})`);
      }
    }
    return out;
  }, []);
  return (
    <div className="block-art" aria-label="An NDVI result filling in block by block" role="img">
      <div className="block-art-grid" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
        {cells.map((c, i) => (
          <span
            key={i}
            style={{ background: c, "--r": Math.floor(i / cols), "--c": i % cols } as CSSProperties}
          />
        ))}
      </div>
      <div className="block-art-scan" aria-hidden="true" />
      <div className="block-art-legend">
        <span>NDVI</span>
        <span className="block-art-ramp" />
        <span>−0.2 … 0.8</span>
      </div>
    </div>
  );
}

function resultName(dataset: string, analysis: AnalysisKey, keys: string[]) {
  const shown = keys.length > 4 ? [...keys.slice(0, 3), `and_${keys.length - 3}_more`] : keys;
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  const stamp = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}-${p(d.getMinutes())}-${p(d.getSeconds())}`;
  return `${dataset}_${analysis}_${shown.join("_")}_${stamp}.tif`;
}

function ProcessPicker() {
  const [ds, setDs] = useState(SAMPLE_DATASETS[0].key);
  const [an, setAn] = useState<AnalysisKey>("Vegetation");
  const [sub, setSub] = useState<string | null>(null);
  const [picked, setPicked] = useState<string[]>(["NDVI", "EVI"]);
  const [run, setRun] = useState<{ name: string; t: number } | null>(null);

  const dataset = SAMPLE_DATASETS.find((d) => d.key === ds)!;
  const info = ANALYSIS_INFO.find((a) => a.key === an)!;
  const list = FORMULAS.filter((f) => f.analysis === an && (!sub || f.sub === sub));
  const withReason = list.map((f) => ({ f, why: whyNot(f, dataset.bands) }));
  const can = withReason.filter((x) => !x.why);
  const cannot = withReason.filter((x) => x.why);
  const anyRunnable = (a: AnalysisKey) => FORMULAS.some((f) => f.analysis === a && !whyNot(f, dataset.bands));
  const runnablePicked = picked.filter((k) => {
    const f = FORMULAS.find((x) => x.key === k);
    return f && f.analysis === an && !whyNot(f, dataset.bands);
  });
  const needsCompare = runnablePicked.some((k) => FORMULAS.find((f) => f.key === k)?.compare);

  useEffect(() => setRun(null), [ds, an]);

  const toggle = (k: string) => setPicked((p) => (p.includes(k) ? p.filter((x) => x !== k) : [...p, k]));

  const card = (f: Formula, why: string, i: number) => (
    <button
      type="button"
      key={f.key}
      className={`proc${picked.includes(f.key) && !why ? " is-picked" : ""}${why ? " is-off" : ""}`}
      onClick={() => !why && toggle(f.key)}
      aria-pressed={!why && picked.includes(f.key)}
      disabled={!!why}
      style={{ "--i": i } as CSSProperties}
    >
      <span className="proc-key">{f.key}</span>
      <span className="proc-name">{f.name}</span>
      <code className="proc-formula">{f.formula}</code>
      {why ? (
        <span className="proc-why">{why}</span>
      ) : f.compare ? (
        <span className="proc-tag">Before / after</span>
      ) : null}
    </button>
  );

  return (
    <div className="picker">
      <div className="picker-top">
        <label className="field picker-ds">
          <span>Dataset</span>
          <select className="select" value={ds} onChange={(e) => setDs(e.target.value)}>
            {SAMPLE_DATASETS.map((d) => (
              <option key={d.key} value={d.key}>
                {d.label}
              </option>
            ))}
          </select>
        </label>
        <p className="picker-bands">
          {dataset.bands.map((b) => (
            <span key={b} className="pill">
              {BAND_NAMES[b]}
            </span>
          ))}
        </p>
      </div>

      <div className="picker-analyses" role="tablist" aria-label="Analyses">
        {ANALYSIS_INFO.map((a) => {
          const ok = anyRunnable(a.key);
          return (
            <button
              key={a.key}
              type="button"
              role="tab"
              aria-selected={an === a.key}
              className={`picker-an${an === a.key ? " is-on" : ""}${ok ? "" : " is-grey"}`}
              onClick={() => {
                setAn(a.key);
                setSub(null);
              }}
              title={ok ? a.desc : "This dataset cannot run any of its processes"}
            >
              <strong>{a.label}</strong>
              <span>{ok ? a.desc : "Not possible with this dataset"}</span>
            </button>
          );
        })}
      </div>

      <div className="picker-subs">
        <button type="button" className={`chip${sub === null ? " is-on" : ""}`} onClick={() => setSub(null)}>
          All
        </button>
        {info.subtypes.map((s) => (
          <button key={s} type="button" className={`chip${sub === s ? " is-on" : ""}`} onClick={() => setSub(s)}>
            {s}
          </button>
        ))}
      </div>

      <h4 className="picker-h">Can run · {can.length}</h4>
      <div className="proc-grid" key={`${ds}-${an}-${sub}`}>
        {can.length ? can.map((x, i) => card(x.f, "", i)) : <p className="empty">Nothing here can run on {dataset.label}.</p>}
      </div>

      {cannot.length > 0 && (
        <details className="picker-cannot">
          <summary>Can't run with this dataset · {cannot.length}</summary>
          <div className="proc-grid">{cannot.map((x, i) => card(x.f, x.why, i))}</div>
        </details>
      )}

      <div className="picker-run">
        <p className="muted-note">
          {runnablePicked.length
            ? `${runnablePicked.length} selected: ${runnablePicked.join(", ")}.`
            : "Click cards to select processes."}{" "}
          {needsCompare && "Tick a dataset of the same place under Compare with."}
        </p>
        <button
          type="button"
          className="btn btn-primary"
          disabled={!runnablePicked.length}
          onClick={() =>
            setRun({
              name: resultName(
                dataset.label.split(" ")[0].replace(/[^A-Za-z0-9-]/g, ""),
                an,
                runnablePicked,
              ),
              t: Date.now(),
            })
          }
        >
          Run analysis
        </button>
      </div>
      {run && (
        <div className="picker-result" key={run.t}>
          <span className="picker-progress" aria-hidden="true">
            <span />
          </span>
          <p>
            Done. Shown from a temporary file; <strong>Save result</strong> would keep it as
          </p>
          <code>analysis/{run.name}</code>
        </div>
      )}
    </div>
  );
}

function DeviceRace() {
  const [ref, inView] = useInView<HTMLDivElement>({ threshold: 0.4, once: false });
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!inView) return;
    if (prefersReducedMotion()) {
      setTick(40);
      return;
    }
    setTick(0);
    const id = window.setInterval(() => setTick((t) => (t >= 48 ? 0 : t + 1)), 90);
    return () => window.clearInterval(id);
  }, [inView]);
  const rows = 12;
  const gpuDone = Math.min(rows, Math.floor(tick / 1.2));
  const cpuDone = Math.min(rows, Math.floor(tick / 3.6));
  const lane = (label: string, done: number, note: string, gpu: boolean) => (
    <div className={`race-lane${gpu ? " is-gpu" : ""}`}>
      <div className="race-head">
        <strong>{label}</strong>
        <span className="muted-note">{note}</span>
      </div>
      <div className="race-rows">
        {Array.from({ length: rows }, (_, i) => (
          <span key={i} className={i < done ? "is-done" : i === done ? "is-now" : ""} />
        ))}
      </div>
      <span className="race-pct">{Math.round((done / rows) * 100)}%</span>
    </div>
  );
  return (
    <div className="race" ref={ref}>
      {lane("GPU", gpuDone, "NVIDIA card, CuPy installed", true)}
      {lane("CPU", cpuDone, "NumPy, the same array code", false)}
      <p className="muted-note race-note">Each bar is one block of rows of the file. Illustration, not a benchmark.</p>
    </div>
  );
}

function CheatSheet() {
  const [q, setQ] = useState("");
  const [an, setAn] = useState<AnalysisKey | null>(null);
  const rows = FORMULAS.filter(
    (f) =>
      (!an || f.analysis === an) &&
      (!q ||
        `${f.key} ${f.name} ${f.formula} ${f.sub}`.toLowerCase().includes(q.toLowerCase())),
  );
  const label = (a: AnalysisKey) => ANALYSIS_INFO.find((x) => x.key === a)!.label;
  return (
    <div className="cheat">
      <div className="cheat-tools">
        <input
          className="input"
          type="search"
          placeholder="Search: NDVI, SWIR2, burn, salinity…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          aria-label="Search the analysis table"
        />
        <div className="cheat-chips">
          <button type="button" className={`chip${an === null ? " is-on" : ""}`} onClick={() => setAn(null)}>
            All
          </button>
          {ANALYSIS_INFO.map((a) => (
            <button
              key={a.key}
              type="button"
              className={`chip${an === a.key ? " is-on" : ""}`}
              onClick={() => setAn(a.key)}
            >
              {a.label}
            </button>
          ))}
        </div>
      </div>
      <div className="table-wrap cheat-table">
        <table className="data-table">
          <thead>
            <tr>
              <th scope="col">Index</th>
              <th scope="col">Group</th>
              <th scope="col">Formula</th>
              <th scope="col">Bands</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((f) => (
              <tr key={f.key}>
                <td>
                  <strong>{f.key}</strong>
                  <br />
                  <span className="muted-note">{f.name}</span>
                  {f.reference && (
                    <>
                      {" "}
                      <span className="pill">Reference</span>
                    </>
                  )}
                </td>
                <td className="nowrap-cell">
                  {label(f.analysis)} › {f.sub}
                </td>
                <td>
                  <code>{f.formula}</code>
                </td>
                <td>{f.bands.map((b) => BAND_NAMES[b]).join(", ") || "—"}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={4} className="muted-note">
                  Nothing matches “{q}”.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="muted-note">
        {rows.length} of the {FORMULAS.length} shown here. The app's table has all 79, each with its value range, how
        to read it and its use cases.
      </p>
    </div>
  );
}

export default function Analysis() {
  return (
    <div className="new-page">
      <NewHero
        eyebrow="New · Analysis"
        title={
          <>
            Four analyses, <span className="grad-text">79 indices and methods</span>
          </>
        }
        lede="Open a finished download or any GeoTIFF, choose an analysis and its processes, and run it on your computer's GPU or CPU. Results are shown at once and saved only when you ask."
        art={<BlockArt />}
      />

      <section className="section">
        <div className="container">
          <SectionHead n="01" title="The four analyses">
            Each is split into sub-types, the way the app groups its process cards.
          </SectionHead>
          <div className="an-grid">
            {ANALYSIS_INFO.map((a, i) => (
              <Reveal key={a.key} delay={i * 110} variant="up" className={`an-card an-${a.key.toLowerCase()}`}>
                <span className="an-fr">{a.fr}</span>
                <h3>{a.label}</h3>
                <p>{a.desc}</p>
                <ul>
                  {a.subtypes.map((s) => (
                    <li key={s}>{s}</li>
                  ))}
                </ul>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="section band-soft">
        <div className="container">
          <SectionHead n="02" title="Only what the dataset can run">
            Processes are cards. Those the dataset can run come first; those it can't are folded away below, each
            saying why. Change the dataset and watch the cards move.
          </SectionHead>
          <Reveal variant="scale">
            <ProcessPicker />
          </Reveal>
          <Reveal delay={100}>
            <p className="muted-note picker-foot">
              Raw download values are scaled to reflectance or kelvin for each satellite before any index is computed.
              Before / after processes (dNBR, RdNBR, RBR, land-cover change, LST change) need a second dataset of the
              same place from another date.
            </p>
          </Reveal>
        </div>
      </section>

      <section className="section">
        <div className="container split">
          <div>
            <SectionHead n="03" title="GPU when it can, CPU when it must">
              The app lists the computer's graphics cards. With a dedicated NVIDIA card and CuPy installed, analyses run
              on the GPU; otherwise, or if the GPU runs out of memory, on the CPU.
            </SectionHead>
            <Reveal delay={100}>
              <p>
                The line above <strong>Run analysis</strong> says which, and why. Files are processed in blocks of rows,
                so a large download does not need to fit in memory. AMD and Intel cards cannot run CuPy on Windows, so
                they use the CPU.
              </p>
              <pre className="cmd-line">
                <code>pip install cupy-cuda12x</code>
              </pre>
            </Reveal>
          </div>
          <Reveal variant="scale">
            <DeviceRace />
          </Reveal>
        </div>
      </section>

      <section className="section band-soft">
        <div className="container">
          <SectionHead n="04" title="Nothing is saved unless you ask">
            A result is shown, each layer with its legend and numbers, from a temporary file. It is deleted when the
            next result replaces it or the app closes.
          </SectionHead>
          <div className="save-steps">
            {[
              ["Run analysis", "Layers, legends and numbers appear from a temporary file."],
              ["Save result", "The GeoTIFF, one band per layer, goes into the project's analysis folder, without asking."],
              ["Numbers kept", "Its settings and numbers are written next to it as .json and recorded in analysis_results.json."],
              ["Never overwritten", "An earlier result with the same name is kept; the new one gets _2, _3, …"],
            ].map(([t, d], i) => (
              <Reveal key={t} delay={i * 120} variant="up" className="save-step">
                <span className="save-dot" aria-hidden="true" />
                <h3>{t}</h3>
                <p>{d}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <SectionHead n="05" title="The analysis table">
            View → Show analysis table (Ctrl+6) opens a cheat sheet of every index: its formula, bands, value range, how
            to read it and its use cases. Most of them are below.
          </SectionHead>
          <Reveal>
            <CheatSheet />
          </Reveal>
        </div>
      </section>

      <NextUp />
    </div>
  );
}
