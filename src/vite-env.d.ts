/// <reference types="vite/client" />

interface ImportMetaEnv {
    readonly VITE_CHANNEL_ID: string
    readonly VITE_CHANNEL_SECRET: string
    readonly VITE_CALLBACK_URL: string
}

interface ImportMeta {
    readonly env: ImportMetaEnv
}

