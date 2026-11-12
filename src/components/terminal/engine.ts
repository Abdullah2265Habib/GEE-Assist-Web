/**
 * A small simulation of gkonsol, the terminal inside the GEE-Assist desktop
 * app. It understands the app's real commands and answers the way the app
 * does, but nothing is downloaded: it is a demonstration for the website.
 */

import { DATASETS, type Dataset } from "../../data/datasets";

export type LineKind = "input" | "out" | "ok" | "err" | "muted" | "blue" | "progress";

export interface Line {
  kind: LineKind;
  text: string;
}

export interface FormState {
  dataset: Dataset | null;
  bands: string[];
  scale: number;
  cloud: number | null;
  composite: string;
  start: string;
  end: string;
  aoi: { kind: "bbox"; w: number; s: number; e: number; n: number } | { kind: "circle"; lon: number; lat: number; km: number } | null;
  crs: string;
  analysis: { type: string; processes: string[] } | null;
}

export interface Session {
  user: string;
  form: FormState;
  requests: FormState[];
  history: string[];
  downloads: { id: string; name: string; sizeMb: number; chunks: number; done: boolean }[];
}

const DEFAULT_BANDS: Record<string, string[]> = {
  sentinel2_sr: ["B2", "B3", "B4", "B8", "B11"],
  sentinel2_toa: ["B2", "B3", "B4", "B8", "B11"],
  landsat9_l2: ["SR_B2", "SR_B3", "SR_B4", "SR_B5", "SR_B6"],
  landsat8_l2: ["SR_B2", "SR_B3", "SR_B4", "SR_B5", "SR_B6"],
  landsat7_l2: ["SR_B1", "SR_B2", "SR_B3", "SR_B4", "SR_B5"],
  landsat5_l2: ["SR_B1", "SR_B2", "SR_B3", "SR_B4", "SR_B5"],
  modis_sr_8day: ["sur_refl_b01", "sur_refl_b02"],
  sentinel1_grd: ["VV", "VH"],
  modis_vi_16day: ["NDVI", "EVI"],
  modis_lst: ["LST_Day_1km", "LST_Night_1km"],
  modis_lst_aqua: ["LST_Day_1km", "LST_Night_1km"],
  era5_land_daily: ["temperature_2m", "skin_temperature"],
  dynamic_world: ["label"],
  modis_landcover: ["LC_Type1"],
  jrc_water_monthly: ["water"],
};

export function newSession(user = "guest"): Session {
  const s2 = DATASETS.find((d) => d.key === "sentinel2_sr")!;
  return {
    user,
    form: {
      dataset: s2,
      bands: DEFAULT_BANDS.sentinel2_sr,
      scale: 10,
      cloud: 20,
      composite: "median",
      start: "2026-08-10",
      end: "2026-11-10",
      aoi: null,
      crs: "EPSG:4326",
      analysis: null,
    },
    requests: [],
    history: [],
    downloads: [],
  };
}

const L = (kind: LineKind, text: string): Line => ({ kind, text });

function findDataset(q: string): Dataset | null {
  const k = q.toLowerCase().replace(/[\s-]+/g, "");
  const aliases: Record<string, string> = {
    s2: "sentinel2_sr",
    sentinel2: "sentinel2_sr",
    sentinel2sr: "sentinel2_sr",
    sentinel2toa: "sentinel2_toa",
    l9: "landsat9_l2",
    landsat9: "landsat9_l2",
    l8: "landsat8_l2",
    landsat8: "landsat8_l2",
    l7: "landsat7_l2",
    landsat7: "landsat7_l2",
    l5: "landsat5_l2",
    landsat5: "landsat5_l2",
    s1: "sentinel1_grd",
    sentinel1: "sentinel1_grd",
    modis: "modis_sr_8day",
    era5: "era5_land_daily",
    dynamicworld: "dynamic_world",
    jrc: "jrc_water_monthly",
  };
  const key = aliases[k];
  if (key) return DATASETS.find((d) => d.key === key) ?? null;
  return DATASETS.find((d) => d.key.replace(/_/g, "") === k || d.key.startsWith(q.toLowerCase())) ?? null;
}

function aoiText(f: FormState): string {
  if (!f.aoi) return "none";
  if (f.aoi.kind === "bbox") {
    const a = f.aoi;
    return `Rectangle (Polygon, 4 vertices) · lon ${a.w.toFixed(4)} → ${a.e.toFixed(4)}, lat ${a.s.toFixed(4)} → ${a.n.toFixed(4)}`;
  }
  return `Circle (Polygon, 64 vertices) · ${f.aoi.km} km around ${f.aoi.lon.toFixed(4)}, ${f.aoi.lat.toFixed(4)}`;
}

/** Rough size: pixels × bands × 4 bytes (float32). */
function estimate(f: FormState): { w: number; h: number; mb: number; chunks: number; requests: number } | null {
  if (!f.aoi || f.bands.length === 0) return null;
  let widthM: number;
  let heightM: number;
  if (f.aoi.kind === "bbox") {
    const midLat = (f.aoi.s + f.aoi.n) / 2;
    widthM = (f.aoi.e - f.aoi.w) * 111_320 * Math.cos((midLat * Math.PI) / 180);
    heightM = (f.aoi.n - f.aoi.s) * 110_574;
  } else {
    widthM = heightM = f.aoi.km * 2000;
  }
  const w = Math.max(1, Math.round(widthM / f.scale));
  const h = Math.max(1, Math.round(heightM / f.scale));
  const bytes = w * h * f.bands.length * 4;
  const mb = bytes / 1_048_576;
  return { w, h, mb, chunks: Math.max(1, Math.ceil(mb / 500)), requests: Math.max(1, Math.ceil(mb / 4)) };
}

function fmtMb(mb: number): string {
  if (mb >= 1024) return `${(mb / 1024).toFixed(1)} GB`;
  if (mb >= 10) return `${mb.toFixed(0)} MB`;
  return `${mb.toFixed(1)} MB`;
}

function days(a: string, b: string): number {
  return Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000);
}

function showForm(f: FormState): Line[] {
  const lines: Line[] = [L("out", "Parameter form")];
  lines.push(L("out", `  Dataset      ${f.dataset ? `${f.dataset.key}  (${f.dataset.name})` : "none"}`));
  lines.push(L("out", `  Bands        ${f.bands.join(", ") || "none"}`));
  lines.push(L("out", `  Scale        ${f.scale} m / pixel`));
  if (f.dataset?.cloudFilter) lines.push(L("out", `  Cloud cover  at most ${f.cloud ?? 20} %`));
  lines.push(L("out", `  Composite    ${f.composite}`));
  lines.push(L("out", `  Area         ${aoiText(f)}`));
  lines.push(L("out", `  Dates        ${f.start} → ${f.end}  (${days(f.start, f.end)} days)`));
  lines.push(L("out", `  Projection   ${f.crs === "EPSG:4326" ? "WGS 84 (EPSG:4326, degrees)" : f.crs}`));
  lines.push(L("out", "  Save to      D:\\GEE-Assist\\workspace\\downloads"));
  lines.push(L("out", `  Analysis     ${f.analysis ? `${f.analysis.type}: ${f.analysis.processes.join(", ")}` : "none (download only)"}`));
  return lines;
}

function validate(f: FormState): string[] {
  const problems: string[] = [];
  if (!f.dataset) problems.push("Dataset: choose a dataset.  → form set dataset <KEY>");
  if (!f.aoi) problems.push("Area: Specify an Area of Interest: import a GeoJSON file, or draw a rectangle, circle or polygon on the map.\n  → form aoi bbox <W> <S> <E> <N>  (or circle / file)");
  if (f.bands.length === 0) problems.push("Bands: choose at least one band.  → form set bands default");
  if (f.dataset && f.start < f.dataset.since) problems.push(`Dates: ${f.dataset.name} starts on ${f.dataset.since}.  → form set start ${f.dataset.since}`);
  return problems;
}

const HELP: Line[] = [
  L("out", "gkonsol commands (this is a demonstration: nothing is really downloaded)"),
  L("out", ""),
  L("blue", "General     "),
  L("out", "  help, clear, history, echo, version, exit"),
  L("blue", "Account     "),
  L("out", "  whoami, user info, session, session verify, server status"),
  L("blue", "Earth Engine"),
  L("out", "  gee status, gee verify, gee login, doctor"),
  L("blue", "Parameters  "),
  L("out", "  datasets list, form show, form set FIELD VALUE, form aoi bbox W S E N,"),
  L("out", "  form aoi circle LON LAT RADIUS, form validate, form estimate, form submit, ask TEXT"),
  L("blue", "Downloads   "),
  L("out", "  requests list, download start [N], download list, download speed"),
  L("out", ""),
  L("muted", "Type help <command> for one command, e.g. help form set."),
];

const HELP_FORM_SET: Line[] = [
  L("out", "form set FIELD VALUE...   Sets one field of the parameter form."),
  L("out", "  dataset    KEY            e.g. landsat8_l2, sentinel2_sr, s2, l8 (see datasets list)"),
  L("out", "  bands      BAND...        bands of the chosen dataset, or default / all"),
  L("out", "  scale      METRES         pixel size, 1-100000"),
  L("out", "  cloud      PERCENT        only datasets with a cloud filter"),
  L("out", "  composite  median|mean|mosaic|min|max|mode"),
  L("out", "  dates      START END      YYYY-MM-DD"),
  L("out", "  crs        EPSG:4326 | utm | EPSG:3857"),
  L("out", "  analysis   none | Water|Vegetation|LST|LULC [PROCESS...]"),
];

export interface RunResult {
  lines: Line[];
  /** When set, the terminal animates a download progress bar after printing the lines. */
  progress?: { id: string; name: string; sizeMb: number; chunks: number };
  clear?: boolean;
}

export function run(session: Session, raw: string): RunResult {
  const input = raw.trim();
  if (!input) return { lines: [] };
  session.history.push(input);
  const [cmd, ...rest] = input.split(/\s+/);
  const c = cmd.toLowerCase();
  const sub = (rest[0] ?? "").toLowerCase();
  const f = session.form;

  switch (c) {
    case "help":
    case "?":
      if (sub === "form" && (rest[1] ?? "").toLowerCase() === "set") return { lines: HELP_FORM_SET };
      return { lines: HELP };

    case "clear":
    case "cls":
      return { lines: [], clear: true };

    case "echo":
      return { lines: [L("out", rest.join(" "))] };

    case "history": {
      const n = Number(rest[0]) || 20;
      const items = session.history.slice(-n);
      const start = session.history.length - items.length + 1;
      return {
        lines: [
          ...items.map((h, i) => L("out", `${String(start + i).padStart(2)}  ${h}`)),
          L("muted", "Run one again with !<number>, or the last one with !!."),
        ],
      };
    }

    case "version":
    case "about":
      return {
        lines: [
          L("out", "gkonsol 1.0  ·  GEE-Assist 1.0.0"),
          L("out", "Python 3.12  ·  PyQt 6.7 (Qt 6.7)  ·  earthengine-api 1.5  ·  google-genai 1.2"),
          L("out", "Windows 11"),
        ],
      };

    case "exit":
    case "close":
      return { lines: [L("muted", "In the app this hides the terminal. Here it has nowhere to go.")] };

    case "whoami":
      return { lines: [L("out", `${session.user}  ${session.user === "guest" ? "Website visitor" : session.user}  ·  User`)] };

    case "user":
    case "account":
      return {
        lines: [
          L("out", `  Name         ${session.user === "guest" ? "Website visitor" : session.user}`),
          L("out", `  Username     ${session.user}`),
          L("out", "  Email        guest@example.com  (verified)"),
          L("out", "  Role         User"),
          L("out", "  Active       Yes"),
          L("out", "  Sign-in      username and password"),
          L("out", "  Member since 12 Nov 2026"),
        ],
      };

    case "session":
      if (sub === "verify" || sub === "check")
        return { lines: [L("ok", "✓ The server accepts your session (41 ms)."), L("muted", "  Access token renews in 27 min.")] };
      return {
        lines: [
          L("out", `  Signed in as    ${session.user}`),
          L("out", "  Server          http://localhost:8000"),
          L("out", "  Kept signed in  Yes, until 19 Nov 2026, 18:40 (in 6 d 23 h)"),
          L("out", "  Access token    renews in 27 min"),
          L("out", "  Refresh token   held"),
          L("muted", "'session verify' asks the server whether the session is still valid."),
        ],
      };

    case "server":
      return { lines: [L("ok", "✓ Authentication server http://localhost:8000 answered in 12 ms.")] };

    case "signout":
    case "logout":
      return { lines: [L("muted", "Signing out needs the app. On the website, use the account menu at the top.")] };

    case "gee":
      if (sub === "verify")
        return {
          lines: [
            L("ok", "✓ Earth Engine library         earthengine-api 1.5.2"),
            L("ok", "✓ Cloud project (GEE_PROJECT)  gee-assist-demo"),
            L("ok", "✓ Sign-in on this computer     ~/.config/earthengine/credentials"),
            L("ok", "✓ Earth Engine answers         ee.Initialize() took 0.9 s"),
            L("out", "Earth Engine is ready."),
          ],
        };
      if (sub === "login")
        return {
          lines: [
            L("out", "Opening Google in your browser to sign in to Earth Engine…"),
            L("ok", "✓ Signed in. Credentials saved for next time."),
          ],
        };
      return { lines: [L("out", "  Cloud project   gee-assist-demo"), L("ok", "✓ Earth Engine can be used (checked in 0.9 s)")] };

    case "doctor":
      return {
        lines: [
          L("ok", "✓ Authentication server   http://localhost:8000 (12 ms)"),
          L("ok", "✓ Session                 valid, renews in 27 min"),
          L("ok", "✓ Gemini                  GEMINI_API_KEY set, model answers"),
          L("ok", "✓ Download folder         D:\\GEE-Assist\\workspace\\downloads (210 GB free)"),
          L("ok", "✓ Earth Engine            project gee-assist-demo, signed in"),
          L("out", "Everything is ready."),
        ],
      };

    case "datasets":
      return {
        lines: [
          L("out", "Datasets (key  ·  name  ·  resolution  ·  dates)"),
          ...DATASETS.map((d) =>
            L("out", `  ${d.key.padEnd(18)} ${d.name.padEnd(56)} ${String(d.scale).padStart(5)} m   ${d.since} → ${d.until ?? "now"}`),
          ),
        ],
      };

    case "ask":
    case "gemini":
    case "nl": {
      const text = rest.join(" ");
      if (!text) return { lines: [L("err", "ask: describe what you need, e.g.  ask NDVI of Lahore for summer 2024 from Sentinel-2")] };
      const lower = text.toLowerCase();
      const ds =
        (lower.includes("landsat 8") || lower.includes("landsat-8")) ? findDataset("landsat8") :
        (lower.includes("landsat 9") || lower.includes("landsat-9")) ? findDataset("landsat9") :
        lower.includes("sentinel-1") || lower.includes("radar") ? findDataset("sentinel1") :
        lower.includes("modis") ? findDataset("modis") :
        findDataset("sentinel2");
      const year = (lower.match(/\b(19[89]\d|20[0-4]\d)\b/) ?? [])[1] ?? "2024";
      const summer = lower.includes("summer");
      const winter = lower.includes("winter");
      f.dataset = ds;
      f.bands = DEFAULT_BANDS[ds?.key ?? "sentinel2_sr"];
      f.scale = ds?.scale ?? 10;
      f.start = summer ? `${year}-06-01` : winter ? `${year}-12-01` : `${year}-01-01`;
      f.end = summer ? `${year}-08-31` : winter ? `${Number(year) + 1}-02-28` : `${year}-12-31`;
      const place =
        lower.includes("lahore") ? { name: "Lahore", w: 74.2, s: 31.4, e: 74.45, n: 31.6 } :
        lower.includes("karachi") ? { name: "Karachi", w: 66.9, s: 24.75, e: 67.25, n: 25.05 } :
        lower.includes("islamabad") ? { name: "Islamabad", w: 72.9, s: 33.6, e: 73.2, n: 33.8 } :
        lower.includes("mangla") ? { name: "Mangla Dam", w: 73.5, s: 33.05, e: 73.8, n: 33.25 } :
        null;
      if (place) f.aoi = { kind: "bbox", ...place };
      const analysis =
        lower.includes("ndvi") || lower.includes("vegetation") ? { type: "Vegetation", processes: ["NDVI"] } :
        lower.includes("water") || lower.includes("flood") ? { type: "Water", processes: ["NDWI"] } :
        lower.includes("temperature") || lower.includes("lst") ? { type: "LST", processes: ["LSTMapping"] } :
        null;
      if (analysis && ds?.analyses.includes(analysis.type as never)) f.analysis = analysis;
      const lines: Line[] = [
        L("muted", "Gemini is reading your request…"),
        L("out", "Recognised:"),
        ...(place ? [L("out", `  PLACE     ${place.name}`)] : []),
        L("out", `  DATE      ${f.start} → ${f.end}`),
        L("out", `  DATASET   ${ds?.name ?? "Sentinel-2"}`),
        ...(analysis ? [L("out", `  ANALYSIS  ${analysis.type} (${analysis.processes.join(", ")})`)] : []),
        L("ok", `✓ Filled: dataset, bands, scale, dates${place ? ", area" : ""}${f.analysis ? ", analysis" : ""}.`),
      ];
      if (!place) lines.push(L("blue", "? Which area do you mean? Name a place, or set it with: form aoi bbox W S E N"));
      lines.push(L("muted", "Check the values with form show, then form submit."));
      return { lines };
    }

    case "form":
    case "params": {
      if (!sub || sub === "show") return { lines: showForm(f) };
      if (sub === "set") {
        const field = (rest[1] ?? "").toLowerCase();
        const vals = rest.slice(2);
        if (!field) return { lines: HELP_FORM_SET };
        switch (field) {
          case "dataset": {
            const ds = findDataset(vals.join(" "));
            if (!ds) return { lines: [L("err", `✗ Unknown dataset '${vals.join(" ")}'. See datasets list.`)] };
            f.dataset = ds;
            f.bands = DEFAULT_BANDS[ds.key] ?? [];
            f.scale = ds.scale;
            f.cloud = ds.cloudFilter ? 20 : null;
            if (f.start < ds.since) f.start = ds.since;
            if (ds.until && f.end > ds.until) f.end = ds.until;
            return {
              lines: [
                L("ok", `✓ dataset = ${ds.key}  (${ds.name})`),
                L("muted", `  bands ${f.bands.join(", ")} · ${f.scale} m${ds.cloudFilter ? " · cloud cover ≤ 20 %" : ""} · dates ${f.start} → ${f.end}`),
              ],
            };
          }
          case "bands":
            if (vals[0]?.toLowerCase() === "default") f.bands = DEFAULT_BANDS[f.dataset?.key ?? ""] ?? [];
            else f.bands = vals.join(" ").split(/[\s,]+/).filter(Boolean).map((b) => b.toUpperCase().replace("SR_B", "SR_B"));
            return { lines: [L("ok", `✓ bands = ${f.bands.join(", ")}`)] };
          case "scale": {
            const m = parseInt(vals[0] ?? "", 10);
            if (!m || m < 1 || m > 100000) return { lines: [L("err", "✗ scale: a pixel size in metres, 1-100000 (e.g. 30 or 30m).")] };
            f.scale = m;
            return { lines: [L("ok", `✓ scale = ${m} m / pixel`)] };
          }
          case "cloud":
          case "cloud-cover":
          case "clouds": {
            if (!f.dataset?.cloudFilter) return { lines: [L("err", `✗ ${f.dataset?.name ?? "This dataset"} has no cloud filter.`)] };
            const p = parseInt(vals[0] ?? "", 10);
            if (Number.isNaN(p) || p < 0 || p > 100) return { lines: [L("err", "✗ cloud: a percentage from 0 to 100.")] };
            f.cloud = p;
            return { lines: [L("ok", `✓ cloud cover = at most ${p} %`)] };
          }
          case "composite":
            if (!["median", "mean", "mosaic", "min", "max", "mode"].includes((vals[0] ?? "").toLowerCase()))
              return { lines: [L("err", "✗ composite: median, mean, mosaic, min, max or mode.")] };
            f.composite = vals[0].toLowerCase();
            return { lines: [L("ok", `✓ composite = ${f.composite}`)] };
          case "dates":
          case "start":
          case "end": {
            const iso = /^\d{4}-\d{2}-\d{2}$/;
            const [a, b] = vals;
            if (field === "dates" && (!iso.test(a ?? "") || !iso.test(b ?? "")))
              return { lines: [L("err", "✗ dates: START END as YYYY-MM-DD, e.g. form set dates 2024-06-01 2024-08-31")] };
            if (field !== "dates" && !iso.test(a ?? "")) return { lines: [L("err", `✗ ${field}: a date as YYYY-MM-DD.`)] };
            const start = field === "end" ? f.start : a;
            const end = field === "dates" ? b : field === "end" ? a : f.end;
            if (start > end) return { lines: [L("err", "✗ The start date must be on or before the end date.")] };
            if (f.dataset && start < f.dataset.since)
              return { lines: [L("err", `✗ ${f.dataset.name} starts on ${f.dataset.since}.`)] };
            if (f.dataset?.until && end > f.dataset.until)
              return { lines: [L("err", `✗ ${f.dataset.name} ends on ${f.dataset.until}.`)] };
            f.start = start;
            f.end = end;
            return { lines: [L("ok", `✓ dates = ${f.start} → ${f.end}  (${days(f.start, f.end)} days)`)] };
          }
          case "crs":
          case "projection": {
            const v = (vals[0] ?? "").toLowerCase();
            const crs = v === "utm" || v === "auto" ? "UTM (zone of the area)" : v === "epsg:3857" || v === "mercator" ? "EPSG:3857" : v === "epsg:4326" || v === "wgs84" ? "EPSG:4326" : null;
            if (!crs) return { lines: [L("err", "✗ crs: EPSG:4326 (wgs84), utm, or EPSG:3857 (mercator).")] };
            f.crs = crs;
            return { lines: [L("ok", `✓ projection = ${crs}`)] };
          }
          case "analysis": {
            const type = vals[0];
            if (!type || type.toLowerCase() === "none") {
              f.analysis = null;
              return { lines: [L("ok", "✓ analysis = none (download only)")] };
            }
            const t = ["Water", "Vegetation", "LST", "LULC"].find((x) => x.toLowerCase() === type.toLowerCase());
            if (!t) return { lines: [L("err", "✗ analysis: Water, Vegetation, LST or LULC, followed by its processes.")] };
            if (f.dataset && !f.dataset.analyses.includes(t as never))
              return { lines: [L("err", `✗ ${f.dataset.name} does not support ${t}. It supports: ${f.dataset.analyses.join(", ")}.`)] };
            const procs = vals.slice(1);
            f.analysis = { type: t, processes: procs.length ? procs : [{ Water: "NDWI", Vegetation: "NDVI", LST: "LSTMapping", LULC: "LULCChangeDetection" }[t]!] };
            return { lines: [L("ok", `✓ analysis = ${t}: ${f.analysis.processes.join(", ")}`)] };
          }
          case "output":
          case "folder":
          case "save-to":
            return { lines: [L("ok", `✓ save to = ${vals.join(" ").replace(/^"|"$/g, "")}`)] };
          default:
            return { lines: [L("err", `✗ form set: unknown field '${field}'.`), ...HELP_FORM_SET] };
        }
      }
      if (sub === "aoi" || sub === "area") {
        const what = (rest[1] ?? "show").toLowerCase();
        if (what === "show") return { lines: [L("out", `  Area  ${aoiText(f)}`)] };
        if (what === "clear") {
          f.aoi = null;
          return { lines: [L("ok", "✓ area cleared")] };
        }
        if (what === "bbox" || what === "rect" || what === "rectangle") {
          const [w, s, e, n] = rest.slice(2).map(Number);
          if ([w, s, e, n].some((x) => Number.isNaN(x)) || rest.length < 6)
            return { lines: [L("err", "✗ form aoi bbox W S E N   (longitudes west/east, latitudes south/north, in degrees)")] };
          if (w >= e || s >= n) return { lines: [L("err", "✗ West must be less than east and south less than north.")] };
          f.aoi = { kind: "bbox", w, s, e, n };
        } else if (what === "circle") {
          const [lon, lat] = rest.slice(2, 4).map(Number);
          const r = rest[4] ?? "";
          const km = r.endsWith("km") ? parseFloat(r) : r.endsWith("m") ? parseFloat(r) / 1000 : parseFloat(r) / 1000;
          if ([lon, lat, km].some((x) => Number.isNaN(x))) return { lines: [L("err", "✗ form aoi circle LON LAT RADIUS   (e.g. form aoi circle 73.08 31.42 10km)")] };
          if (km > 500) return { lines: [L("err", "✗ The radius can be at most 500 km.")] };
          f.aoi = { kind: "circle", lon, lat, km };
        } else if (what === "file" || what === "geojson") {
          return { lines: [L("muted", "Importing a GeoJSON file needs the app. Try form aoi bbox or form aoi circle here.")] };
        } else {
          return { lines: [L("err", "✗ form aoi: show, bbox, circle, file, geojson or clear.")] };
        }
        const est = estimate(f);
        return {
          lines: [
            L("ok", `✓ area = ${aoiText(f)}`),
            ...(est ? [L("muted", `  ≈ ${fmtMb(est.mb)} in ${est.chunks} chunk${est.chunks > 1 ? "s" : ""} of 500 MB  ·  'form estimate' for more`)] : []),
          ],
        };
      }
      if (sub === "validate" || sub === "check") {
        const problems = validate(f);
        if (problems.length === 0) return { lines: [L("ok", "✓ The form is valid. form submit keeps it as a request.")] };
        return { lines: problems.map((p) => L("err", `✗ ${p}`)) };
      }
      if (sub === "estimate") {
        const est = estimate(f);
        if (!est) return { lines: [L("err", "✗ form estimate needs an area and at least one band.")] };
        return {
          lines: [
            L("out", `  Grid          ${est.w} × ${est.h} px`),
            L("out", `  Bands         ${f.bands.length}`),
            L("out", `  Size          about ${fmtMb(est.mb)} (float32 GeoTIFF)`),
            L("out", `  Chunks        ${est.chunks} chunk${est.chunks > 1 ? "s" : ""} of 500 MB`),
            L("out", `  GEE requests  ${est.requests} (GEE allows 48.0 MB per request)`),
          ],
        };
      }
      if (sub === "submit") {
        const problems = validate(f);
        if (problems.length) return { lines: problems.map((p) => L("err", `✗ ${p}`)) };
        session.requests.push({ ...f });
        const n = session.requests.length;
        return { lines: [L("ok", `✓ Parameters accepted and kept as request #${n}.`), L("muted", `  → download start ${n}  downloads it`)] };
      }
      if (sub === "reset") {
        const fresh = newSession(session.user).form;
        Object.assign(f, fresh);
        return { lines: [L("ok", "✓ The form is back to its defaults.")] };
      }
      if (sub === "wizard" || sub === "fill") return { lines: [L("muted", "The wizard asks one question per field in the app. Here, use form set.")] };
      return { lines: [L("err", `✗ form: unknown subcommand '${sub}'. Try form show, form set, form aoi, form validate, form estimate, form submit.`)] };
    }

    case "requests":
    case "req":
    case "kept": {
      if (session.requests.length === 0) return { lines: [L("muted", "No kept requests yet. Fill the form and form submit.")] };
      return {
        lines: session.requests.map((r, i) =>
          L("out", `  #${i + 1}  ${r.dataset?.satellite ?? "?"}${r.analysis ? ` ${r.analysis.type}: ${r.analysis.processes.join(", ")}` : ""}  ·  ${r.start} → ${r.end}  ·  ${aoiText(r)}  ·  ready`),
        ),
      };
    }

    case "download":
    case "dl":
    case "downloads": {
      if (sub === "start") {
        const n = parseInt(rest[1] ?? "", 10) || session.requests.length;
        const r = session.requests[n - 1];
        if (!r) return { lines: [L("err", "✗ No request to download. Fill the form and form submit first.")] };
        const est = estimate(r)!;
        const id = Math.random().toString(16).slice(2, 10);
        const centre =
          r.aoi!.kind === "bbox"
            ? { lon: (r.aoi!.w + r.aoi!.e) / 2, lat: (r.aoi!.s + r.aoi!.n) / 2 }
            : { lon: r.aoi!.lon, lat: r.aoi!.lat };
        const name = `${r.dataset!.satellite}_${centre.lon.toFixed(4)}_${centre.lat.toFixed(4)}_${r.start}_${r.end}`;
        session.downloads.push({ id, name, sizeMb: est.mb, chunks: est.chunks, done: false });
        return {
          lines: [
            L("out", `Download ${id}  ·  ${name}`),
            L("out", `  ${fmtMb(est.mb)} in ${est.chunks} chunk${est.chunks > 1 ? "s" : ""}  ·  ${est.requests} GEE request${est.requests > 1 ? "s" : ""}  ·  D:\\GEE-Assist\\workspace\\downloads\\${name}\\`),
            L("muted", "  Ctrl+C stops following; the download goes on."),
          ],
          progress: { id, name, sizeMb: est.mb, chunks: est.chunks },
        };
      }
      if (sub === "speed") return { lines: [L("muted", "In the app this opens a live speed chart. Start a download here to see the progress bar.")] };
      if (!sub || sub === "list" || sub === "ls") {
        if (session.downloads.length === 0) return { lines: [L("muted", "No downloads yet.")] };
        return {
          lines: session.downloads.map((d, i) =>
            L("out", `  #${i + 1}  ${d.id}  ${d.name}  ${d.done ? "completed  [██████████] 100 %" : "running"}  ${fmtMb(d.sizeMb)}`),
          ),
        };
      }
      return { lines: [L("err", `✗ download: start, list or speed.`)] };
    }

    default:
      if (["dir", "ls", "cd", "python", "pip", "earthengine", "git", "npm"].includes(c))
        return { lines: [L("err", `${c}: gkonsol commands work only inside GEE-Assist. This is not a Windows shell.`)] };
      return { lines: [L("err", `${c}: unknown command. Type help.`)] };
  }
}
