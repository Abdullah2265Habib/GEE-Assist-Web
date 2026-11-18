import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { Reveal, useScrollProgress } from "../../components/motion/motion";
import { Chapter, SectionHead } from "../../components/newpages/NewLayout";
import RasterViewer from "../../components/raster/RasterViewer";
import { NDVI_RAMP, NDWI_RAMP, rampCss, render, viewUrl, type ViewKey } from "../../components/raster/scene";

const CLS_VIEW: Record<string, ViewKey> = { "vs-true": "true", "vs-false": "false", "vs-ndvi": "ndvi", "vs-ndwi": "ndwi", "vs-lc": "lc" };
const bg = (cls: string): CSSProperties => ({ backgroundImage: `url(${viewUrl(CLS_VIEW[cls])})` });

/** Hero picture: the same tile seen through the viewer's views, fanned out like slides. */
function ViewStack() {
  const views = [
    { label: "True colour", cls: "vs-true" },
    { label: "False colour", cls: "vs-false" },
    { label: "NDVI", cls: "vs-ndvi" },
    { label: "Land cover", cls: "vs-lc" },
  ];
  return (
    <div className="vstack" aria-hidden="true">
      {views.map((v, i) => (
        <div key={v.label} className={`vstack-card ${v.cls}`} style={{ ...bg(v.cls), "--i": i } as CSSProperties}>
          <span>{v.label}</span>
        </div>
      ))}
    </div>
  );
}

const LAYERS = [
  { t: "True colour", cls: "vs-true", d: "Red, green and blue bands, stretched between their 2nd and 98th percentiles." },
  { t: "False colour", cls: "vs-false", d: "NIR shown as red, so healthy vegetation glows red and water is near black." },
  { t: "NDVI", cls: "vs-ndvi", d: "Fixed range −0.2 to 0.8, so a colour means the same in every file." },
  { t: "NDWI", cls: "vs-ndwi", d: "Fixed range −0.5 to 0.5: brown land, blue water." },
  { t: "Land cover", cls: "vs-lc", d: "Dynamic World classes in their official colours." },
];

function useNarrow(px: number) {
  const q = `(max-width: ${px}px)`;
  const [narrow, setNarrow] = useState(() => typeof window !== "undefined" && window.matchMedia(q).matches);
  useEffect(() => {
    const m = window.matchMedia(q);
    const on = () => setNarrow(m.matches);
    m.addEventListener("change", on);
    return () => m.removeEventListener("change", on);
  }, [q]);
  return narrow;
}

/**
 * The views as a stack that peels apart as you scroll, with their descriptions beside it. Clicking a
 * layer opens it flat on the left; the others wait in a small stack on the right, ready to swap in.
 */
function PeelScene() {
  const [ref] = useScrollProgress<HTMLDivElement>();
  const [open, setOpen] = useState<number | null>(null);
  const [hot, setHot] = useState<number | null>(null);
  const [moving, setMoving] = useState(false);
  const narrow = useNarrow(720);
  const timer = useRef(0);

  const choose = (i: number | null) => {
    setOpen(i);
    setHot(null);
    setMoving(true);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setMoving(false), 800);
  };
  useEffect(() => () => window.clearTimeout(timer.current), []);

  // The waiting layers, top of the stack first (land cover), as in the list beside the stack.
  const rest = LAYERS.map((_, i) => i)
    .filter((i) => i !== open)
    .reverse();

  const place = (i: number): CSSProperties => {
    if (open === null) {
      return {
        left: narrow ? "6%" : "2%",
        top: narrow ? "10%" : "16%",
        width: narrow ? "88%" : "54%",
        zIndex: i,
        transform: `rotateX(calc(var(--t) * 56deg)) rotateZ(calc(var(--t) * -22deg)) translateZ(calc(${i - 2} * var(--t) * 90px))`,
      };
    }
    if (i === open) return { left: 0, top: 0, width: narrow ? "100%" : "57%", zIndex: 10, transform: "none" };
    const k = rest.indexOf(i);
    if (narrow) {
      return {
        left: `${k * 25.4}%`,
        top: "78%",
        width: "23.5%",
        zIndex: hot === i ? 20 : 5,
        transform: "none",
      };
    }
    return {
      left: "64%",
      top: `${k * 17}%`,
      width: "34%",
      // A hovered card keeps its place in the stack: it lifts, but the card below it still covers it.
      zIndex: 5 + k,
      // The hover lift is on .peel-visual inside, never here: if the card itself moved, it could slide
      // out from under the pointer, hand the hover to the card behind and slide back, over and over.
      transform: "perspective(1000px) rotateY(-14deg)",
    };
  };

  return (
    <div className={`peel${open !== null ? " is-open" : ""}${moving ? " is-moving" : ""}`} ref={ref}>
      <div className="peel-sticky">
        <div className="peel-bar">
          {open === null ? (
            <p className="muted-note">Click a layer, or its name, to open it.</p>
          ) : (
            <>
              <p className="muted-note">
                {narrow
                  ? "Tap a layer below to swap it in."
                  : "Point at a layer on the right to pick it out, click to swap it in."}
              </p>
              <button type="button" className="btn btn-secondary peel-back" onClick={() => choose(null)}>
                ← Back to the stack
              </button>
            </>
          )}
        </div>
        <div className="peel-stage">
          {LAYERS.map((l, i) => (
            <button
              type="button"
              key={l.t}
              className={`peel-layer${hot === i ? " is-hot" : ""}${open === i ? " is-front" : ""}`}
              style={place(i)}
              onClick={() => open !== i && choose(i)}
              onMouseEnter={() => setHot(i)}
              onMouseLeave={() => setHot(null)}
              onFocus={() => setHot(i)}
              onBlur={() => setHot(null)}
              aria-label={open === i ? `${l.t}, open` : `Open ${l.t}`}
              aria-pressed={open === i}
            >
              <span className="peel-visual">
                <span className="peel-img" style={bg(l.cls)} />
                <span className="peel-tag">{l.t}</span>
                {open === i && (
                  <span className="peel-cap">
                    <strong>{l.t}</strong>
                    <span>{l.d}</span>
                  </span>
                )}
              </span>
            </button>
          ))}
          {open === null && (
            <ul className="peel-list">
              {LAYERS.map((l, i) => ({ l, i }))
                .reverse()
                .map(({ l, i }) => (
                  <li key={l.t}>
                    <button
                      type="button"
                      className={hot === i ? "is-hot" : ""}
                      onMouseEnter={() => setHot(i)}
                      onMouseLeave={() => setHot(null)}
                      onClick={() => choose(i)}
                    >
                      <strong>{l.t}</strong>
                      <span>{l.d}</span>
                    </button>
                  </li>
                ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function AnalysisColours() {
  const [on, setOn] = useState(true);
  const own = useMemo(() => render("ndviStretched").range ?? [0, 1], []);
  return (
    <div className="ac">
      <div className="ac-img" style={bg("vs-ndvi")} aria-hidden="true">
        <div className={`ac-img-top${on ? " is-on" : ""}`} style={{ backgroundImage: `url(${viewUrl("ndviStretched")})` }} />
      </div>
      <div className="ac-bar">
        <span style={{ background: on ? rampCss(NDVI_RAMP) : "linear-gradient(90deg,#440154,#3b528b,#21918c,#5ec962,#fde725)" }} />
        <span className="ac-ticks">
          <span>{on ? "−0.2" : own[0].toFixed(2)}</span>
          <span>{on ? "0.8" : own[1].toFixed(2)}</span>
        </span>
      </div>
      <label className="switch">
        <input type="checkbox" checked={on} onChange={(e) => setOn(e.target.checked)} />
        <span className="switch-track" aria-hidden="true">
          <span />
        </span>
        Analysis colours
      </label>
      <p className="muted-note">
        {on
          ? "On: each layer in exactly the colours and range of the Analysis page, read from the .json saved next to the result."
          : "Off: each band on the general colour scale, stretched to its own values. Useful to see small differences."}
      </p>
    </div>
  );
}

export function ViewerChapter() {
  return (
    <>
      <Chapter
        id="viewer"
        eyebrow="GeoTIFF viewer"
        title={
          <>
            See what you downloaded, <span className="grad-text">pixel by pixel</span>
          </>
        }
        lede="Press View on a finished download, or File → Open GeoTIFF… for any .tif. The viewer picks the views the file's bands allow and reads every band's value under your pointer."
        art={<ViewStack />}
      />

      <section className="section">
        <div className="container">
          <SectionHead n="01" title="Try it">
            A made-up Sentinel-2 tile with a reservoir, a river, forest on the hills, crops and a town. Switch views
            and point at it, as you would in the app.
          </SectionHead>
          <Reveal variant="scale">
            <RasterViewer />
          </Reveal>
        </div>
      </section>

      <section className="section band-soft">
        <div className="container">
          <SectionHead n="02" title="One file, many views">
            The views depend on the file's bands. Scroll to peel them apart.
          </SectionHead>
          <PeelScene />
        </div>
      </section>

      <section className="section band-soft">
        <div className="container split">
          <div>
            <SectionHead n="03" title="Analysis results keep their colours">
              Open a saved result's .tif and the viewer adds an Analysis colours switch under the view.
            </SectionHead>
            <Reveal delay={100}>
              <p className="muted-note">
                The NDWI view uses the same idea with its own fixed range:{" "}
                <span className="inline-ramp" style={{ background: rampCss(NDWI_RAMP) }} /> −0.5 to 0.5.
              </p>
            </Reveal>
          </div>
          <Reveal variant="scale">
            <AnalysisColours />
          </Reveal>
        </div>
      </section>

    </>
  );
}
