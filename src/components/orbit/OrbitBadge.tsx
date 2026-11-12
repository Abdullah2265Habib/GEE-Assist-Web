import { useEffect, useMemo, useRef } from "react";
import { geoGraticule10, geoOrthographic, geoPath } from "d3-geo";
import { feature } from "topojson-client";
import type { Feature, FeatureCollection, Geometry } from "geojson";
import type { GeometryCollection, Topology } from "topojson-specification";
import countriesTopo from "world-atlas/countries-110m.json";
import "./orbit-badge.css";

/**
 * A small animated scene: the Earth turning, three satellites on tilted orbits that pass
 * behind and in front of it, and the lead satellite now and then imaging the surface
 * (a scan beam, a ripple where it lands, and data rising back to the satellite).
 */

const C = 100;
const R = 50;

interface Orbit {
  rx: number;
  ry: number;
  tilt: number;
  /** Seconds per revolution. */
  period: number;
  phase: number;
  scale: number;
}

const ORBITS: Orbit[] = [
  { rx: 84, ry: 24, tilt: (-16 * Math.PI) / 180, period: 10, phase: 0.2, scale: 1.3 },
  { rx: 72, ry: 38, tilt: (38 * Math.PI) / 180, period: 15, phase: 2.4, scale: 1.05 },
  { rx: 93, ry: 13, tilt: (9 * Math.PI) / 180, period: 21, phase: 4.1, scale: 0.85 },
];

/** Position on the tilted ellipse and whether it is on the near side of the planet. */
function onOrbit(o: Orbit, angle: number) {
  const lx = o.rx * Math.cos(angle);
  const ly = o.ry * Math.sin(angle);
  const c = Math.cos(o.tilt);
  const s = Math.sin(o.tilt);
  return { x: C + lx * c - ly * s, y: C + lx * s + ly * c, front: Math.sin(angle) > 0 };
}

function ellipsePath(o: Orbit, from: number, to: number, steps = 64) {
  let d = "";
  for (let i = 0; i <= steps; i++) {
    const p = onOrbit(o, from + ((to - from) * i) / steps);
    d += `${i ? "L" : "M"}${p.x.toFixed(2)} ${p.y.toFixed(2)}`;
  }
  return d;
}

const STARS = Array.from({ length: 22 }, (_, i) => ({
  x: (i * 83 + 17) % 200,
  y: (i * 47 + 31) % 200,
  r: i % 5 === 0 ? 1.1 : 0.6,
  delay: (i * 0.37) % 3,
}));

function Satellite({ scale }: { scale: number }) {
  return (
    <g transform={`scale(${scale})`}>
      <rect className="ob-panel" x={-12} y={-2.2} width={8} height={4.4} rx={0.6} />
      <rect className="ob-panel" x={4} y={-2.2} width={8} height={4.4} rx={0.6} />
      <line className="ob-strut" x1={-4} y1={0} x2={4} y2={0} />
      <rect className="ob-body" x={-2.8} y={-3.4} width={5.6} height={6.8} rx={1} />
      <circle className="ob-lens" cx={0} cy={3.2} r={1.1} />
    </g>
  );
}

export default function OrbitBadge({ size = 200, label }: { size?: number; label?: string }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const countries = useMemo(() => {
    const topo = countriesTopo as unknown as Topology<{ countries: GeometryCollection<{ name: string }> }>;
    return (feature(topo, topo.objects.countries) as FeatureCollection<Geometry, { name: string }>).features as Feature<Geometry, { name: string }>[];
  }, []);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const projection = geoOrthographic().scale(R).translate([C, C]).clipAngle(90);
    const path = geoPath(projection);
    const graticule = geoGraticule10();
    const countryEls = Array.from(svg.querySelectorAll<SVGPathElement>(".ob-country"));
    const gratEl = svg.querySelector<SVGPathElement>(".ob-graticule")!;
    const sats = Array.from(svg.querySelectorAll<SVGGElement>(".ob-sat"));
    const satMovers = Array.from(svg.querySelectorAll<SVGGElement>(".ob-sat-move"));
    const beam = svg.querySelector<SVGPolygonElement>(".ob-beam")!;
    const ripples = Array.from(svg.querySelectorAll<SVGEllipseElement>(".ob-ripple"));
    const bits = Array.from(svg.querySelectorAll<SVGCircleElement>(".ob-bit"));

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let raf = 0;
    let visible = true;
    const start = performance.now();

    const draw = (now: number) => {
      const t = reduce ? 3.2 : (now - start) / 1000;

      projection.rotate([t * 9 - 40, -18, -14]);
      countryEls.forEach((el, i) => el.setAttribute("d", path(countries[i]) ?? ""));
      gratEl.setAttribute("d", path(graticule) ?? "");

      let lead = { x: 0, y: 0, front: false };
      ORBITS.forEach((o, i) => {
        const p = onOrbit(o, o.phase + (t / o.period) * Math.PI * 2);
        if (i === 0) lead = p;
        const el = sats[i];
        satMovers[i].setAttribute("transform", `translate(${p.x.toFixed(2)} ${p.y.toFixed(2)})`);
        // Behind the planet the satellite is masked by the Earth's disc.
        if (p.front) el.removeAttribute("mask");
        else el.setAttribute("mask", "url(#ob-behind)");
        el.setAttribute("opacity", p.front ? "1" : "0.55");
      });

      // Imaging pass: when the lead satellite is on the near side and well clear of the limb,
      // it casts a beam to the point below it; a ripple spreads and data rises back up.
      const dx = lead.x - C;
      const dy = lead.y - C;
      const dist = Math.hypot(dx, dy);
      const cycle = (t % 3.2) / 3.2;
      const on = lead.front && dist > 4 && cycle < 0.7;
      if (on) {
        const ux = dx / dist;
        const uy = dy / dist;
        // The point imaged lies on the surface, a little toward the centre of the disc.
        const reach = Math.min(R - 4, Math.max(0, dist - 20));
        const gx = C + ux * reach;
        const gy = C + uy * reach;
        const w = 9;
        beam.setAttribute(
          "points",
          `${lead.x.toFixed(1)},${lead.y.toFixed(1)} ${(gx - uy * w).toFixed(1)},${(gy + ux * w).toFixed(1)} ${(gx + uy * w).toFixed(1)},${(gy - ux * w).toFixed(1)}`,
        );
        const fade = Math.sin((cycle / 0.7) * Math.PI);
        beam.setAttribute("opacity", (0.85 * fade).toFixed(2));
        ripples.forEach((rp, k) => {
          const ph = ((cycle / 0.7) * 1.4 - k * 0.35 + 1) % 1;
          rp.setAttribute("cx", gx.toFixed(1));
          rp.setAttribute("cy", gy.toFixed(1));
          rp.setAttribute("rx", (2 + ph * 14).toFixed(1));
          rp.setAttribute("ry", (1 + ph * 6).toFixed(1));
          rp.setAttribute("transform", `rotate(${((Math.atan2(uy, ux) * 180) / Math.PI + 90).toFixed(1)} ${gx.toFixed(1)} ${gy.toFixed(1)})`);
          rp.setAttribute("opacity", ((1 - ph) * fade).toFixed(2));
        });
        bits.forEach((b, k) => {
          const ph = ((cycle / 0.7) * 2.2 + k / bits.length) % 1;
          b.setAttribute("cx", (gx + (lead.x - gx) * ph + Math.sin(ph * 9 + k) * 1.5).toFixed(1));
          b.setAttribute("cy", (gy + (lead.y - gy) * ph).toFixed(1));
          b.setAttribute("opacity", (Math.sin(ph * Math.PI) * fade).toFixed(2));
        });
      } else {
        beam.setAttribute("opacity", "0");
        ripples.forEach((rp) => rp.setAttribute("opacity", "0"));
        bits.forEach((b) => b.setAttribute("opacity", "0"));
      }

      if (!reduce && visible) raf = requestAnimationFrame(draw);
    };

    const io = new IntersectionObserver(([e]) => {
      const was = visible;
      visible = e.isIntersecting;
      if (visible && !was && !reduce) raf = requestAnimationFrame(draw);
    });
    io.observe(svg);
    raf = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
    };
  }, [countries]);

  return (
    <svg
      ref={svgRef}
      className="orbit-badge"
      viewBox="0 0 200 200"
      width={size}
      height={size}
      role="img"
      aria-label={label ?? "Satellites orbiting a turning Earth, one imaging the surface"}
      aria-hidden={label ? undefined : true}
    >
      <defs>
        <radialGradient id="ob-ocean" cx="36%" cy="32%" r="75%">
          <stop offset="0%" stopColor="var(--ob-ocean-hi)" />
          <stop offset="100%" stopColor="var(--ob-ocean)" />
        </radialGradient>
        <radialGradient id="ob-atmo" cx="50%" cy="50%" r="50%">
          <stop offset="76%" stopColor="var(--ob-glow)" stopOpacity="0.55" />
          <stop offset="100%" stopColor="var(--ob-glow)" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="ob-night" x1="0" y1="0" x2="1" y2="0.35">
          <stop offset="45%" stopColor="#000" stopOpacity="0" />
          <stop offset="100%" stopColor="#000" stopOpacity="0.42" />
        </linearGradient>
        <radialGradient id="ob-shine" cx="34%" cy="28%" r="40%">
          <stop offset="0%" stopColor="#fff" stopOpacity="0.38" />
          <stop offset="100%" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="ob-beam-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--ob-beam)" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#eafff5" stopOpacity="0.7" />
        </linearGradient>
        <clipPath id="ob-earth-clip">
          <circle cx={C} cy={C} r={R} />
        </clipPath>
        {/* Hides whatever is behind the planet's disc. */}
        <mask id="ob-behind" maskUnits="userSpaceOnUse" x="0" y="0" width="200" height="200">
          <rect x="0" y="0" width="200" height="200" fill="#fff" />
          <circle cx={C} cy={C} r={R + 0.5} fill="#000" />
        </mask>
      </defs>

      <g className="ob-stars">
        {STARS.map((s, i) => (
          <circle key={i} cx={s.x} cy={s.y} r={s.r} style={{ animationDelay: `${s.delay}s` }} />
        ))}
      </g>

      {/* far halves of the orbits, under the planet */}
      {ORBITS.map((o, i) => (
        <path key={`b${i}`} className="ob-orbit ob-orbit-back" d={ellipsePath(o, Math.PI, Math.PI * 2)} />
      ))}

      <circle cx={C} cy={C} r={R + 9} fill="url(#ob-atmo)" className="ob-atmo" />
      <circle cx={C} cy={C} r={R} fill="url(#ob-ocean)" />
      <g clipPath="url(#ob-earth-clip)">
        <path className="ob-graticule" />
        {countries.map((_, i) => (
          <path key={i} className="ob-country" />
        ))}
        <circle cx={C} cy={C} r={R} fill="url(#ob-night)" />
        <circle cx={C} cy={C} r={R} fill="url(#ob-shine)" />
      </g>
      <circle cx={C} cy={C} r={R} className="ob-limb" />

      {/* near halves of the orbits, over the planet */}
      {ORBITS.map((o, i) => (
        <path key={`f${i}`} className="ob-orbit" d={ellipsePath(o, 0, Math.PI)} />
      ))}

      <polygon className="ob-beam" fill="url(#ob-beam-fill)" opacity={0} />
      {[0, 1, 2].map((k) => (
        <ellipse key={k} className="ob-ripple" opacity={0} />
      ))}
      {Array.from({ length: 6 }).map((_, k) => (
        <circle key={k} className="ob-bit" r={1.1} opacity={0} />
      ))}

      {ORBITS.map((o, i) => (
        <g key={i} className="ob-sat">
          <g className="ob-sat-move">
            <Satellite scale={o.scale} />
          </g>
        </g>
      ))}
    </svg>
  );
}
