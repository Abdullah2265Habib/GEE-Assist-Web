import { useEffect, useRef, useState } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../auth/AuthProvider";
import { useTheme, THEMES } from "../../theme/ThemeProvider";
import ThemeSwitcher from "./ThemeSwitcher";

const NAV = [
  { to: "/features", label: "Features" },
  { to: "/datasets", label: "Datasets" },
  { to: "/terminal", label: "Terminal" },
  { to: "/about", label: "About" },
  { to: "/community", label: "Community" },
];

function initials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

function AccountMenu() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  if (!user) return null;

  return (
    <div className="account-menu" ref={ref}>
      <button
        type="button"
        className="avatar-btn"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <span className="avatar" aria-hidden="true">
          {initials(user.full_name)}
        </span>
        <span className="avatar-name">{user.full_name.split(" ")[0]}</span>
      </button>
      {open && (
        <div className="menu" role="menu">
          <div className="menu-head">
            <strong>{user.full_name}</strong>
            <span>@{user.username}</span>
          </div>
          <Link role="menuitem" to="/account" onClick={() => setOpen(false)}>
            Your account
          </Link>
          <Link role="menuitem" to="/community" onClick={() => setOpen(false)}>
            Your ratings and feedback
          </Link>
          {user.role === "admin" && (
            <Link role="menuitem" to="/admin" onClick={() => setOpen(false)}>
              Admin dashboard
            </Link>
          )}
          <button
            role="menuitem"
            type="button"
            onClick={() => {
              setOpen(false);
              // Leave first: on a protected page the route guard would otherwise send us to
              // /login and remember the page for after the next sign-in.
              navigate("/");
              logout();
            }}
          >
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}

export default function Header() {
  const { user, ready } = useAuth();
  const { theme } = useTheme();
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();
  const icon = THEMES.find((t) => t.name === theme)?.icon ?? "/media/icon-light-64.png";

  useEffect(() => setMenuOpen(false), [location.pathname]);

  return (
    <header className="site-header">
      <div className="container header-inner">
        <Link to="/" className="brand" aria-label="GEE-Assist home">
          <img src={icon} alt="" width={34} height={34} />
          <span>GEE-Assist</span>
        </Link>

        <button
          type="button"
          className="nav-toggle"
          aria-expanded={menuOpen}
          aria-controls="site-nav"
          onClick={() => setMenuOpen((o) => !o)}
        >
          <span className="visually-hidden">Menu</span>
          <span className="nav-toggle-bars" aria-hidden="true" />
        </button>

        <nav id="site-nav" className={`site-nav${menuOpen ? " is-open" : ""}`} aria-label="Main">
          <ul>
            {NAV.map((n) => (
              <li key={n.to}>
                <NavLink to={n.to}>{n.label}</NavLink>
              </li>
            ))}
          </ul>
          <div className="nav-tools">
            <ThemeSwitcher />
            {ready && !user && (
              <Link to="/login" className="btn btn-quiet">
                Sign in
              </Link>
            )}
            <AccountMenu />
            <Link to="/download" className="btn btn-primary">
              Download
            </Link>
          </div>
        </nav>
      </div>
    </header>
  );
}
