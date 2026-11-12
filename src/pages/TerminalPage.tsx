import Terminal from "../components/terminal/Terminal";
import { useAuth } from "../auth/AuthProvider";

const GROUPS: { name: string; commands: [string, string][] }[] = [
  {
    name: "Parameters",
    commands: [
      ["ask TEXT", "Describe the data in plain words and let Gemini fill the form"],
      ["form show", "Show every field of the parameter form"],
      ["form set FIELD VALUE", "Set dataset, bands, scale, cloud, composite, dates, crs or analysis"],
      ["form aoi bbox W S E N", "Use a rectangle as the area"],
      ["form aoi circle LON LAT RADIUS", "Use a circle, e.g. 10km"],
      ["form estimate", "Grid size, file size, chunks and Earth Engine requests"],
      ["form validate", "Check the form without keeping it"],
      ["form submit", "Keep the form as a request"],
      ["datasets list", "Every dataset with its key, pixel size and dates"],
    ],
  },
  {
    name: "Downloads",
    commands: [
      ["requests list", "The kept requests"],
      ["download start N", "Download request N and follow its progress"],
      ["download list", "Every download and its status"],
    ],
  },
  {
    name: "Earth Engine",
    commands: [
      ["gee status", "Whether Earth Engine can be used right now"],
      ["gee verify", "Check the set-up step by step, with fixes"],
      ["gee login", "Sign in to Earth Engine in the browser"],
      ["doctor", "Check the server, session, Gemini, folder and Earth Engine"],
    ],
  },
  {
    name: "Account and general",
    commands: [
      ["whoami", "Who is signed in"],
      ["session", "Your session and when it renews"],
      ["history", "Recent commands; !N runs one again, !! the last"],
      ["help", "Every command"],
      ["clear", "Clear the output (Ctrl+L)"],
    ],
  },
];

const TRY = [
  "ask NDVI of Lahore for summer 2024 from Sentinel-2",
  "form set dataset landsat8",
  "form aoi circle 73.08 31.42 10km",
  "form set analysis LST",
  "datasets list",
  "gee verify",
];

export default function TerminalPage() {
  const { user } = useAuth();
  return (
    <>
      <div className="container page-head">
        <h1>Try gkonsol</h1>
        <p className="lede">
          The command line from GEE-Assist, running in your browser. It understands the app's real commands and answers the
          way the app does. Nothing is sent to Earth Engine and nothing is downloaded.
        </p>
      </div>
      <div className="container terminal-layout">
        <div>
          <Terminal height="min(60vh, 520px)" autoFocus user={user?.username ?? "guest"} />
          <div className="try-list">
            <p>Some commands to start with. Click one to copy it.</p>
            <ul>
              {TRY.map((c) => (
                <li key={c}>
                  <button type="button" className="chip" onClick={() => navigator.clipboard?.writeText(c).catch(() => {})}>
                    {c}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
        <aside className="cmd-ref" aria-label="Command reference">
          {GROUPS.map((g) => (
            <section key={g.name}>
              <h2>{g.name}</h2>
              <dl>
                {g.commands.map(([c, d]) => (
                  <div key={c}>
                    <dt>
                      <code>{c}</code>
                    </dt>
                    <dd>{d}</dd>
                  </div>
                ))}
              </dl>
            </section>
          ))}
        </aside>
      </div>
    </>
  );
}
