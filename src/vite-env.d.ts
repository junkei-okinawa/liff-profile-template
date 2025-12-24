/// <reference types="vite/client" />

interface Window {
  _env_: {
    [key: string]: string;
  };
}

interface ImportMetaEnv {
    readonly VITE_CHANNEL_ID: string
    readonly VITE_CHANNEL_SECRET: string
    readonly VITE_CALLBACK_URL: string
    readonly VITE_API_BASE_URL: string
    readonly VITE_ENABLE_MOCK_LIFF?: string
}

interface ImportMeta {
    readonly env: ImportMetaEnv
}
