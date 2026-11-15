/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** API base including the /api prefix. */
  readonly VITE_API_URL?: string;
  /** Backend origin without /api. */
  readonly VITE_BACKEND_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
