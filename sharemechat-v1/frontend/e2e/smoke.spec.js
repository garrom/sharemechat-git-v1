// ADR-059 Fase 4 — E2E smoke: valida toda la tubería (Playwright + dev server
// product + CI). Prueba que la app carga y React monta. Los happy-paths reales
// (registro→pago, login) se añaden en specs siguientes con backend mockeado.

const { test, expect } = require('@playwright/test');

test('smoke: la app carga y React monta', async ({ page }) => {
  // Diagnóstico: capturamos errores de consola y excepciones de página para que,
  // si el árbol no monta, el log de CI diga POR QUÉ (index.js monta de forma
  // asíncrona con `await import('./App')`; cualquier throw deja #root vacío).
  const errors = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push('[console.error] ' + msg.text());
  });
  page.on('pageerror', (err) => errors.push('[pageerror] ' + (err && err.stack ? err.stack : err)));
  page.on('requestfailed', (req) =>
    errors.push('[requestfailed] ' + req.url() + ' -> ' + (req.failure() && req.failure().errorText)));

  await page.goto('/', { waitUntil: 'load' });

  // El <title> estático de la SPA product.
  await expect(page).toHaveTitle(/SharemeChat/i);

  // React monta el árbol de forma asíncrona; en un runner frío damos margen.
  try {
    await expect(page.locator('#root')).not.toBeEmpty({ timeout: 45_000 });
  } catch (e) {
    const html = await page.locator('#root').evaluate((el) => el.outerHTML).catch(() => 'n/a');
    console.log('=== DIAGNÓSTICO SMOKE (root vacío) ===');
    console.log('URL:', page.url());
    console.log('root:', html);
    console.log('errores capturados:\n' + (errors.length ? errors.join('\n') : '(ninguno)'));
    throw e;
  }
});
