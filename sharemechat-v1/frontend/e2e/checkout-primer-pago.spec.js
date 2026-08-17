// ADR-059 Fase 4 — E2E happy-path: primer pago (checkout) del cliente recién
// registrado, con backend MOCKEADO por interceptación de red.
//
// Contexto de producto: tras registrarse, el cliente es rol USER + userType
// FORM_CLIENT y aterriza en /dashboard-user-client (resolveHomeUrl). Desde ahí,
// con su KYC de edad APPROVED y el email verificado, el botón "Hazte Premium"
// dispara handleFirstPayment -> modal de selección de pack -> POST
// /billing/nowpayments/checkout -> el backend responde una invoiceUrl (hosted
// page del PSP) y la app hace window.location.href = invoiceUrl.
//
// El backend real de billing ya está cubierto por los tests de integración;
// aquí probamos el flujo de UI: gates (KYC + email) -> modal -> redirección.
// La auth real es por cookie httpOnly, pero como GET /users/me está mockeado y
// devuelve el usuario sin mirar la cookie, navegamos directos a la ruta
// protegida sin ejecutar el login.
//
// Interceptado explícitamente:
//   GET  /api/users/me                       -> USER/FORM_CLIENT, KYC APPROVED,
//                                               email verificado, mode OPEN.
//   POST /api/billing/nowpayments/checkout   -> {orderId, invoiceUrl, sessionId}
//                                               (capturamos el packId enviado).
//   la propia invoiceUrl (host del PSP)      -> stub 200 para que la navegación
//                                               cross-origin complete sin error.
// Resto de /api -> benigno.
//
// Aserción de éxito = la app redirige a la invoiceUrl del PSP y el backend
// recibió el packId del pack elegido.

const { test, expect } = require('@playwright/test');

const INVOICE_URL = 'https://pay.example.test/invoice/e2e-primer-pago';

test('primer pago: cliente FORM_CLIENT elige pack y es redirigido a la invoiceUrl del PSP', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('age_ok_v1', 'true');
    localStorage.setItem('terms_ok_v1', 'true');
  });

  let checkoutBody = null;

  await page.route('**/api/**', async (route) => {
    const req = route.request();
    const url = req.url();

    if (req.method() === 'GET' && url.includes('/api/users/me')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 42,
          email: 'nuevocliente@example.com',
          role: 'USER',
          userType: 'FORM_CLIENT',
          // Gates de handleFirstPayment: KYC de edad APPROVED + email verificado.
          clientKycStatus: 'APPROVED',
          emailVerifiedAt: '2026-08-15T10:00:00',
          // ADR-009: RequireRole exige mode no vacío para abrir la ruta protegida.
          productAccessMode: 'OPEN',
          allowlisted: true,
        }),
      });
      return;
    }

    if (req.method() === 'POST' && url.includes('/api/billing/nowpayments/checkout')) {
      checkoutBody = req.postDataJSON();
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          orderId: 'e2e-order-001',
          invoiceUrl: INVOICE_URL,
          sessionId: 1,
        }),
      });
      return;
    }

    await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
  });

  // Stub de la hosted page del PSP: window.location.href = invoiceUrl navega
  // cross-origin; sin este route la navegación fallaría por red y toHaveURL
  // no resolvería.
  await page.route('**/pay.example.test/**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'text/html',
      body: '<!doctype html><title>PSP invoice stub</title><h1>PSP</h1>',
    });
  });

  await page.goto('/dashboard-user-client');

  // El botón "Cargar saldo" del onboarding se retiró (commit "onboarding cliente
  // = 2 verificaciones": cargar saldo = hacerse premium, ya no es un paso). El
  // MISMO handler (handleFirstPayment) se dispara desde el CTA "Hazte Premium" del
  // banner de modo gratuito (TrialFreeBanner: sticky, siempre visible en la sección
  // videochat). Se scopea al banner (role=note "Modo gratuito") para no colisionar
  // con el "Hazte Premium" de la navbar.
  const trialBanner = page.getByRole('note', { name: 'Modo gratuito' });
  await trialBanner.getByRole('button', { name: 'Hazte Premium' }).click();

  // Modal de selección de pack: cada PackCard muestra "{minutes} min". Elegimos
  // el recomendado (P20 = "22 min").
  await page.getByRole('button', { name: /22 min/ }).click();

  // Éxito: la app redirige a la hosted page del PSP.
  await expect(page).toHaveURL(/pay\.example\.test\/invoice\/e2e-primer-pago/);

  // El backend recibió el packId del pack elegido.
  expect(checkoutBody).toMatchObject({ packId: 'P20' });
});
