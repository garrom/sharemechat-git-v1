// ADR-059 Fase 4 — E2E happy-path: login de cliente con backend MOCKEADO.
//
// Flujo real (mapeado sobre el código, superficie product en ES):
//   navegar a /login -> Home detecta el path y abre el modal de login
//   (useEffect en Home.jsx) -> rellenar email+password -> "Iniciar Sesión"
//   -> POST /auth/login -> refresh() = GET /users/me -> resolveHomeUrl(user)
//   -> para rol CLIENT redirige (history.push) a /client.
//
// Backend mockeado por interceptación de red (page.route). El login real ya
// está cubierto por los tests de integración backend; aquí probamos el flujo
// de UI en navegador. Se interceptan explícitamente:
//   POST /api/auth/login  -> 200 (capturamos el payload de credenciales)
//   GET  /api/users/me     -> 200 con un usuario CLIENT + productAccessMode OPEN
//                             (RequireRole exige mode no vacío para renderizar
//                             la ruta protegida /client; con OPEN entra).
// Cualquier otra llamada /api se responde benigna para no depender de red (la
// dashboard de cliente dispara varias al montar; su shape no afecta al veredicto).
//
// Aserción de éxito = la SPA redirige a /client (destino de resolveHomeUrl para
// CLIENT) y el backend recibió las credenciales tecleadas.

const { test, expect } = require('@playwright/test');

test('login cliente: happy-path redirige a /client y envía las credenciales', async ({ page }) => {
  // El modal de login se abre solo al entrar por /login; el age-gate no lo
  // bloquea, pero sembramos su aceptación por consistencia con el resto de
  // specs (evita que un overlay de gate intercepte clics).
  await page.addInitScript(() => {
    localStorage.setItem('age_ok_v1', 'true');
    localStorage.setItem('terms_ok_v1', 'true');
  });

  let loginBody = null;
  let meCalled = false;
  await page.route('**/api/**', async (route) => {
    const req = route.request();
    const url = req.url();

    if (req.method() === 'POST' && url.includes('/api/auth/login')) {
      loginBody = req.postDataJSON();
      await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
      return;
    }

    if (req.method() === 'GET' && url.includes('/api/users/me')) {
      meCalled = true;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        // role CLIENT -> resolveHomeUrl = /client. productAccessMode OPEN para
        // que RequireRole abra la ruta protegida en vez de PreLaunchScreen.
        body: JSON.stringify({
          id: 1,
          email: 'cliente@example.com',
          role: 'CLIENT',
          productAccessMode: 'OPEN',
          allowlisted: true,
        }),
      });
      return;
    }

    // Resto de /api: respuesta benigna (la dashboard de cliente hace fetches al
    // montar; no dependemos de su contenido para el veredicto de login).
    await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
  });

  await page.goto('/login');

  // Modal de login abierto: título visible. Es un <h2> (rol heading); usar el
  // rol lo distingue de los botones "Iniciar sesión" del navbar (mismo texto).
  await expect(page.getByRole('heading', { name: 'Iniciar sesión' })).toBeVisible();

  // Los inputs no tienen label accesible -> por placeholder.
  await page.getByPlaceholder('Email').fill('cliente@example.com');
  await page.getByPlaceholder('Contraseña (mínimo 8 caracteres)').fill('Password123');

  // exact: evita colisionar con el botón "Iniciar sesión con Google" (GIS) si
  // el flag isGoogleOAuthEnabled está activo en el build product de test.
  await page.getByRole('button', { name: 'Iniciar Sesión', exact: true }).click();

  // Éxito: la SPA redirige al área de cliente (resolveHomeUrl para rol CLIENT).
  await expect(page).toHaveURL(/\/client(\/|$|\?)/);

  // El backend de auth recibió exactamente las credenciales tecleadas...
  expect(loginBody).toMatchObject({
    email: 'cliente@example.com',
    password: 'Password123',
  });

  // ...y hubo refresh de sesión (GET /users/me) tras el login.
  expect(meCalled).toBe(true);
});
