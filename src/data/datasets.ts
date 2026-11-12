/** The datasets the desktop app can download, copied from its backend/config/datasets.py. */

export type DatasetCategory =
  | "Optical (multispectral)"
  | "Radar (SAR)"
  | "Vegetation products"
  | "Temperature"
  | "Land cover"
  | "Surface water";

export type AnalysisGroup = "Water" | "Vegetation" | "LST" | "LULC";

export interface Dataset {
  key: string;
  name: string;
  satellite: string;
  category: DatasetCategory;
  collectionId: string;
  /** Metres per pixel. */
  scale: number;
  /** First acquisition date (ISO). */
  since: string;
  /** Null when the sensor is still acquiring. */
  until: string | null;
  analyses: AnalysisGroup[];
  cloudFilter: boolean;
  note: string;
}

export const DATASET_CATEGORIES: DatasetCategory[] = [
  "Optical (multispectral)",
  "Radar (SAR)",
  "Vegetation products",
  "Temperature",
  "Land cover",
  "Surface water",
];

export const ANALYSES: Record<AnalysisGroup, { label: string; processes: string[] }> = {
  Water: { label: "Water", processes: ["NDWI", "MNDWI", "Water body detection", "Water area estimation"] },
  Vegetation: { label: "Vegetation", processes: ["NDVI", "EVI", "SAVI", "GNDVI"] },
  LST: { label: "Land surface temperature", processes: ["LST mapping", "LST temporal analysis"] },
  LULC: { label: "Land use / land cover", processes: ["LULC change detection", "LULC transition"] },
};

export const DATASETS: Dataset[] = [
  {
    key: "sentinel2_sr",
    name: "Sentinel-2 Surface Reflectance (L2A)",
    satellite: "Sentinel-2",
    category: "Optical (multispectral)",
    collectionId: "COPERNICUS/S2_SR_HARMONIZED",
    scale: 10,
    since: "2017-03-28",
    until: null,
    analyses: ["Water", "Vegetation"],
    cloudFilter: true,
    note: "The sharpest free optical imagery. Atmospherically corrected, so indices compare well across dates.",
  },
  {
    key: "sentinel2_toa",
    name: "Sentinel-2 Top-of-Atmosphere (L1C)",
    satellite: "Sentinel-2",
    category: "Optical (multispectral)",
    collectionId: "COPERNICUS/S2_HARMONIZED",
    scale: 10,
    since: "2015-06-27",
    until: null,
    analyses: ["Water", "Vegetation"],
    cloudFilter: true,
    note: "Reaches two years further back than L2A. Not atmospherically corrected.",
  },
  {
    key: "landsat9_l2",
    name: "Landsat 9 Collection 2 Level-2",
    satellite: "Landsat-9",
    category: "Optical (multispectral)",
    collectionId: "LANDSAT/LC09/C02/T1_L2",
    scale: 30,
    since: "2021-10-31",
    until: null,
    analyses: ["Water", "Vegetation", "LST"],
    cloudFilter: true,
    note: "Surface reflectance plus a thermal band, so it also supports land surface temperature.",
  },
  {
    key: "landsat8_l2",
    name: "Landsat 8 Collection 2 Level-2",
    satellite: "Landsat-8",
    category: "Optical (multispectral)",
    collectionId: "LANDSAT/LC08/C02/T1_L2",
    scale: 30,
    since: "2013-03-18",
    until: null,
    analyses: ["Water", "Vegetation", "LST"],
    cloudFilter: true,
    note: "Same bands as Landsat 9, a decade longer record.",
  },
  {
    key: "landsat7_l2",
    name: "Landsat 7 Collection 2 Level-2",
    satellite: "Landsat-7",
    category: "Optical (multispectral)",
    collectionId: "LANDSAT/LE07/C02/T1_L2",
    scale: 30,
    since: "1999-05-28",
    until: null,
    analyses: ["Water", "Vegetation", "LST"],
    cloudFilter: true,
    note: "Covers the 2000s. Images after May 2003 have stripes of missing data.",
  },
  {
    key: "landsat5_l2",
    name: "Landsat 5 Collection 2 Level-2",
    satellite: "Landsat-5",
    category: "Optical (multispectral)",
    collectionId: "LANDSAT/LT05/C02/T1_L2",
    scale: 30,
    since: "1984-03-16",
    until: "2012-05-05",
    analyses: ["Water", "Vegetation", "LST"],
    cloudFilter: true,
    note: "The archive for anything before 2000. Ended in 2012.",
  },
  {
    key: "modis_sr_8day",
    name: "MODIS Terra Surface Reflectance 8-Day (MOD09A1)",
    satellite: "MODIS",
    category: "Optical (multispectral)",
    collectionId: "MODIS/061/MOD09A1",
    scale: 500,
    since: "2000-02-18",
    until: null,
    analyses: ["Water", "Vegetation"],
    cloudFilter: false,
    note: "Coarse but cloud-free composites every 8 days. Good for regional or country-wide areas.",
  },
  {
    key: "sentinel1_grd",
    name: "Sentinel-1 SAR GRD (C-band)",
    satellite: "Sentinel-1",
    category: "Radar (SAR)",
    collectionId: "COPERNICUS/S1_GRD",
    scale: 10,
    since: "2014-10-03",
    until: null,
    analyses: ["Water"],
    cloudFilter: false,
    note: "Radar sees through clouds and at night. Used for flood and open-water mapping.",
  },
  {
    key: "modis_vi_16day",
    name: "MODIS Terra Vegetation Indices 16-Day 250 m (MOD13Q1)",
    satellite: "MODIS",
    category: "Vegetation products",
    collectionId: "MODIS/061/MOD13Q1",
    scale: 250,
    since: "2000-02-18",
    until: null,
    analyses: ["Vegetation"],
    cloudFilter: false,
    note: "NDVI and EVI already computed, every 16 days since 2000.",
  },
  {
    key: "modis_lst",
    name: "MODIS Terra Land Surface Temperature 8-Day (MOD11A2)",
    satellite: "MODIS",
    category: "Temperature",
    collectionId: "MODIS/061/MOD11A2",
    scale: 1000,
    since: "2000-02-18",
    until: null,
    analyses: ["LST"],
    cloudFilter: false,
    note: "Day and night surface temperature, averaged over 8 days.",
  },
  {
    key: "modis_lst_aqua",
    name: "MODIS Aqua Land Surface Temperature 8-Day (MYD11A2)",
    satellite: "MODIS",
    category: "Temperature",
    collectionId: "MODIS/061/MYD11A2",
    scale: 1000,
    since: "2002-07-04",
    until: null,
    analyses: ["LST"],
    cloudFilter: false,
    note: "Same product from the Aqua satellite, which passes in the afternoon.",
  },
  {
    key: "era5_land_daily",
    name: "ERA5-Land Daily Aggregated (climate reanalysis)",
    satellite: "ERA5-Land",
    category: "Temperature",
    collectionId: "ECMWF/ERA5_LAND/DAILY_AGGR",
    scale: 11132,
    since: "1950-01-02",
    until: null,
    analyses: ["LST"],
    cloudFilter: false,
    note: "Modelled air and skin temperature back to 1950. No gaps, no clouds, 11 km cells.",
  },
  {
    key: "dynamic_world",
    name: "Dynamic World Land Use / Land Cover (10 m)",
    satellite: "Dynamic World",
    category: "Land cover",
    collectionId: "GOOGLE/DYNAMICWORLD/V1",
    scale: 10,
    since: "2015-06-27",
    until: null,
    analyses: ["LULC"],
    cloudFilter: false,
    note: "Nine land cover classes for every Sentinel-2 scene, in near real time.",
  },
  {
    key: "modis_landcover",
    name: "MODIS Land Cover Type Yearly 500 m (MCD12Q1)",
    satellite: "MODIS",
    category: "Land cover",
    collectionId: "MODIS/061/MCD12Q1",
    scale: 500,
    since: "2001-01-01",
    until: null,
    analyses: ["LULC"],
    cloudFilter: false,
    note: "One land cover map per year since 2001, for long-term change.",
  },
  {
    key: "jrc_water_monthly",
    name: "JRC Global Surface Water Monthly History",
    satellite: "JRC GSW",
    category: "Surface water",
    collectionId: "JRC/GSW1_4/MonthlyHistory",
    scale: 30,
    since: "1984-03-16",
    until: "2021-12-31",
    analyses: ["Water"],
    cloudFilter: false,
    note: "Where water was, month by month, from 1984 to 2021. Built from the whole Landsat archive.",
  },
];

export const COMPOSITE_METHODS = ["median", "mean", "mosaic", "min", "max", "mode"];
