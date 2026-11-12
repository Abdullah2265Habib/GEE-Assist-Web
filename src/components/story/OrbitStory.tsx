import { useEffect, useMemo, useRef, useState } from "react";
import { createScope, createTimeline, onScroll, stagger, svg as animeSvg, type Scope, type Timeline } from "animejs";
import { geoGraticule10, geoOrthographic, geoPath } from "d3-geo";
import { feature } from "topojson-client";
import type { Feature, FeatureCollection, Geometry } from "geojson";
import type { GeometryCollection, Topology } from "topojson-specification";
import countriesTopo from "world-atlas/countries-110m.json";
import { buildScene, NDVI_STOPS, type Scene } from "./landscape";
import "./story.css";

/* ------------------------------------------------------------------ copy */

const CHAPTERS = [
  {
    title: "In orbit",
    body: "Sentinel-2, Landsat and MODIS circle the planet and photograph the same fields every few days. GEE-Assist knows fifteen of their collections, some going back to 1950.",
  },
  {
    title: "Through the lens",
    body: "Each pass records light in many bands, with pixels as small as 10 metres. Tell GEE-Assist how cloudy is too cloudy and it keeps only the clear scenes.",
  },
  {
    title: "Down to Earth",
    body: "Earth Engine sends at most 48 MB per request. GEE-Assist asks for pieces of about 4 MB, eight at a time, so data starts arriving straight away.",
  },
  {
    title: "Caught on the ground",
    body: "Every piece is written to disk the moment it lands. Pause, close the app, and carry on later. The Downloads page shows the speed and the time left.",
  },
  {
    title: "Decoded into bands",
    body: "The pieces join into one image, and the bands come apart: red, green, blue and near-infrared. Pick the bands you need, or let Gemini pick them from your request.",
  },
  {
    title: "Turned into answers",
    body: "Add an analysis and the index is computed before the download: NDVI here, or water, temperature and land cover. The result is a GeoTIFF that opens in QGIS or ArcGIS.",
  },
];

/* ------------------------------------------------------------- geometry */

const W = 1200;
const H = 900;
const EARTH = { cx: 600, cy: 520, r: 300 };
const ORBIT = { rx: 470, ry: 120, tilt: (-14 * Math.PI) / 180 };
const SAT_END_T = -0.3;
const SAT_DOWN = { x: 600, y: 150 };
/** Where the dish head turns, and its feed horn (the point the camera dives into). */
const PIVOT = { x: 600, y: 668 };
const FEED = { x: 600, y: 506 };
const FRAME = { x: 480, y: 230, size: 360 };
const AOI = { x: 600, y: 300, size: 400 };
const LENS = { cx: 600, cy: 450, r: 290 };
const STRIP_SCALE = 4;
const TOTAL = 6500;
const HOLD = 350;
const BINARY_ROWS = 13;
/** Where the split bands land: a column to the right of the picture. */
const BAND_X = 380;
const BAND_SIZE = 150;
/** The rounded "screen" the decoder and the map are shown on. */
const SCREEN = { x: 24, y: 24, w: W - 48, h: H - 48, r: 32 };

function orbitPoint(t: number): [number, number] {
  const lx = ORBIT.rx * Math.cos(t);
  const ly = ORBIT.ry * Math.sin(t);
  const c = Math.cos(ORBIT.tilt);
  const s = Math.sin(ORBIT.tilt);
  return [EARTH.cx + lx * c - ly * s, EARTH.cy + lx * s + ly * c];
}

function orbitPath(from: number, to: number, steps = 80): string {
  let d = "";
  for (let i = 0; i <= steps; i++) {
    const [x, y] = orbitPoint(from + ((to - from) * i) / steps);
    d += `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`;
  }
  return d;
}

const SAT_END = orbitPoint(SAT_END_T);
/** The satellite lens, in scene units, when the orbit ends (lens at y=22 in the shape, drawn at 0.9). */
const SAT_LENS = { x: SAT_END[0], y: SAT_END[1] + 22 * 0.9, r: 6 * 0.9 };
/** How far the camera magnifies to make the satellite lens fill the lens view. */
const DIVE = LENS.r / SAT_LENS.r;
const bits = (n: number) => n.toString(2).padStart(8, "0");
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

/** Timeline time (ms) at which each chapter's scene begins; captions follow these. */
const CHAPTER_STARTS = [0, 1000, 2500, 3100, 3950, 5400];

/** Timeline time (ms) during which each scene layer may be visible: [selector, from, to]. */
const SCENE_WINDOWS: [string, number, number][] = [
  [".st-world", 0, 1950],
  [".st-lens", 1040, 3050],
  [".st-ground", 2650, 4450],
  [".st-decoder", 4150, Infinity],
  [".st-band", 4780, 5850],
  [".st-map", 5900, Infinity],
  [".st-map-late-layer", 5900, Infinity],
];
const chapterAt = (t: number) => {
  let c = 0;
  CHAPTER_STARTS.forEach((start, i) => {
    if (t + 60 >= start) c = i;
  });
  return c;
};

/* ----------------------------------------------------------- satellite */

function SatelliteShape() {
  const cells = (x: number) =>
    [0, 1, 2, 3].map((i) => <line key={i} x1={x + 11.5 * (i + 1)} y1={-12} x2={x + 11.5 * (i + 1)} y2={12} />);
  return (
    <g className="st-sat-shape">
      <line className="st-sat-strut" x1={-24} y1={0} x2={-14} y2={0} />
      <line className="st-sat-strut" x1={14} y1={0} x2={24} y2={0} />
      <rect className="st-sat-panel" x={-80} y={-13} width={56} height={26} rx={2} />
      <rect className="st-sat-panel" x={24} y={-13} width={56} height={26} rx={2} />
      <g className="st-sat-cells">
        {cells(-80)}
        {cells(24)}
        <line x1={-80} y1={0} x2={-24} y2={0} />
        <line x1={24} y1={0} x2={80} y2={0} />
      </g>
      <rect className="st-sat-body" x={-14} y={-20} width={28} height={40} rx={4} />
      <rect className="st-sat-band" x={-14} y={-6} width={28} height={6} />
      <line className="st-sat-strut" x1={0} y1={-20} x2={0} y2={-32} />
      <path className="st-sat-dish" d="M -9 -32 Q 0 -40 9 -32 Z" />
      <circle className="st-sat-lens" cx={0} cy={22} r={6} />
    </g>
  );
}

/* --------------------------------------------------------------- story */

export default function OrbitStory() {
  const rootRef = useRef<HTMLElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [chapter, setChapter] = useState(0);
  const chapterRef = useRef(0);
  const tlRef = useRef<Timeline | null>(null);
  const [reduced] = useState(() => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  const scene: Scene = useMemo(() => buildScene(), []);

  const countries = useMemo(() => {
    const topo = countriesTopo as unknown as Topology<{ countries: GeometryCollection<{ name: string }> }>;
    return (feature(topo, topo.objects.countries) as FeatureCollection<Geometry, { name: string }>).features as Feature<Geometry, { name: string }>[];
  }, []);

  useEffect(() => {
    const root = rootRef.current;
    const svgEl = svgRef.current;
    if (!root || !svgEl) return;

    const $ = <T extends Element = SVGElement>(sel: string) => svgEl.querySelector<T>(sel)!;
    const $$ = (sel: string) => Array.from(svgEl.querySelectorAll(sel));

    /* Earth, redrawn from the timeline's time. */
    const projection = geoOrthographic().scale(EARTH.r).translate([EARTH.cx, EARTH.cy]).clipAngle(90);
    const path = geoPath(projection);
    const graticule = geoGraticule10();
    const countryEls = $$(".st-country");
    const gratEl = $(".st-graticule");
    let lastLon = NaN;
    const drawEarth = (lon: number) => {
      if (Math.abs(lon - lastLon) < 0.05) return;
      lastLon = lon;
      projection.rotate([lon, -18, 0]);
      countryEls.forEach((el, i) => el.setAttribute("d", path(countries[i]) ?? ""));
      gratEl.setAttribute("d", path(graticule) ?? "");
    };

    /* Decoder: reveal rows and print the bytes being decoded. */
    const revealEl = $(".st-reveal-rect");
    const scanEl = $(".st-reveal-scan");
    const rowEls = $$(".st-bin-row");
    const rowLabel = $(".st-bin-label");
    let lastRow = -1;
    const drawDecoder = (fraction: number) => {
      const rows = Math.round(fraction * 128);
      if (rows === lastRow) return;
      lastRow = rows;
      const h = (rows / 128) * FRAME.size;
      revealEl.setAttribute("height", String(h));
      scanEl.setAttribute("y1", String(FRAME.y + h));
      scanEl.setAttribute("y2", String(FRAME.y + h));
      scanEl.setAttribute("opacity", rows > 0 && rows < 128 ? "1" : "0");
      rowLabel.textContent = `row ${String(Math.min(rows, 127)).padStart(3, "0")} / 128`;
      rowEls.forEach((el, i) => {
        const row = Math.max(0, Math.min(127, rows - (BINARY_ROWS - 1) + i));
        const bytes = scene.rowBytes(row).slice(0, 4);
        el.textContent = bytes.map(bits).join(" ");
        el.setAttribute("class", `st-bin-row${i === BINARY_ROWS - 1 ? " is-current" : ""}`);
      });
    };

    /* Each scene is only rendered inside its time window. Scroll smoothing approaches its
       target gradually, which can leave a scene at a few percent opacity after you scroll
       back past it; hiding it outright means no trace of it can show. */
    const windows = SCENE_WINDOWS.map(([sel, from, to]) => ({ els: $$(sel), from, to }));
    const showScenes = (t: number) => {
      windows.forEach(({ els, from, to }) => {
        const v = t >= from && t <= to ? "visible" : "hidden";
        els.forEach((el) => {
          if (el.getAttribute("visibility") !== v) el.setAttribute("visibility", v);
        });
      });
    };

    const updateFromTime = (t: number) => {
      showScenes(t);
      drawEarth(-60 + (t / 2600) * 110);
      drawDecoder(clamp01((t - 4250) / 500));
      const c = chapterAt(t);
      if (c !== chapterRef.current) {
        chapterRef.current = c;
        setChapter(c);
      }
    };

    let scope: Scope | null = createScope({ root }).add(() => {
      const tl = createTimeline({
        defaults: { ease: "inOutQuad" },
        autoplay: reduced ? false : onScroll({ target: root, enter: "top top", leave: "bottom bottom", sync: 0.5 }),
        onUpdate: (self) => updateFromTime(self.currentTime),
      });
      tlRef.current = tl;
      const motion = animeSvg.createMotionPath($(".st-satpath"));

      /* Starting state of everything that appears later, set at time 0 so that a remount
         or scrolling back to the top always shows the orbit scene alone. */
      tl.set($(".st-lens"), { opacity: 0, translateX: SAT_LENS.x - LENS.cx, translateY: SAT_LENS.y - LENS.cy, scale: 1 / DIVE }, 0)
        .set($(".st-ground"), { opacity: 0, scale: 1 }, 0)
        .set($(".st-downlink"), { opacity: 0 }, 0)
        .set($(".st-horizon"), { translateY: 320 }, 0)
        .set($(".st-dish"), { translateY: 460 }, 0)
        .set($(".st-dish-head"), { rotate: -38 }, 0)
        .set($(".st-status"), { opacity: 0 }, 0)
        .set($$(".st-wave"), { opacity: 0 }, 0)
        .set($$(".st-packet"), { opacity: 0 }, 0)
        .set($$(".st-hud"), { opacity: 0 }, 0)
        .set($(".st-decoder"), { opacity: 0 }, 0)
        .set($$(".st-band"), { opacity: 0, translateX: 0, translateY: 0, scale: 1 }, 0)
        .set($(".st-ndvi"), { opacity: 0 }, 0)
        .set($(".st-formula"), { opacity: 0 }, 0)
        .set($(".st-map"), { opacity: 0 }, 0)
        .set($$(".st-map-late"), { opacity: 0 }, 0);

      /* 1 · In orbit */
      tl.add($(".st-sat-orbit"), { translateX: motion.translateX, translateY: motion.translateY, duration: 1050, ease: "inOutSine" }, 0)
        .add(animeSvg.createDrawable($$(".st-orbit-trail")), { draw: ["0 0", "0 1"], duration: 1050, ease: "inOutSine" }, 0)

        /* 2 · Through the lens: dive into the satellite lens. The world and the lens view share
           one transform (same ease, same timing), so the tiny lens grows into the lens view. */
        .add($(".st-world"), {
          translateX: [0, LENS.cx - SAT_LENS.x],
          translateY: [0, LENS.cy - SAT_LENS.y],
          scale: [1, DIVE],
          duration: 850,
          ease: "inCubic",
        }, 1050)
        .add($(".st-lens"), { opacity: [0, 1], duration: 80, ease: "linear" }, 1050)
        .add($(".st-lens"), {
          translateX: [SAT_LENS.x - LENS.cx, 0],
          translateY: [SAT_LENS.y - LENS.cy, 0],
          scale: [1 / DIVE, 1],
          duration: 850,
          ease: "inCubic",
        }, 1050)
        .add($(".st-world"), { opacity: [1, 0], duration: 120, ease: "linear" }, 1780)
        .add($(".st-strip"), { translateY: [0, -(scene.stripHeight * STRIP_SCALE - 2 * LENS.r - 40)], duration: 1450, ease: "linear" }, 1100)
        .add($(".st-lens-ring"), { rotate: [0, 120], duration: 1450, ease: "linear" }, 1100)
        .add($(".st-lens-scan"), { translateY: [-LENS.r, LENS.r, -LENS.r, LENS.r], duration: 700, ease: "linear" }, 1850)
        .add($$(".st-hud"), { opacity: [0, 1], translateY: [12, 0], duration: 220, delay: stagger(50) }, 1900)

        /* 3 · Down to Earth */
        .add($(".st-lens"), { scale: [1, 0.12], translateY: [0, SAT_DOWN.y - LENS.cy], opacity: [1, 0], duration: 450, ease: "inQuad" }, 2550)
        .add($(".st-ground"), { opacity: [0, 1], duration: 120 }, 2700)
        .add($(".st-downlink"), { opacity: [0, 1], duration: 250 }, 2800)
        .add($(".st-horizon"), { translateY: [320, 0], duration: 450, ease: "outQuad" }, 2700)
        .add($$(".st-wave"), { scale: [0.15, 5.6], opacity: [0, 0.9, 0], duration: 520, delay: stagger(95) }, 2880)

        /* 4 · Caught on the ground: the dish rises, then its head swings round to track the
           satellite and settles, while the pedestal stays put. */
        .add($(".st-dish"), { translateY: [460, 0], duration: 420, ease: "outQuad" }, 2950)
        .add($(".st-dish-head"), { rotate: [-38, 14, -8, 4, -2, 0], duration: 950, ease: "inOutSine" }, 3150)
        .add($$(".st-wave"), { scale: [0.15, 5.6], opacity: [0, 0.9, 0], duration: 520, delay: stagger(95) }, 3450)
        .add($$(".st-packet"), { translateY: [0, FEED.y - SAT_DOWN.y - 40], opacity: [0, 1, 1, 0], duration: 360, delay: stagger(55) }, 3450)
        .add($(".st-status"), { opacity: [0, 1], translateY: [10, 0], duration: 250 }, 3400)

        /* 5 · Decoded into bands: dive into the feed horn, decode, split the bands out. */
        .add($(".st-ground"), { scale: [1, 6], opacity: [1, 0], duration: 400, ease: "inQuad" }, 4000)
        .add($(".st-decoder"), { opacity: [0, 1], duration: 220 }, 4180)
        .add($$(".st-band"), {
          translateX: [0, BAND_X],
          translateY: stagger(170, { start: -110 }),
          scale: [1, BAND_SIZE / FRAME.size],
          opacity: [0, 1],
          duration: 320,
          delay: stagger(50),
          ease: "outQuad",
        }, 4800)

        /* 6 · Turned into answers: the bands slide back into the picture and NDVI appears. */
        .add($$(".st-band"), { translateX: 0, translateY: 0, scale: 1, opacity: 0, duration: 300, delay: stagger(45), ease: "inQuad" }, 5450)
        .add($(".st-formula"), { opacity: [0, 1], translateY: [10, 0], duration: 200 }, 5500)
        .add($(".st-ndvi"), { opacity: [0, 1], duration: 260 }, 5600)
        .add($$(".st-decoder-chrome"), { opacity: [1, 0], duration: 250 }, 5950)
        .add($(".st-map"), { opacity: [0, 1], duration: 300 }, 5950)
        .add($(".st-result"), {
          translateX: [0, AOI.x - FRAME.x],
          translateY: [0, AOI.y - FRAME.y],
          scale: [1, AOI.size / FRAME.size],
          duration: 420,
          ease: "inOutCubic",
        }, 6000)
        .add($$(".st-map-late"), { opacity: [0, 1], translateY: [10, 0], duration: 250, delay: stagger(60) }, 6300)
        .add({ duration: HOLD }, TOTAL);

      if (reduced) tl.seek(tl.duration);
      else updateFromTime(0);
    });

    return () => {
      scope?.revert();
      scope = null;
      tlRef.current = null;
    };
  }, [countries, scene, reduced]);

  const goTo = (i: number) => {
    const root = rootRef.current;
    if (!root) return;
    const top = root.getBoundingClientRect().top + window.scrollY;
    const range = root.offsetHeight - window.innerHeight;
    window.scrollTo({ top: top + (range * (CHAPTER_STARTS[i] + 150)) / (TOTAL + HOLD), behavior: "smooth" });
  };

  const binaryRows = Array.from({ length: BINARY_ROWS });

  return (
    <section ref={rootRef} className={`story${reduced ? " is-static" : ""}`} aria-labelledby="story-title">
      <div className="story-stage">
        <div className="story-copy">
          <h2 id="story-title" className="story-kicker">
            From orbit to your disk
          </h2>
          <div className="story-captions" aria-live="polite">
            {CHAPTERS.map((c, i) => (
              <div key={c.title} className={`story-caption${chapter === i ? " is-active" : ""}`} aria-hidden={!reduced && chapter !== i}>
                <h3>{c.title}</h3>
                <p>{c.body}</p>
              </div>
            ))}
          </div>
          <ol className="story-rail" aria-label="Chapters">
            {CHAPTERS.map((c, i) => (
              <li key={c.title}>
                <button type="button" className={chapter === i ? "is-active" : chapter > i ? "is-done" : ""} onClick={() => goTo(i)} aria-current={chapter === i ? "step" : undefined}>
                  <span className="story-rail-dot" aria-hidden="true" />
                  <span className="story-rail-label">{c.title}</span>
                </button>
              </li>
            ))}
          </ol>
        </div>

        <svg ref={svgRef} className="story-svg" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" role="img" aria-label="Animation: a satellite images the Earth, sends the data to a ground station, and the data is decoded into bands and an NDVI map.">
          <defs>
            <radialGradient id="st-ocean" cx="40%" cy="35%" r="70%">
              <stop offset="0%" stopColor="#2f7fc1" />
              <stop offset="100%" stopColor="#0f3a5c" />
            </radialGradient>
            <radialGradient id="st-glow" cx="50%" cy="50%" r="50%">
              <stop offset="80%" stopColor="#6cb8f0" stopOpacity="0.35" />
              <stop offset="100%" stopColor="#6cb8f0" stopOpacity="0" />
            </radialGradient>
            <linearGradient id="st-sky-glow" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#5ed3a8" stopOpacity="0" />
              <stop offset="100%" stopColor="#5ed3a8" stopOpacity="0.16" />
            </linearGradient>
            <linearGradient id="st-ground-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#1d4a40" />
              <stop offset="100%" stopColor="#0d2621" />
            </linearGradient>
            <linearGradient id="st-ndvi-ramp" x1="0" y1="0" x2="1" y2="0">
              {NDVI_STOPS.map(([v, [r, g, b]]) => (
                <stop key={v} offset={`${((v + 0.4) / 1.15) * 100}%`} stopColor={`rgb(${r},${g},${b})`} />
              ))}
            </linearGradient>
            <clipPath id="st-lens-clip">
              <circle cx={LENS.cx} cy={LENS.cy} r={LENS.r} />
            </clipPath>
            <clipPath id="st-reveal-clip">
              <rect className="st-reveal-rect" x={FRAME.x} y={FRAME.y} width={FRAME.size} height={0} />
            </clipPath>
            <path id="st-wave-shape" d="M -60 0 A 60 60 0 0 0 60 0" />
            <clipPath id="st-screen-clip">
              <rect x={SCREEN.x} y={SCREEN.y} width={SCREEN.w} height={SCREEN.h} rx={SCREEN.r} />
            </clipPath>
          </defs>

          <rect className="st-space" x={0} y={0} width={W} height={H} />
          <g className="st-stars" aria-hidden="true">
            {Array.from({ length: 70 }).map((_, i) => {
              const x = (i * 397) % W;
              const y = (i * 211) % H;
              return <circle key={i} cx={x} cy={y} r={i % 7 === 0 ? 1.6 : 0.9} opacity={0.25 + ((i * 37) % 60) / 100} />;
            })}
          </g>

          {/* 1 · Earth and orbit */}
          <g className="st-world" style={{ transformOrigin: `${SAT_LENS.x}px ${SAT_LENS.y}px` }}>
            <circle cx={EARTH.cx} cy={EARTH.cy} r={EARTH.r + 26} fill="url(#st-glow)" />
            <path className="st-orbit-back" d={orbitPath(0, -Math.PI)} />
            <circle cx={EARTH.cx} cy={EARTH.cy} r={EARTH.r} fill="url(#st-ocean)" />
            <path className="st-graticule" />
            {countries.map((_, i) => (
              <path key={i} className="st-country" />
            ))}
            <path className="st-orbit-front" d={orbitPath(Math.PI, 0)} />
            <path className="st-orbit-trail" d={orbitPath(Math.PI, SAT_END_T)} />
            <path className="st-satpath" d={orbitPath(Math.PI, SAT_END_T)} />
            <g className="st-sat-orbit">
              <g transform="scale(0.9)">
                <SatelliteShape />
              </g>
            </g>
          </g>

          {/* 2 · Lens view */}
          <g className="st-lens" style={{ transformOrigin: `${LENS.cx}px ${LENS.cy}px` }}>
            <circle cx={LENS.cx} cy={LENS.cy} r={LENS.r + 18} className="st-lens-bezel" />
            <g clipPath="url(#st-lens-clip)">
              <image
                className="st-strip"
                href={scene.strip}
                x={LENS.cx - 80 * STRIP_SCALE}
                y={LENS.cy - LENS.r - 20}
                width={160 * STRIP_SCALE}
                height={scene.stripHeight * STRIP_SCALE}
                preserveAspectRatio="none"
                style={{ imageRendering: "pixelated" }}
              />
              <rect x={LENS.cx - LENS.r} y={LENS.cy - LENS.r} width={LENS.r * 2} height={LENS.r * 2} className="st-lens-tint" />
              <g className="st-lens-scan" style={{ transformOrigin: `${LENS.cx}px ${LENS.cy}px` }}>
                <rect x={LENS.cx - LENS.r} y={LENS.cy - 2} width={LENS.r * 2} height={4} className="st-scanline" />
                <rect x={LENS.cx - LENS.r} y={LENS.cy - 40} width={LENS.r * 2} height={38} className="st-scanglow" />
              </g>
            </g>
            <g className="st-lens-ring" style={{ transformOrigin: `${LENS.cx}px ${LENS.cy}px` }}>
              {Array.from({ length: 72 }).map((_, i) => {
                const a = (i / 72) * Math.PI * 2;
                const r1 = LENS.r + 4;
                const r2 = LENS.r + (i % 6 === 0 ? 16 : 9);
                return <line key={i} x1={LENS.cx + r1 * Math.cos(a)} y1={LENS.cy + r1 * Math.sin(a)} x2={LENS.cx + r2 * Math.cos(a)} y2={LENS.cy + r2 * Math.sin(a)} />;
              })}
            </g>
            <g className="st-reticle">
              <line x1={LENS.cx - 40} y1={LENS.cy} x2={LENS.cx - 12} y2={LENS.cy} />
              <line x1={LENS.cx + 12} y1={LENS.cy} x2={LENS.cx + 40} y2={LENS.cy} />
              <line x1={LENS.cx} y1={LENS.cy - 40} x2={LENS.cx} y2={LENS.cy - 12} />
              <line x1={LENS.cx} y1={LENS.cy + 12} x2={LENS.cx} y2={LENS.cy + 40} />
              <rect x={LENS.cx - 70} y={LENS.cy - 70} width={140} height={140} className="st-reticle-box" />
            </g>
            <g className="st-hud-group">
              <text className="st-hud" x={LENS.cx - LENS.r - 40} y={LENS.cy - 190} textAnchor="end">MSI · 13 bands</text>
              <text className="st-hud" x={LENS.cx - LENS.r - 40} y={LENS.cy - 160} textAnchor="end">10 m per pixel</text>
              <text className="st-hud" x={LENS.cx + LENS.r + 40} y={LENS.cy + 170}>Swath 290 km</text>
              <text className="st-hud" x={LENS.cx + LENS.r + 40} y={LENS.cy + 200}>Altitude 786 km</text>
            </g>
          </g>

          {/* 3 + 4 · Downlink and ground station */}
          <g className="st-ground" style={{ transformOrigin: `${FEED.x}px ${FEED.y}px` }}>
            <g className="st-downlink">
              <g className="st-waves">
                {[0, 1, 2, 3, 4].map((i) => (
                  <use key={i} href="#st-wave-shape" className="st-wave" x={SAT_DOWN.x} y={SAT_DOWN.y + 20} style={{ transformOrigin: `${SAT_DOWN.x}px ${SAT_DOWN.y + 20}px` }} />
                ))}
              </g>
              <g className="st-packets">
                {Array.from({ length: 8 }).map((_, i) => (
                  <rect key={i} className="st-packet" x={SAT_DOWN.x - 7 + ((i % 3) - 1) * 18} y={SAT_DOWN.y + 30} width={14} height={9} rx={2} />
                ))}
              </g>
              <g transform={`translate(${SAT_DOWN.x} ${SAT_DOWN.y}) scale(1.25)`}>
                <SatelliteShape />
              </g>
            </g>
            <g className="st-horizon">
              <rect x={-600} y={540} width={2400} height={260} fill="url(#st-sky-glow)" />
              <path className="st-land-far" d="M -600 700 C -300 650 -100 690 100 668 S 400 618 560 648 S 900 640 1050 612 S 1400 652 1800 628 L 1800 1600 L -600 1600 Z" />
              <path className="st-land-mid" d="M -600 734 C -300 714 0 734 200 721 S 500 700 700 717 S 1000 704 1200 721 S 1600 709 1800 719 L 1800 1600 L -600 1600 Z" />
              <path className="st-land-near" d="M -600 760 Q 600 738 1800 760 L 1800 1600 L -600 1600 Z" />
              <path className="st-land-road" d="M 640 749 Q 760 752 900 751" />
              {/* control building with lit windows */}
              <rect className="st-building" x={792} y={706} width={116} height={44} rx={3} />
              <rect className="st-building-roof" x={786} y={700} width={128} height={8} rx={2} />
              {[0, 1, 2, 3].map((i) => (
                <rect key={i} className="st-window" x={806 + i * 25} y={720} width={14} height={9} rx={1.5} />
              ))}
              <line className="st-mast" x1={890} y1={700} x2={890} y2={672} />
              <circle className="st-mast-light" cx={890} cy={670} r={3.5} />
              {/* a smaller dish */}
              <line className="st-mast" x1={396} y1={751} x2={396} y2={722} />
              <path className="st-small-dish" d="M 372 708 Q 396 736 420 708 Z" transform="rotate(-24 396 716)" />
              {/* trees */}
              {[[226, 756, 15], [254, 758, 11], [1000, 756, 13], [1026, 758, 17], [1058, 760, 10]].map(([x, y, r], i) => (
                <g key={i}>
                  <line className="st-trunk" x1={x} y1={y} x2={x} y2={y - r * 1.4} />
                  <circle className="st-tree" cx={x} cy={y - r * 1.6} r={r} />
                </g>
              ))}
            </g>
            <g className="st-dish">
              <path className="st-dish-base" d="M 554 750 L 646 750 L 630 722 L 570 722 Z" />
              <rect className="st-dish-neck" x={589} y={PIVOT.y} width={22} height={56} />
              <g className="st-dish-head" style={{ transformOrigin: `${PIVOT.x}px ${PIVOT.y}px` }}>
                <g transform={`translate(${PIVOT.x} ${PIVOT.y})`}>
                  <rect className="st-dish-neck" x={-9} y={-24} width={18} height={24} />
                  <path className="st-dish-bowl" d="M -132 -74 Q 0 42 132 -74 Z" />
                  <ellipse className="st-dish-rim" cx={0} cy={-74} rx={132} ry={21} />
                  <ellipse className="st-dish-inner" cx={0} cy={-72} rx={112} ry={15} />
                  <line className="st-dish-strut" x1={-104} y1={-72} x2={0} y2={-160} />
                  <line className="st-dish-strut" x1={104} y1={-72} x2={0} y2={-160} />
                  <line className="st-dish-strut" x1={0} y1={-66} x2={0} y2={-160} />
                  <rect className="st-dish-horn" x={-8} y={-172} width={16} height={14} rx={3} />
                  <circle className="st-dish-feed" cx={0} cy={FEED.y - PIVOT.y} r={6} />
                </g>
              </g>
              <circle className="st-dish-hinge" cx={PIVOT.x} cy={PIVOT.y} r={8} />
            </g>
            <g className="st-status">
              <rect x={760} y={540} width={330} height={78} rx={12} />
              <text x={782} y={572}>Receiving · 4 MB pieces</text>
              <text x={782} y={600} className="st-status-sub">8 at a time · written to disk on arrival</text>
            </g>
          </g>

          {/* 6 · Map */}
          <g className="st-map" clipPath="url(#st-screen-clip)">
            <image href={scene.basemap} x={0} y={0} width={W} height={H} preserveAspectRatio="none" />
            <g className="st-map-grid">
              {[1, 2, 3, 4, 5].map((i) => (
                <line key={`v${i}`} x1={i * 200} y1={0} x2={i * 200} y2={H} />
              ))}
              {[1, 2, 3].map((i) => (
                <line key={`h${i}`} x1={0} y1={i * 225} x2={W} y2={i * 225} />
              ))}
            </g>
            <rect x={AOI.x} y={AOI.y} width={AOI.size} height={AOI.size} className="st-aoi" />
          </g>
          {/* 5 · Decoder */}
          <g className="st-decoder">
            <g className="st-decoder-chrome">
              <rect x={SCREEN.x} y={SCREEN.y} width={SCREEN.w} height={SCREEN.h} rx={SCREEN.r} className="st-decoder-bg" />
              <text className="st-panel-title" x={70} y={190}>Decoding downlink</text>
              <text className="st-bin-label" x={70} y={222}>row 000 / 128</text>
              {binaryRows.map((_, i) => (
                <text key={i} className="st-bin-row" x={70} y={258 + i * 27}>
                  00000000 00000000 00000000 00000000
                </text>
              ))}
            </g>
            <g className="st-result" style={{ transformOrigin: `${FRAME.x}px ${FRAME.y}px` }}>
              <rect x={FRAME.x - 1} y={FRAME.y - 1} width={FRAME.size + 2} height={FRAME.size + 2} className="st-frame-bg" />
              <image href={scene.trueColor} x={FRAME.x} y={FRAME.y} width={FRAME.size} height={FRAME.size} clipPath="url(#st-reveal-clip)" style={{ imageRendering: "pixelated" }} />
              <image className="st-ndvi" href={scene.ndvi} x={FRAME.x} y={FRAME.y} width={FRAME.size} height={FRAME.size} style={{ imageRendering: "pixelated" }} />
              <line className="st-reveal-scan" x1={FRAME.x - 10} x2={FRAME.x + FRAME.size + 10} y1={FRAME.y} y2={FRAME.y} />
              <rect x={FRAME.x} y={FRAME.y} width={FRAME.size} height={FRAME.size} className="st-frame" />
            </g>
            {scene.bands.map((b) => (
              <g key={b.id} className="st-band" style={{ transformOrigin: `${FRAME.x}px ${FRAME.y}px` }}>
                <image href={b.url} x={FRAME.x} y={FRAME.y} width={FRAME.size} height={FRAME.size} style={{ imageRendering: "pixelated" }} />
                <rect x={FRAME.x} y={FRAME.y} width={FRAME.size} height={FRAME.size} className="st-frame" style={{ stroke: b.colour }} />
                <text x={FRAME.x + FRAME.size + 30} y={FRAME.y + FRAME.size / 2 + 14} className="st-band-label" style={{ fill: b.colour }}>
                  {b.label}
                </text>
              </g>
            ))}
            <text className="st-formula st-decoder-chrome" x={FRAME.x + FRAME.size / 2} y={FRAME.y + FRAME.size + 60} textAnchor="middle">
              NDVI = (B8 − B4) / (B8 + B4)
            </text>
          </g>

          {/* The result sits above the map once it lands in the area box. */}
          <g className="st-map-late-layer">
            <g className="st-map-late">
              <text className="st-coord" x={AOI.x} y={AOI.y + AOI.size + 28} textAnchor="middle">74.20° E</text>
              <text className="st-coord" x={AOI.x + AOI.size} y={AOI.y + AOI.size + 28} textAnchor="middle">74.45° E</text>
              <text className="st-coord" x={AOI.x - 12} y={AOI.y + 6} textAnchor="end">31.60° N</text>
              <text className="st-coord" x={AOI.x - 12} y={AOI.y + AOI.size + 6} textAnchor="end">31.40° N</text>
            </g>
            <g className="st-map-late">
              <rect x={60} y={740} width={340} height={100} rx={12} className="st-card" />
              <text x={80} y={772} className="st-card-title">NDVI</text>
              <rect x={80} y={786} width={300} height={14} rx={3} fill="url(#st-ndvi-ramp)" />
              <text x={80} y={822} className="st-card-sub">−0.4 water</text>
              <text x={380} y={822} className="st-card-sub" textAnchor="end">0.75 dense crops</text>
            </g>
            <g className="st-map-late">
              <rect x={60} y={60} width={660} height={84} rx={12} className="st-card" />
              <text x={84} y={96} className="st-card-title">Sentinel-2_74.3250_31.5000_2024-06-01_2024-08-31.tif</text>
              <text x={84} y={124} className="st-card-sub">Saved · NDVI · float32 GeoTIFF · EPSG:4326</text>
            </g>
          </g>
        </svg>
      </div>
    </section>
  );
}
