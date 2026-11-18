/* The analyses of the desktop app (backend/data/dao/formula_catalogue.py in GEE-Assist), trimmed to
   what the website shows: key, name, sub-type, formula and the band roles it needs. */

export type Band =
  | "blue"
  | "green"
  | "red"
  | "re1"
  | "re2"
  | "re3"
  | "nir"
  | "swir1"
  | "swir2"
  | "tir"
  | "vv"
  | "vh"
  | "hh"
  | "hv"
  | "label"
  | "water";

export const BAND_NAMES: Record<Band, string> = {
  blue: "blue",
  green: "green",
  red: "red",
  re1: "red-edge 1",
  re2: "red-edge 2",
  re3: "red-edge 3",
  nir: "NIR",
  swir1: "SWIR1",
  swir2: "SWIR2",
  tir: "thermal",
  vv: "VV radar",
  vh: "VH radar",
  hh: "HH radar",
  hv: "HV radar",
  label: "land-cover class",
  water: "water class",
};

export type AnalysisKey = "Water" | "Vegetation" | "LST" | "LULC";

export const ANALYSIS_INFO: { key: AnalysisKey; label: string; fr: string; desc: string; subtypes: string[] }[] = [
  {
    key: "Water",
    label: "Water",
    fr: "FR-06",
    desc: "Open water, water quality, flooding and water area, snow and ice.",
    subtypes: ["Water indices", "Water quality", "Water bodies & area", "Snow & ice"],
  },
  {
    key: "Vegetation",
    label: "Vegetation",
    fr: "FR-07",
    desc: "Plant greenness and chlorophyll, moisture and drought, fire and burn severity.",
    subtypes: ["Vegetation indices", "Moisture & drought", "Burn & fire"],
  },
  {
    key: "LST",
    label: "Land Surface Temperature",
    fr: "FR-09",
    desc: "Surface temperature maps, its change over time and heat stress.",
    subtypes: ["Surface temperature", "Temperature change", "Heat stress"],
  },
  {
    key: "LULC",
    label: "Land Use / Land Cover",
    fr: "FR-08",
    desc: "Land-cover change, built-up land, soil and salinity, band transformations and radar.",
    subtypes: ["Land cover change", "Built-up & urban", "Soil & salinity", "Transformations", "Radar (SAR)"],
  },
];

export type Formula = {
  key: string;
  name: string;
  sub: string;
  analysis: AnalysisKey;
  formula: string;
  bands: Band[];
  /** Compares two datasets of the same place. */
  compare?: boolean;
  /** Described in the table but not computed. */
  reference?: boolean;
};

const f = (
  analysis: AnalysisKey,
  sub: string,
  key: string,
  name: string,
  formula: string,
  bands: string,
  more: Partial<Formula> = {},
): Formula => ({ analysis, sub, key, name, formula, bands: bands.split(" ").filter(Boolean) as Band[], ...more });

export const FORMULAS: Formula[] = [
  // Water
  f("Water", "Water indices", "NDWI", "Normalized Difference Water Index", "(Green − NIR) / (Green + NIR)", "green nir"),
  f("Water", "Water indices", "MNDWI", "Modified NDWI", "(Green − SWIR1) / (Green + SWIR1)", "green swir1"),
  f("Water", "Water indices", "AWEInsh", "Automated Water Extraction Index (no shadow)", "4 × (Green − SWIR1) − (0.25 × NIR + 2.75 × SWIR2)", "green swir1 nir swir2"),
  f("Water", "Water indices", "AWEIsh", "Automated Water Extraction Index (shadow)", "Blue + 2.5 × Green − 1.5 × (NIR + SWIR1) − 0.25 × SWIR2", "blue green nir swir1 swir2"),
  f("Water", "Water indices", "WRI", "Water Ratio Index", "(Green + Red) / (NIR + SWIR1)", "green red nir swir1"),
  f("Water", "Water quality", "NDTI", "Normalized Difference Turbidity Index", "(Red − Green) / (Red + Green)", "red green"),
  f("Water", "Water quality", "NDCI", "Normalized Difference Chlorophyll Index", "(RE1 − Red) / (RE1 + Red)", "re1 red"),
  f("Water", "Water quality", "FAI", "Floating Algae Index", "NIR − (Red + (SWIR1 − Red) × (λNIR − λRed) / (λSWIR1 − λRed))", "nir red swir1"),
  f("Water", "Water bodies & area", "WaterBodyDetection", "Water body detection", "MNDWI > 0, NDWI > 0, VV < −16 dB or JRC water class", ""),
  f("Water", "Water bodies & area", "WaterAreaEstimation", "Water area estimation", "Σ water pixels × pixel area", ""),
  f("Water", "Snow & ice", "NDSI", "Normalized Difference Snow Index", "(Green − SWIR1) / (Green + SWIR1)", "green swir1"),
  f("Water", "Snow & ice", "NDGI", "Normalized Difference Glacier Index", "(Green − Red) / (Green + Red)", "green red"),
  f("Water", "Snow & ice", "S3", "S3 snow index", "NIR × (Red − SWIR1) / ((NIR + Red) × (NIR + SWIR1))", "nir red swir1"),

  // Vegetation
  f("Vegetation", "Vegetation indices", "NDVI", "Normalized Difference Vegetation Index", "(NIR − Red) / (NIR + Red)", "nir red"),
  f("Vegetation", "Vegetation indices", "EVI", "Enhanced Vegetation Index", "2.5 × (NIR − Red) / (NIR + 6 × Red − 7.5 × Blue + 1)", "nir red blue"),
  f("Vegetation", "Vegetation indices", "SAVI", "Soil Adjusted Vegetation Index", "(1 + L) × (NIR − Red) / (NIR + Red + L),  L = 0.5", "nir red"),
  f("Vegetation", "Vegetation indices", "MSAVI", "Modified SAVI", "(2 × NIR + 1 − √((2 × NIR + 1)² − 8 × (NIR − Red))) / 2", "nir red"),
  f("Vegetation", "Vegetation indices", "GNDVI", "Green NDVI", "(NIR − Green) / (NIR + Green)", "nir green"),
  f("Vegetation", "Vegetation indices", "NDRE", "Normalized Difference Red Edge", "(NIR − RE1) / (NIR + RE1)", "nir re1"),
  f("Vegetation", "Vegetation indices", "GCI", "Green Chlorophyll Index", "NIR / Green − 1", "nir green"),
  f("Vegetation", "Vegetation indices", "CIre", "Red-edge Chlorophyll Index", "NIR / RE1 − 1", "nir re1"),
  f("Vegetation", "Vegetation indices", "MTCI", "MERIS Terrestrial Chlorophyll Index", "(RE2 − RE1) / (RE1 − Red)", "re2 re1 red"),
  f("Vegetation", "Vegetation indices", "ARVI", "Atmospherically Resistant Vegetation Index", "(NIR − (2 × Red − Blue)) / (NIR + (2 × Red − Blue))", "nir red blue"),
  f("Vegetation", "Vegetation indices", "VARI", "Visible Atmospherically Resistant Index", "(Green − Red) / (Green + Red − Blue)", "green red blue"),
  f("Vegetation", "Vegetation indices", "PSRI", "Plant Senescence Reflectance Index", "(Red − Blue) / RE2", "red blue re2"),
  f("Vegetation", "Vegetation indices", "LAI", "Leaf Area Index (from EVI)", "3.618 × EVI − 0.118", "nir red blue"),
  f("Vegetation", "Vegetation indices", "FAPAR", "Absorbed photosynthetic radiation (empirical)", "1.1638 × NDVI − 0.1426", "nir red"),
  f("Vegetation", "Moisture & drought", "NDMI", "Normalized Difference Moisture Index", "(NIR − SWIR1) / (NIR + SWIR1)", "nir swir1"),
  f("Vegetation", "Moisture & drought", "MSI", "Moisture Stress Index", "SWIR1 / NIR", "swir1 nir"),
  f("Vegetation", "Moisture & drought", "NDDI", "Normalized Difference Drought Index", "(NDVI − NDWI) / (NDVI + NDWI)", "nir red swir1"),
  f("Vegetation", "Moisture & drought", "VCI", "Vegetation Condition Index", "(NDVI − NDVImin) / (NDVImax − NDVImin)", "nir red"),
  f("Vegetation", "Moisture & drought", "SPI", "Standardized Precipitation Index", "Rainfall over decades, standardised", "", { reference: true }),
  f("Vegetation", "Moisture & drought", "PDSI", "Palmer Drought Severity Index", "Water balance over many months", "", { reference: true }),
  f("Vegetation", "Burn & fire", "NBR", "Normalized Burn Ratio", "(NIR − SWIR2) / (NIR + SWIR2)", "nir swir2"),
  f("Vegetation", "Burn & fire", "dNBR", "Differenced NBR", "NBRpre − NBRpost", "nir swir2", { compare: true }),
  f("Vegetation", "Burn & fire", "RdNBR", "Relative dNBR", "dNBR / √|NBRpre|", "nir swir2", { compare: true }),
  f("Vegetation", "Burn & fire", "RBR", "Relativized Burn Ratio", "dNBR / (NBRpre + 1.001)", "nir swir2", { compare: true }),
  f("Vegetation", "Burn & fire", "BAI", "Burned Area Index", "1 / ((0.1 − Red)² + (0.06 − NIR)²)", "red nir"),
  f("Vegetation", "Burn & fire", "CSI", "Char Soil Index", "NIR / SWIR2", "nir swir2"),

  // LST
  f("LST", "Surface temperature", "LSTMapping", "Land Surface Temperature map", "Thermal band → kelvin → °C", "tir"),
  f("LST", "Temperature change", "LSTTemporalAnalysis", "LST change and trend", "Latest − earliest; least-squares °C per year", "tir", { compare: true }),
  f("LST", "Heat stress", "TCI", "Temperature Condition Index", "(LSTmax − LST) / (LSTmax − LSTmin)", "tir"),
  f("LST", "Heat stress", "VHI", "Vegetation Health Index", "0.5 × VCI + 0.5 × TCI", "tir nir red"),

  // LULC
  f("LULC", "Land cover change", "LULCChangeDetection", "Land-cover change detection", "before × 100 + after, per pixel", "label", { compare: true }),
  f("LULC", "Land cover change", "LULCTransition", "Land-cover transition matrix", "Σ area of every “from → to” pair", "label", { compare: true }),
  f("LULC", "Built-up & urban", "NDBI", "Normalized Difference Built-up Index", "(SWIR1 − NIR) / (SWIR1 + NIR)", "swir1 nir"),
  f("LULC", "Built-up & urban", "UI", "Urban Index", "(SWIR2 − NIR) / (SWIR2 + NIR)", "swir2 nir"),
  f("LULC", "Built-up & urban", "IBI", "Index-based Built-up Index", "(NDBI − (SAVI + MNDWI) / 2) / (NDBI + (SAVI + MNDWI) / 2)", "swir1 nir red green"),
  f("LULC", "Built-up & urban", "BUI", "Built-up Index", "NDBI − NDVI", "swir1 nir red"),
  f("LULC", "Built-up & urban", "NDBaI", "Normalized Difference Bareness Index", "(SWIR1 − TIR) / (SWIR1 + TIR)", "swir1 tir", { reference: true }),
  f("LULC", "Soil & salinity", "BSI", "Bare Soil Index", "((SWIR1 + Red) − (NIR + Blue)) / ((SWIR1 + Red) + (NIR + Blue))", "swir1 red nir blue"),
  f("LULC", "Soil & salinity", "SI1", "Salinity Index 1", "√(Green × Red)", "green red"),
  f("LULC", "Soil & salinity", "SI_T", "Salinity Index (Tripathi)", "100 × Red / NIR", "red nir"),
  f("LULC", "Soil & salinity", "BI", "Brightness Index", "√((Red² + NIR²) / 2)", "red nir"),
  f("LULC", "Soil & salinity", "ClayIndex", "Clay Minerals Ratio", "SWIR1 / SWIR2", "swir1 swir2"),
  f("LULC", "Soil & salinity", "IronOxide", "Iron Oxide Ratio", "Red / Blue", "red blue"),
  f("LULC", "Soil & salinity", "NDTI_tillage", "Normalized Difference Tillage Index", "(SWIR1 − SWIR2) / (SWIR1 + SWIR2)", "swir1 swir2"),
  f("LULC", "Transformations", "TasseledCap", "Tasseled Cap (brightness, greenness, wetness)", "Fixed weights × the six optical bands", "blue green red nir swir1 swir2"),
  f("LULC", "Transformations", "PCA", "Principal Component Analysis", "PCₖ = eₖ · (bands − mean)", "red nir"),
  f("LULC", "Radar (SAR)", "Backscatter_dB", "Backscatter in decibels", "σ⁰(dB) = 10 × log10(σ⁰)", "vv"),
  f("LULC", "Radar (SAR)", "VV_VH_ratio", "VV/VH ratio", "VV(dB) − VH(dB)", "vv vh"),
  f("LULC", "Radar (SAR)", "RVI_SAR", "Radar Vegetation Index", "4 × VH / (VV + VH)", "vv vh"),
  f("LULC", "Radar (SAR)", "NDPI", "Normalized Difference Polarization Index", "(VV − VH) / (VV + VH)", "vv vh"),
  f("LULC", "Radar (SAR)", "RFDI", "Radar Forest Degradation Index", "(HH − HV) / (HH + HV)", "hh hv"),
  f("LULC", "Radar (SAR)", "Coherence", "Interferometric coherence", "|⟨s₁ · s₂*⟩| / √(⟨|s₁|²⟩ · ⟨|s₂|²⟩)", "", { reference: true }),
];

/** Example datasets and the band roles a download of each holds. */
export const SAMPLE_DATASETS: { key: string; label: string; bands: Band[]; water?: boolean }[] = [
  {
    key: "s2",
    label: "Sentinel-2 surface reflectance",
    bands: ["blue", "green", "red", "re1", "re2", "re3", "nir", "swir1", "swir2"],
  },
  { key: "l8", label: "Landsat 8 Level 2", bands: ["blue", "green", "red", "nir", "swir1", "swir2", "tir"] },
  { key: "s1", label: "Sentinel-1 radar", bands: ["vv", "vh"] },
  { key: "dw", label: "Dynamic World land cover", bands: ["label"] },
  { key: "modis", label: "MODIS land surface temperature", bands: ["tir"] },
];

/** Why a dataset cannot run a process, or "" when it can. */
export function whyNot(formula: Formula, bands: Band[]): string {
  if (formula.reference) return "Reference only: needs data a single download does not hold";
  if (formula.key === "WaterBodyDetection" || formula.key === "WaterAreaEstimation") {
    const ok =
      bands.includes("vv") ||
      (bands.includes("green") && (bands.includes("nir") || bands.includes("swir1"))) ||
      bands.includes("water");
    return ok ? "" : "Needs green and NIR or SWIR1 bands, or radar (VV) data";
  }
  const missing = formula.bands.filter((b) => !bands.includes(b));
  if (missing.length === 0) return "";
  if (missing.length === 1) return `Needs the ${BAND_NAMES[missing[0]]} band`;
  return `Needs the ${missing
    .slice(0, -1)
    .map((b) => BAND_NAMES[b])
    .join(", ")} and ${BAND_NAMES[missing[missing.length - 1]]} bands`;
}
