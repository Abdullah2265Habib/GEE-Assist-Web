import { useId } from "react";
import { LAND_PATH } from "./land-path";
import "./earth-loader.css";

interface Props {
  /** What is loading, e.g. "Loading the 3D model". */
  label?: string;
  /** The current step, shown under the label. */
  detail?: string;
  /** 0 to 1. Leave out when progress is unknown. */
  progress?: number;
  /** Diameter of the globe in pixels. */
  size?: number;
  className?: string;
}

/**
 * A rotating Earth with a satellite circling it, shown while something heavy loads.
 * The continents scroll behind a shaded disc, which reads as a turning globe; the
 * animation is a CSS transform, so it keeps turning while the page is busy.
 */
export default function EarthLoader({ label = "Loading…", detail, progress, size = 132, className = "" }: Props) {
  const id = useId().replace(/:/g, "");
  const pct = progress === undefined ? undefined : Math.round(Math.min(1, Math.max(0, progress)) * 100);
  return (
    <div className={`earth-loader ${className}`} role="status" aria-live="polite">
      <div className="earth-loader-globe" style={{ width: size, height: size }}>
        <svg viewBox="0 0 100 100" aria-hidden="true">
          <defs>
            <clipPath id={`earth-loader-disc-${id}`}>
              <circle cx="50" cy="50" r="46" />
            </clipPath>
            <radialGradient id={`earth-loader-sea-${id}`} cx="38%" cy="32%" r="75%">
              <stop offset="0" stopColor="#3f8fd0" />
              <stop offset="0.6" stopColor="#1d5f97" />
              <stop offset="1" stopColor="#0c3559" />
            </radialGradient>
            <radialGradient id={`earth-loader-shade-${id}`} cx="36%" cy="30%" r="72%">
              <stop offset="0" stopColor="#ffffff" stopOpacity="0.28" />
              <stop offset="0.45" stopColor="#ffffff" stopOpacity="0" />
              <stop offset="0.8" stopColor="#020c14" stopOpacity="0.35" />
              <stop offset="1" stopColor="#020c14" stopOpacity="0.7" />
            </radialGradient>
          </defs>
          <circle className="earth-loader-glow" cx="50" cy="50" r="48.5" />
          <circle cx="50" cy="50" r="46" fill={`url(#earth-loader-sea-${id})`} />
          <g clipPath={`url(#earth-loader-disc-${id})`}>
            {/* Two copies of the map side by side, scrolled one map-width per turn. */}
            <g className="earth-loader-land" transform="translate(4 4) scale(0.92)">
              <g className="earth-loader-spin">
                <path d={LAND_PATH} />
                <path d={LAND_PATH} transform="translate(-200 0)" />
              </g>
            </g>
          </g>
          <circle cx="50" cy="50" r="46" fill={`url(#earth-loader-shade-${id})`} />
        </svg>
        {/* The orbit is drawn twice: its far half behind the globe, its near half in front. */}
        {(["is-back", "is-front"] as const).map((side) => (
          <div
            key={side}
            className={`earth-loader-orbit ${side}`}
            aria-hidden="true"
            style={{ ["--ry" as string]: `${size * 0.19}px` }}
          >
            <span className="earth-loader-ring" />
            <span className="earth-loader-sat-x">
              <i />
            </span>
          </div>
        ))}
      </div>
      <div className="earth-loader-text">
        <strong>{label}</strong>
        {detail && <span>{detail}</span>}
      </div>
      {pct !== undefined && (
        <div className="earth-loader-bar" aria-hidden="true">
          <div style={{ width: `${pct}%` }} />
        </div>
      )}
    </div>
  );
}
