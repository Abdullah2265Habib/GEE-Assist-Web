import { Link } from "react-router-dom";
import { BACKEND_GITHUB_URL, GITHUB_URL } from "../../config";
import BackendStatus from "./BackendStatus";

export default function Footer() {
  return (
    <footer className="site-footer">
      <div className="container footer-grid">
        <div className="footer-about">
          <p className="footer-name">GEE-Assist</p>
          <p>
            A Windows app for finding, downloading and analysing Google Earth Engine imagery. Free and open source
            under the GNU GPL v3.
          </p>
          <BackendStatus />
        </div>
        <nav aria-label="Product">
          <h2>Product</h2>
          <ul>
            <li>
              <Link to="/features">Features</Link>
            </li>
            <li>
              <Link to="/datasets">Datasets</Link>
            </li>
            <li>
              <Link to="/terminal">Try the terminal</Link>
            </li>
            <li>
              <Link to="/download">Download and set up</Link>
            </li>
          </ul>
        </nav>
        <nav aria-label="Project">
          <h2>Project</h2>
          <ul>
            <li>
              <Link to="/about">About</Link>
            </li>
            <li>
              <Link to="/community">Rate and give feedback</Link>
            </li>
            <li>
              <a href={GITHUB_URL} target="_blank" rel="noreferrer">
                Desktop app source
              </a>
            </li>
            <li>
              <a href={BACKEND_GITHUB_URL} target="_blank" rel="noreferrer">
                Server source
              </a>
            </li>
          </ul>
        </nav>
      </div>
      <div className="container footer-base">
        <span>© {new Date().getFullYear()} GEE-Assist. Not affiliated with Google.</span>
        <span>Google Earth Engine is a trademark of Google LLC.</span>
      </div>
    </footer>
  );
}
