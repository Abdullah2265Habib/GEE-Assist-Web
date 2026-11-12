import { useState } from "react";

const WORDS = ["", "Poor", "Fair", "Good", "Very good", "Excellent"];

function Star({ filled }: { filled: boolean }) {
  return (
    <svg viewBox="0 0 24 24" width="100%" height="100%" aria-hidden="true">
      <path
        d="M12 2.8l2.8 5.9 6.4.8-4.7 4.4 1.2 6.4L12 17.2l-5.7 3.1 1.2-6.4L2.8 9.5l6.4-.8z"
        fill={filled ? "var(--star)" : "none"}
        stroke={filled ? "var(--star)" : "var(--border-strong)"}
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** A radio group of five stars. Arrow keys work because the inputs are real radios. */
export default function Stars({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [hover, setHover] = useState(0);
  const shown = hover || value;
  return (
    <div className="stars-input" onPointerLeave={() => setHover(0)}>
      <div className="stars" role="radiogroup" aria-label="Rating">
        {[1, 2, 3, 4, 5].map((n) => (
          <label key={n} className="star" onPointerEnter={() => setHover(n)}>
            <input type="radio" name="stars" value={n} checked={value === n} onChange={() => onChange(n)} className="visually-hidden" />
            <Star filled={n <= shown} />
            <span className="visually-hidden">
              {n} star{n > 1 ? "s" : ""}, {WORDS[n]}
            </span>
          </label>
        ))}
      </div>
      <span className="stars-word" aria-hidden="true">
        {WORDS[shown] || "Choose 1 to 5 stars"}
      </span>
    </div>
  );
}

export function StarsDisplay({ value, size = 16 }: { value: number; size?: number }) {
  return (
    <span className="stars-display" role="img" aria-label={`${value} out of 5 stars`} style={{ height: size }}>
      {[1, 2, 3, 4, 5].map((n) => (
        <span key={n} style={{ width: size, height: size, display: "inline-block" }}>
          <Star filled={n <= Math.round(value)} />
        </span>
      ))}
    </span>
  );
}
