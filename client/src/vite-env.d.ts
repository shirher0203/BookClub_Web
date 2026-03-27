/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Axios base URL; default `/api` (same-origin). */
  readonly VITE_API_URL?: string;
  /** Origin for `/uploads/...` if not same as the page (optional). */
  readonly VITE_ASSET_ORIGIN?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
