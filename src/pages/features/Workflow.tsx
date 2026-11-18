import { useEffect, useRef, useState } from "react";
import { CountUp, Reveal } from "../../components/motion/motion";
import { Chapter, ChapterCards, SectionHead } from "../../components/newpages/NewLayout";
import { SideIcon, type SideIconName } from "../../components/newpages/SideIcons";
import { THEMES, useTheme } from "../../theme/ThemeProvider";

const FLOW = [
  {
    icon: "key",
    title: "Your own keys",
    body: "The first sign-in asks for your Earth Engine project ID and a Gemini API key, with the steps to get both. The key is kept in Windows Credential Manager, never in a file.",
    link: "#setup",
  },
  {
    icon: "folder",
    title: "Create a project",
    body: "Everything you do lives in a project folder: downloads, analysis results, AI explanations and PDF reports. Rename it or move it and everything follows.",
    link: "#projects",
  },
  {
    icon: "down",
    title: "Download",
    body: "The parameter form says only what to download, and the GeoTIFF lands in the project's downloads folder. Save to… copies it anywhere else.",
    link: "#project-downloads",
  },
  {
    icon: "chart",
    title: "Analyse",
    body: "Pick one of four analyses and its processes. Processes the dataset cannot run are folded away with the reason. It runs on an NVIDIA GPU when there is one.",
    link: "#analysis",
  },
  {
    icon: "eye",
    title: "Look at it",
    body: "The viewer shows true colour, false colour, NDVI, NDWI, land cover or any band, with the value under the pointer and the legend for the view.",
    link: "#viewer",
  },
  {
    icon: "spark",
    title: "Explain with AI",
    body: "Gemini is sent the result GeoTIFF, a preview of each layer and all the metadata, and writes an explanation that is kept in the project.",
    link: "#ai-explanation",
  },
  {
    icon: "pdf",
    title: "Make a PDF report",
    body: "One click turns an explanation into an A4 PDF with the result's pictures, colour bars, headings and tables. Export it anywhere.",
    link: "#reports",
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

/** Steps on the right; a sticky screen on the left that follows the step in the middle of the window. */
function Workflow() {
  const [active, setActive] = useState(0);
  const refs = useRef<(HTMLLIElement | null)[]>([]);
  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) setActive(Number((e.target as HTMLElement).dataset.i));
        }
      },
      { rootMargin: "-45% 0px -45% 0px" },
    );
    refs.current.forEach((el) => el && io.observe(el));
    return () => io.disconnect();
  }, []);
  const step = FLOW[active];
  return (
    <div className="flow">
      <div className="flow-sticky">
        <div className="flow-screen" aria-hidden="true">
          <div className="flow-screen-bar">
            <span />
            <span />
            <span />
            <em>GEE-Assist</em>
          </div>
          <div className="flow-screen-body">
            <div className="flow-rail">
              {FLOW.map((s, i) => (
                <span key={s.title} className={i === active ? "is-on" : i < active ? "is-done" : ""}>
                  <FlowGlyph name={s.icon} />
                </span>
              ))}
            </div>
            <div className="flow-stage" key={active}>
              <span className="flow-stage-icon">
                <FlowGlyph name={step.icon} />
              </span>
              <strong>{step.title}</strong>
              <span className="flow-stage-n">
                Step {active + 1} of {FLOW.length}
              </span>
              <span className="flow-meter">
                <span style={{ width: `${((active + 1) / FLOW.length) * 100}%` }} />
              </span>
            </div>
          </div>
        </div>
      </div>
      <ol className="flow-steps">
        {FLOW.map((s, i) => (
          <li
            key={s.title}
            data-i={i}
            ref={(el) => {
              refs.current[i] = el;
            }}
            className={i === active ? "is-active" : ""}
          >
            <span className="flow-n">{String(i + 1).padStart(2, "0")}</span>
            <h3>{s.title}</h3>
            <p>{s.body}</p>
            <a href={s.link}>Read more</a>
          </li>
        ))}
      </ol>
    </div>
  );
}

const SIDE: { name: SideIconName; label: string; how: string }[] = [
  { name: "query", label: "Query Input", how: "a pencil writing on a sheet" },
  { name: "downloads", label: "Downloads", how: "an arrow sliding down into a tray" },
  { name: "analysis", label: "Analysis", how: "bars rising under a sweeping lens" },
  { name: "explain", label: "AI Explanation", how: "lines appearing in a bubble, a sparkle twinkling" },
  { name: "terminal", label: "Terminal", how: "a prompt typing" },
];

function SideBarDemo() {
  const [pinned, setPinned] = useState(false);
  const { theme } = useTheme();
  const icon = THEMES.find((t) => t.name === theme)?.icon ?? "/media/icon-light-64.png";
  return (
    <div className="sbd-wrap">
      <div className={`sbd${pinned ? " is-pinned" : ""}`}>
        <div className="sbd-logo">
          <img src={icon} alt="" width={26} height={26} />
          <span>GEE-Assist</span>
        </div>
        <ul>
          {SIDE.map((s) => (
            <li key={s.name}>
              <span className="sbd-icon">
                <SideIcon name={s.name} />
              </span>
              <span className="sbd-label">{s.label}</span>
            </li>
          ))}
        </ul>
      </div>
      <div className="sbd-page" aria-hidden="true">
        <span />
        <span />
        <span />
        <span />
      </div>
      <label className="sbd-pin">
        <input type="checkbox" checked={pinned} onChange={(e) => setPinned(e.target.checked)} /> Keep it open (
        <kbd>Ctrl</kbd>+<kbd>B</kbd>)
      </label>
    </div>
  );
}

const SMALL = [
  {
    t: "Settings window",
    d: "Options → Settings… (Ctrl+,) changes the Earth Engine project, the Gemini key and how long Keep me signed in lasts. Changes apply at once, without a restart.",
  },
  {
    t: "Save to…",
    d: "Copy a finished download's GeoTIFF to a USB drive or a shared folder. The project keeps its own copy, and an existing file is never overwritten.",
  },
  {
    t: "Feedback window",
    d: "After an AI explanation or an analysis, a small window offers Rate the app, Send feedback or Suggest a feature, and opens that tab of this site's Community page.",
  },
  {
    t: "Account page",
    d: "Click your name, username or phone to edit it; Discard and Save changes appear once something really changed. Password accounts can change their password.",
  },
  {
    t: "Profile photos stay local",
    d: "Your photo is saved on this computer only and never sent to the server.",
  },
  {
    t: "Managing users",
    d: "Administrators can now add and delete users, find anyone by email, edit details including the email (which must then be verified again) and reset passwords.",
  },
  {
    t: "More of the menu bar",
    d: "File → New project, Open project, Recent projects, Rename, Move, Close; Open GeoTIFF… (Ctrl+O). View → Analysis (Ctrl+5), Show analysis table (Ctrl+6), Reports (Ctrl+7).",
  },
  {
    t: "Logo goes home",
    d: "Click the GEE-Assist logo at the top of the side bar to get back to the dashboard from any page. There is no back arrow any more.",
  },
];

const SETUP = [
  {
    t: "Create a Google Cloud project",
    d: (
      <>
        In the{" "}
        <a href="https://console.cloud.google.com/projectcreate" target="_blank" rel="noreferrer">
          Google Cloud console
        </a>
        , create a project and note its <strong>Project ID</strong>.
      </>
    ),
  },
  {
    t: "Register it for Earth Engine",
    d: (
      <>
        At{" "}
        <a href="https://code.earthengine.google.com/register" target="_blank" rel="noreferrer">
          code.earthengine.google.com/register
        </a>{" "}
        (unpaid usage), then enable the{" "}
        <a
          href="https://console.cloud.google.com/apis/library/earthengine.googleapis.com"
          target="_blank"
          rel="noreferrer"
        >
          Earth Engine API
        </a>
        .
      </>
    ),
  },
  {
    t: "Get a Gemini API key",
    d: (
      <>
        In{" "}
        <a href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer">
          Google AI Studio
        </a>{" "}
        press <strong>Create API key</strong> and copy it.
      </>
    ),
  },
  {
    t: "Enter both in Set up GEE-Assist",
    d: (
      <>
        The window opens at your first sign-in and cannot be skipped. Then sign this computer in once with{" "}
        <code>gee login</code> in gkonsol, and check it all with <code>gee verify</code>.
      </>
    ),
  },
];

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
              <CountUp to={5} />
            </dd>
          </div>
        </dl>
      </Chapter>

      <section className="section">
        <div className="container">
          <SectionHead n="01" title="What is new in the app">
            Each new part of the desktop app has its own chapter below. Jump to one, or keep scrolling for the whole story.
          </SectionHead>
          <ChapterCards />
        </div>
      </section>

      <section className="section band-soft">
        <div className="container">
          <SectionHead n="02" title="One request, start to finish">
            Scroll through what happens now, from the first sign-in to a PDF you can hand in.
          </SectionHead>
          <Workflow />
        </div>
      </section>

      <section className="section" id="setup">
        <div className="container split">
          <div>
            <SectionHead n="03" title="Bring your own Earth Engine project and Gemini key">
              Every user now enters their own Earth Engine project ID and Gemini API key. A new copy of the app asks for
              both at the first sign-in and shows how to get them.
            </SectionHead>
            <Reveal delay={120}>
              <p>
                The key is kept in Windows Credential Manager, never in a file. The project ID and how long{" "}
                <strong>Keep me signed in</strong> lasts (7 days unless you change it) are saved in the app's workspace.
                Change any of them later in <strong>Options → Settings…</strong>.
              </p>
            </Reveal>
          </div>
          <ol className="key-steps">
            {SETUP.map((s, i) => (
              <Reveal as="li" key={s.t} delay={i * 120} variant="right">
                <span className="key-n">{i + 1}</span>
                <div>
                  <h3>{s.t}</h3>
                  <p>{s.d}</p>
                </div>
              </Reveal>
            ))}
          </ol>
        </div>
      </section>

      <section className="section band-soft">
        <div className="container split">
          <div>
            <SectionHead n="04" title="A side bar that opens when you need it">
              The side bar stays collapsed to icons and slides open over the page while the pointer rests on it. Each
              icon animates under the pointer. Try it.
            </SectionHead>
            <Reveal as="ul" className="side-list" delay={100}>
              {SIDE.map((s) => (
                <li key={s.name}>
                  <strong>{s.label}</strong>: {s.how}
                </li>
              ))}
            </Reveal>
          </div>
          <Reveal variant="scale" delay={150}>
            <SideBarDemo />
          </Reveal>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <SectionHead n="05" title="And the smaller things" />
          <div className="small-grid">
            {SMALL.map((s, i) => (
              <Reveal key={s.t} delay={(i % 4) * 80} variant="flip" className="small-card">
                <h3>{s.t}</h3>
                <p>{s.d}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

    </>
  );
}
