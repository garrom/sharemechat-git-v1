# Operaciones administrativas

## Operaciones principales

- login específico de backoffice
- revisión de modelos y checklist
- consulta de streams activos
- revisión de moderación
- lectura de métricas y finanzas
- consultas internas de datos
- administración de usuarios, roles y permisos de backoffice

## Controles relevantes

- el acceso de backoffice exige perfil efectivo de backoffice
- el email no verificado ya no bloquea el login de backoffice, pero deja la UI interna en estado restringido hasta completar la validacion
- existe trazabilidad de acciones de acceso

## Punto de atención

Aunque el backoffice ya tiene bastante cobertura funcional, su correcto uso depende de que el catálogo de permisos y los overrides se mantengan coherentes con la evolución de endpoints y paneles.

## Panel "Clientes y Modelos" (embudo agregado)

Vista `activeView='users'` en el sidebar sección Business (justo encima de "Modelos"). Añadida 2026-07-18 tras observar el primer registro real en PROD (user 37, `Zzzz`, `miorenrir@tokmail.net`, registrado 2026-06-30 desde IP `77.111.246.51`) y detectar que no había forma agregada de ver la conversión sin bajar a BD.

- Endpoint: `GET /api/admin/users/segments` (protegido por catch-all `/api/admin/**`, exige ROLE_ADMIN). Implementado en `AdminController.usersSegments()` → `AdminService.usersSegmentsOverview()`.
- Contenido: 6 `count(*)` sobre `users` + 2 SELECT de 10 filas. Sin cache.
- Segmentos: **Clientes** (`FORM_CLIENT` + `CLIENT`) + **Modelos** (`FORM_MODEL` + `MODEL`), con `activePct` de conversión.
- Breakdown de `FORM_MODEL` por `verification_status`: `noKyc` (NULL), `kycPending`, `kycRejected`.
- Listados: 10 últimos `FORM_CLIENT` + 10 últimos `FORM_MODEL` SIN KYC iniciado. **No duplica** el panel Modelos existente (que muestra los que ya iniciaron KYC con checklist y acciones approve/reject).
- Frontend: `AdminUsersPanel.jsx`. **Carga al abrir + botón "Refrescar" manual**, sin polling automático (decisión operador — evita ruido de red y carga cognitiva).

Capacidad reutilizada: `canViewModels` (no se crea permiso nuevo). Se muestra a admin y a backoffice con permiso `models.read_list`.

## Notificación al buzón admin en nuevos registros

Desde 2026-07-18, cada registro publico exitoso dispara un email best-effort al buzón interno del equipo:

- `POST /api/users/register/client` → notifica a `notifications.admin.new-client-email`.
- `POST /api/users/register/model` → notifica a `notifications.admin.new-model-email`.

Configuración vendor-agnostic vía `AdminNotificationProperties` (`@ConfigurationProperties(prefix="notifications.admin")`). Property vacía → skip silencioso (default en TEST/AUDIT para no spamear con registros de pruebas manuales). En PROD las properties están rellenas con `admin+clientes@sharemechat.com` y `admin+modelos@sharemechat.com` (overridables por env-var `NOTIFICATIONS_ADMIN_NEW_CLIENT_EMAIL` / `NOTIFICATIONS_ADMIN_NEW_MODEL_EMAIL` para cambiar sin redeploy).

Copy ES fijo (destinatario interno hispanohablante) con tabla de metadatos: userId, nickname, email, país detectado, IP registro, ui_locale, created_at y entorno. Nickname/email escapados HTML (defensa en profundidad, misma política que `renderWelcome`). Categorías nuevas en `EmailMessage.Category`: `ADMIN_NEW_CLIENT_REGISTERED` y `ADMIN_NEW_MODEL_REGISTERED`. Priority `BEST_EFFORT` — fallo del envío no revierte el registro (log WARN + continue). Motivación: el 2026-06-30 se registró el user 37 en PROD y nadie del equipo se enteró hasta 18 días después.

## Moderación de usuarios

Los usuarios pueden reportar abusos a través de la UI de producto. Cada reporte se persiste en la tabla `moderation_reports` y queda disponible en el panel de administración (`/api/admin/moderation/reports*`), donde un operador con permisos puede revisarlo, marcar resultado y, si procede, aplicar acciones sobre las cuentas implicadas (bloqueo, advertencia, etc.). El flujo está soportado por:

- Entidad `ModerationReport` (paquete `com.sharemechat.entity`).
- Servicio `ModerationReportService`.
- Controllers: `ModerationReportController` (creación desde producto, `POST /api/reports/abuse`) y `AdminController` (revisión desde backoffice, `/api/admin/moderation/reports*`).
- UI admin: `AdminModerationPanel.jsx`.
