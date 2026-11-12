import { useEffect, useMemo, useRef, useState } from "react";
import { geoBounds, geoCentroid, geoGraticule10, geoOrthographic, geoPath, geoInterpolate } from "d3-geo";
import { feature } from "topojson-client";
import type { Feature, FeatureCollection, Geometry } from "geojson";
import type { GeometryCollection, Topology } from "topojson-specification";
import countriesTopo from "world-atlas/countries-110m.json";
import "./globe.css";

type Country = Feature<Geometry, { name: string }>;

export interface SelectedArea {
  name: string;
  /** West, south, east, north in degrees. */
  bbox: [number, number, number, number];
}

interface Props {
  onSelect?: (area: SelectedArea | null) => void;
}

const SIZE = 560;

export default function Globe({ onSelect }: Props) {
  const countries = useMemo(() => {
    const topo = countriesTopo as unknown as Topology<{ countries: GeometryCollection<{ name: string }> }>;
    return (feature(topo, topo.objects.countries) as FeatureCollection<Geometry, { name: string }>).features.filter(
      (f) => f.properties.name !== "Antarctica",
    ) as Country[];
  }, []);

  const projection = useMemo(
    () => geoOrthographic().scale(SIZE / 2 - 8).translate([SIZE / 2, SIZE / 2]).clipAngle(90).rotate([-70, -22, 0]),
    [],
  );
  const path = useMemo(() => geoPath(projection), [projection]);
  const graticule = useMemo(() => geoGraticule10(), []);

  const svgRef = useRef<SVGSVGElement>(null);
  const countryRefs = useRef<(SVGPathElement | null)[]>([]);
  const gratRef = useRef<SVGPathElement>(null);
  const selectedRef = useRef<number | null>(null);
  const spinning = useRef(true);
  const [selected, setSelected] = useState<number | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);

  const redraw = () => {
    countryRefs.current.forEach((el, i) => {
      if (el) el.setAttribute("d", path(countries[i]) ?? "");
    });
    gratRef.current?.setAttribute("d", path(graticule) ?? "");
  };

  // Idle spin (stops while dragging, after a selection, and for reduced motion).
  useEffect(() => {
    redraw();
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) spinning.current = false;
    let raf = 0;
    let last = performance.now();
    let visible = true;
    const io = new IntersectionObserver(([e]) => (visible = e.isIntersecting));
    if (svgRef.current) io.observe(svgRef.current);
    const tick = (now: number) => {
      const dt = now - last;
      last = now;
      if (spinning.current && visible) {
        const [l, p, g] = projection.rotate();
        projection.rotate([l + dt * 0.006, p, g]);
        redraw();
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Drag to rotate.
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    let start: { x: number; y: number; rot: [number, number, number] } | null = null;
    let moved = false;
    const down = (e: PointerEvent) => {
      start = { x: e.clientX, y: e.clientY, rot: projection.rotate() as [number, number, number] };
      moved = false;
      spinning.current = false;
    };
    const move = (e: PointerEvent) => {
      if (!start) return;
      const dx = e.clientX - start.x;
      const dy = e.clientY - start.y;
      if (!moved && Math.hypot(dx, dy) < 4) return;
      if (!moved) svg.setPointerCapture(e.pointerId);
      moved = true;
      const k = 0.35 * (SIZE / svg.getBoundingClientRect().width);
      const phi = Math.max(-80, Math.min(80, start.rot[1] - dy * k));
      projection.rotate([start.rot[0] + dx * k, phi, start.rot[2]]);
      redraw();
    };
    const up = (e: PointerEvent) => {
      if (svg.hasPointerCapture(e.pointerId)) svg.releasePointerCapture(e.pointerId);
      start = null;
      // A click without a drag is handled by the country's own onClick.
      if (moved) svg.dataset.dragged = "1";
      else delete svg.dataset.dragged;
    };
    svg.addEventListener("pointerdown", down);
    svg.addEventListener("pointermove", move);
    svg.addEventListener("pointerup", up);
    svg.addEventListener("pointercancel", up);
    return () => {
      svg.removeEventListener("pointerdown", down);
      svg.removeEventListener("pointermove", move);
      svg.removeEventListener("pointerup", up);
      svg.removeEventListener("pointercancel", up);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const rotateTo = (lonLat: [number, number]) => {
    const from = projection.rotate();
    const to: [number, number] = [-lonLat[0], Math.max(-60, Math.min(60, -lonLat[1]))];
    // Take the short way round.
    let dl = to[0] - from[0];
    dl = ((dl + 540) % 360) - 180;
    const interp = geoInterpolate([from[0], from[1]], [from[0] + dl, to[1]]);
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const duration = reduce ? 0 : 900;
    const t0 = performance.now();
    const step = (now: number) => {
      const t = duration === 0 ? 1 : Math.min(1, (now - t0) / duration);
      const e = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
      const [l, p] = interp(e);
      projection.rotate([l, p, 0]);
      redraw();
      if (t < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  };

  const select = (i: number | null) => {
    selectedRef.current = i;
    setSelected(i);
    if (i === null) {
      onSelect?.(null);
      spinning.current = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      return;
    }
    spinning.current = false;
    const c = countries[i];
    const [[w, s], [e, n]] = geoBounds(c);
    onSelect?.({ name: c.properties.name, bbox: [w, s, e, n] });
    rotateTo(geoCentroid(c) as [number, number]);
  };

  const onCountryClick = (i: number) => {
    if (svgRef.current?.dataset.dragged) return;
    select(selectedRef.current === i ? null : i);
  };

  return (
    <div className="globe">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        className="globe-svg"
        role="img"
        aria-label="Globe of the world's countries. Drag to rotate, select a country to use it as an area of interest."
      >
        <defs>
          <radialGradient id="globe-shade" cx="38%" cy="32%" r="75%">
            <stop offset="0%" stopColor="var(--globe-ocean-hi)" />
            <stop offset="100%" stopColor="var(--globe-ocean)" />
          </radialGradient>
        </defs>
        <circle cx={SIZE / 2} cy={SIZE / 2} r={SIZE / 2 - 8} className="globe-ocean" fill="url(#globe-shade)" />
        <path ref={gratRef} className="globe-graticule" />
        {countries.map((c, i) => (
          <path
            key={i}
            ref={(el) => {
              countryRefs.current[i] = el;
            }}
            className={`globe-country${selected === i ? " is-selected" : ""}`}
            onClick={() => onCountryClick(i)}
            onPointerEnter={() => setHovered(c.properties.name)}
            onPointerLeave={() => setHovered(null)}
          >
            <title>{c.properties.name}</title>
          </path>
        ))}
        <circle cx={SIZE / 2} cy={SIZE / 2} r={SIZE / 2 - 8} className="globe-rim" />
      </svg>
      <div className="globe-hover" aria-hidden="true">
        {hovered ?? " "}
      </div>
      <label className="globe-picker">
        <span className="visually-hidden">Choose a country</span>
        <select
          className="select"
          value={selected ?? ""}
          onChange={(e) => select(e.target.value === "" ? null : Number(e.target.value))}
        >
          <option value="">Choose a country…</option>
          {countries
            .map((c, i) => ({ name: c.properties.name, i }))
            .sort((a, b) => a.name.localeCompare(b.name))
            .map(({ name, i }) => (
              <option key={i} value={i}>
                {name}
              </option>
            ))}
        </select>
      </label>
    </div>
  );
}
