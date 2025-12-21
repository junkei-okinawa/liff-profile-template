import { defineConfig, loadEnv } from 'vite'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(new URL(import.meta.url)))

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  
  const alias = {}
  if (env.VITE_ENABLE_MOCK_LIFF === 'true' || mode === 'test') {
    console.log('Enabling Mock LIFF via alias replacement');
    alias['@line/liff'] = path.resolve(__dirname, 'src/test/liff-mock.ts')
  }

  return {
    root: './',
    base: './',
    server: {
      port: 3000,
      open: true
    },
    resolve: {
      alias
    },
    test: {
      globals: true,
      environment: 'jsdom',
      setupFiles: './src/test/setup.ts',
      exclude: ['node_modules', 'dist', 'e2e/**'],
    }
  }
})
