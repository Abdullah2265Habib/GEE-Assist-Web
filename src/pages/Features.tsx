import { Link } from "react-router-dom";

const SHORTCUTS: [string[], string][] = [
  [["Ctrl", "N"], "New request"],
  [["Ctrl", "1"], "Dashboard"],
  [["Ctrl", "2"], "Query input"],
  [["Ctrl", "3"], "Downloads"],
  [["Ctrl", "4"], "Account"],
  [["Ctrl", "B"], "Show or hide the side bar"],
  [["Ctrl", "`"], "Show or hide the terminal"],
  [["F11"], "Full screen"],
  [["Ctrl", "Q"], "Exit"],
];

const SECTIONS = [
  { id: "query", label: "Asking in plain words" },
  { id: "form", label: "The parameter form" },
  { id: "downloads", label: "Large downloads" },
  { id: "terminal", label: "The terminal" },
  { id: "accounts", label: "Accounts" },
  { id: "shortcuts", label: "Menus and shortcuts" },
];

export default function Features() {
  return (
    <>
      <div className="container page-head">
        <h1>What GEE-Assist does</h1>
        <p className="lede">
          A desktop app that sits between you and Google Earth Engine. It finds the right collection, builds the request,
          and brings the result to your disk in pieces Earth Engine will accept.
        </p>
      </div>

      <div className="container doc-layout">
        <nav className="doc-toc" aria-label="On this page">
          <ul>
            {SECTIONS.map((s) => (
              <li key={s.id}>
                <a href={`#${s.id}`}>{s.label}</a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="doc-body">
          <section id="query">
            <h2>Asking in plain words</h2>
            <p>
              The Query Input page has a <strong>Chat with Gemini</strong> assistant. Write what you need the way you would
              say it to a colleague: a place, a time, what you want to measure. GEE-Assist first runs its own recogniser
              over the text and tags places, dates, datasets, analyses and band names. Gemini then uses those tags to fill
              the parameter form.
            </p>
            <figure className="example">
              <blockquote>water bodies near Mangla Dam in 2023</blockquote>
              <figcaption>
                fills in the area around the dam, 1 January to 31 December 2023, and the Water analysis, then suggests a
                dataset that supports it.
              </figcaption>
            </figure>
            <p>
              Anything it could not take from the request is listed in notes under the form. If the request is ambiguous,
              Gemini asks a question rather than filling the form with a guess.
            </p>
          </section>

          <section id="form">
            <h2>The parameter form</h2>
            <p>Whether you type, ask Gemini or use the terminal, every request ends up on the same form:</p>
            <dl className="def-list">
              <dt>Dataset and bands</dt>
              <dd>Choosing a dataset sets its default bands, pixel size, cloud cover and composite. You can change any of them.</dd>
              <dt>Area of interest</dt>
              <dd>Draw a rectangle, circle or polygon on the map, type coordinates, or import a GeoJSON file of up to 20 MB.</dd>
              <dt>Dates</dt>
              <dd>Kept inside what the dataset covers. Choose a date outside it and the form tells you the dataset's range.</dd>
              <dt>Cloud cover and composite</dt>
              <dd>Leave out cloudy scenes, then combine the rest by median, mean, mosaic, min, max or mode.</dd>
              <dt>Projection</dt>
              <dd>WGS 84 in degrees, the UTM zone of your area in metres, or Web Mercator.</dd>
              <dt>Analysis</dt>
              <dd>
                Optional. Water, vegetation, land surface temperature or land cover change. Analyses the dataset cannot
                compute are greyed out.
              </dd>
            </dl>
            <p>
              <strong>Submit Parameters</strong> checks the form and keeps it as a request. Kept requests wait in a list
              until you start their download.
            </p>
          </section>

          <section id="downloads">
            <h2>Large downloads</h2>
            <p>
              Earth Engine refuses any single request larger than 48 MB, which rules out most real study areas. GEE-Assist
              works around this without making you tile anything by hand.
            </p>
            <ol className="plain-steps">
              <li>The request is split into chunks of 500 MB. You can change the chunk size for new downloads.</li>
              <li>
                Each chunk is fetched as small requests of about 4 MB, eight at a time. Small requests are computed sooner,
                so data starts arriving early and keeps arriving.
              </li>
              <li>Every piece is written to disk the moment it arrives.</li>
              <li>Chunks are merged as soon as two exist, until one GeoTIFF remains.</li>
            </ol>
            <p>
              If Earth Engine runs out of memory on a request, for example a median over many years, that request is split
              into four and the rest of the download continues at the smaller size. Failed chunks are retried three times,
              and <strong>Retry</strong> re-runs only those.
            </p>
            <p>
              The Downloads page shows progress, speed, time left and disk usage for each download, with Start, Pause and
              Cancel. Pausing keeps the finished parts, even after you close the app.
            </p>
          </section>

          <section id="terminal">
            <h2>The terminal</h2>
            <p>
              gkonsol is a command line inside GEE-Assist. Open it from the side bar or with <kbd>Ctrl</kbd>+<kbd>`</kbd>.
              It can fill the form, start and watch downloads, show a live speed chart, and check your Earth Engine sign-in
              step by step with <code>gee verify</code>. <code>doctor</code> checks everything at once.
            </p>
            <p>
              <Link to="/terminal">Try gkonsol in your browser</Link>
            </p>
          </section>

          <section id="accounts">
            <h2>Accounts</h2>
            <p>
              Sign in with a username and password or with Google. New accounts confirm their email address with a link;
              the app waits on a “Check your email” screen and signs you in as soon as the link is opened.
            </p>
            <p>
              <strong>Keep me signed in</strong> stores your session in the Windows Credential Manager, so the next launch
              opens straight on the dashboard. Passwords are hashed with Argon2id on the server and never stored in the app.
            </p>
            <p>
              Administrators get a <strong>Manage users</strong> window for changing roles and enabling or disabling
              accounts.
            </p>
          </section>

          <section id="shortcuts">
            <h2>Menus and shortcuts</h2>
            <p>
              A menu bar runs along the top of every page, as in Word or Excel: File, Edit, View, Terminal, Options and
              Help. The side bar on the left opens Query Input, Downloads and the terminal.
            </p>
            <table className="data-table shortcuts">
              <caption className="visually-hidden">Keyboard shortcuts</caption>
              <thead>
                <tr>
                  <th scope="col">Keys</th>
                  <th scope="col">Does</th>
                </tr>
              </thead>
              <tbody>
                {SHORTCUTS.map(([keys, what]) => (
                  <tr key={what}>
                    <td>
                      {keys.map((k, i) => (
                        <span key={k}>
                          {i > 0 && "+"}
                          <kbd>{k}</kbd>
                        </span>
                      ))}
                    </td>
                    <td>{what}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </div>
      </div>
    </>
  );
}
