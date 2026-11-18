import { useMemo, useState, type CSSProperties } from "react";
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

/** The four views peeled apart as you scroll through the section. */
function PeelScene() {
  const [ref] = useScrollProgress<HTMLDivElement>();
  return (
    <div className="peel" ref={ref}>
      <div className="peel-sticky">
        {[
          ["True colour", "vs-true", "Red, green and blue bands, stretched between their 2nd and 98th percentiles."],
          ["False colour", "vs-false", "NIR shown as red, so healthy vegetation glows red and water is near black."],
          ["NDVI", "vs-ndvi", "Fixed range −0.2 to 0.8, so a colour means the same in every file."],
          ["NDWI", "vs-ndwi", "Fixed range −0.5 to 0.5: brown land, blue water."],
          ["Land cover", "vs-lc", "Dynamic World classes in their official colours."],
        ].map(([t, cls, d], i) => (
          <div key={t} className="peel-layer" style={{ "--i": i } as CSSProperties}>
            <div className={`peel-img ${cls}`} style={bg(cls)} />
            <div className="peel-cap">
              <strong>{t}</strong>
              <span>{d}</span>
            </div>
          </div>
        ))}
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

      <section className="section">
        <div className="container">
          <SectionHead n="03" title="What the viewer shows" />
          <div className="small-grid">
            {[
              ["Legend", "A colour bar with its range, the land-cover classes present, or which band is shown as red, green and blue."],
              ["Under the pointer", "Latitude and longitude, every band's value read from the full-resolution file, and the index or class there."],
              ["Details", "Size, bands, coordinate system, area, file size and path."],
              ["Zoom and pan", "The mouse wheel zooms, dragging pans, double-click fits the picture again. Large files are drawn at most 1600 px across."],
              ["No-data is clear", "No-data pixels are transparent instead of black, so the edge of a scene is obvious."],
              ["Show on map", "Lays the current view over the Query Input map, with an opacity slider and Remove from map."],
            ].map(([t, d], i) => (
              <Reveal key={t} delay={(i % 3) * 90} variant="flip" className="small-card">
                <h3>{t}</h3>
                <p>{d}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="section band-soft">
        <div className="container split">
          <div>
            <SectionHead n="04" title="Analysis results keep their colours">
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
