import { Link } from "react-router-dom";
import { BACKEND_GITHUB_URL, GITHUB_URL } from "../config";

const STACK: [string, string][] = [
  ["Desktop app", "Python, PyQt6 and Qt WebEngine for the map"],
  ["Earth Engine", "earthengine-api, rasterio and NumPy for chunking and merging GeoTIFFs"],
  ["Language", "Google Gemini, with spaCy for recognising places, dates and datasets"],
  ["Account server", "FastAPI, MongoDB, JWT tokens, Argon2id password hashing"],
  ["This website", "React and TypeScript, built with Vite"],
];

export default function About() {
  return (
    <>
      <div className="container page-head about-head">
        <div>
          <h1>About GEE-Assist</h1>
          <p className="lede">
            A final-year project built around one question: why does getting a few satellite images of one city still
            require writing JavaScript?
          </p>
        </div>
        <span className="globe-badge about-badge" aria-hidden="true">
          <img src="/media/satellite-around-earth.gif" alt="" width={140} height={140} />
        </span>
      </div>

      <div className="container doc-body about-body">
        <section>
          <h2>The problem</h2>
          <p>
            Google Earth Engine holds petabytes of free imagery: Landsat back to 1984, Sentinel-2 at 10 metres, decades of
            temperature and land cover. Getting it out means learning its code editor, its JavaScript or Python API, and its
            limits. A single export may be at most 48 MB, so a modest study area must be cut into tiles by hand and stitched
            back together.
          </p>
          <p>
            Students, planners and researchers who need the data often lose days to this before they can start the work they
            actually care about.
          </p>
        </section>

        <section>
          <h2>What we built</h2>
          <p>
            GEE-Assist is a Windows app that does the Earth Engine part for you. You describe the data, check a form that
            knows what each dataset can do, and press download. The app handles tiling, retries, merging, and resuming after
            a restart. For people who prefer typing, a built-in terminal does all of it by command.
          </p>
          <p>
            <Link to="/features">See every feature</Link>
          </p>
        </section>

        <section>
          <h2>How the pieces fit</h2>
          <div className="arch" role="img" aria-label="The desktop app talks to the account server for sign-in, to Gemini to understand requests, and to Google Earth Engine for imagery. This website talks only to the account server.">
            <div className="arch-node arch-main">
              <strong>GEE-Assist desktop app</strong>
              <span>on your computer</span>
            </div>
            <div className="arch-links">
              <div className="arch-node">
                <strong>Account server</strong>
                <span>sign-in, ratings, feedback</span>
              </div>
              <div className="arch-node">
                <strong>Google Gemini</strong>
                <span>reads your request</span>
              </div>
              <div className="arch-node">
                <strong>Google Earth Engine</strong>
                <span>computes and serves imagery</span>
              </div>
            </div>
            <div className="arch-node arch-web">
              <strong>This website</strong>
              <span>uses the same account server</span>
            </div>
          </div>
          <p>
            Your Earth Engine sign-in and your downloads stay on your computer. The account server only knows who you are and
            what you have told us through ratings, feedback and suggestions. The same account works in the app and here.
          </p>
        </section>

        <section>
          <h2>Built with</h2>
          <dl className="def-list">
            {STACK.map(([k, v]) => (
              <div key={k} className="def-row">
                <dt>{k}</dt>
                <dd>{v}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section>
          <h2>Open source</h2>
          <p>
            GEE-Assist is released under the GNU General Public License v3. You may use, study, change and share it, as long
            as what you share stays under the same licence.
          </p>
          <ul className="link-list">
            <li>
              <a href={GITHUB_URL} target="_blank" rel="noreferrer">
                Desktop app on GitHub
              </a>
            </li>
            <li>
              <a href={BACKEND_GITHUB_URL} target="_blank" rel="noreferrer">
                Account server on GitHub
              </a>
            </li>
          </ul>
        </section>

        <section>
          <h2>Data and privacy</h2>
          <p>
            An account stores your name, username, email address and phone number. Passwords are hashed with Argon2id and are
            never stored or shown in readable form. Ratings, feedback and suggestions are saved with your account so you can
            follow their status. Only administrators can see them, and only you can see your own on this site.
          </p>
          <p>
            Earth Engine data is provided by Google and the agencies behind each collection, under their own terms. GEE-Assist
            is not affiliated with Google.
          </p>
        </section>
      </div>
    </>
  );
}
