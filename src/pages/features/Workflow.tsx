import { CountUp } from "../../components/motion/motion";
import { Chapter } from "../../components/newpages/NewLayout";

const FLOW = [
  {
    icon: "key",
    title: "Your own keys",
    body: "The first sign-in asks for your Earth Engine project ID and a Gemini API key, with the steps to get both. The key is kept in Windows Credential Manager, never in a file.",
  },
  {
    icon: "folder",
    title: "Create a project",
    body: "Everything you do lives in a project folder: downloads, analysis results, AI explanations and PDF reports. Rename it or move it and everything follows.",
  },
  {
    icon: "down",
    title: "Download",
    body: "The parameter form says only what to download, and the GeoTIFF lands in the project's downloads folder. Save to… copies it anywhere else.",
  },
  {
    icon: "chart",
    title: "Analyse",
    body: "Pick one of four analyses and its processes. Processes the dataset cannot run are folded away with the reason. It runs on an NVIDIA GPU when there is one.",
  },
  {
    icon: "eye",
    title: "Look at it",
    body: "The viewer shows true colour, false colour, NDVI, NDWI, land cover or any band, with the value under the pointer and the legend for the view.",
  },
  {
    icon: "spark",
    title: "Explain with AI",
    body: "Gemini is sent the result GeoTIFF, a preview of each layer and all the metadata, and writes an explanation that is kept in the project.",
  },
  {
    icon: "pdf",
    title: "Make a PDF report",
    body: "One click turns an explanation into an A4 PDF with the result's pictures, colour bars, headings and tables. Export it anywhere.",
  },
] as const;

function FlowGlyph({ name }: { name: (typeof FLOW)[number]["icon"] }) {
  const common = { width: 24, height: 24, fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round" } as const;
  switch (name) {
    case "key":
      return (
        <svg viewBox="0 0 24 24" {...common}>
          <circle cx="8" cy="15" r="4" />
          <path d="M11 12l8-8M16 7l2 2M14 9l2 2" />
        </svg>
      );
    case "folder":
      return (
        <svg viewBox="0 0 24 24" {...common}>
          <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
        </svg>
      );
    case "down":
      return (
        <svg viewBox="0 0 24 24" {...common}>
          <path d="M12 3v12M7 10l5 5 5-5M4 19h16" />
        </svg>
      );
    case "chart":
      return (
        <svg viewBox="0 0 24 24" {...common}>
          <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
        </svg>
      );
    case "eye":
      return (
        <svg viewBox="0 0 24 24" {...common}>
          <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      );
    case "spark":
      return (
        <svg viewBox="0 0 24 24" {...common}>
          <path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z" />
          <path d="M19 16l.7 1.8 1.8.7-1.8.7L19 21l-.7-1.8-1.8-.7 1.8-.7z" />
        </svg>
      );
    case "pdf":
      return (
        <svg viewBox="0 0 24 24" {...common}>
          <path d="M6 2h9l5 5v15H6z" />
          <path d="M14 2v6h6M9 14h6M9 17h4" />
        </svg>
      );
  }
}

/** The hero picture: the new workflow as a loop, with a pulse travelling round it. */
function OrbitArt() {
  const nodes = FLOW.map((s, i) => {
    const a = (i / FLOW.length) * Math.PI * 2 - Math.PI / 2;
    return { ...s, x: 200 + Math.cos(a) * 140, y: 200 + Math.sin(a) * 140 };
  });
  return (
    <div className="orbit-art">
      <svg viewBox="0 0 400 400" role="img" aria-label="The new workflow: keys, project, download, analyse, view, explain, report">
        <defs>
          <linearGradient id="orbit-grad" x1="0" x2="1" y1="0" y2="1">
            <stop offset="0" stopColor="var(--fx-a)" />
            <stop offset="1" stopColor="var(--fx-b)" />
          </linearGradient>
        </defs>
        <circle cx="200" cy="200" r="140" className="orbit-ring" />
        <circle cx="200" cy="200" r="140" className="orbit-ring-dash" stroke="url(#orbit-grad)" />
        <circle cx="200" cy="200" r="78" className="orbit-core" />
        <text x="200" y="194" className="orbit-core-t1">
          GEE-Assist
        </text>
        <text x="200" y="216" className="orbit-core-t2">
          what's new
        </text>
        <circle r="6" className="orbit-pulse">
          <animateMotion dur="9s" repeatCount="indefinite" path="M200,60 a140,140 0 1,1 -0.01,0" />
        </circle>
        {nodes.map((n, i) => (
          <g key={n.title} className="orbit-node" style={{ animationDelay: `${i * 0.12}s` }} transform={`translate(${n.x} ${n.y})`}>
            <circle r="26" />
            <g transform="translate(-12 -12)" className="orbit-node-icon">
              <FlowGlyph name={n.icon} />
            </g>
          </g>
        ))}
      </svg>
    </div>
  );
}

export function WorkflowChapter() {
  return (
    <>
      <Chapter
        id="workflow"
        eyebrow="The whole workflow"
        title={
          <>
            From a download tool to a <span className="grad-text">full workflow</span>
          </>
        }
        lede="GEE-Assist now keeps your work in projects, runs four analyses on what you download, shows the result in a proper viewer, asks Gemini to explain it and writes the explanation up as a PDF report."
        art={<OrbitArt />}
      >
        <dl className="new-stats">
          <div>
            <dt>analyses</dt>
            <dd>
              <CountUp to={4} />
            </dd>
          </div>
          <div>
            <dt>indices and methods</dt>
            <dd>
              <CountUp to={79} />
            </dd>
          </div>
          <div>
            <dt>sub-types</dt>
            <dd>
              <CountUp to={15} />
            </dd>
          </div>
          <div>
            <dt>new pages here</dt>
            <dd>
              <CountUp to={3} />
            </dd>
          </div>
        </dl>
      </Chapter>
    </>
  );
}
