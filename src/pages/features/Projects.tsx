import { useMemo, useState } from "react";
import { Reveal, useInView } from "../../components/motion/motion";
import { Chapter, SectionHead } from "../../components/newpages/NewLayout";

const TREE: { depth: number; name: string; note: string; kind: "dir" | "file" }[] = [
  { depth: 0, name: "Lahore heat 2024/", note: "the project", kind: "dir" },
  { depth: 1, name: "project.json", note: "id, name, creation time", kind: "file" },
  { depth: 1, name: "downloads/", note: "every dataset downloaded while it is open", kind: "dir" },
  { depth: 2, name: "Landsat-8_74.3436_31.5204_…/", note: "one folder per download", kind: "dir" },
  { depth: 1, name: "analysis/", note: "results you save", kind: "dir" },
  { depth: 2, name: "analysis_results.json", note: "every run: settings, numbers, file", kind: "file" },
  { depth: 1, name: "explanation/", note: "AI explanations (Markdown)", kind: "dir" },
  { depth: 1, name: "reports/", note: "PDF reports", kind: "dir" },
];

function TreeArt() {
  const [ref, inView] = useInView<HTMLDivElement>({ threshold: 0.3 });
  return (
    <div className={`tree-art${inView ? " is-in" : ""}`} ref={ref}>
      <div className="tree-art-bar">
        <span />
        <span />
        <span />
        <em>Documents / GEE-Assist Projects</em>
      </div>
      <ul>
        {TREE.map((n, i) => (
          <li key={n.name} style={{ "--i": i, "--depth": n.depth } as React.CSSProperties}>
            <span className={`tree-icon tree-${n.kind}`} aria-hidden="true" />
            <code>{n.name}</code>
            <span className="tree-note">{n.note}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function NewProjectDialog() {
  const [name, setName] = useState("");
  const [location, setLocation] = useState("C:\\Users\\you\\Documents\\GEE-Assist Projects");
  const [existing, setExisting] = useState(["Project 1", "Project 2", "Mangla floods"]);
  const next = useMemo(() => {
    let k = 1;
    while (existing.includes(`Project ${k}`)) k++;
    return `Project ${k}`;
  }, [existing]);
  const finalName = name.trim() || next;
  const clash = existing.includes(finalName);

  return (
    <div className="dlg">
      <div className="dlg-title">New project</div>
      <div className="dlg-body">
        <label className="field">
          <span>Name</span>
          <input
            className="input"
            value={name}
            placeholder={`Leave empty for “${next}”`}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <label className="field">
          <span>Create in</span>
          <input className="input" value={location} onChange={(e) => setLocation(e.target.value)} />
        </label>
        <p className="dlg-preview">
          <span className="muted-note">Folder that will be made</span>
          <code key={finalName + location} className="dlg-path">
            {location.replace(/[\\/]+$/, "")}\<strong>{finalName}</strong>
          </code>
        </p>
        {clash && <p className="dlg-error">A folder called “{finalName}” is already there.</p>}
        <div className="dlg-existing">
          <span className="muted-note">Already in that location:</span>
          {existing.map((e) => (
            <span key={e} className="pill dlg-pill">
              {e}
            </span>
          ))}
        </div>
        <div className="btn-row">
          <button
            type="button"
            className="btn btn-primary"
            disabled={clash}
            onClick={() => {
              setExisting((x) => [...x, finalName]);
              setName("");
            }}
          >
            Create
          </button>
          <button type="button" className="btn btn-quiet" onClick={() => setExisting(["Project 1", "Project 2", "Mangla floods"])}>
            Reset
          </button>
        </div>
      </div>
    </div>
  );
}

const ACTIONS = [
  {
    t: "Create",
    d: "From the dashboard's New project, or File → New project… (Ctrl+Shift+N). By default it goes next to your last project, else in Documents/GEE-Assist Projects.",
  },
  {
    t: "Open",
    d: "Open project… (Ctrl+Shift+O) and pick its folder, click a card under Recent projects, or use File → Recent projects.",
  },
  {
    t: "Rename or move",
    d: "The folder is renamed or moved with everything in it. Saved downloads, even paused ones, follow it. This is refused while one of its downloads is running.",
  },
  {
    t: "Close",
    d: "From the dashboard card or the File menu. Signing out closes it too. Forgetting a project never deletes its folder.",
  },
];

const NAME_PARTS = [
  { t: "Sentinel-2", k: "satellite" },
  { t: "73.8231", k: "centre longitude" },
  { t: "33.2334", k: "centre latitude" },
  { t: "2023-01-01", k: "start date" },
  { t: "2023-12-31", k: "end date" },
];

function FileName() {
  const [ref, inView] = useInView<HTMLDivElement>({ threshold: 0.5 });
  return (
    <div className={`fname${inView ? " is-in" : ""}`} ref={ref}>
      <div className="fname-row">
        {NAME_PARTS.map((p, i) => (
          <span key={p.k} className="fname-part" style={{ "--i": i } as React.CSSProperties}>
            {i > 0 && <span className="fname-sep">_</span>}
            <span className="fname-chip">
              {p.t}
              <small>{p.k}</small>
            </span>
          </span>
        ))}
        <span className="fname-part fname-ext" style={{ "--i": NAME_PARTS.length } as React.CSSProperties}>
          .tif
        </span>
      </div>
      <p className="muted-note">
        The same request downloaded again gets <code>_2</code>, <code>_3</code>, … at the end.
      </p>
    </div>
  );
}

const RECENT = [
  { name: "Lahore heat 2024", where: "Documents/GEE-Assist Projects", result: "LST · LSTMapping", when: "today, 14:02" },
  { name: "Mangla floods", where: "D:/Thesis", result: "Water · MNDWI, WaterAreaEstimation", when: "yesterday" },
  { name: "Project 2", where: "Documents/GEE-Assist Projects", result: "Vegetation · NDVI, EVI", when: "12 Nov" },
];

function DashboardMock() {
  return (
    <div className="dash">
      <div className="dash-open">
        <span className="pill pill-green">Open project</span>
        <strong>Lahore heat 2024</strong>
        <span className="muted-note">Documents/GEE-Assist Projects</span>
        <div className="dash-open-actions">
          <span>Rename</span>
          <span>Move</span>
          <span>Close</span>
        </div>
      </div>
      <div className="dash-cols">
        <div>
          <h4>Recent projects</h4>
          {RECENT.map((r, i) => (
            <Reveal key={r.name} delay={i * 110} variant="left" className="dash-card">
              <strong>{r.name}</strong>
              <span className="muted-note">{r.where}</span>
            </Reveal>
          ))}
        </div>
        <div>
          <h4>Latest analysis results</h4>
          {RECENT.map((r, i) => (
            <Reveal key={r.name} delay={150 + i * 110} variant="right" className="dash-card">
              <strong>{r.result}</strong>
              <span className="muted-note">
                {r.name} · {r.when}
              </span>
            </Reveal>
          ))}
        </div>
      </div>
    </div>
  );
}

export function ProjectsChapter() {
  return (
    <>
      <Chapter
        id="projects"
        eyebrow="Projects"
        title={
          <>
            Your work, kept <span className="grad-text">in one folder</span>
          </>
        }
        lede="As in other desktop apps, you now work inside a project. Every download, analysis result, AI explanation and PDF report made while it is open goes into its folder."
        art={<TreeArt />}
      />

      <section className="section">
        <div className="container">
          <SectionHead n="01" title="What is in a project">
            A project is a plain folder you can back up, zip or hand to someone. Paths inside it are stored relative to
            it, so moving the project keeps them valid.
          </SectionHead>
          <div className="anatomy">
            {TREE.slice(1)
              .filter((n) => n.depth === 1 || n.name === "analysis_results.json")
              .map((n, i) => (
                <Reveal key={n.name} delay={i * 80} className="anatomy-card" variant="up">
                  <span className={`tree-icon tree-${n.kind}`} aria-hidden="true" />
                  <code>{n.name}</code>
                  <p>{n.note}</p>
                </Reveal>
              ))}
          </div>
        </div>
      </section>

      <section className="section band-soft">
        <div className="container split">
          <div>
            <SectionHead n="02" title="Leave the name empty">
              The New project dialog shows the folder it will make. With no name you get <strong>Project 1</strong>, then{" "}
              <strong>Project 2</strong>, <strong>Project 3</strong>, … the first number not already a folder there.
            </SectionHead>
            <Reveal delay={100}>
              <p className="muted-note">This is a working copy of that dialog. Press Create a few times.</p>
            </Reveal>
          </div>
          <Reveal variant="scale" delay={120}>
            <NewProjectDialog />
          </Reveal>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <SectionHead n="03" title="Create, open, rename, move, close" />
          <div className="action-grid">
            {ACTIONS.map((a, i) => (
              <Reveal key={a.t} delay={i * 100} variant="flip" className="action-card">
                <span className="action-n">{i + 1}</span>
                <h3>{a.t}</h3>
                <p>{a.d}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="section band-soft" id="project-downloads">
        <div className="container">
          <SectionHead n="04" title="Downloads go into the project">
            A download needs an open project; starting one without it asks you to create or open one first. The form's
            Save to folder always shows the project's <code>downloads</code> folder, and the parameter form only says
            what to download. Analyses are chosen on the Analysis page.
          </SectionHead>
          <Reveal>
            <FileName />
          </Reveal>
          <div className="two-notes">
            <Reveal className="note-card" variant="left">
              <h3>Save to…</h3>
              <p>
                Copies a finished GeoTIFF into any folder: a USB drive, a shared folder. The project keeps its own copy,
                so the Analysis page still finds it, and an existing file is never overwritten.
              </p>
            </Reveal>
            <Reveal className="note-card" variant="right" delay={100}>
              <h3>Pause, close, carry on</h3>
              <p>
                Pausing keeps the finished parts. Start continues where it stopped, even after closing the app, and
                even after the project was renamed or moved.
              </p>
            </Reveal>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container split">
          <div>
            <SectionHead n="05" title="The dashboard knows your projects">
              After signing in the app opens on the dashboard. It shows the open project, your last three projects
              (click one to open it) and the latest analysis results of those three.
            </SectionHead>
            <Reveal delay={100}>
              <p className="muted-note">
                Where your projects are is remembered per user on this computer. Click the GEE-Assist logo in the side
                bar to come back here from any page.
              </p>
            </Reveal>
          </div>
          <Reveal variant="scale">
            <DashboardMock />
          </Reveal>
        </div>
      </section>

    </>
  );
}
