import { lazy, Suspense, useEffect } from "react";
import { Route, Routes, useLocation } from "react-router-dom";
import Header from "./components/layout/Header";
import Footer from "./components/layout/Footer";
import RequireAuth from "./auth/RequireAuth";
import Loading from "./components/Loading";
import Home from "./pages/Home";

const Features = lazy(() => import("./pages/Features"));
const Datasets = lazy(() => import("./pages/Datasets"));
const TerminalPage = lazy(() => import("./pages/TerminalPage"));
const About = lazy(() => import("./pages/About"));
const Download = lazy(() => import("./pages/Download"));
const Community = lazy(() => import("./pages/Community"));
const Login = lazy(() => import("./pages/auth/Login"));
const Signup = lazy(() => import("./pages/auth/Signup"));
const Verify = lazy(() => import("./pages/auth/Verify"));
const Account = lazy(() => import("./pages/Account"));
const Admin = lazy(() => import("./pages/admin/Admin"));
const NotFound = lazy(() => import("./pages/NotFound"));

const TITLES: Record<string, string> = {
  "/": "GEE-Assist: Earth Engine data in plain words",
  "/features": "Features · GEE-Assist",
  "/datasets": "Datasets · GEE-Assist",
  "/terminal": "Try the terminal · GEE-Assist",
  "/about": "About · GEE-Assist",
  "/download": "Download · GEE-Assist",
  "/community": "Community · GEE-Assist",
  "/login": "Sign in · GEE-Assist",
  "/signup": "Create an account · GEE-Assist",
  "/verify": "Check your email · GEE-Assist",
  "/account": "Your account · GEE-Assist",
  "/admin": "Admin · GEE-Assist",
};

function ScrollAndTitle() {
  const { pathname, hash } = useLocation();
  useEffect(() => {
    document.title = TITLES[pathname] ?? "GEE-Assist";
    if (hash) {
      document.getElementById(hash.slice(1))?.scrollIntoView();
    } else {
      window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
    }
  }, [pathname, hash]);
  return null;
}

export default function App() {
  return (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <ScrollAndTitle />
      <Header />
      <main id="main" tabIndex={-1}>
        <Suspense fallback={<Loading />}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/features" element={<Features />} />
            <Route path="/datasets" element={<Datasets />} />
            <Route path="/terminal" element={<TerminalPage />} />
            <Route path="/about" element={<About />} />
            <Route path="/download" element={<Download />} />
            <Route path="/community" element={<Community />} />
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/verify" element={<Verify />} />
            <Route
              path="/account"
              element={
                <RequireAuth>
                  <Account />
                </RequireAuth>
              }
            />
            <Route
              path="/admin"
              element={
                <RequireAuth admin>
                  <Admin />
                </RequireAuth>
              }
            />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </main>
      <Footer />
    </>
  );
}
