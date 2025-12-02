export const getEnv = (key: string): string => {
  // ランタイム環境変数 (window._env_) を優先し、なければビルド時環境変数 (import.meta.env) を使用
  return window._env_?.[key] || (import.meta.env as Record<string, string>)[key] || '';
};

export const config = {
  get apiBaseUrl() { return getEnv('VITE_API_BASE_URL'); },
  get liffId() { return getEnv('VITE_CHANNEL_ID') || getEnv('VITE_LIFF_ID'); },
  get callbackUrl() { return getEnv('VITE_CALLBACK_URL'); },
};
