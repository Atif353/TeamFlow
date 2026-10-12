import path from 'node:path'
import { defineConfig, devices } from '@playwright/test'

const isWindows = process.platform === 'win32'
const python = path.join('.venv', isWindows ? 'Scripts' : 'bin', 'python')
const channel = process.env.PW_CHANNEL ?? (isWindows ? 'msedge' : undefined)

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [['list']],
  use: { baseURL: 'http://localhost:5273', trace: 'retain-on-failure', channel },
  projects: [{ name: 'desktop', use: { ...devices['Desktop Chrome'], channel } }],
  webServer: [
    {
      command: `${python} -m uvicorn app.main:app --port 8100`,
      cwd: '../backend',
      url: 'http://localhost:8100/api/v1/health',
      reuseExistingServer: false,
      timeout: 60_000,
      env: {
        MONGODB_DB: process.env.E2E_MONGODB_DB ?? 'teamflow_e2e',
        RATE_LIMIT_ENABLED: 'false',
        ENVIRONMENT: 'development',
        SMTP_HOST: '',
        SMTP_USER: '',
        SMTP_PASSWORD: '',
        SMTP_FROM: '',
      },
    },
    {
      command: 'npm run dev -- --port 5273 --strictPort',
      url: 'http://localhost:5273',
      reuseExistingServer: false,
      timeout: 60_000,
      env: { VITE_API_PROXY_TARGET: 'http://localhost:8100' },
    },
  ],
})
