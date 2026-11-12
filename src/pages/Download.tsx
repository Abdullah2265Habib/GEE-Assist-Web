import { Link } from "react-router-dom";
import CopyButton from "../components/CopyButton";
import { APP_VERSION, BACKEND_GITHUB_URL, DOWNLOAD_URL, GITHUB_URL } from "../config";

function Cmd({ children }: { children: string }) {
  return (
    <div className="cmd-block">
      <pre>
        <code>{children}</code>
      </pre>
      <CopyButton text={children} />
    </div>
  );
}

const FAQ: [string, string][] = [
  [
    "Is GEE-Assist free?",
    "Yes. The app and its server are open source under the GNU GPL v3. Earth Engine itself is free for research, education and non-profit use; commercial use needs a paid Earth Engine plan from Google.",
  ],
  [
    "Do I need to know JavaScript or Python?",
    "No. You describe the data or fill in a form. Python is only needed to run the app from source until the installer is published.",
  ],
  [
    "Does it run on macOS or Linux?",
    "It is built and tested on Windows. The code is cross-platform Python and Qt, so it may run elsewhere, but “Keep me signed in” relies on the Windows Credential Manager.",
  ],
  [
    "Why do I need a Google Cloud project?",
    "Earth Engine requires every request to belong to a registered Cloud project. Registering is free for non-commercial use and takes a few minutes.",
  ],
  [
    "What happens if my download stops halfway?",
    "Finished chunks are kept. Press Start on the Downloads page and it continues where it stopped, even after restarting the app. Failed chunks are retried three times automatically.",
  ],
  [
    "What do I need for “Chat with Gemini”?",
    "A Gemini API key from Google AI Studio, set as GEMINI_API_KEY in the app's .env file. Without it, the parameter form and terminal still work.",
  ],
];

export default function Download() {
  return (
    <>
      <section className="download-hero">
        <div className="container download-hero-inner">
          <div>
            <h1>Download GEE-Assist</h1>
            <p className="lede">Version {APP_VERSION} for Windows 10 and 11. Free and open source.</p>
            <div className="btn-row">
              <a className="btn btn-primary btn-lg" href={DOWNLOAD_URL}>
                Download for Windows
              </a>
              <a className="btn btn-secondary btn-lg" href={GITHUB_URL} target="_blank" rel="noreferrer">
                View the source
              </a>
            </div>
          </div>
          <video
            className="download-video"
            src="/media/earth-rotating.mp4"
            autoPlay
            muted
            loop
            playsInline
            aria-hidden="true"
          />
        </div>
      </section>

      <div className="container doc-body download-body">
        <section>
          <h2>What you need</h2>
          <ul className="check-list">
            <li>Windows 10 or 11, 64-bit</li>
            <li>Python 3.10 or newer, to run from source</li>
            <li>A Google account, and a Google Cloud project registered for Earth Engine</li>
            <li>Optional: a Gemini API key for plain-language requests</li>
            <li>Free disk space for your downloads. A year of Sentinel-2 over a city is usually tens to hundreds of megabytes</li>
          </ul>
        </section>

        <section>
          <h2>Run it from source</h2>
          <ol className="setup-steps">
            <li>
              <h3>Start the account server</h3>
              <p>
                Sign-in goes through the{" "}
                <a href={BACKEND_GITHUB_URL} target="_blank" rel="noreferrer">
                  GEE-Assist account server
                </a>
                . Skip this if your organisation already runs one, and put its address in <code>AUTH_API_URL</code>.
              </p>
              <Cmd>{`cd GEE-Assist-Backend\n.venv\\Scripts\\activate\nuvicorn app.main:app`}</Cmd>
            </li>
            <li>
              <h3>Install the app</h3>
              <Cmd>{`git clone ${GITHUB_URL}.git\ncd GEE-Assist\npython -m venv .venv\n.venv\\Scripts\\activate\npip install -r requirements.txt\ncopy .env.example .env`}</Cmd>
            </li>
            <li>
              <h3>Fill in .env</h3>
              <p>
                Set <code>GEE_PROJECT</code> to your Cloud project ID and, for Gemini, <code>GEMINI_API_KEY</code>. Change{" "}
                <code>AUTH_API_URL</code> if the server is not on <code>localhost:8000</code>.
              </p>
            </li>
            <li>
              <h3>Start GEE-Assist</h3>
              <Cmd>python main.py</Cmd>
              <p>Choose a theme, then sign in or create an account.</p>
            </li>
          </ol>
        </section>

        <section>
          <h2>Connect Earth Engine, once</h2>
          <ol className="setup-steps">
            <li>
              <h3>Register a Cloud project</h3>
              <p>
                Go to{" "}
                <a href="https://code.earthengine.google.com/register" target="_blank" rel="noreferrer">
                  code.earthengine.google.com/register
                </a>{" "}
                and register a project for Earth Engine. Copy its ID into <code>GEE_PROJECT</code>.
              </p>
            </li>
            <li>
              <h3>Sign in on this computer</h3>
              <p>
                In the app, open the terminal with <kbd>Ctrl</kbd>+<kbd>`</kbd> and type <code>gee login</code>. A browser
                window opens for your Google account.
              </p>
            </li>
            <li>
              <h3>Check the set-up</h3>
              <p>
                Type <code>gee verify</code>. Each step that does not pass comes with how to fix it.
              </p>
            </li>
          </ol>
          <p>
            <Link to="/terminal">See what these commands print</Link>
          </p>
        </section>

        <section id="faq">
          <h2>Questions</h2>
          <div className="faq">
            {FAQ.map(([q, a]) => (
              <details key={q}>
                <summary>{q}</summary>
                <p>{a}</p>
              </details>
            ))}
          </div>
          <p>
            Something else? <Link to="/community?tab=feedback">Ask through the feedback form</Link>.
          </p>
        </section>
      </div>
    </>
  );
}
