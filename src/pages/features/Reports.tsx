import { useState, type CSSProperties } from "react";
import { Reveal } from "../../components/motion/motion";
import { useScrollProgress } from "../../components/motion/motion";
import { Chapter, SectionHead } from "../../components/newpages/NewLayout";
import { NDVI_RAMP, rampCss, viewUrl } from "../../components/raster/scene";

function Page1() {
  return (
    <div className="a4-inner">
      <div className="a4-h">Vegetation · NDVI, EVI</div>
      <div className="a4-pic" style={{ backgroundImage: `url(${viewUrl("ndvi")})` }} />
      <div className="a4-bar" style={{ background: rampCss(NDVI_RAMP) }} />
      <div className="a4-ticks">
        <span>−0.2</span>
        <span>NDVI</span>
        <span>0.8</span>
      </div>
      <div className="a4-pic a4-pic-sm" style={{ backgroundImage: `url(${viewUrl("lc")})` }} />
      <div className="a4-foot">1</div>
    </div>
  );
}

function Page2() {
  return (
    <div className="a4-inner">
      <div className="a4-h">Summary</div>
      {[92, 80, 86, 54].map((w, i) => (
        <span key={i} className="a4-line" style={{ width: `${w}%` }} />
      ))}
      <div className="a4-h2">What the layers show</div>
      {[70, 82, 60].map((w, i) => (
        <span key={i} className="a4-line a4-bullet" style={{ width: `${w}%` }} />
      ))}
      <div className="a4-h2">Caveats</div>
      {[88, 46].map((w, i) => (
        <span key={i} className="a4-line" style={{ width: `${w}%` }} />
      ))}
      <div className="a4-foot">2</div>
    </div>
  );
}

function Page3() {
  return (
    <div className="a4-inner">
      <div className="a4-h2">Numbers</div>
      <div className="a4-table">
        {Array.from({ length: 12 }, (_, i) => (
          <span key={i} className={i < 3 ? "is-head" : ""} />
        ))}
      </div>
      <div className="a4-h2">Land-cover change</div>
      <div className="a4-table">
        {Array.from({ length: 15 }, (_, i) => (
          <span key={i} className={i < 3 ? "is-head" : ""} />
        ))}
      </div>
      <div className="a4-foot">3</div>
    </div>
  );
}

function PdfArt() {
  return (
    <div className="pdf-art" aria-hidden="true">
      <div className="a4 a4-art" style={{ "--i": 2 } as CSSProperties}>
        <Page3 />
      </div>
      <div className="a4 a4-art" style={{ "--i": 1 } as CSSProperties}>
        <Page2 />
      </div>
      <div className="a4 a4-art" style={{ "--i": 0 } as CSSProperties}>
        <Page1 />
      </div>
      <span className="pdf-badge">PDF</span>
    </div>
  );
}

const PAGES = [
  {
    t: "Pictures first",
    d: "A picture of each layer of the result the explanation is about, coloured as on the Analysis page, each with its colour bar and range, or its classes.",
    el: <Page1 />,
  },
  {
    t: "Then the explanation",
    d: "Headed “Summary”, with its headings and lists, exactly as Gemini wrote it.",
    el: <Page2 />,
  },
  {
    t: "Tables stay whole",
    d: "Each table stays on one page together with its heading; the header row is shaded and repeated.",
    el: <Page3 />,
  },
];

/** Three pages that slide in from the sides and stack up as you scroll through the section. */
function Assemble() {
  const [ref, p] = useScrollProgress<HTMLDivElement>(true);
  const step = p < 0.38 ? 0 : p < 0.55 ? 1 : 2;
  return (
    <div className="assemble" ref={ref}>
      <div className="assemble-sticky">
        <div className="assemble-stage">
          {PAGES.map((pg, i) => (
            <div key={pg.t} className="a4 assemble-page" style={{ "--k": i } as CSSProperties}>
              {pg.el}
            </div>
          ))}
        </div>
        <div className="assemble-text">
          {PAGES.map((pg, i) => (
            <div key={pg.t} className={`assemble-cap${i === step ? " is-on" : ""}`}>
              <span className="assemble-n">0{i + 1}</span>
              <h3>{pg.t}</h3>
              <p>{pg.d}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

type Row = { name: string; when: string; pdf: boolean; busy?: boolean };

function ReportsList() {
  const [rows, setRows] = useState<Row[]>([
    { name: "Sentinel-2_…_Vegetation_NDVI_EVI_explanation", when: "today, 15:12", pdf: false },
    { name: "Landsat-8_…_LST_LSTMapping_explanation", when: "today, 11:40", pdf: true },
    { name: "Sentinel-1_…_Water_WaterBodyDetection_explanation", when: "16 Nov", pdf: true },
  ]);
  const [sel, setSel] = useState(0);
  const create = () => {
    setRows((r) => r.map((x, i) => (i === sel ? { ...x, busy: true } : x)));
    window.setTimeout(() => setRows((r) => r.map((x, i) => (i === sel ? { ...x, busy: false, pdf: true } : x))), 1400);
  };
  const cur = rows[sel];
  return (
    <div className="rl">
      <div className="rl-title">Reports</div>
      <ul role="listbox" aria-label="Saved explanations">
        {rows.map((r, i) => (
          <li
            key={r.name}
            role="option"
            aria-selected={i === sel}
            className={i === sel ? "is-on" : ""}
            onClick={() => setSel(i)}
            onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && setSel(i)}
            tabIndex={0}
          >
            <span className="rl-name">{r.name}</span>
            <span className="muted-note">{r.when}</span>
            {r.busy ? (
              <span className="pill pill-blue rl-busy">Creating…</span>
            ) : r.pdf ? (
              <span className="pill pill-green">PDF</span>
            ) : (
              <span className="pill">No PDF yet</span>
            )}
          </li>
        ))}
      </ul>
      <div className="btn-row">
        <button type="button" className="btn btn-primary" onClick={create} disabled={cur.busy}>
          {cur.pdf ? "Create again" : "Create PDF report"}
        </button>
        <button type="button" className="btn btn-secondary" disabled={!cur.pdf}>
          Export PDF…
        </button>
        <button type="button" className="btn btn-quiet" disabled={!cur.pdf}>
          Open PDF
        </button>
      </div>
      {cur.busy && (
        <span className="rl-progress" aria-hidden="true">
          <span />
        </span>
      )}
    </div>
  );
}

export function ReportsChapter() {
  return (
    <>
      <Chapter
        id="reports"
        eyebrow="PDF reports"
        title={
          <>
            From explanation to <span className="grad-text">a report you can hand in</span>
          </>
        }
        lede="The Reports page turns any saved AI explanation into an A4 PDF: the result's pictures with their colour bars, then the explanation with its headings, lists and tables."
        art={<PdfArt />}
      />

      <section className="section">
        <div className="container split">
          <div>
            <SectionHead n="01" title="The Reports page">
              Open it from the dashboard's Reports card, View → Reports or <kbd>Ctrl</kbd>+<kbd>7</kbd>. It lists the
              explanations saved in the open project, newest first, and whether each already has a PDF.
            </SectionHead>
            <Reveal delay={100}>
              <p className="muted-note">
                PDF report on the AI explanation page jumps here and creates that explanation's report at once. Try
                Create PDF report on the first row.
              </p>
            </Reveal>
          </div>
          <Reveal variant="scale">
            <ReportsList />
          </Reveal>
        </div>
      </section>

      <section className="section band-soft assemble-section">
        <div className="container">
          <SectionHead n="02" title="How a report is put together">
            Keep scrolling: the pages come together in the order the PDF has them.
          </SectionHead>
          <Assemble />
        </div>
      </section>

      <section className="section">
        <div className="container">
          <SectionHead n="03" title="The details" />
          <div className="small-grid">
            {[
              ["A4, numbered, bookmarked", "Pages are numbered and every heading is a bookmark, so a long report is easy to move around in."],
              ["Written with markdown-pdf", "The PDF is made in the app's backend with markdown-pdf, through PyMuPDF."],
              ["Kept in the project", "Saved as reports/<explanation>.pdf. Creating it again replaces it."],
              ["Export anywhere", "Export PDF… saves a copy to Documents, a USB drive or anywhere else; the project keeps its own."],
              ["Open it", "Open PDF opens the computer's PDF viewer; Open reports folder shows the folder."],
              ["Missing picture?", "If the result .tif is no longer there, the report says so and has the explanation only."],
            ].map(([t, d], i) => (
              <Reveal key={t} delay={(i % 3) * 90} variant="flip" className="small-card">
                <h3>{t}</h3>
                <p>{d}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

    </>
  );
}
