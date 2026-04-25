export const getEnv = (key: string): string => {
  // ランタイム環境変数 (window._env_) を優先し、なければビルド時環境変数 (import.meta.env) を使用
  // Node 環境（Playwright 等）では window が存在しないため typeof チェックでガードする
  const runtimeEnv = typeof window !== 'undefined' ? window._env_?.[key] : undefined;
  // Vite 管理下以外の Node 環境（Playwright 等）では import.meta.env が提供されないため
  // optional chaining でガードし、Node では process.env をフォールバックとして使用する
  const buildTimeEnv = ((import.meta as any)?.env as Record<string, string> | undefined)?.[key]
    ?? (typeof process !== 'undefined' ? process.env[key] : undefined);
  return runtimeEnv || buildTimeEnv || '';
};

export const config = {
  get apiBaseUrl() { return getEnv('VITE_API_BASE_URL'); },
  get liffId() { return getEnv('VITE_LIFF_ID'); },
  get callbackUrl() { return getEnv('VITE_CALLBACK_URL'); },
};
