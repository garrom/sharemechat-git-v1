// ADR-059 Fase 4 (frontend) — E2E con Playwright.
//
// Enfoque (decidido con el operador 2026-08-15): backend MOCKEADO por
// interceptación de red (`page.route('**/api/**')`). El backend ya está
// blindado con 107 tests de integración, así que aquí probamos los flujos de
// UI en navegador real sin levantar Spring+MySQL (rápido y determinista).
//
// El webServer sirve el frontend con `react-scripts start` en modo product
// (.env.product) en el puerto 3100. `CI: false` evita el "warnings-as-errors"
// de CRA en el arranque del dev server; Playwright sí ve CI (retries/reporter).

const { defineConfig, devices } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:3100',
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: {
    command: 'npx env-cmd -f .env.product react-scripts start',
    url: 'http://localhost:3100',
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    env: { BROWSER: 'none', PORT: '3100', CI: 'false' },
  },
});
