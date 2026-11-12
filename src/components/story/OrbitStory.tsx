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
const FEED = { x: 600, y: 492 };
const FRAME = { x: 480, y: 230, size: 360 };
const AOI = { x: 600, y: 300, size: 400 };
const LENS = { cx: 600, cy: 450, r: 290 };
const STRIP_SCALE = 4;
const TOTAL = 6000;
const HOLD = 350;
const BINARY_ROWS = 13;
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
const bits = (n: number) => n.toString(2).padStart(8, "0");
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

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

    const updateFromTime = (t: number) => {
      drawEarth(-60 + (t / 2600) * 110);
      drawDecoder(clamp01((t - 4300) / 600));
      const c = Math.min(CHAPTERS.length - 1, Math.max(0, Math.floor((t + 120) / 1000)));
      if (c !== chapterRef.current) {
        chapterRef.current = c;
        setChapter(c);
      }
    };

    let scope: Scope | null = createScope({ root }).add(() => {
      const tl = createTimeline({
        defaults: { ease: "inOutQuad" },
        autoplay: reduced ? false : onScroll({ target: root, enter: "top top", leave: "bottom bottom", sync: 0.35 }),
        onUpdate: (self) => updateFromTime(self.currentTime),
      });
      tlRef.current = tl;
      const motion = animeSvg.createMotionPath($(".st-satpath"));

      /* 1 · In orbit */
      tl.add($(".st-sat-orbit"), { ...motion, duration: 1050, ease: "inOutSine" }, 0)
        .add(animeSvg.createDrawable($$(".st-orbit-trail")), { draw: ["0 0", "0 1"], duration: 1050, ease: "inOutSine" }, 0)

        /* 2 · Through the lens */
        .add($(".st-world"), { translateX: [0, LENS.cx - SAT_END[0]], translateY: [0, LENS.cy - SAT_END[1]], scale: [1, 7], opacity: [1, 0], duration: 650, ease: "inQuad" }, 1050)
        .add($(".st-lens"), { scale: [0.25, 1], opacity: [0, 1], duration: 450, ease: "outQuad" }, 1420)
        .add($(".st-strip"), { translateY: [0, -(scene.stripHeight * STRIP_SCALE - 2 * LENS.r - 40)], duration: 1300, ease: "linear" }, 1250)
        .add($(".st-lens-ring"), { rotate: [0, 120], duration: 1300, ease: "linear" }, 1250)
        .add($(".st-lens-scan"), { translateY: [-LENS.r, LENS.r, -LENS.r, LENS.r], duration: 1000, ease: "linear" }, 1500)
        .add($$(".st-hud"), { opacity: [0, 1], translateY: [12, 0], duration: 250, delay: stagger(60) }, 1650)

        /* 3 · Down to Earth */
        .add($(".st-lens"), { scale: [1, 0.12], translateY: [0, SAT_DOWN.y - LENS.cy], opacity: [1, 0], duration: 450, ease: "inQuad" }, 2500)
        .add($(".st-ground"), { opacity: [0, 1], duration: 120 }, 2650)
        .add($(".st-downlink"), { opacity: [0, 1], duration: 250 }, 2780)
        .add($(".st-horizon"), { translateY: [260, 0], duration: 450, ease: "outQuad" }, 2700)
        .add($$(".st-wave"), { scale: [0.15, 5.4], opacity: [0, 0.9, 0], duration: 520, delay: stagger(95) }, 2880)

        /* 4 · Caught on the ground */
        .add($(".st-dish"), { translateY: [440, 0], duration: 450, ease: "outBack(1.4)" }, 3000)
        .add($$(".st-wave"), { scale: [0.15, 5.4], opacity: [0, 0.9, 0], duration: 520, delay: stagger(95) }, 3450)
        .add($$(".st-packet"), { translateY: [0, FEED.y - SAT_DOWN.y - 30], opacity: [0, 1, 1, 0], duration: 360, delay: stagger(55) }, 3300)
        .add($(".st-dish-body"), { rotate: [0, -8, 6, -4, 2, 0], translateY: [0, -18, 0, -10, 0, 0], duration: 850, ease: "inOutSine" }, 3200)
        .add($(".st-status"), { opacity: [0, 1], translateY: [10, 0], duration: 250 }, 3350)

        /* 5 · Decoded into bands */
        .add($(".st-ground"), { scale: [1, 6], opacity: [1, 0], duration: 420, ease: "inQuad" }, 4000)
        .add($(".st-decoder"), { opacity: [0, 1], duration: 250 }, 4200)
        .add($$(".st-band"), {
          translateX: [0, 420],
          translateY: stagger(170, { start: -110 }),
          scale: [1, 150 / FRAME.size],
          opacity: [0, 1],
          duration: 380,
          delay: stagger(70),
          ease: "outQuad",
        }, 4900)

        /* 6 · Turned into answers */
        .add($$(".st-band"), { translateX: 120, translateY: stagger(170, { start: -110 }), opacity: 0, duration: 300, delay: stagger(50) }, 5150)
        .add($(".st-ndvi"), { opacity: [0, 1], duration: 250 }, 5250)
        .add($(".st-formula"), { opacity: [0, 1], translateY: [10, 0], duration: 200 }, 5200)
        .add($$(".st-decoder-chrome"), { opacity: [1, 0], duration: 250 }, 5450)
        .add($(".st-map"), { opacity: [0, 1], duration: 300 }, 5450)
        .add($(".st-result"), {
          translateX: [0, AOI.x - FRAME.x],
          translateY: [0, AOI.y - FRAME.y],
          scale: [1, AOI.size / FRAME.size],
          duration: 420,
          ease: "inOutCubic",
        }, 5500)
        .add($$(".st-map-late"), { opacity: [0, 1], translateY: [10, 0], duration: 250, delay: stagger(60) }, 5800)
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
    window.scrollTo({ top: top + (range * (i * 1000 + 150)) / (TOTAL + HOLD), behavior: "smooth" });
  };

  const [satX, satY] = SAT_END;
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
            <linearGradient id="st-ground-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#2c5e4c" />
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
          <g className="st-world" style={{ transformOrigin: `${satX}px ${satY}px` }}>
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
          <g className="st-lens" style={{ transformOrigin: `${LENS.cx}px ${LENS.cy}px`, opacity: 0 }}>
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
          <g className="st-ground" style={{ transformOrigin: `${FEED.x}px ${FEED.y}px`, opacity: 0 }}>
            <g className="st-downlink" style={{ opacity: 0 }}>
              <g className="st-waves">
                {[0, 1, 2, 3, 4].map((i) => (
                  <use key={i} href="#st-wave-shape" className="st-wave" x={SAT_DOWN.x} y={SAT_DOWN.y + 20} style={{ transformOrigin: `${SAT_DOWN.x}px ${SAT_DOWN.y + 20}px`, opacity: 0 }} />
                ))}
              </g>
              <g className="st-packets">
                {Array.from({ length: 8 }).map((_, i) => (
                  <rect key={i} className="st-packet" x={SAT_DOWN.x - 7 + ((i % 3) - 1) * 18} y={SAT_DOWN.y + 30} width={14} height={9} rx={2} style={{ opacity: 0 }} />
                ))}
              </g>
              <g transform={`translate(${SAT_DOWN.x} ${SAT_DOWN.y}) scale(1.25)`}>
                <SatelliteShape />
              </g>
            </g>
            <g className="st-horizon" style={{ transform: "translateY(260px)" }}>
              <circle cx={600} cy={1215} r={560} fill="url(#st-ground-fill)" />
              <circle cx={600} cy={1215} r={560} className="st-atmosphere" />
            </g>
            <g className="st-dish" style={{ transform: "translateY(440px)" }}>
              <g className="st-dish-body" style={{ transformOrigin: "600px 700px" }}>
                <g transform="translate(600 612)">
                  <line className="st-dish-strut" x1={-92} y1={-28} x2={0} y2={-120} />
                  <line className="st-dish-strut" x1={92} y1={-28} x2={0} y2={-120} />
                  <line className="st-dish-strut" x1={0} y1={18} x2={0} y2={-120} />
                  <path className="st-dish-bowl" d="M -125 -30 Q 0 85 125 -30 Z" />
                  <ellipse className="st-dish-rim" cx={0} cy={-30} rx={125} ry={20} />
                  <circle className="st-dish-feed" cx={0} cy={-122} r={9} />
                  <rect className="st-dish-neck" x={-14} y={22} width={28} height={70} />
                </g>
              </g>
              <path className="st-dish-base" d="M 545 712 L 655 712 L 640 690 L 560 690 Z" />
            </g>
            <g className="st-status" style={{ opacity: 0 }}>
              <rect x={760} y={560} width={330} height={78} rx={12} />
              <text x={782} y={592}>Receiving · 4 MB pieces</text>
              <text x={782} y={620} className="st-status-sub">8 at a time · written to disk on arrival</text>
            </g>
          </g>

          {/* 6 · Map */}
          <g className="st-map" style={{ opacity: 0 }} clipPath="url(#st-screen-clip)">
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
          <g className="st-decoder" style={{ opacity: 0 }}>
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
              <image className="st-ndvi" href={scene.ndvi} x={FRAME.x} y={FRAME.y} width={FRAME.size} height={FRAME.size} style={{ imageRendering: "pixelated", opacity: 0 }} />
              <line className="st-reveal-scan" x1={FRAME.x - 10} x2={FRAME.x + FRAME.size + 10} y1={FRAME.y} y2={FRAME.y} />
              <rect x={FRAME.x} y={FRAME.y} width={FRAME.size} height={FRAME.size} className="st-frame" />
            </g>
            {scene.bands.map((b) => (
              <g key={b.id} className="st-band" style={{ transformOrigin: `${FRAME.x}px ${FRAME.y}px`, opacity: 0 }}>
                <image href={b.url} x={FRAME.x} y={FRAME.y} width={FRAME.size} height={FRAME.size} style={{ imageRendering: "pixelated" }} />
                <rect x={FRAME.x} y={FRAME.y} width={FRAME.size} height={FRAME.size} className="st-frame" style={{ stroke: b.colour }} />
                <text x={FRAME.x + FRAME.size + 30} y={FRAME.y + FRAME.size / 2 + 14} className="st-band-label" style={{ fill: b.colour }}>
                  {b.label}
                </text>
              </g>
            ))}
            <text className="st-formula st-decoder-chrome" x={FRAME.x + FRAME.size / 2} y={FRAME.y + FRAME.size + 60} textAnchor="middle" style={{ opacity: 0 }}>
              NDVI = (B8 − B4) / (B8 + B4)
            </text>
          </g>

          {/* The result sits above the map once it lands in the area box. */}
          <g className="st-map-late-layer">
            <g className="st-map-late" style={{ opacity: 0 }}>
              <text className="st-coord" x={AOI.x} y={AOI.y + AOI.size + 28} textAnchor="middle">74.20° E</text>
              <text className="st-coord" x={AOI.x + AOI.size} y={AOI.y + AOI.size + 28} textAnchor="middle">74.45° E</text>
              <text className="st-coord" x={AOI.x - 12} y={AOI.y + 6} textAnchor="end">31.60° N</text>
              <text className="st-coord" x={AOI.x - 12} y={AOI.y + AOI.size + 6} textAnchor="end">31.40° N</text>
            </g>
            <g className="st-map-late" style={{ opacity: 0 }}>
              <rect x={60} y={740} width={340} height={100} rx={12} className="st-card" />
              <text x={80} y={772} className="st-card-title">NDVI</text>
              <rect x={80} y={786} width={300} height={14} rx={3} fill="url(#st-ndvi-ramp)" />
              <text x={80} y={822} className="st-card-sub">−0.4 water</text>
              <text x={380} y={822} className="st-card-sub" textAnchor="end">0.75 dense crops</text>
            </g>
            <g className="st-map-late" style={{ opacity: 0 }}>
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
