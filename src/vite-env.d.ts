/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_DOWNLOAD_URL?: string;
  readonly VITE_GITHUB_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
