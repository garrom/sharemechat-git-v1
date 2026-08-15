// ADR-059 Fase 4 — E2E smoke: valida toda la tubería (Playwright + dev server
// product + CI). Prueba que la app carga y React monta. Los happy-paths reales
// (registro→pago, login) se añaden en specs siguientes con backend mockeado.

const { test, expect } = require('@playwright/test');

test('smoke: la app carga y React monta', async ({ page }) => {
  await page.goto('/', { waitUntil: 'load' });

  // El <title> estático de la SPA product.
  await expect(page).toHaveTitle(/SharemeChat/i);

  // React monta el árbol (index.js lo hace de forma asíncrona: await import('./App')).
  await expect(page.locator('#root')).not.toBeEmpty();
});
