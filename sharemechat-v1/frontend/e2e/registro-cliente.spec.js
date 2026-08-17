// ADR-059 Fase 4 — E2E happy-path: registro de cliente con backend MOCKEADO.
//
// Flujo real (mapeado sobre el código, superficie product en ES):
//   age-gate de invitado (se siembra en localStorage para saltarlo)
//   -> Home -> CTA "Iniciar Video Chat" -> formulario cliente DIRECTO
//   -> "Registrarse" -> modal de éxito "Revisa tu bandeja de entrada".
//   (Opción B, 2026-08-17: el selector hombre/mujer se retiró; goRegister abre
//    register-client directo. El cliente ya no pasa por el paso de género.)
//
// El POST /api/users/register/client se intercepta y se responde 200 sin tocar
// backend real (ya cubierto por los tests de integración). El resto de /api se
// responde de forma benigna para no depender de red. Aserción de éxito = el aviso
// de verificación por email (no hay auto-login ni redirección).

const { test, expect } = require('@playwright/test');

test('registro cliente: happy-path muestra el aviso de verificación por email', async ({ page }) => {
  // Saltar el age-gate: el gate recuerda la aceptación en localStorage (key
  // age_ok_v1, TERMS_VERSION='v1' por defecto). Sin esto, los CTA de la Home
  // hacen return silencioso y no abren nada.
  await page.addInitScript(() => {
    localStorage.setItem('age_ok_v1', 'true');
    localStorage.setItem('terms_ok_v1', 'true');
  });

  // Backend mockeado: capturamos el POST de registro y respondemos 200; cualquier
  // otra llamada /api se responde benigna (la Home no consume /api al cargar, pero
  // esto blinda el test frente a cualquier fetch inesperado).
  let registerBody = null;
  await page.route('**/api/**', async (route) => {
    const req = route.request();
    if (req.method() === 'POST' && req.url().includes('/api/users/register/client')) {
      registerBody = req.postDataJSON();
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
  });

  await page.goto('/');

  // Home -> "Iniciar Video Chat" abre DIRECTO el registro de cliente (Opción B:
  // el selector hombre/mujer se retiró; goRegister -> initialView register-client).
  await page.getByRole('button', { name: 'Iniciar Video Chat' }).click();

  // Formulario de cliente. Los inputs no tienen label accesible -> por placeholder.
  await page.getByPlaceholder('Apodo / Nickname').fill('e2euser');
  await page.getByPlaceholder('Email').fill('e2e@example.com');
  await page.getByPlaceholder('Contraseña (mínimo 8 caracteres)').fill('Password123');

  // Los dos checkboxes (mayor de 18 / acepto términos) no tienen accessible name;
  // se localizan por rol. Guardamos que son exactamente 2 (form correcto renderizado
  // y age-gate cerrado, que si no aportaría un tercer checkbox).
  const checks = page.getByRole('checkbox');
  await expect(checks).toHaveCount(2);
  await checks.nth(0).check(); // Soy mayor de 18 años
  await checks.nth(1).check(); // Acepto términos

  // exact: evita colisionar con el botón "Registrarse con Google" (GIS).
  await page.getByRole('button', { name: 'Registrarse', exact: true }).click();

  // Éxito visible: aviso de verificación por email.
  await expect(page.getByText('Revisa tu bandeja de entrada')).toBeVisible();

  // El backend recibió el payload esperado (nombres de campo reales del backend:
  // 'confirAdult' sin la 'm' y 'acceptedTerm' en singular; nickname normalizado).
  expect(registerBody).toMatchObject({
    nickname: 'e2euser',
    email: 'e2e@example.com',
    password: 'Password123',
    confirAdult: true,
    acceptedTerm: true,
  });
});
