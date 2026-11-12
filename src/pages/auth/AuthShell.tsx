import type { ReactNode } from "react";

/** Two-column frame for sign-in screens: the form, and a short note on what an account is for. */
export default function AuthShell({ title, intro, children }: { title: string; intro?: ReactNode; children: ReactNode }) {
  return (
    <div className="container auth-layout">
      <div className="auth-card">
        <h1>{title}</h1>
        {intro && <div className="auth-intro">{intro}</div>}
        {children}
      </div>
      <aside className="auth-aside">
        <span className="globe-badge" aria-hidden="true">
          <img src="/media/satellite-around-earth.gif" alt="" width={120} height={120} />
        </span>
        <h2>One account for the app and this site</h2>
        <ul>
          <li>Sign in to the GEE-Assist desktop app</li>
          <li>Rate the app and change your rating any time</li>
          <li>Report bugs and follow what happens to them</li>
          <li>Suggest features and see when they are planned or shipped</li>
        </ul>
        <p>Browsing this website never needs an account.</p>
      </aside>
    </div>
  );
}
