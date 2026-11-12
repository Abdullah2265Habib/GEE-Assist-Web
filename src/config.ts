/** Site-wide links. Override with VITE_* variables in .env. */

export const GITHUB_URL = import.meta.env.VITE_GITHUB_URL || "https://github.com/Abdullah2265Habib/GEE-Assist";
export const BACKEND_GITHUB_URL = "https://github.com/Abdullah2265Habib/GEE-Assist-Backend";
/** Where "Download for Windows" points. Falls back to the GitHub releases page. */
export const DOWNLOAD_URL = import.meta.env.VITE_DOWNLOAD_URL || `${GITHUB_URL}/releases`;
export const APP_VERSION = "1.0.0";
