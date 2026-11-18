import { useEffect, useMemo, useRef, useState, type PointerEvent as RPointerEvent } from "react";
import {
  BANDS,
  BAND_LABEL,
  BBOX,
  DW,
  H,
  VIEWS,
  W,
  makeScene,
  nd,
  rampCss,
  render,
  type ViewKey,
} from "./scene";
import "./raster.css";

type Hover = { x: number; y: number } | null;

export default function RasterViewer() {
  const [view, setView] = useState<ViewKey>("true");
  const [hover, setHover] = useState<Hover>(null);
  const [zoom, setZoom] = useState({ s: 1, x: 0, y: 0 });
  const canvas = useRef<HTMLCanvasElement>(null);
  const drag = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);
  const scene = useMemo(() => makeScene(), []);
  const rendered = useMemo(() => render(view), [view]);

  useEffect(() => {
    const ctx = canvas.current?.getContext("2d");
    if (!ctx) return;
    ctx.putImageData(new ImageData(rendered.pixels, W, H), 0, 0);
  }, [rendered]);

  const onMove = (e: RPointerEvent<HTMLCanvasElement>) => {
    if (drag.current) {
      const d = drag.current;
      setZoom((z) => ({ ...z, x: d.ox + (e.clientX - d.x), y: d.oy + (e.clientY - d.y) }));
    }
    const r = e.currentTarget.getBoundingClientRect();
    const x = Math.floor(((e.clientX - r.left) / r.width) * W);
    const y = Math.floor(((e.clientY - r.top) / r.height) * H);
    setHover(x >= 0 && y >= 0 && x < W && y < H ? { x, y } : null);
  };

  const zoomBy = (k: number) =>
    setZoom((z) => {
      const s = Math.min(6, Math.max(1, z.s * k));
      return s === 1 ? { s: 1, x: 0, y: 0 } : { ...z, s };
    });

  const i = hover ? hover.y * W + hover.x : -1;
  const lon = hover ? BBOX.west + ((hover.x + 0.5) / W) * (BBOX.east - BBOX.west) : 0;
  const lat = hover ? BBOX.north - ((hover.y + 0.5) / H) * (BBOX.north - BBOX.south) : 0;
  const classesPresent = useMemo(() => [...new Set(scene.classes)].sort(), [scene]);

  return (
    <div className="rv">
      <div className="rv-toolbar" role="tablist" aria-label="Views">
        {VIEWS.map((v) => (
          <button
            key={v.key}
            type="button"
            role="tab"
            aria-selected={view === v.key}
            className={`rv-tab${view === v.key ? " is-on" : ""}`}
            onClick={() => setView(v.key)}
          >
            {v.label}
          </button>
        ))}
      </div>

      <div className="rv-body">
        <div className="rv-stage">
          <div
            className="rv-frame"
            onDoubleClick={() => setZoom({ s: 1, x: 0, y: 0 })}
            onWheel={(e) => {
              if (!e.ctrlKey) return;
              e.preventDefault();
              zoomBy(e.deltaY < 0 ? 1.25 : 0.8);
            }}
          >
            <canvas
              key={view}
              ref={canvas}
              width={W}
              height={H}
              className="rv-canvas"
              style={{ transform: `translate(${zoom.x}px, ${zoom.y}px) scale(${zoom.s})` }}
              onPointerMove={onMove}
              onPointerLeave={() => {
                setHover(null);
                drag.current = null;
              }}
              onPointerDown={(e) => {
                if (zoom.s === 1) return;
                e.currentTarget.setPointerCapture(e.pointerId);
                drag.current = { x: e.clientX, y: e.clientY, ox: zoom.x, oy: zoom.y };
              }}
              onPointerUp={() => (drag.current = null)}
              aria-label={`Example scene shown as ${VIEWS.find((v) => v.key === view)?.label}`}
              role="img"
            />
            {hover && zoom.s === 1 && (
              <span
                className="rv-crosshair"
                style={{ left: `${((hover.x + 0.5) / W) * 100}%`, top: `${((hover.y + 0.5) / H) * 100}%` }}
                aria-hidden="true"
              />
            )}
            <div className="rv-zoom">
              <button type="button" onClick={() => zoomBy(1.4)} aria-label="Zoom in">
                +
              </button>
              <button type="button" onClick={() => zoomBy(1 / 1.4)} aria-label="Zoom out">
                −
              </button>
              <button type="button" onClick={() => setZoom({ s: 1, x: 0, y: 0 })} aria-label="Fit the picture">
                ⤢
              </button>
            </div>
          </div>

          <div className="rv-legend" aria-live="polite">
            {view === "lc" ? (
              <ul className="rv-classes">
                {classesPresent.map((c) => (
                  <li key={c}>
                    <span style={{ background: DW[c].color }} />
                    {DW[c].name}
                  </li>
                ))}
              </ul>
            ) : rendered.stops && rendered.range ? (
              <div className="rv-bar">
                <span className="rv-bar-ramp" style={{ background: rampCss(rendered.stops) }} />
                <span className="rv-bar-ticks">
                  <span>{rendered.range[0].toFixed(view === "ndvi" || view === "ndwi" ? 1 : 3)}</span>
                  <span>{rendered.range[1].toFixed(view === "ndvi" || view === "ndwi" ? 1 : 3)}</span>
                </span>
              </div>
            ) : (
              <p className="rv-rgb">
                <span className="rv-r">R</span> {view === "true" ? "B4 red" : "B8 NIR"} ·{" "}
                <span className="rv-g">G</span> {view === "true" ? "B3 green" : "B4 red"} ·{" "}
                <span className="rv-b">B</span> {view === "true" ? "B2 blue" : "B3 green"}{" "}
                <span className="muted-note">(2nd to 98th percentile stretch)</span>
              </p>
            )}
          </div>
        </div>

        <aside className="rv-side">
          <h3>Under the pointer</h3>
          {hover ? (
            <dl className="rv-readout">
              <dt>Latitude, longitude</dt>
              <dd>
                {lat.toFixed(5)}, {lon.toFixed(5)}
              </dd>
              {BANDS.map((b) => (
                <div key={b} className="rv-row">
                  <dt>{BAND_LABEL[b]}</dt>
                  <dd>{scene.bands[b][i].toFixed(4)}</dd>
                </div>
              ))}
              <div className="rv-row rv-row-strong">
                <dt>NDVI</dt>
                <dd>{nd(scene.bands.nir[i], scene.bands.red[i]).toFixed(3)}</dd>
              </div>
              <div className="rv-row rv-row-strong">
                <dt>NDWI</dt>
                <dd>{nd(scene.bands.green[i], scene.bands.nir[i]).toFixed(3)}</dd>
              </div>
              <div className="rv-row rv-row-strong">
                <dt>Land cover</dt>
                <dd>
                  <span className="rv-swatch" style={{ background: DW[scene.classes[i]].color }} />
                  {DW[scene.classes[i]].name}
                </dd>
              </div>
            </dl>
          ) : (
            <p className="muted-note">Point at the picture to read every band, the indices and the class there.</p>
          )}
          <h3>Details</h3>
          <dl className="rv-details">
            <div className="rv-row">
              <dt>Size</dt>
              <dd>
                {W} × {H} px
              </dd>
            </div>
            <div className="rv-row">
              <dt>Bands</dt>
              <dd>6</dd>
            </div>
            <div className="rv-row">
              <dt>Coordinates</dt>
              <dd>EPSG:4326</dd>
            </div>
          </dl>
        </aside>
      </div>
      <p className="rv-hint muted-note">
        Drag to pan once zoomed, Ctrl + wheel to zoom, double-click to fit. In the app the wheel alone zooms.
      </p>
    </div>
  );
}
