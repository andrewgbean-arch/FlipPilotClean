/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_GENESIS_API?: string;
  readonly VITE_GENESIS_TOKEN?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
