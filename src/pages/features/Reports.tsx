import type { CSSProperties } from "react";
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
    d: "Headed “Summary”, with its headings and lists, exactly as the AI wrote it.",
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

      <section className="section band-soft assemble-section">
        <div className="container">
          <SectionHead title="How a report is put together">
            Keep scrolling: the pages come together in the order the PDF has them.
          </SectionHead>
          <Assemble />
        </div>
      </section>

    </>
  );
}
