export const getEnv = (key: string): string => {
  // ランタイム環境変数 (window._env_) を優先し、なければビルド時環境変数 (import.meta.env) を使用
  return window._env_?.[key] || (import.meta.env as Record<string, string>)[key] || '';
};

export const config = {
  apiBaseUrl: getEnv('VITE_API_BASE_URL'),
  liffId: getEnv('VITE_CHANNEL_ID') || getEnv('VITE_LIFF_ID'),
  callbackUrl: getEnv('VITE_CALLBACK_URL'),
};
