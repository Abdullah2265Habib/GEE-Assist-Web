/* The desktop side bar's icons, redrawn as SVG. Each one animates while its row is hovered
   (the animation lives in new-pages.css under .sbd li:hover). */

export type SideIconName = "query" | "downloads" | "analysis" | "explain" | "terminal";

const stroke = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.7,
  strokeLinecap: "round",
  strokeLinejoin: "round",
} as const;

export function SideIcon({ name }: { name: SideIconName }) {
  switch (name) {
    case "query":
      return (
        <svg viewBox="0 0 24 24" className="si si-query" aria-hidden="true">
          <rect x="4" y="3" width="13" height="18" rx="2" {...stroke} />
          <path className="si-line si-l1" d="M7 8h7" {...stroke} />
          <path className="si-line si-l2" d="M7 12h7" {...stroke} />
          <path className="si-line si-l3" d="M7 16h4" {...stroke} />
          <g className="si-pencil">
            <path d="M15 19l6-6 1.6 1.6-6 6H15z" {...stroke} />
          </g>
        </svg>
      );
    case "downloads":
      return (
        <svg viewBox="0 0 24 24" className="si si-downloads" aria-hidden="true">
          <path d="M4 15v4a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-4" {...stroke} />
          <g className="si-arrow">
            <path d="M12 3v11M8 10l4 4 4-4" {...stroke} />
          </g>
        </svg>
      );
    case "analysis":
      return (
        <svg viewBox="0 0 24 24" className="si si-analysis" aria-hidden="true">
          <path className="si-bar si-b1" d="M5 20v-5" {...stroke} />
          <path className="si-bar si-b2" d="M9 20v-9" {...stroke} />
          <path className="si-bar si-b3" d="M13 20v-6" {...stroke} />
          <path d="M3 20h18" {...stroke} />
          <g className="si-lens">
            <circle cx="17" cy="7" r="3.2" {...stroke} />
            <path d="M19.3 9.3l2 2" {...stroke} />
          </g>
        </svg>
      );
    case "explain":
      return (
        <svg viewBox="0 0 24 24" className="si si-explain" aria-hidden="true">
          <path d="M4 5h12a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H9l-4 3v-3H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z" {...stroke} />
          <path className="si-line si-l1" d="M6 9h8" {...stroke} />
          <path className="si-line si-l2" d="M6 12h5" {...stroke} />
          <path
            className="si-sparkle"
            d="M20 2l.8 2.2L23 5l-2.2.8L20 8l-.8-2.2L17 5l2.2-.8z"
            fill="currentColor"
            stroke="none"
          />
        </svg>
      );
    case "terminal":
      return (
        <svg viewBox="0 0 24 24" className="si si-terminal" aria-hidden="true">
          <rect x="2.5" y="4" width="19" height="16" rx="2" {...stroke} />
          <path d="M6 10l3 2.5L6 15" {...stroke} />
          <path className="si-caret" d="M11 15h6" {...stroke} />
        </svg>
      );
  }
}
