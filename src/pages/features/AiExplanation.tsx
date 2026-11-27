import { useState, type ReactNode } from "react";
import { Reveal, useInView, useTypewriter } from "../../components/motion/motion";
import { Chapter, SectionHead } from "../../components/newpages/NewLayout";
import { viewUrl } from "../../components/raster/scene";

/** Hero picture: the three inputs flowing into the AI, and an explanation coming out. */
function FlowArt() {
  const inputs = [
    { y: 70, label: "Result GeoTIFF" },
    { y: 150, label: "PNG previews" },
    { y: 230, label: "Metadata + prompt" },
  ];
  return (
    <div className="ai-art">
      <svg viewBox="0 0 420 300" role="img" aria-label="The GeoTIFF, previews and metadata go to the AI, which returns an explanation">
        <defs>
          <linearGradient id="ai-grad" x1="0" x2="1">
            <stop offset="0" stopColor="var(--fx-b)" />
            <stop offset="1" stopColor="var(--fx-a)" />
          </linearGradient>
        </defs>
        {inputs.map((p, i) => {
          const d = `M120,${p.y} C175,${p.y} 175,150 222,150`;
          return (
            <g key={p.label}>
              <path d={d} className="ai-wire" />
              <circle r="4" className="ai-packet">
                <animateMotion dur="2.4s" begin={`${i * 0.6}s`} repeatCount="indefinite" path={d} />
              </circle>
              <g className="ai-in" style={{ animationDelay: `${i * 0.15}s` }}>
                <rect x="6" y={p.y - 17} width="114" height="34" rx="9" />
                <text x="63" y={p.y + 4}>
                  {p.label}
                </text>
              </g>
            </g>
          );
        })}
        <path d="M282,150 C310,150 310,150 330,150" className="ai-wire" />
        <circle r="4" className="ai-packet ai-packet-out">
          <animateMotion dur="1.2s" repeatCount="indefinite" path="M282,150 L330,150" />
        </circle>
        <g className="ai-core">
          <circle cx="252" cy="150" r="32" fill="url(#ai-grad)" />
          <path
            className="ai-star"
            d="M252 130l5 13 13 5-13 5-5 13-5-13-13-5 13-5z"
            fill="var(--fx-on)"
          />
        </g>
        <g className="ai-doc">
          <rect x="332" y="96" width="80" height="108" rx="8" />
          <rect x="342" y="110" width="44" height="7" rx="3" className="ai-doc-h" />
          {[0, 1, 2, 3, 4, 5].map((k) => (
            <rect key={k} x="342" y={126 + k * 11} width={k % 3 === 2 ? 40 : 60} height="5" rx="2.5" className="ai-doc-l" style={{ animationDelay: `${k * 0.25}s` }} />
          ))}
        </g>
        <text x="372" y="222" className="ai-doc-cap">
          explanation.md
        </text>
      </svg>
    </div>
  );
}

const SENT: { t: string; items: [string, string][] }[] = [
  {
    t: "Analysis",
    items: [
      ["Analysis", "Vegetation"],
      ["Processes", "NDVI (NIR − Red) / (NIR + Red), EVI"],
      ["Parameters", "SAVI L = 0.5"],
      ["Ran on", "GPU · 3.8 s"],
    ],
  },
  {
    t: "Before the analysis",
    items: [
      ["Satellite", "Sentinel-2"],
      ["Dates", "2024-05-01 → 2024-08-31"],
      ["Bands", "B2 B3 B4 B8 B11 B12"],
      ["Size", "4 210 × 3 980 px, 10 m"],
      ["Coordinates", "EPSG:32643, centre 74.34, 31.52"],
      ["Area", "1 675 km²"],
    ],
  },
  {
    t: "After the analysis",
    items: [
      ["Layers", "NDVI (red → green, −0.2 … 0.8), EVI"],
      ["Data type", "float32, no-data NaN"],
      ["Numbers", "mean NDVI 0.41, 22 % above 0.6"],
      ["File size", "128 MB"],
    ],
  },
];

const EXAMPLE = `## Summary
Most of the area is moderately green: the mean NDVI is **0.41**, typical of irrigated farmland in early summer.

## What the layers show
- **NDVI** is highest (above 0.6) in the canal-fed fields to the south-east.
- The built-up centre stays below 0.2.
- **EVI** follows NDVI but separates the densest fields better.

## Numbers
| Layer | Mean | Above 0.6 |
|---|---|---|
| NDVI | 0.41 | 22 % |
| EVI | 0.33 | 9 % |

## Caveats
A median composite over four months hides short events such as a harvest.`;

/** A small Markdown renderer for the example: headings, lists, tables and bold. */
function Md({ text }: { text: string }) {
  const bold = (s: string): ReactNode[] =>
    s.split(/(\*\*[^*]+\*\*)/).map((p, i) => (p.startsWith("**") && p.endsWith("**") ? <strong key={i}>{p.slice(2, -2)}</strong> : p));
  const lines = text.split("\n");
  const out: ReactNode[] = [];
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (l.startsWith("## ")) out.push(<h4 key={i}>{l.slice(3)}</h4>);
    else if (l.startsWith("- ")) {
      const items = [];
      while (i < lines.length && lines[i].startsWith("- ")) items.push(<li key={i}>{bold(lines[i++].slice(2))}</li>);
      i--;
      out.push(<ul key={`u${i}`}>{items}</ul>);
    } else if (l.startsWith("|")) {
      const rows: string[][] = [];
      while (i < lines.length && lines[i].startsWith("|")) {
        const cells = lines[i++].split("|").slice(1, -1).map((c) => c.trim());
        if (!cells.every((c) => /^-+$/.test(c))) rows.push(cells);
      }
      i--;
      const [head, ...body] = rows;
      out.push(
        <table key={`t${i}`} className="md-table">
          <thead>
            <tr>{head?.map((c, k) => <th key={k}>{c}</th>)}</tr>
          </thead>
          <tbody>
            {body.map((r, k) => (
              <tr key={k}>{r.map((c, j) => <td key={j}>{c}</td>)}</tr>
            ))}
          </tbody>
        </table>,
      );
    } else if (l.trim()) out.push(<p key={i}>{bold(l)}</p>);
  }
  return <>{out}</>;
}

function ExplanationPage() {
  const [ref, inView] = useInView<HTMLDivElement>({ threshold: 0.35 });
  const [round, setRound] = useState(0);
  const [copied, setCopied] = useState(false);
  const typed = useTypewriter(EXAMPLE, inView, 12, round);
  return (
    <div className="xp" ref={ref}>
      <div className="xp-left">
        {SENT.map((g, gi) => (
          <Reveal key={g.t} delay={gi * 130} variant="left" className="xp-group">
            <h4>{g.t}</h4>
            <dl>
              {g.items.map(([k, v]) => (
                <div key={k}>
                  <dt>{k}</dt>
                  <dd>{v}</dd>
                </div>
              ))}
            </dl>
          </Reveal>
        ))}
        <Reveal delay={420} variant="left" className="xp-group xp-previews">
          <h4>Previews sent</h4>
          <div>
            <img src={viewUrl("ndvi")} alt="NDVI layer preview" />
            <img src={viewUrl("ndviStretched")} alt="EVI layer preview" />
          </div>
        </Reveal>
      </div>
      <div className="xp-right">
        <div className="xp-bar">
          <span className="xp-title">AI explanation</span>
          <div className="xp-actions">
            <button type="button" className="btn btn-quiet" onClick={() => setRound((r) => r + 1)}>
              Explain again
            </button>
            <button
              type="button"
              className="btn btn-quiet"
              onClick={() => {
                navigator.clipboard?.writeText(EXAMPLE).then(() => {
                  setCopied(true);
                  window.setTimeout(() => setCopied(false), 1500);
                });
              }}
            >
              {copied ? "Copied" : "Copy"}
            </button>
            <span className="btn btn-quiet xp-fake">Open folder</span>
          </div>
        </div>
        <div className={`xp-md${typed.length < EXAMPLE.length ? " is-typing" : ""}`}>
          <Md text={typed} />
        </div>
        <p className="muted-note xp-note">Example text, for illustration. Real explanations depend on your result.</p>
      </div>
    </div>
  );
}

export function AiExplanationChapter() {
  return (
    <>
      <Chapter
        id="ai-explanation"
        eyebrow="AI explanation"
        title={
          <>
            Ask the AI <span className="grad-text">what the result means</span>
          </>
        }
        lede="The AI is sent the result GeoTIFF itself, a picture of every layer, and everything the app knows about the analysis and the data. It answers in plain words, and the answer is kept in your project."
        art={<FlowArt />}
      />

      <section className="section band-soft">
        <div className="container">
          <SectionHead title="What the AI sees, and what it says">
            On the left the page shows exactly what the AI is sent; the explanation appears on the right.
          </SectionHead>
          <ExplanationPage />
        </div>
      </section>

    </>
  );
}
