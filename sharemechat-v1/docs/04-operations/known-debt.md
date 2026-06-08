# Deudas técnicas conocidas

Registro de deudas detectadas durante operación o auditoría que no son incidencias urgentes pero conviene no perder. Cuando una deuda se cierre, mover su sección a `incident-notes.md` con marca de resolución y eliminar de aquí.

## 2026-06-08 — Auditoría defensiva: Lote 2 y Lote 3 pendientes

Tras cerrar el Lote 1 (H3 rate-limit IP en login, H2 validación nickname + escape HTML en `EmailCopyRenderer`, H6 `limit_req` nginx en `/api/auth/`, `/api/users/register/`, `/api/admin/auth/`), quedan abiertas estas mitigaciones de la auditoría. Ver bitácora 2026-06-08 para contexto completo.

### ~~[DEUDA media — Lote 2] H1 Enumeración de email en `POST /api/users/register/*`~~ — **CERRADA 2026-06-08**

Cerrada en bitácora 2026-06-08 (Lote 2 parte 2). `UserService.registerClient/registerModel` reordenado: nickname check primero (mantiene aviso explícito por UX), email check después con respuesta uniforme. Email "ya tienes cuenta" enviado al titular del email existente. Validado en TEST con `diff` vacío entre bodies de los dos caminos.

La enumeración del **nickname** se MANTIENE conscientemente: si el nickname está cogido, el backend responde `400` con `"Ese nickname ya existe, debes elegir otro."`. Decisión de UX: pedir al usuario que pruebe otro alias en el momento es preferible a fallar silenciosamente. El nickname no permite enlazar identidades igual que un email, por lo que el riesgo de enumeración es menor.

### ~~[DEUDA media — Lote 2] H4 atributo `class` libre en jsoup Safelist del CMS~~ — **CERRADA 2026-06-08**

Cerrada en bitácora 2026-06-08 (Lote 2 parte 1). `filterClasses()` en `MarkdownRendererService` aplica whitelist por (tag, valor) post-`Jsoup.clean`. Tests JUnit `renderDivWithCalloutClassIsPreserved`, `renderDivWithNonWhitelistedClassLosesClass`, `renderCodeBlockLanguageClassIsPreserved`, `renderCodeBlockBogusClassIsStripped`.

### ~~[DEUDA baja — Lote 2] H5 regex injection en preprocessador `:::callout`~~ — **CERRADA 2026-06-08**

Cerrada en bitácora 2026-06-08 (Lote 2 parte 1). `preprocessCallouts` neutraliza `</\s*div\s*>` literal en el cuerpo del callout antes de generar el wrapper. Test JUnit `preprocessCalloutWithDivCloseInBodyIsNeutralized`.

### [DEUDA baja — Lote 3] H8 bumps de dependencia: `jjwt 0.11.5 → 0.12.x` y `jsoup 1.17.2 → 1.18.x`

Sin CVE crítico abierto al momento de la auditoría (2026-06-08), pero ambas ramas están en mantenimiento y se han publicado sucesores. Conviene subir y ejecutar `mvn org.owasp:dependency-check-maven:check` (el plugin ya está en `pom.xml`, versión 9.0.9) para inventario CVE actualizado de todo el árbol transitivo. Prioridad: baja (sin exposición conocida hoy).

### [DEUDA refactor — Lote 3] Capa PSP-agnóstica para sustituir CCBill por Segpay (u otro PSP adult-specialist)

`BillingController` y el webhook `/api/billing/ccbill/notify` están acoplados al naming CCBill. Segpay queda como candidato activo tras los cambios de la sesión 2026-06-03. Refactorizar a capa abstracta (`PaymentSession`, `WebhookSignatureVerifier`, `PspAdapter`) facilitará el switch sin tocar capas superiores. Prioridad: media (necesario antes de activar Segpay en PROD, no urgente mientras el PSP esté en onboarding).

---

## 2026-06-05 — Deudas abiertas tras cierre del frente PRELAUNCH

Tras el cableado de `PRODUCT_ACCESS_MODE=PRELAUNCH` end-to-end (ver `project-log.md` 2026-06-05), quedan cinco frentes abiertos. Ninguno bloquea TEST; los marcados como **REQUISITO PRE-PROD** sí deben cerrarse antes del lanzamiento real.

### [DEUDA mantenibilidad] `LocaleSwitcher` hace `window.location.assign` por restricción del basename del Router v5

`react-router-dom` v5 fija el basename una vez en `App.jsx` a partir de la URL inicial; no es reactivo. Cambiar de ES (basename `/`) a EN (basename `/en`) requiere re-montar el Router, lo que en la práctica equivale a recargar la página. Por eso `LocaleSwitcher.handleChange` termina con `window.location.assign(newPath)` (full reload). Coste: cada cambio de idioma destruye y reconstruye toda la SPA, con un blanco de carga visible antes de que React vuelva a montar la PreLaunchScreen (o cualquier ruta autenticada).

Refactor pendiente, no bloqueante: quitar el basename y pasar el locale como prefijo de path interno (afecta a todos los `<Link>`, todos los `Route` declarados, las reglas de redirect entre superficies, el handler de locale del blog que ya tiene su propio Router context). Alta inversión; solo justificable si en algún momento se prioriza la UX de cambio de idioma. Mientras tanto, la puerta cerrada por defecto de `RequireRole` evita que se vea contenido protegido durante el blanco, así que la regresión visible se limita al propio blanco.

### [DEUDA arquitectural — REQUISITO PRE-PROD] Enriquecer `productAccessMode` y `allowlisted` en TODAS las respuestas `UserDTO` del backend, no solo en `GET /api/users/me`

Hoy esos dos campos los puebla únicamente `UserController.getCurrentUser` después de `userService.mapToDTO(user)`. Cualquier otro endpoint que devuelva `UserDTO` (`PUT /api/users/me/ui-locale`, registros de cliente/modelo, endpoints admin, futuros) los entrega como `null`. El frontend lo parchea con un merge defensivo en `SessionProvider.updateUiLocale` (preserva los campos del `user` previo), pero la solución correcta es backend consistente: cualquier `UserDTO` devuelto debería estar enriquecido. Opciones a valorar:

- Mover el enriquecimiento dentro de `UserService.mapToDTO` (acopla mapToDTO al servicio de modo operacional, pero centraliza la regla y elimina la deuda).
- Helper `enrichUserDTOWithAccessMode(UserDTO, User)` que cada controller llame explícitamente tras `mapToDTO` (más control, más boilerplate, fácil de olvidar en un controller nuevo).

Prioridad: alta. **Antes de PROD**: si alguien introduce un endpoint nuevo que devuelva `UserDTO` y el frontend deja de usar el merge defensivo, reaparece el flicker de "puerta abierta por momento". El parche frontend funciona hoy pero es frágil.

### [DEUDA crítica — REQUISITO PRE-PROD] Blindaje del script de deploy de frontend con builds secuenciales y smoke tests obligatorios

Durante esta sesión, lanzar `npm run build:product` y `npm run build:admin` en paralelo (los dos comparten la carpeta `build/` que CRA sobreescribe en cada `npm run build:*`) provocó que el segundo build sobreescribiera mientras el primer `aws s3 sync` estaba aún leyendo: el bucket `sharemechat-frontend-test` quedó incompleto (solo assets estáticos, sin js/css/index.html). Detectado y recuperado en la propia sesión. La verificación post-deploy fue solo de API (curl `/api/users/me`) y dio por bueno el deploy hasta que el operador reportó que el frontend no cargaba.

Antes de tocar PROD, el script `ops/scripts/deploy-frontend.ps1` (o su equivalente) debe:

1. **Builds estrictamente secuenciales** producto → sync producto → admin → sync admin, NUNCA en paralelo; el `build/` de CRA no es seguro para concurrencia. Mejor todavía: builds a carpetas separadas (`build-product/`, `build-admin/`) renombrando tras cada `npm run build:*`.
2. **Smoke test obligatorio post-sync** que valide carga real, NO solo API: `curl https://<dominio>/ → 200 && size > 500 && content-type text/html`; extraer `main.[hash].js` referenciado en index.html con `grep -oE`; confirmar que ese hash existe en `aws s3 ls s3://<bucket>/static/js/`; `curl https://<dominio>/static/js/main.<hash>.js → 200 && size > 0`. **Si cualquier check falla: `exit 1`** (no solo log).
3. **Smoke test funcional mínimo del modo activo**: si `PRODUCT_ACCESS_MODE=PRELAUNCH`, verificar que `POST /api/auth/login` NO devuelve 503 y `POST /api/models/documents` SÍ devuelve 503. Detecta tanto el bug del gate como un mismatch de config entre EC2 y bundle.
4. **`rm -rf build/` antes de cada `npm run build:*`** para evitar artefactos colados entre runs.

Prioridad: bloqueante para el primer despliegue a PROD del frente PRELAUNCH (y a futuro para cualquier despliegue de frontend).

### [DEUDA UX opcional] Sustituir el `return null` de carga por un splash/loader con marca

`RequireRole` ahora retorna `null` mientras `loading=true` o `user.productAccessMode` está vacío. El operador ve una pantalla blanca breve (~100-300 ms en condiciones normales) hasta que `/api/users/me` resuelve. Funcionalmente correcto y mucho mejor que el flicker del componente real, pero estéticamente un splash con la marca (mismo fondo oscuro de la PreLaunchScreen, mismo logo, sin texto) eliminaría hasta esa transición.

Implementación trivial: componente `<LoadingSplash/>` reutilizando `HeroContainer` + `HeroOverlay` o un fondo de marca, sustituyendo el `return null`. Riesgo: si el splash queda montado más tiempo del esperado por un fetch lento, da apariencia de app rota. Mitigación: timeout de 5 s tras el cual muestra un mensaje de error suave.

Prioridad: baja, mejora de UX. No bloquea nada.

### [DEUDA operativa — pre-lanzamiento AUDIT/PROD] Subir assets de hero pre-launch a `assets-sharemechat-audit` y `assets-sharemechat-prod`

Los `prelaunch_desktop_v1.webp` y `prelaunch_mobile_v1.webp` solo existen hoy en `s3://assets-sharemechat-test1/prelaunch/hero/`. Cuando AUDIT o PROD pasen a `PRODUCT_ACCESS_MODE=PRELAUNCH`, su `ASSETS_BASE` resolverá a `assets.audit.sharemechat.com` o `assets.sharemechat.com` respectivamente, y la imagen no cargará porque el bucket de destino no la tiene. La PreLaunchScreen se degradaría a fondo negro plano (`#0b0f14` del `HeroContainer` + scrim del `HeroOverlay`) — presentable pero perdiendo el peso de marca.

Procedimiento al activar PRELAUNCH en cada entorno: copiar los dos webp con el mismo path al bucket correspondiente (`s3://assets-sharemechat-audit/prelaunch/hero/prelaunch_{desktop,mobile}_v1.webp`, `s3://assets-sharemechat-prod/prelaunch/hero/prelaunch_{desktop,mobile}_v1.webp`). Sin invalidación CloudFront necesaria (objetos nuevos). Verificar `https://assets.<env>.sharemechat.com/prelaunch/hero/prelaunch_desktop_v1.webp → 200` antes de cambiar `PRODUCT_ACCESS_MODE=PRELAUNCH` del entorno.

Prioridad: bloqueante para activar PRELAUNCH en AUDIT/PROD; no urge hoy porque solo TEST está en PRELAUNCH.

## 2026-05-31 — Guardarraíl anti-fugas del prefijo de idioma en navegación interna

### [DEUDA mantenibilidad] Evitar que se reintroduzcan fugas del prefijo `/en` en navegación interna

Tras cerrar las fugas conocidas (perfiles "Volver"/logo, footer, botones "atrás" de Faq/Safety/Rules/Config — ver `project-log.md` 2026-05-31), la preservación del prefijo `/en` en producto depende de una **convención implícita**: toda navegación interna debe pasar por React Router (`history.push` / `<Link>`), porque es lo único que hereda el basename del Router. Cualquier `<a href="/ruta-interna">`, `history.goBack()` o `window.location` a una ruta interna multilingüe que se introduzca en el futuro **reintroduce la fuga** de forma silenciosa (solo se nota bajo `/en`, que no es el idioma por defecto de desarrollo).

Pendiente decidir un guardarraíl que haga la regla explícita y automática. Opciones a valorar (prioridad al criterio del proyecto, no urge):

- Regla **ESLint** que prohíba `<a href="/...">` a rutas internas (forzando `<Link>`), y/o que marque `history.goBack()` en superficie producto.
- Un componente/hook centralizado (`<AppLink>` / `useAppNavigate`) que encapsule la navegación interna locale-safe, de modo que el equipo no dependa de recordar la convención caso a caso.
- Excepción explícita y documentada para los casos intencionales (Legal es-only, switch de idioma, cross-surface).

No bloquea nada hoy; relevante para que el frente de i18n no se erosione con cambios futuros.

## 2026-05-30 — Deudas y notas documentadas en cierre de Capa 2 multi-asset + saneo PublicUserDTO + Fase 7/9

### [LECCIÓN OPERATIVA] Auditar SecurityConfig sistemáticamente por panel admin

Durante el bugfix Fase 9 se descubrió que `/api/admin/model-assets/**` estaba bloqueado para SUPPORT desde Capa 1 (Fase 2 backend, 2026-05-30) sin detectarse. Causa: el catch-all `/api/admin/**` exige `ROLE_ADMIN`, y los endpoints de moderación assets no tenían matcher específico que admitiera `BO_ROLE_SUPPORT` o `BO_ROLE_AUDIT`. La validación del operador con un user ADMIN+SUPPORT simultáneo enmascaró el bug durante 3 deploys.

Patrón a auditar en sesión separada: revisar cada `RequestMapping` de `controller/*.java` con prefijo `/api/admin/`, y confirmar que tiene matcher específico en `SecurityConfig` antes del catch-all si SUPPORT/AUDIT deben poder usarlo. Sospechables: otros paneles del backoffice (AdminAdministrationPanel, AdminFinancePanel, AdminDataPanel, etc.). Si el panel está pensado solo para ADMIN, el catch-all es correcto; si SUPPORT/AUDIT deben tener lectura/operativa, falta matcher.

Prioridad: media-alta. Sin esto, cualquier panel admin nuevo cae al catch-all por defecto y queda silenciosamente bloqueado para SUPPORT/AUDIT.

### [LECCIÓN OPERATIVA] Validar features con TODOS los roles antes de cerrar

Durante 3 deploys de Capa 2/Fase 7/Fase 9, el operador validó el panel de moderación assets como ADMIN. El Bug 1 (SUPPORT bloqueado) no se detectó hasta el cuarto despliegue cuando se hizo prueba dedicada con un user SUPPORT puro. Regla nueva: cualquier feature que afecte a panels backoffice exige validación obligatoria desde un user con SUPPORT puro y otro con AUDIT puro antes de marcar la feature como cerrada. Si la matriz de validación incluye varios roles BO, hacerla siempre desde users separados (no desde un user multi-rol).

### [DEUDA test] Tests JUnit pendientes para servicios y endpoints Capa 2

Sin tests unitarios desplegados para:

- `ModelAssetService`: upload, markPrincipal (validación APPROVED de Fase 9), delete (incluyendo cancel automático de review PENDING), auto-rotación de principal.
- `ModelAssetReviewService`: createPendingReview, approveReview, rejectReview (con auto-rotación), `rejectApprovedRetroactively` (Fase 9), cancelPendingByAssetId, isModelFullyApproved alineado con queries del pool.
- `ModelService.getPublicProfile`: validación de disponibilidad (role MODEL + isActive + !unsubscribe + accountStatus ACTIVE + verificationStatus APPROVED), retorno DTO sin name/surname/email/country.
- `UserController.getUserById`: detección backoffice viewer, retorno `PublicUserDTO` reducido vs `BackofficeUserViewDTO` completo según rol del viewer.
- Endpoints retroactivo + cola filtrada (`max(id) per asset`) + countByStatus alineado.

Pendiente para sesión dedicada de testing.

### [DEUDA test heredada] `UserControllerConsentMockMvcTest` roto

Test roto desde Fase 2 Capa 1 (deuda heredada del trabajo anterior, no resuelta en esta sesión). El constructor de `UserController` cambió (de `ModelDocumentRepository` a `ModelAssetRepository` en Capa 2) y el test sigue esperando el constructor antiguo. Build se compila con `-Dmaven.test.skip=true`. Adaptar o eliminar pendiente.

### [DEUDA arquitectural] Granularidad fina por rol BO en `BackofficeUserViewDTO`

Hoy ADMIN/SUPPORT/AUDIT/EDITOR ven los mismos datos en el endpoint genérico `/api/users/{id}` cuando son backoffice. Decisión actual: simple y suficiente. Mejora futura: discriminar campos según rol BO (ej. AUDIT no necesita ver `riskReason` ni `suspendedUntil`, EDITOR no necesita ver `email`). Granularidad fina queda como deuda baja hasta que se justifique con un caso de uso real.

### [DEUDA optimización] Cacheo de `viewerIsBackoffice` en sesión Spring Security

`UserController.getUserById` llama a `BackofficeAccessService.loadProfile(viewer)` en cada request. Si este endpoint pasa a hot path (carga masiva de avatares en el cliente, por ejemplo), conviene cachear el flag `isBackoffice` en el `Authentication`/sesión Spring Security para evitar el roundtrip a BD. Hoy no es problema; medir antes de optimizar.

### [DEUDA auditoría amplia] Otros endpoints surface cliente/modelo que devuelven info de terceros

El frente de saneo PublicUserDTO (Fase 5) cubrió solo `/api/users/{id}`. Hay otros endpoints del surface cliente/modelo que pueden estar devolviendo info de OTRO usuario sin auditar (mensajes, favoritos meta, listados públicos). Pendiente: auditoría sistemática del payload de cada endpoint que devuelva datos de terceros, identificando qué campos del User entity expone. Programar junto con tests JUnit del frente Capa 2 — al escribir tests forzados a la lista de campos, los leaks aparecen.

### [DEUDA cosmética] Claves i18n huérfanas en `perfilModel.*` tras refactor Capa 2

Tras eliminar las 2 `MediaCard` de Capa 1 (foto + vídeo individual) en `PerfilModel.jsx`, varias claves quedaron sin consumidor: `perfilModel.sections.profilePhoto.subtitle`, `perfilModel.sections.introVideo.*`, `perfilModel.actions.uploadVideo`, `perfilModel.actions.deleteVideo`, `perfilModel.confirm.deleteIntroVideo`, `perfilModel.media.*`, `perfilModel.hints.acceptContractForPhoto`, `perfilModel.hints.acceptContractForVideo`, `perfilModel.hints.photoFormat`, `perfilModel.hints.videoFormat`, `perfilModel.empty.notUploaded`. Decisión: no se borraron en la sesión para no romper otros consumidores hipotéticos. Limpieza pendiente con un grep cross-referencia.

### [DEUDA codigo muerto] `FavoriteItem.jsx` sin consumidores

`frontend/src/pages/favorites/FavoriteItem.jsx` no se importa desde ningún sitio del frontend. Las listas de favoritos usan `FavListItem` interno de `FavoritesClientList.jsx`/`FavoritesModelList.jsx`. `FavoriteItem.jsx` conserva el helper `resolveProfilePic` con fallbacks legacy (`urlPic`, `documents.urlPic`, etc.) que también son código muerto. Candidato a borrar.

### [DEUDA limpieza BD] Reviews huérfanas residuales en AUDIT

9 filas en `model_asset_reviews` con `asset_id IS NULL` (2 del grandfather V5 + 7 generadas durante validación manual con código pre-Fase 7). Ocultas por el filtro nuevo en la cola admin. Limpieza física puntual sería `DELETE FROM model_asset_reviews WHERE asset_id IS NULL` puntual cuando se quiera base limpia. Sin impacto operativo, no urgente.

### [DEUDA documental] Grep final de referencias legacy `urlPic|urlVideo|picApproved|videoApproved`

Tras la migración Capa 2, las referencias activas en código se han limpiado. Pendiente verificar que no quedan menciones en docs/comentarios/README de los campos eliminados de `model_documents`. Mantener el repo coherente con la realidad post-V5.

### [DEUDA visual opcional] Stat card CANCELLED

`ModelAssetReviewStatsDTO` solo expone `pendingReview/approved/rejected`. El estado `CANCELLED` (Fase 7) no tiene stat card en el header del panel. Si quieres visibilidad permanente del volumen de CANCELLED, ampliar el DTO + un getter en `getStats()` + la 4ª stat card. No bloqueante, solo decisión UX.

### [MEJORA opcional] Distinguir email de rechazo retroactivo vs pre-aprobación

El email al modelo es idéntico para `rejectReview` (pre-aprobación) y `rejectApprovedRetroactively` (Fase 9). Si la UX lo requiere, distinguir el template para que el modelo entienda que se le revierte una aprobación previa. Decisión actual: mismo template para simplicidad. Baja prioridad.

### [MEJORA opcional] Consolidación batch async de emails de rechazo

Si admin rechaza foto Y vídeo del mismo modelo en sesión corta (escenario operativo común), hoy se envían 2 emails separados. Consolidación batch async (debounce por user+sesión) podría enviar un único email "rechazado pic + video" con motivos combinados. Mejora UX baja prioridad.

### [DEUDA cosmética] Warning Flyway MySQL 8.4 sin soporte oficial

Logs de arranque muestran `Flyway upgrade recommended: MySQL 8.4 is newer than this version of Flyway`. Sin impacto funcional (V1..V6 aplicadas OK). Actualizar Flyway en `pom.xml` queda como mantenimiento de dependencias. Baja prioridad.

### [DEUDA arquitectural] Refactor `AdminModelsPanel` (KYC) con patrón Capa 2

`AdminModelsPanel.jsx` (revisión documentos KYC del onboarding del modelo) sigue sin motivo de rechazo, sin email al modelo, sin audit log de la decisión, sin posibilidad de reapertura. El patrón Capa 2 (motivo + email + audit log + cancelado) está validado y reusable. Refactor del panel KYC para alinearlo con el mismo flujo queda como deuda media — se beneficia el operador con consistencia entre las dos pantallas de moderación.

### [NOTA operativa go-live PROD] `ALTER TABLE model_documents/model_assets` con tráfico real

V5 ejecuta `ALTER TABLE model_documents DROP COLUMN url_pic, url_video, pic_approved, video_approved` y crea `model_assets` con índices compuestos. En AUDIT con 3 filas es instantáneo, pero en PROD con tráfico real el ALTER puede ser largo y bloquear. Considerar `ALGORITHM=INPLACE, LOCK=NONE` explícito en el SQL de V5 antes del go-live PROD, o ventana de mantenimiento. Verificar también que la creación de FK e índices de `model_assets` no bloquea writes en `users` durante la migración.

### [MEJORA opcional] Capa 3 multi-asset (más slots)

Si benchmark con competencia post-go-live muestra que 5+2 es restrictivo, ampliar a más slots. Constantes en `ModelAssetService.MAX_ACTIVE_PIC_PER_USER` y `MAX_ACTIVE_VIDEO_PER_USER`. Sin cambio de schema (no hay límite duro en BD). Baja prioridad hasta tener métricas.

### [CERRADA 2026-05-31] Selector de idioma UI bloqueado tras login

Resuelta. Era una regresión del commit `7520029` (16 mayo): el `LocaleSwitcher` de producto dejó de persistir la elección en BD, y `SessionProvider.applyLocale` reimponía `user.ui_locale` en cada carga autenticada, pisando el locale de la URL. Fix: en producto/blog la URL manda en el display (`applyLocale` solo toca `i18n` en superficie admin) y el switcher de producto vuelve a persistir vía `PUT /users/me/ui-locale` para los emails. Detalle de resolución movido a `incident-notes.md` (sección "Selector de idioma bloqueado tras login en producto — 2026-05-31"). Despliegue + bitácora en `project-log.md` 2026-05-31.

---

## 2026-05-31 — Patrón de backup de frontend (deuda de nivelación TEST/PROD)

### [DEUDA operativa] Nivelar a TEST y PROD el patrón de backup de frontend estrenado en AUDIT

Durante el despliegue del arreglo del selector de idioma (2026-05-31) se estrenó en AUDIT una red de rollback de frontend que antes no existía: `ops/scripts/deploy-frontend.ps1` hace `aws s3 sync --delete` (irreversible) sobre buckets frontend **sin versionado**, sin backup ni rollback documentado. La mitigación aplicada en AUDIT fue sincronizar el bundle vivo a un prefijo dedicado del bucket de backups general antes de cada deploy: `s3://sharemechat-backups/audit/frontend/{product,admin}/`, sobrescribible (un único respaldo = estado inmediatamente anterior), con red extra heredada del versionado del bucket. Procedimiento de rollback en `runbooks.md` ("Runbook de rollback de frontend (S3 + CloudFront)").

Hoy esto solo existe para AUDIT. **TEST y PROD no tienen ni el backup pre-deploy ni el rollback cableado** en su flujo de despliegue de frontend. Pendiente decidir y nivelar:

- replicar los prefijos `s3://sharemechat-backups/{test,pro}/frontend/{product,admin}/` y el paso de backup pre-sync para esos entornos;
- o, mejor estructuralmente, integrar el backup pre-deploy como paso opcional dentro de `deploy-frontend.ps1` (parametrizado por entorno/surface, resolviendo el prefijo desde el mapping) para no depender de comandos manuales por entorno;
- valorar activar versionado en los buckets frontend de cada entorno como red nativa, en lugar del backup-a-prefijo.

Prioridad: a criterio del proyecto. No bloquea hoy (AUDIT cubierto); relevante antes de despliegues frecuentes de frontend en TEST/PROD, y especialmente antes del go-live de PROD.

---

## 2026-05-30 — Deudas y notas documentadas en cierre de Capa 1 moderación assets

### [BUG CONOCIDO Capa 1, resuelto en Capa 2] Foto pendiente visible en matching pool

En Capa 1, el filtro `pic_approved=TRUE AND video_approved=TRUE` se añadió a las 5 queries de listing público (`countEligibleModelsWithVideo`, `findTeasersPage`, `findTopByEarnings`, `findNewestModels`, `findRandomModels`) de `ModelDocumentRepository`, **pero NO al matching pool ni a otras superficies que leen `url_pic`/`url_video` directos desde `ModelDocument`**. Resultado: una modelo con foto recién subida pero aún `PENDING_REVIEW` puede aparecer en el matching emparejada con clientes.

La solución estructural es **Capa 2** (tabla aparte `model_assets` con FK a `users` + concepto "asset principal aprobado"). Las queries del pool en Capa 2 harán JOIN explícito con `model_asset_reviews APPROVED` por asset, evitando todo el atajo de leer URLs directas. Se prioriza Capa 2 sobre parchear Capa 1 porque el modelo de datos cambia de raíz.

### [DEUDA estructural] Asimetría temporal entre revisión documentos KYC y revisión assets

`AdminModelsPanel.jsx` (revisión de documentos de identidad para onboarding del modelo) sigue sin motivo de rechazo, sin email al modelo, sin audit log de la decisión, sin posibilidad de reapertura — patrón heredado. `AdminAssetModerationPanel.jsx` (Capa 1 desplegada) sí tiene motivo (10 + `OTHER`), email bilingüe, audit log, y permisos diferenciados ADMIN+SUPPORT (moderan) vs AUDIT (solo lectura). La asimetría es por priorización (lo de assets era lo que pedían los PSPs en onboarding). Refactor de la pantalla de documentos para alinear con el patrón nuevo queda como deuda en sesión separada.

### [LECCIÓN OPERATIVA] Deploy SPA = dos surfaces separadas

Cualquier feature que toque ficheros bajo `frontend/src/pages/admin/` requiere **dos despliegues independientes**:

- `npm run build:product` (`.env.product` con `REACT_APP_SURFACE=product`) → `sharemechat-frontend-{env}` → distribución del producto (`E2Q4VNDDWD5QBU` test / `E1ILXV7P6ENUV8` audit / `E2FWNC80D4QDJC` prod).
- `npm run build:admin` (`.env.admin` con `REACT_APP_SURFACE=admin`) → `sharemechat-admin-{env}` → distribución del admin (`E28YCPVIRB4ASH` test / `E21IB0VBKYNNBW` audit / `E3O40LHJ4PC6LE` prod).

Los planes de despliegue tienen que distinguir explícitamente ambas. Durante Capa 1 se olvidó el admin y hubo que reaplicar tras la validación; quedó como gap de proceso. El script `ops/scripts/deploy-frontend.ps1` ya está preparado para esto vía el parámetro `surface`, pero los planes operativos lo perdieron de vista.

### [VERIFICACIÓN pendiente] Detección de idioma en frontend

El operador observó que al cambiar VPN entre países, `audit.sharemechat.com` sigue mostrándose en español. Hipótesis no verificada: la SPA lee `Accept-Language` del navegador (que no cambia con la VPN), no la IP. Pendiente verificar configuración Firefox del propio equipo del operador en sesión separada; si confirma comportamiento correcto, documentar y cerrar; si es bug, sesión separada para diagnóstico. **No afecta** al email de rechazo de assets de Capa 1: lee `user.ui_locale` de BD, no del navegador del moderador.

### [DEUDA tests] Tests JUnit para `ModelAssetReviewService` pendientes

Capa 1 desplegada sin tests unitarios del service nuevo. Tests recomendados:

- `createPendingReview` crea row y baja flag denormalizado en `model_documents`.
- `approveReview` sube flag y escribe audit log con payload `{resource_type, resource_id, asset_type, asset_url}`.
- `rejectReview` baja flag, escribe audit log, dispara email (BEST_EFFORT) con motivo bilingüe.
- Validación de `reasonCode`: dentro del catálogo de 11 valores, `OTHER` exige `reasonText` no vacío.
- Transiciones bloqueadas: aprobar/rechazar una review en estado `APPROVED` o `REJECTED` lanza `IllegalStateException`.

Pendiente en sesión separada o como parte de Capa 2 si la API queda equivalente.

### [DEUDA scope reducido Capa 1] `findApprovedModelProfileDocumentByUserId` sin filtro flags

La 6ª query de `ModelDocumentRepository` (lookup individual, no listado) no se modificó en Capa 1 — el plan del operador habló literalmente de "5 queries" y se interpretó estricto. La query la usa `ModelService.matchesAuthorizedTeaserStorageKey` para autorizar accesos a `/api/storage/content` (verifica que el `storageKey` solicitado pertenece al perfil aprobado del modelo). Vector residual: un modelo con assets `PENDING_REVIEW` podría tener su storage accesible vía URL exacta si el caller conoce el key. Capa 2 reemplaza esta lógica completa al iterar sobre `model_assets` aprobados, por lo que se resuelve naturalmente. Anotado por trazabilidad.

### [NOTA OPERATIVA go-live PROD] `ALTER TABLE model_documents` con `ALGORITHM=INPLACE`

Cuando se aplique **V5** (próxima migración Capa 2) en PROD con tráfico real, el `ALTER TABLE model_documents DROP COLUMN ...` (`url_pic`, `url_video`, `pic_approved`, `video_approved`) puede ser largo si la tabla tiene muchas filas. Considerar `ALGORITHM=INPLACE` explícito y ventana de mantenimiento si procede. Para AUDIT actual (3 filas) es irrelevante; la advertencia es para PROD futuro.

---

## 2026-05-29 — Cuentas demo de PSP inactivo eliminadas de AUDIT + deuda aislamiento multi-PSP

Se eliminaron de AUDIT las cuentas `demo+ccbill_*` (4 cuentas, 137 filas BD, 5 objetos S3 con documentos KYC) tras detectar que un PSP con acceso al backoffice de AUDIT podría ver cuentas demo asociadas a otro PSP, exponiendo información comercial cruzada. Las cuentas eliminadas eran mockup sin actividad real (sin transacciones, sesiones, chats ni moderación). Backup SQL local conservado en `/tmp/ccbill-removal-backup-2026-05-29.sql` en la EC2 de AUDIT. El código Java y la documentación interna conservan menciones a CCBill por tratarse de scaffold mockup intercambiable; no son visibles para PSPs externos.

### [DEUDA ARQUITECTURAL — prioridad MEDIA] Aislamiento entre PSPs en backoffice multi-tenant

Hoy un PSP con rol backoffice (AUDIT/SUPPORT) ve TODO el listado de usuarios/modelos/clientes en `admin.audit.sharemechat.com`, incluyendo cuentas demo asociadas a otros PSPs. Cuando AUDIT/PROD reciban múltiples PSPs activos en paralelo con accesos backoffice simultáneos, replantear el modelo de aislamiento. Opciones a evaluar:

- (a) cuentas demo invisibles entre PSPs (filtro por owner/tag en la vista de backoffice);
- (b) segmentación de la vista del backoffice por tenant/PSP;
- (c) permisos backoffice más granulares (un AUDIT externo ve solo lo que su PSP necesita validar);
- (d) tabla aparte de cuentas demo con visibilidad explícita por tenant.

Prioridad **media**: no bloquea hoy (Segpay es el único PSP con acceso backoffice activo tras la eliminación), pero conviene resolver antes de aceptar un segundo PSP en paralelo con acceso simultáneo al backoffice.

---

## 2026-05-29 — Incidente acceso PSP Segpay: country access desactivado (AUDIT+TEST) + fix ORP CloudFront admin

Contexto: Patricia (Segpay) reportó bloqueo de acceso a las superficies de AUDIT. El diagnóstico (ver `project-log.md` 2026-05-29) reveló que el country access redesign del 2026-05-27 bloqueaba la superficie admin para toda conexión no-bypass, por una asimetría de Origin Request Policy en CloudFront. Patricia aclaró que su equipo de compliance está distribuido (UK, Europa, EE.UU., banco) con IPs volátiles y pidió explícitamente acceso sin restricción geográfica.

### [NOTA OPERATIVA] Country access DESACTIVADO temporalmente en AUDIT durante onboarding PSP

AUDIT tiene `COUNTRY_ACCESS_ENABLED=false` desactivado temporalmente durante el período de auditoría PSP (Segpay y otros). Razón: los PSPs tienen equipos de compliance distribuidos en múltiples países (UK, Europa varios, EE.UU., bancos) con IPs volátiles, y solicitan explícitamente acceso sin restricción geográfica. AUDIT es por diseño el entorno de validación/auditoría externa, abierto a auditores de múltiples países; el geo-gating tiene sentido en PROD (producción real con monetización), no aquí durante el onboarding.

REACTIVAR cuando termine la auditoría PSP: poner `COUNTRY_ACCESS_ENABLED=true` en `/opt/sharemechat/config.env` de AUDIT + restart. Las allowlists (CLIENT 28 / MODEL 51) y `COUNTRY_ACCESS_BYPASS_IPS` siguen configuradas e intactas en config.env, listas para reactivación. `COUNTRY_ACCESS_BLOCK_WHEN_MISSING` quedó en `false` tras la mitigación previa del 2026-05-28; al reactivar, decidir si vuelve a `true`. Prioridad: documental + recordatorio operativo.

### [NOTA OPERATIVA] Country access DESACTIVADO en TEST (las allowlists estaban vacías)

Durante la verificación se descubrió que TEST tenía el country gate `enabled=true` con allowlists VACÍAS y sin bypass: el `.env` de TEST nunca definió ninguna clave `COUNTRY_ACCESS_*`, y el código arranca con `enabled=true` por defecto. Efecto: el gate bloqueaba TODA petición (cualquier país resuelto cae fuera de la allowlist vacía; cualquier país no resuelto cae por `block-when-missing=true` por defecto) → 403 → reescrito a HTML por la CustomErrorResponse de la distribución admin → overlay. Se añadió `COUNTRY_ACCESS_ENABLED=false` al `/opt/sharemechat/.env` de TEST (mirror de AUDIT) + restart (el backend de TEST corre como proceso de `ec2-user`, no systemd). Si en el futuro se quiere geo-gating real en TEST, hay que configurar las allowlists y bypass además de poner `enabled=true`.

### [NOTA CRÍTICA go-live PROD] ORP correcto + configurar country access explícitamente

Dos puntos para el go-live de PROD (marcar como paso crítico del paso 4 / Bloque 8 del snapshot go-live):

1. **ORP admin**: cuando se cablee la behavior `/api/*` en la distribución admin PROD (`E3O40LHJ4PC6LE` — hoy SIN behavior `/api/*`), debe usar `Managed-AllViewerExceptHostHeader` (`b689b0a8`) DESDE EL INICIO, NO `admin-api-origin-request-v2` (`f11445e9`). El ORP `f11445e9` no forwardea `CloudFront-Viewer-Country` al backend, lo que combinado con country access activo + `BLOCK_WHEN_MISSING=true` bloqueó el admin de AUDIT y TEST (incidente Segpay 2026-05-28).

2. **Footgun enabled-by-default**: `CountryAccessService` arranca con `enabled=true` por defecto si no se define `COUNTRY_ACCESS_ENABLED`, y con allowlists vacías si no se definen → gate totalmente bloqueante de forma silenciosa (lo que pasó en TEST). En PROD hay que definir EXPLÍCITAMENTE `COUNTRY_ACCESS_ENABLED` y, si está en `true`, poblar allowlists y bypass; de lo contrario el login queda bloqueado para todos. Deuda de código separada a considerar: cambiar el default a `enabled=false`, o fallar el arranque si `enabled=true` con allowlists vacías.

---

## 2026-05-27 — Cierre auth bypass + deudas detectadas durante el fix

### [CERRADA 2026-05-27] Auth bypass producto → backoffice (entrada original del 2026-05-26)

**Cerrado vía Opción C v2** en commit `<HEAD>` (2026-05-27). El fix v1 (whitelist por `users.role={USER,CLIENT,MODEL}`) era insuficiente — cubría solo el caso `users.role=ADMIN` puro. Durante validación post-deploy del v1 el operador detectó que `users.role=USER + user_backoffice_roles=[SUPPORT]` seguía pasando el check (caso real más común).

**Diseño v2 aplicado**: doble check en `AuthController.login` Y `AuthController.refresh`:

1. **Check 1 (rol primario)**: `users.role` debe pertenecer a `{USER, CLIENT, MODEL}`. Bloquea el caso `users.role=ADMIN` puro.
2. **Check 2 (roles backoffice)**: `backofficeAccessService.loadProfile(u.getId(), u.getRole()).roles()` debe ser vacío. Bloquea el caso `users.role=USER/CLIENT/MODEL + user_backoffice_roles=[SUPPORT/AUDIT/EDITOR]`.

Respuesta uniforme `InvalidCredentialsException("Credenciales inválidas")` en ambos checks, idéntica a credencial errónea (sin oráculo). `AdminAuthController.login` intacto: sigue siendo el único endpoint válido para autenticar usuarios con acceso backoffice.

**Validación operativa**:

- TEST y AUDIT desplegados con JAR v2 (SHA256 `f3aaf17b67157eadc2ac06746f38d0099409686aebc1d6b457dc1b60ac08f891`).
- Operador validó en navegador modo incógnito (con `refresh_tokens` purgados en ambos entornos):
  - `audit.sharemechat.com/api/auth/login` con USER+SUPPORT → HTTP/2 401 (688 ms). Bypass crítico cerrado.
  - `admin.audit.sharemechat.com/api/admin/auth/login` con el mismo usuario → HTTP 200, admin dashboard intacto.
- Mismo patrón verificado en TEST antes del deploy a AUDIT.

**`refresh_tokens` purgados post-deploy**:

- TEST: 1147 borrados → 0 vivos.
- AUDIT: 416 borrados → 0 vivos.

Esto invalida cualquier cookie refresh_token emitida pre-fix, forzando re-login de todos los usuarios. Acción aceptable porque TEST/AUDIT solo tienen al operador y auditores ocasionales.

**PROD pendiente del próximo deploy general**: PROD está apagado (EC2 stopped + RDS stopped). El JAR v2 se aplicará cuando el operador inicie el próximo arranque PROD. El bug no se expone hasta entonces porque PROD arrancará en modo `PRELAUNCH` que bloquea `/api/auth/login` a nivel `ProductOperationalModeService` antes de llegar al controller. Anotación operativa: al subir el v2 a PROD, ejecutar también `DELETE FROM refresh_tokens` (aunque la tabla estará casi vacía, por uniformidad de proceso).

**Vectores residuales** (NO cubiertos por v2, deudas separadas más abajo):

1. EDITOR catalogado en código pero sin operadores activos en BD (ver entrada propia).
2. Endpoints adicionales que materialicen sesión autenticada con cookie (ver entrada propia).

---

### Rol EDITOR catalogado en código pero NO operativo

**Origen**: detectado durante el análisis forense del fix v2 (2026-05-27). El rol `EDITOR` aparece en:

- `BackofficeAuthorities.java:11` (constante `ROLE_EDITOR = "EDITOR"`).
- `OFFICIAL_BACKOFFICE_PERMISSION_CATALOG`: 4 permisos `CONTENT.*` asociados al rol.
- Tabla `backoffice_roles` (catálogo BD).

Pero **NO está incluido en** `AdminAuthController.hasInternalBackofficeAccess` (línea 105-107), que solo acepta ROLE_ADMIN/SUPPORT/AUDIT. Tampoco en `canAccessBackoffice` del frontend (`backofficeAccess.js:38-39`). Un usuario hipotético con `user_backoffice_roles=[EDITOR]` quedaría bloqueado en `/api/admin/auth/login` (401 "Acceso de backoffice denegado") y también en `/api/auth/login` (check 2 del fix v2 — backoffice no vacío → 401).

**Estado**: ABIERTA. Prioridad BAJA. No urgente.

**Verificación operativa** (2026-05-27): query `SELECT COUNT(*) FROM user_backoffice_roles ubr JOIN backoffice_roles br ON br.id=ubr.role_id WHERE UPPER(br.code)='EDITOR' AND ubr.user_id IN (SELECT id FROM users WHERE account_status='ACTIVE');` devolvió:

- TEST: **0 EDITORs activos**.
- AUDIT: **0 EDITORs activos**.

Por tanto el rol no está operativo hoy y el fix v2 no introduce regresión en usuarios reales. Cuando se decida asignar EDITORs operativamente:

1. Añadir `profile.roles().contains(BackofficeAuthorities.ROLE_EDITOR)` a `AdminAuthController.hasInternalBackofficeAccess`.
2. Añadir `isBackofficeEditor(user)` a `canAccessBackoffice` en el frontend (`backofficeAccess.js`).
3. Verificar las rutas admin que deben aceptar EDITOR (probablemente solo las de gestión de contenido, no las administrativas generales).
4. Tests JUnit cubriendo el nuevo rol.

**Prioridad operativa**: BAJA. El rol existe como catálogo de permisos pero no se usa todavía en flujos reales. Cuando empiece a usarse, activar siguiendo los 4 pasos.

---

### Auditoría sistemática pendiente de endpoints que emiten sesión autenticada con cookie

**Origen**: durante el análisis forense del fix v2 (2026-05-27), se inspeccionaron exhaustivamente todos los puntos del código que emiten cookie de sesión (`grep -n 'ResponseCookie\.from' src/main/java`). El resultado encontró solo 6 ocurrencias en 3 ficheros:

- `AuthController.java` (login, refresh, logout) — **cubierto por fix v2**.
- `AdminAuthController.java` (login admin) — **validación intacta** (`hasInternalBackofficeAccess`).
- `ProductOperationalModeFilter.java` — solo borra cookies, no emite sesión.

**No existen** hoy endpoints SSO, magic link, OAuth, ni callbacks de proveedores externos que materialicen cookie de sesión. **El universo de emisión de sesión está cubierto**.

**Sin embargo, esta deuda anota la auditoría preventiva pendiente** sobre endpoints adyacentes que NO emiten cookie de sesión directa hoy pero podrían materializar sesión en el futuro o vía side-effect:

- `POST /api/email-verification/confirm` o equivalente: cuando un usuario verifica su email, ¿se loguea automáticamente? Si sí, ¿valida rol antes de emitir cookie?
- `POST /api/auth/password/forgot` y `POST /api/auth/password/reset`: el reset de password emite token reset (no es cookie de sesión). Pero al completar reset, si el flujo loguea automáticamente al usuario, debe aplicar el mismo check 1+2 que `AuthController.login`.
- Cualquier flujo futuro de magic link, OAuth (Google/Apple sign-in), SSO empresarial: aplicar el mismo patrón check 1+2 desde el inicio.

**Estado**: ABIERTA. Prioridad BAJA-MEDIA (preventiva).

**Acción**: sesión separada de auditoría sistemática que recorra:

1. `grep -rn 'ResponseCookie\|setCookie\|addCookie\|JwtUtil\.generate' src/main/java` para encontrar todos los puntos de emisión de cookies/tokens autenticables.
2. Inspeccionar el flujo de `EmailVerificationService` y `PasswordResetService` (si existen) — verificar si emiten sesión post-validación.
3. Documentar conclusiones: o bien "no aplica" (no se emite sesión), o "aplicar check 1+2".
4. Si se decide implementar SSO/OAuth/magic link, incluir el check 1+2 como requisito de diseño desde el RFC.

**Prioridad operativa**: BAJA. No bloquea go-live. Recomendado completar antes de habilitar OAuth o cualquier flujo de auth alternativo.

## 2026-05-26 — Hallazgo de seguridad durante validación post-PRO-5.A

### Bypass de aislamiento auth producto → backoffice (login admin acepta desde superficie de producto)

**Origen del hallazgo**: descubierto orgánicamente por el operador al validar TEST/AUDIT tras el refactor de properties PRO-5.A. Desde el formulario de login de la superficie pública del producto (`https://audit.sharemechat.com/`), al introducir credenciales de un usuario administrador del backoffice (que debería ser exclusivo de `https://admin.audit.sharemechat.com/`), el login se completa con éxito y el usuario es redirigido al dashboard del backoffice.

**Estado**: ABIERTA. Prioridad máxima dentro del frente de hardening pre-go-live. Primera tarea programada inmediatamente tras el cierre de PRO-10 del frente actual de provisioning PROD.

**Diagnóstico**: regresión por omisión, NO decisión arquitectónica documentada. Análisis exhaustivo en chat de la sesión Claude.ai del 2026-05-26.

- `POST /api/auth/login` (`AuthController.java:73-136`) llama `userService.authenticateAndLoadUser(dto)` que valida solo password y estado de cuenta; **nunca inspecciona `user.getRole()`**. Emite JWT y cookie `access_token` con el rol intacto sea el que sea (USER, CLIENT, MODEL, ADMIN).
- `POST /api/admin/auth/login` (`AdminAuthController.java:73-76`) sí valida con `hasInternalBackofficeAccess(profile)` que el usuario tenga `ROLE_ADMIN`, `ROLE_SUPPORT` o `ROLE_AUDIT` del backoffice antes de emitir cookie; si no, devuelve 401. **La asimetría entre los dos controllers es el fallo de fondo.**
- Cookie emitida desde producto tiene `domain=.audit.sharemechat.com` (con punto inicial). Por RFC 6265 §5.1.3, esa cookie es válida automáticamente en `admin.audit.sharemechat.com` sin que el frontend admin tenga que hacer nada. PROD tendrá el mismo comportamiento con `.sharemechat.com`.
- Frontend producto (`LoginModalContent.jsx:60-101` + `runtimeSurface.js:39-42`) detecta `user.role === 'ADMIN'` tras login OK y redirige proactivamente a `https://admin.audit.sharemechat.com/dashboard-admin`. La SPA admin carga, las cookies cross-domain ya son válidas, dashboard backoffice visible.
- Historia (`git log --follow`): `AuthController` nació en Sprint 1 como endpoint de login universal antes de existir el concepto de backoffice. `AdminAuthController` se introdujo en commit `42d7085 Admin BackOffice Fase 1.5` ya con la validación `hasInternalBackofficeAccess`. Cuando se añadió `AdminAuthController`, no se cerró el espejo defensivo en `AuthController`. **Es regresión por omisión histórica.**

**Impacto**:

- **Superficie de ataque ampliada para credential stuffing contra cuentas admin**: el atacante puede usar el formulario público (más visible) en lugar del admin (menos visible). ADR-008 Auth-risk cubre `Channels.PRODUCT` pero no `ADMIN`; con el bypass, un atacante de credenciales admin entra por el canal observado pero el bloqueo CRITICAL queda registrado bajo namespace producto, y no está confirmado si afecta también el canal admin (ver verificación pendiente abajo).
- **Separación "Dual Surface" de ADR-001 rota a nivel auth**. La filosofía dice "superficies distintas con disciplina documental"; la implementación une la sesión.
- **Posible DoS hacia cuentas admin** vía bloqueo del email en namespace producto: si un atacante provoca CRITICAL repetido en `/api/auth/login` con el email del admin, podría bloquear el login de ese admin también vía `/api/admin/auth/login` si `AuthRiskService.isEmailBlocked` consulta un namespace único sin discriminación de canal. **Verificación pendiente.**
- **En modo `OPEN`** (estado actual TEST/AUDIT y modo de operación normal previsto para PROD post-COMING-SOON): bypass trivialmente explotable.
- **En modos `PRELAUNCH`/`MAINTENANCE`/`CLOSED`** (ADR-009): mitigado, porque `ProductOperationalModeService.isProductPath:324` clasifica `/api/auth/login` como path de producto y devuelve 503 antes de llegar al controller. PRO se provisiona y arranca en PRELAUNCH durante COMING SOON, lo que mitiga el bypass durante esa fase.

**Solución propuesta**: **Opción C — whitelist de roles aceptados en `AuthController`**.

Patrón allowlist: `AuthController.login()` declara explícitamente que solo acepta usuarios con `role ∈ {USER, CLIENT, MODEL}`. Cualquier otro rol (incluido `ADMIN` y futuros roles backoffice como `MODERATOR`, `SUPPORT_LIGHT`, `EDITOR` que ya existe en BD) → 401 con mensaje genérico "Credenciales inválidas" (mismo que credencial errónea, para no filtrar oráculo sobre la existencia del admin). Registro `LOGIN_FAILURE` con razón específica `admin_role_blocked_on_product_channel` (o similar) para trazabilidad Auth-risk.

- ~15 líneas en `AuthController.java`, helper trivial.
- Reusable: pasa por el mismo `BackofficeAccessService` que ya consume `AdminAuthController`.
- Reversible (revert del PR).
- Sin coordinación frontend obligatoria. El frontend producto seguirá recibiendo 401 y mostrará "Credenciales inválidas" en lugar del redirect cross-surface obsoleto.
- Sin migración de cookies ni rotación de sesiones admin activas (la validación opera solo en login, no en JWT existente).
- Patrón allowlist es más seguro que blocklist frente a evolución del modelo de roles: roles nuevos NO permitidos por defecto hasta decisión explícita.

Detalle completo del análisis (4 bloques, opciones A-E comparadas, alcance estimado, riesgos de regresión) en el chat de la sesión Claude.ai del 2026-05-26.

**Acciones residuales antes o durante el fix**:

- Confirmar comportamiento cross-channel de `AuthRiskService.isEmailBlocked`: si un bloqueo CRITICAL generado por intentos contra `/api/auth/login` (Channels.PRODUCT) bloquea también intentos contra `/api/admin/auth/login`. Esto condiciona la mitigación del DoS hacia cuentas admin.
- Confirmar ausencia de tests JUnit existentes sobre `AuthController.login()` con usuarios admin. Si existen y esperaban 200 OK, hay que actualizarlos para esperar 401.
- Confirmar ausencia de otros endpoints que autentiquen sin discriminación de rol: password reset (`/api/auth/password/forgot|reset`), email verification (`/api/email-verification/confirm`), futuros flujos OAuth si se añadieran. Aplicar la misma regla allowlist donde aplique.
- Confirmar que el `cookieDomain` con dot-leading (`.audit.sharemechat.com`, `.sharemechat.com`) es decisión consciente, no descuido. Verificación: aparece literal en `application.properties` per-env desde varios sprints atrás. Documentar motivo si se encuentra (probable: compartir sesión entre apex y `admin.*` de forma deliberada, lo cual es justamente lo que habilita el bypass).

**Defensa en profundidad opcional para sesión posterior**: Opción E — cookies con domain sin punto (`audit.sharemechat.com` en producto, `admin.audit.sharemechat.com` en admin). Aplicar como segunda capa tras la Opción C ya implementada. Si por error futuro la validación de rol cayera (refactor, flag, bug), las cookies no serían válidas cross-surface. Requiere coordinación frontend.

**Prioridad operativa**: BLOQUEANTE del go-live público de PROD. PROD NO se abre al público hasta que esta deuda esté resuelta. PROD puede provisionarse (PRO-6 a PRO-10) con el bug presente porque arrancará en modo `PRELAUNCH` (que mitiga el bypass por ADR-009); el bypass solo se activa al pasar a `OPEN`, que es decisión consciente posterior. La sesión de fix se programa inmediatamente tras el cierre de PRO-10 con prioridad máxima sobre cualquier otra deuda abierta.

### [CERRADA 2026-05-27] Country Access — migración de blocklist random a allowlist por flujo (cliente vs modelo) + bypass por IP para PSPs

**Cerrado el 2026-05-27** vía commit `<HEAD>`. Implementado el diseño completo aprobado el 2026-05-26: dual allowlist (28 países en client-registration, 51 países en model-registration, unión de 51 para login/refresh/admin-login) + bypass por IP (`90.175.201.51/32` del operador inicialmente; PSPs pendientes de coordinación con CCBill) + respuesta HTTP 403 uniforme `{code:"REGISTRATION_UNAVAILABLE", message:"Registro no disponible", path:null, scope:null}` sin filtrar scope ni país (OPSEC) + logs server-side con scope y country real para diagnóstico interno. `block-when-missing=true` por defecto (modo seguro: deny si no se resuelve país).

**Decisión de divergencia 403 vs 503**: country gate sigue siendo HTTP 403 (geo-restriction permanente) y ProductOperationalMode sigue siendo HTTP 503 (modo operativo temporal). Son semánticamente distintos: un cliente legítimo se beneficia de la información (503=reintenta mañana, 403=tu ubicación no autorizada). Dentro del universo country-blocked toda respuesta es indistinguible (no se filtra scope client/model/union ni país concreto), por tanto un atacante con VPN no puede mapear qué países están en qué lista.

**Validado en TEST y AUDIT**:

- Bootstrap log confirma parsing OK: `CountryAccessService initialized: enabled=true, clientAllowed=28, modelAllowed=51, unionAllowed=51, bypassIps=1`.
- Smoke tests internos (POST `/api/auth/login` con header `CloudFront-Viewer-Country` simulado):
  - `ES` (en ambas allowlists) → HTTP 401 (creds malas, country gate pasa)
  - `CN` (en ninguna) → HTTP 403 con body uniforme
  - `RU` (solo en model-allowlist; en unión por ser superconjunto) → HTTP 401
  - `XX` (código inválido, no resuelve a país) → HTTP 403
- Logs server-side: `Country gate DENY: scope=union country=CN ip=127.0.0.1` correctamente registrados con scope y país real.
- Operador validó login habitual desde su IP en TEST y AUDIT: 200 OK normal (ES en allowlists + IP en bypass).

**Properties nuevas** (en `application.properties` + `/opt/sharemechat/config.env` per-entorno):

```
country.access.enabled=${COUNTRY_ACCESS_ENABLED:true}
country.access.block-when-missing=${COUNTRY_ACCESS_BLOCK_WHEN_MISSING:true}
country.access.client-registration.allowed-countries=${COUNTRY_ACCESS_CLIENT_REGISTRATION_ALLOWED_COUNTRIES:}
country.access.model-registration.allowed-countries=${COUNTRY_ACCESS_MODEL_REGISTRATION_ALLOWED_COUNTRIES:}
country.access.bypass-ips=${COUNTRY_ACCESS_BYPASS_IPS:}
```

`country.access.blocked-countries` y `blocked-message` quedaron deprecadas (comentadas en `application.properties` con nota DEPRECATED para referencia histórica). El código nuevo NO las lee.

**PROD pendiente**: PROD está apagado al cierre del fix. JAR v3 (SHA `2591315ba1ce10c0a1c871460c0aa8fd185f439b97bd72c5db596eb8f6dde148`) se aplicará en el próximo arranque general, junto con actualización de `/opt/sharemechat/config.env` con las 5 keys nuevas. **Orden crítico**: actualizar config.env ANTES del scp del JAR (si se invierte, allowlists vacías + deny-all → operador bloqueado).

---

### Tests JUnit pendientes sobre CountryAccessService

**Origen**: cierre del country access redesign (2026-05-27). El servicio nuevo no tiene cobertura JUnit.

**Estado**: ABIERTA. Prioridad BAJA. No bloquea funcionalidad.

**Cobertura mínima recomendada** para sesión futura:

- `assertAllowedForClientRegistration` con país en client-allowlist (allow) y fuera (deny).
- `assertAllowedForModelRegistration` análogo.
- `assertAllowed` (unión) con país solo en model-allowlist (caso de modelo regional que se loguea) → allow.
- `assertAllowed` con país en ninguna allowlist → deny.
- `bypass-ips` con IP individual (`90.175.201.51`) → bypass (deny no se aplica).
- `bypass-ips` con CIDR (`192.0.2.0/24`) → bypass para IPs dentro del rango.
- `block-when-missing=true` sin header `CloudFront-Viewer-Country` → deny.
- `block-when-missing=false` sin header → allow.
- `enabled=false` → todos los casos allow.
- Excepción `CountryBlockedException` con mensaje uniforme `"Registro no disponible"` en todos los caminos deny.

**Prioridad operativa**: BAJA. La lógica está validada con smoke tests internos en TEST + AUDIT, pero los tests JUnit darían cobertura automatizada para regresiones futuras.

---

### Coordinación con CCBill y otros PSPs para obtener IPs operativas oficiales

**Origen**: cierre del country access redesign (2026-05-27). La lista actual de `COUNTRY_ACCESS_BYPASS_IPS` contiene solo la IP del operador (`90.175.201.51/32`). Los PSPs (CCBill principalmente, posiblemente otros como Veriff, gateway de email) NO están en la lista de bypass todavía.

**Estado**: ABIERTA. Prioridad MEDIA (no bloqueante para go-live OPEN si los PSPs operan desde países dentro de la unión; bloqueante si alguno opera desde país no listado).

**Acción**: coordinar con contacto en CCBill (y resto de PSPs si aplica) para obtener listado oficial de IPs/CIDR desde los que sus servidores hacen llamadas/webhooks al backend. Añadir a `COUNTRY_ACCESS_BYPASS_IPS` de cada entorno (TEST/AUDIT/PROD) vía edición de `config.env` per-EC2.

**Hipótesis sin verificar**: probablemente la mayoría de PSPs operan desde US, que está en ambas allowlists (no requeriría bypass). El bypass IP cubre el caso edge de PSP operando desde país no listado.

**Verificación recomendada antes de go-live OPEN**: revisar logs `Country gate DENY:` en AUDIT durante una semana operativa típica para identificar IPs de PSPs siendo bloqueadas inadvertidamente.

---

### Patrón maintenance — overlay React funcional + bucket S3 descolgado + comentarios "10.A.3.pre" engañosos

**Origen del hallazgo**: PRO-6/PRO-7 (2026-05-26), durante la inspección de TEST y AUDIT en busca del patrón maintenance a replicar en PROD. La hipótesis inicial era que el HTML del bucket `sharemechat-maintenance/{test,audit}/index.html` se servía vía CloudFront cuando el backend está caído. La inspección exhaustiva demostró que NO es así.

**Estado**: ABIERTA. Prioridad BAJA. No bloquea ningún go-live. Documentado para clarificar el estado actual, no para urgir resolución.

**Estado real (verificado experimentalmente)**:

- **Overlay React `MaintenanceOverlay`** (`frontend/src/components/MaintenanceProvider.jsx`) es el mecanismo realmente activo en los 3 entornos (TEST, AUDIT, PROD desde PRO-7). Detecta 5xx o respuestas con `Content-Type: text/html` en llamadas `/api/*`, monta un overlay bloqueante con branding `SHAREMECHAT` bilingüe EN+ES, y hace polling cada 30 s a `/api/users/me` para retirarlo cuando el backend vuelve. Es client-side puro.
- El **bundle frontend producto y admin desplegado en PROD** (PRO-7) ya incluye `MaintenanceProvider` integrado en `App.jsx`, por lo que PROD tendrá la misma experiencia maintenance que TEST/AUDIT desde el día uno, sin necesidad de cablear nada en CloudFront.
- **Bucket `sharemechat-maintenance`** existe con dos objetos: `audit/index.html` y `test/index.html` (ambos 1874 B, idénticos en branding al overlay React). **NO existe `prod/index.html`**. Los HTMLs están **descolgados**: ninguna distribución CloudFront los referencia como Origin, OriginGroup, CustomErrorResponse, behavior path-pattern, ni vía CloudFront Function.
- **Bucket policy de `sharemechat-maintenance`** autoriza `s3:GetObject` desde las dos distribuciones product (TEST `E2Q4VNDDWD5QBU`, AUDIT `E1ILXV7P6ENUV8`) — permiso residual de un cableado preparado pero nunca activado. No autoriza ni a las distribuciones admin ni a las distribuciones PROD (incluida la admin nueva `E3O40LHJ4PC6LE`). OAC `EKY0V8P96XXWM` (`oac-sharemechat-maintenance`) existe en CloudFront, también residual.
- **Comentarios en código describiendo un patrón "se complementa con OriginGroup en CloudFront"** (`MaintenanceProvider.jsx` líneas 3-5) y "CloudFront sirve desde el bucket sharemechat-maintenance via failover" (`http.js` líneas 12-15) son **engañosos**: describen la intención del paquete histórico `10.A.3.pre` que nunca se cerró. El sufijo `pre` del nombre sugiere que se quedó como pre-step y no se completó. La parte React funcional del paquete sí se mergeó; la parte CloudFront no.
- **Verificación experimental concluyente** (`curl -sI https://test.sharemechat.com/api/users/me` con EC2 TEST parado, 2026-05-26): respuesta HTTP `504` con body HTML genérico de CloudFront `<TITLE>ERROR: The request could not be satisfied</TITLE>` (936 B), **no** el HTML del bucket maintenance (1874 B con `<TITLE>SHAREMECHAT — Maintenance</TITLE>`). `x-cache: Error from cloudfront`. Lo que el operador interpretaba visualmente como "HTML servido desde el bucket maintenance" era de hecho el overlay React montado sobre la SPA cargada normalmente desde el bucket frontend; visualmente son idénticos porque comparten el mismo branding por diseño.

**Razonamiento sobre cobertura**:

- El overlay React cubre el **99.99 %** de los casos reales de "backend caído pero usuario quiere usar la app": EC2 stopped, JAR caído, nginx caído, RDS inaccesible. En todos esos casos la SPA carga desde S3 (servicio con 99.99 % de durabilidad/disponibilidad), hace fetch a `/api/*`, recibe 5xx o HTML genérico de CloudFront, y monta el overlay.
- El cableado CloudFront → bucket maintenance solo cubriría el caso edge de "la SPA misma no se sirve" (bucket frontend caído, S3 region down, distribución CloudFront caída). Probabilidad ínfima en operación normal.

**Cuándo abordarlo (si se aborda algún día)**:

- No prioritario; los registros se abrirán en PROD con el overlay React funcional desde día uno.
- Si en algún momento se decide cablear el bucket maintenance a CloudFront, la sesión debe abordarse con:
  - Decisión arquitectónica entre **CER** (`CustomErrorResponses 502/503/504 → /maintenance.html` con `ResponseCode=503`, simple pero local a cada distribución y requiere subir el HTML a cada bucket origin) versus **OriginGroup** (origin primario backend + secundario bucket maintenance, failover automático sobre 502/503/504, centralizado en bucket compartido reutilizable entre entornos).
  - Decisión sobre **alcance**: cablear solo en PROD; o nivelar también TEST/AUDIT al mismo tiempo para mantener simetría operativa (recomendado para no introducir asimetrías de respuesta entre entornos).
  - Decisión sobre **path** del HTML maintenance: si se elige OriginGroup, el OriginPath del origin secundario debe inyectar el prefijo `prod/` (y `audit/`, `test/` en sus respectivos cableos) para que el bucket compartido siga sirviendo el HTML correcto por entorno.
  - Subida del HTML faltante `prod/index.html` al bucket compartido, idéntico en branding a `audit/` y `test/`.
  - Extensión del bucket policy y del OAC para autorizar las distribuciones PROD adicionales.
  - ADR formal documentando la decisión (CER vs OriginGroup), la cobertura (caso edge SPA caída) y la convivencia con el overlay React (que sigue siendo la primera línea para todos los demás casos).
  - Limpieza de los comentarios engañosos en `MaintenanceProvider.jsx` y `http.js` para que reflejen el estado real: o bien describir el cableado nuevo si se hace, o bien reformularlos como "overlay client-side único mecanismo activo, bucket S3 reservado para futura extensión".

**Prioridad operativa**: BAJA. No bloquea PRO-8/9/10. No bloquea apertura `PRELAUNCH → OPEN` en PROD. No está en la cola de hardening post-PRO. Esta entrada existe para que cualquier persona que inspeccione el bucket `sharemechat-maintenance` o lea los comentarios "10.A.3.pre" no se confunda sobre lo que está activo y lo que no.

## 2026-05-27 — Cierre Q7 plan v2 PRO (auto-renewal cert TLS coturn AUDIT)

### [CERRADA] Cert TLS coturn AUDIT sin hook deploy — auto-renewal no cableado

**Origen**: Q7 del plan v2 PRO (documentado en PRO-1 como deuda paralela aceptada, planificada para cierre en PRO-10). El cert TLS de `api.audit.sharemechat.com` se renovaba vía `certbot-renew.timer` (cuando estaba activo), pero **no había hook deploy** que sincronizara el cert renovado a `/home/ec2-user/coturn/runtime/` ni reiniciara `coturn-audit.service`. Resultado: tras una renovación de Let's Encrypt, coturn seguía sirviendo el cert viejo cargado en memoria hasta restart manual.

**Estado del cierre (2026-05-27, PRO-10)**: CERRADA. Verificación exhaustiva pre-cambio reveló además que el propio `certbot-renew.timer` estaba **disabled + inactive** en AUDIT (subdeuda implícita en Q7 — el timer ni siquiera estaba lanzando intentos de renovación). PROD ya tenía el patrón cableado correctamente desde PRO-5 (hook + timer activo).

**Acciones aplicadas en AUDIT**:

1. **Hook deploy creado** en `/etc/letsencrypt/renewal-hooks/deploy/sync-coturn.sh` (0755 root:root, 601 B). Es un clon literal del hook PROD `sync-coturn.sh` con dos adaptaciones quirúrgicas:
   - Lineage: `/etc/letsencrypt/live/api.audit.sharemechat.com` (vs `api.sharemechat.com` en PROD).
   - Servicio a reiniciar: `coturn-audit.service` (vs `coturn-prod.service` en PROD).
   - Resto del flujo idéntico: cp `fullchain.pem` + `privkey.pem` a `/home/ec2-user/coturn/runtime/`, chown `ec2-user:ec2-user`, chmod `0600`, `systemctl restart coturn-audit.service`, `logger` con mensaje `[certbot-deploy-hook] cert sincronizado a coturn-audit y servicio reiniciado`.
   - Sintaxis verificada con `bash -n`.

2. **`certbot-renew.timer` activado**: `systemctl enable certbot-renew.timer && systemctl start certbot-renew.timer`. Confirmado `is-enabled=enabled` y `is-active=active`. Next run inmediato post-activación: `Wed 2026-05-27 23:33:15 UTC` (luego cadencia estándar de certbot, dos veces al día).

3. **Validaciones realizadas**:
   - `certbot renew --dry-run` → "Congratulations, all simulated renewals succeeded: /etc/letsencrypt/live/api.audit.sharemechat.com/fullchain.pem (success)".
   - Ejecución manual del hook (`sudo /etc/letsencrypt/renewal-hooks/deploy/sync-coturn.sh`) → exit 0; fingerprints SHA-256 de `runtime/fullchain.pem` y `live/api.audit.sharemechat.com/fullchain.pem` coinciden tras la copia; perms `ec2-user:ec2-user 0600` correctos; `coturn-audit.service` reiniciado (MainPID 1507 → 2250913, ActiveEnterTimestamp 2026-05-27 07:49:56 UTC); `is-active=active`; mensaje del `logger` capturado en journalctl.
   - Backup pre-cambio del par `fullchain.pem` + `privkey.pem` runtime conservado como `*.bak.pre-PRO-10-20260527T074952Z` en `/home/ec2-user/coturn/runtime/` (recuperable si fuera necesario).

**Estado actual del cert TLS coturn AUDIT**:

- Subject `CN=api.audit.sharemechat.com`, issuer `Let's Encrypt E7`, `notAfter=Jul 9 23:25:59 2026 GMT` (≈43 días vigencia). Let's Encrypt activará renovación automática a partir de mediados de junio (umbral de 30 días); cuando ocurra, el hook copiará el cert nuevo y reiniciará coturn sin intervención del operador.

**Observación complementaria** (no es Q7, pero detectada durante la verificación): el Security Group del puerto TURN-TLS 5349 en AUDIT bloquea conexiones TCP desde IPs externas. Verificación: `timeout 5 bash -c '</dev/tcp/18.195.185.25/5349'` → cerrado/bloqueado desde el equipo del operador; en PROD (3.77.59.1:5349) el equivalente sí responde con cert válido. La validación end-to-end del cert TLS externo en AUDIT, por tanto, no se pudo ejecutar — pero la validación interna (fingerprints + restart + log) demuestra que el hook hace su trabajo correctamente; el bloqueo externo es asimetría de SG independiente de Q7. Anotado como deuda menor abajo.

### Asimetría SG TURN-TLS 5349 entre AUDIT y PROD (deuda menor, detectada durante validación PRO-10)

**Estado**: ABIERTA. Prioridad BAJA.

PROD permite acceso TCP 5349 desde IPs externas (verificado en PRO-8 con `openssl s_client -connect 3.77.59.1:5349` mostrando cert válido). AUDIT lo bloquea (verificado el 2026-05-27 con `timeout 5 bash -c '</dev/tcp/18.195.185.25/5349'` → closed). La asimetría puede deberse a configuración intencional (TURN-TLS de AUDIT no expuesto al público porque AUDIT no recibe tráfico de clientes WebRTC real, solo del equipo interno) o a omisión histórica.

Verificación pendiente para una sesión posterior: comparar inbound rules del SG `sharemechat-audit-turn-relay-sg` con el de PROD `sharemechat-prod-turn-relay-sg`. Si la asimetría es intencional, documentarla en `docs/03-environments/audit.md`. Si no, ajustar el SG AUDIT para que sea simétrico con PROD (regla 0.0.0.0/0 → tcp 5349). Sin urgencia operativa porque AUDIT no atiende tráfico WebRTC público.

## 2026-05-27 — Refactor config/secrets split (Fase 1-3 + PRO-9) y deudas residuales descubiertas

### Refactor secrets en los 3 entornos — cerrado

Estado: CERRADO el 2026-05-27. Aplicado a TEST, AUDIT y PROD el patrón de separación `config.env` (0644 root:root, no-secret) + `secrets.env` (0600 root:root, secretos) tras incidente de transcripción de `SMTP_PASSWORD` del reporter perimetral AUDIT. Backups `.env.bak.pre-refactor-secrets-2026-05-26` conservados en los 3 entornos. Aprendizaje operativo registrado más abajo; este bloque queda como referencia histórica del cierre, no requiere acción adicional.

### [APRENDIZAJE] Agente transcribió SMTP_PASSWORD del reporter AUDIT al hacer cat /etc/.../config.env

**Origen**: 2026-05-26, durante inspección preparatoria de PRO-9. El agente ejecutó `cat /etc/sharemechat-audit-access-reporter/config.env` para inspeccionar la estructura del reporter, y el output incluyó la línea `SMTP_PASSWORD='<valor>'` literal. El valor de la credencial SMTP de `operations@sharemechat.com` quedó en el historial de chat del operador.

**Hecho**: la credencial SMTP productiva de Microsoft 365 (cuenta `operations@sharemechat.com`) quedó expuesta en chat. La cuenta autoriza envío SMTP autenticado y, dependiendo del scope concedido en M365 admin, otros permisos asociados.

**Mitigación inmediata aplicada** (2026-05-26 - 2026-05-27):

1. El operador rotó `SMTP_PASSWORD` en M365 admin para `operations@sharemechat.com`. La password expuesta quedó invalidada.
2. La nueva password requirió un segundo paso (login interactivo desde `outlook.office.com` con la cuenta) porque M365 había marcado la rotación como "must change at next sign-in", lo que provocó un error `535 5.7.139 user password has expired` en el primer test del reporter. Tras forzar el cambio interactivo, M365 aceptó la nueva password como definitiva.
3. Refactor `config.env` + `secrets.env` aplicado al reporter de AUDIT y al equivalente PROD (creado en PRO-9). El nuevo valor se entregó vía mensaje aparte y se inyectó directamente al heredoc SSH sin re-emisión en chat.

**Acción preventiva permanente añadida** a la lección documentada el 2026-05-25 (DB_PASSWORD): al inspeccionar cualquier `*.env`, `*.conf`, `*.properties` que mezcle config con secretos, **filtrar preventivamente las keys de password** antes de mostrar el contenido. Patrón recomendado para el agente:

```
sudo grep -vE '^(SMTP_PASSWORD|DB_PASSWORD|JWT_SECRET[_A-Z]*|CONSENT_SECRET[_A-Z]*|AUTHRISK_EMAIL_HASH_SALT|EMAIL_GRAPH_CLIENT_SECRET|WEBRTC_TURN_CREDENTIAL|WEBRTC_TURN_USERNAME|REDIS_PASSWORD|MAIL_PASSWORD)=' <fichero>
```

O `grep -oE '^[A-Z_]+='` cuando solo se necesite la lista de keys sin valores.

**Prioridad**: información (aprendizaje operativo). No es deuda técnica reversible; el refactor config/secrets que lo motivó queda como mitigación estructural. Esta entrada permanece junto a la del 2026-05-25 como lección permanente para futuros frentes.

### Deudas residuales en TEST (asimetrías históricas vs AUDIT/PROD, no resueltas)

Descubiertas durante el refactor 2026-05-27 al inspeccionar TEST. **Ninguna se resolvió** porque excedían el scope del refactor (acordado con el operador: solo separación config/secrets en TEST, no renombrar keys ni instalar systemd unit). Quedan para revisión en frente de hardening pre-go-live cuando se decida si convergir TEST con el patrón AUDIT/PROD o aceptar la divergencia.

**Estado**: ABIERTA en bloque. Prioridad media-baja, no bloquea ningún go-live. TEST es entorno desechable (se enciende/apaga manualmente), por lo que las asimetrías afectan a operación interna no a producción.

1. **`JWT_SECRET` y `CONSENT_SECRET` sin sufijo `_TEST`**.
   AUDIT y PROD usan `JWT_SECRET_AUDIT`/`JWT_SECRET_PROD` y `CONSENT_SECRET_AUDIT`/`CONSENT_SECRET_PROD`. TEST sigue con `JWT_SECRET=` y `CONSENT_SECRET=` (sin sufijo). `application-test.properties` espera el naming sin sufijo. Renombrar implica coordinar properties + .env y verificar bootstrap. Trivial pero fuera del scope refactor secrets actual.

2. **`WEBRTC_TURN_URL_TLS` no poblado en TEST**.
   AUDIT y PROD tienen las 3 URLs TURN (UDP/TCP/TLS). TEST solo UDP+TCP. La línea TLS no existe en `/opt/sharemechat/.env` ni en `config.env` tras el refactor. Degradación silenciosa: WebRTC en TEST no usa TLS relay, lo que limita conectividad en NATs simétricos con egress filtrado. Activar TLS en TEST requiere coordinar coturn (cert válido) y `.env`. Documentación previa: deuda 2026-05-25 "Rename de keys WEBRTC_TURN_* en .env de TEST y AUDIT" (que se cerró el 25 sin poblar TLS en TEST porque no estaba inicialmente).

3. **Backend TEST sin systemd unit** (deuda preexistente 2026-05-09, refrescada hoy).
   TEST se arranca manualmente. Tras el refactor 2026-05-27 se creó `/home/ec2-user/sharemechat-v1/start-test.sh` como wrapper para que el comando manual cargue automáticamente `config.env` + `secrets.env` + active `profile=test`. El operador sigue arrancándolo con `nohup ./start-test.sh ...` o tmux/screen. La creación de unit systemd para TEST sigue siendo deuda independiente para la sesión de hardening.

4. **`MAIL_PASSWORD` y `REDIS_PASSWORD` residuo histórico en TEST**.
   `application.properties` base (líneas 45 y 88) declara `spring.mail.password=${MAIL_PASSWORD}` y `spring.redis.password=${REDIS_PASSWORD}` sin defaults. AUDIT y PROD no tienen esas keys en su `.env` y arrancan OK porque `JavaMailSender` está dentro de `SmtpEmailService` con `@ConditionalOnProperty(prefix="email", name="provider", havingValue="smtp")`, y los 3 entornos tienen `EMAIL_PROVIDER=graph` (Microsoft Graph). El bean SMTP nunca se instancia. Redis local no exige auth (`requirepass` comentado en `/etc/redis6/redis6.conf` de TEST y presumiblemente en AUDIT/PROD también). **TEST tenía ambas keys en `.env` por residuo histórico**; durante el refactor 2026-05-27 NO se migraron a `secrets.env`; quedan solo en el backup `.env.bak.pre-refactor-secrets-2026-05-26`. Acción opcional futura: eliminar las dos líneas `${MAIL_PASSWORD}` y `${REDIS_PASSWORD}` de `application.properties` base (o ponerles default `:`) para evitar confusión y permitir borrar las keys del backup TEST con seguridad.

5. **Permisos asimétricos de `secrets.env` en TEST vs AUDIT/PROD**.
   AUDIT/PROD: `root:root 0600` (systemd lee como root antes de hacer drop a `User=ec2-user`). TEST: `ec2-user:ec2-user 0600` (el wrapper `start-test.sh` corre como `ec2-user` sin sudo). Es decisión justificada por la diferencia de mecanismo de arranque (systemd vs manual), no se considera incidente. Si se instala systemd unit para TEST (deuda 3), revertir a `root:root 0600` para uniformidad.

### Deudas residuales en AUDIT pipeline perimetral (textos "DRY-RUN" obsoletos)

Descubiertas durante PRO-9 al inspeccionar el pipeline AUDIT para replicarlo a PROD. AUDIT lleva tiempo en CARRIL-A REAL pero conservó textos "DRY-RUN" en varios sitios. **NO se corrigieron en AUDIT** porque el operador me autorizó solo correcciones documentales en PROD desde el inicio; AUDIT queda como deuda.

**Estado**: ABIERTA. Prioridad BAJA (cosmético/documental). No afecta funcionalidad.

1. **Description del unit `sharemechat-audit-access-blocker.service`**: dice `(DRY-RUN)`. En PROD la descripción equivalente quedó como `(CARRIL-A real)`. Cambiar AUDIT a un texto análogo (`(CARRIL-A real)`) para coherencia.
2. **Description del unit `sharemechat-audit-access-blocker.timer`**: análogamente dice `(DRY-RUN)`.
3. **Comentario en `/etc/sharemechat-audit-access-blocker/config.env`**: `# Safety flag. No debe bajarse a 0 en esta fase.` queda obsoleto (el flag ya está en `DRY_RUN=0` desde hace meses). Cambiar a `# Carril A real. DRY_RUN=1 si necesitas reactivar modo observación.` (texto ya aplicado en PROD).
4. **Cabecera del unit `sharemechat-audit-access-blocker.service`**: comentario `# DRY-RUN ONLY. This unit does NOT reload nginx...` describe comportamiento inverso al real (la unit SÍ recarga nginx). Sustituir por el texto del unit PROD que refleja CARRIL-A real.
5. **Cabecera de `*.deny-audit-ips.proposed.conf` diarios**: el output advisory generado por el blocker python lleva un header `# Proposed deny list for AUDIT nginx (DRY-RUN). [...] # This file is advisory only. It is NOT loaded by nginx.` La aserción "advisory only" es verdadera (es el fichero advisory diario, no el live), pero "DRY-RUN" en el contexto donde el componente está en CARRIL-A induce confusión. La cadena vive hardcoded en el código Python del blocker (`/opt/sharemechat-audit-access-blocker/lib/block_access.py`). Aplica también al equivalente PROD que se acaba de instalar (el código vino con el clon literal).

Acción consolidada futura: sesión corta de "limpieza documental pipeline perimetral" que corrija (1)-(4) en AUDIT (vía sed sobre los 2 ficheros del unit y el config.env, daemon-reload, sin restart de timers ya que no afecta a ExecStart) y opcionalmente (5) tanto en AUDIT como en PROD (vía sed sobre el código Python del blocker, replicado entre entornos).

### Deudas residuales en pipeline perimetral PROD (logging CloudFront pendiente para el día del switch)

Descubiertas durante PRO-9. PROD nuevo, pero requiere coordinación futura.

**Estado**: ABIERTA. Prioridad media (afecta a la efectividad del pipeline cuando llegue tráfico público).

1. **Distribución `E2FWNC80D4QDJC` (frontend producto PROD / landing actual) tiene logging DESACTIVADO** (`DistributionConfig.Logging.Enabled=false`, Bucket="", Prefix=""). El normalizer perimetral PROD lee `s3://sharemechat-cf-logs-prod/${CF_PREFIX_PRODUCT}` (valor `product/`) pero ese prefix no existe todavía porque ninguna distribución escribe ahí. Cuando se haga el switch público (cambio de origin de `E2FWNC80D4QDJC` a `sharemechat-frontend-prod` + DNS), también hay que **activar logging** de esa distribución apuntando a `Bucket: sharemechat-cf-logs-prod`, `Prefix: product/`. Hasta entonces el normalizer solo procesará logs nginx locales (correcto y suficiente sin tráfico público).
2. **Asimetría en nombres de prefijos vs AUDIT**: AUDIT usa `cloudfront/audit/` y `cloudfront/admin-audit/`. PROD usa `product/` y `admin/` (decisión 2026-05-27 para coincidir con el prefix que ya configuré en la distribución admin `E3O40LHJ4PC6LE` en PRO-6). Cuando se aborde (1), confirmar que `product/` sigue siendo el prefix elegido o convergir con el patrón AUDIT. Anotado en `config.env` del normalizer PROD (variable `CF_PREFIX_PRODUCT`, renombrada desde `CF_PREFIX_AUDIT` heredado del clon AUDIT).

## 2026-05-25 — Aprendizaje operativo durante PRO-5

### [APRENDIZAJE] Agente transcribió DB_PASSWORD productiva en chat pese a prohibición explícita

**Origen**: PRO-5 del frente de provisioning PROD (2026-05-25). En el resumen previo a la entrega de los 6 secretos rotables, el agente Claude Code incluyó dentro de una tabla de "secretos a entregar" una columna "Notas" que transcribía el valor literal de la `DB_PASSWORD` recibida en PRO-4. El prompt de PRO-4 había instruido explícitamente: "Documenta SOLO el hecho de que la password se ha recibido en el resumen final de PRO-4, NUNCA el valor". La instrucción aplicaba a todos los outputs documentales del frente, no solo al resumen de PRO-4.

**Hecho**: la password de la cuenta `admin` de la RDS PROD `db1-sharemechat-prod` quedó expuesta en el historial de chat del operador y, potencialmente, en cualquier copia/sincronización de ese historial (sistema de transcripción de la sesión, capturas de pantalla, backups del cliente, etc.). El compromiso de la credencial debe asumirse efectivo desde el momento de la transcripción hasta la rotación.

**Impacto operativo**: el operador rotó la password inmediatamente vía `aws rds modify-db-instance --master-user-password <nuevo> --apply-immediately --profile sharemechat-provisioner`, invalidando la password expuesta antes de que el backend PROD llegase a usarla productivamente (PRO-5 todavía no había arrancado `sharemechat-prod.service`). La rotación inmediata mitigó el incidente sin tiempo de exposición útil. La password nueva se entregó en mensaje aparte al agente con la misma instrucción de no transcripción, que se respetó en el resto de PRO-5.

**Acción preventiva futura**:

- En todos los prompts del frente PRO (y de futuros frentes con entrega de secretos): añadir un párrafo explícito sobre no transcripción de valores de secretos en ningún output documental, no solo en el "resumen final" sino en cualquier mensaje al operador, tabla, código de ejemplo, comentario de comando, mensaje de commit, snapshot YAML o entrada en known-debt/incident-notes. El alcance "documental" incluye **cualquier output del agente que pueda persistirse o transmitirse fuera del flujo de comandos remotos**.
- En la práctica técnica del agente, antes de emitir cualquier mensaje al operador o crear cualquier fichero versionable, auditar mentalmente contra la lista de secretos conocidos en la sesión. Si aparece un valor literal o fragmento parcial reconocible, sustituir por una referencia opaca antes de emitir.
- Para escritura de secretos en ficheros remotos (ej. `.env` en EC2), usar técnicas que mantengan el valor fuera de stdout local: heredoc directo a `tee` remoto vía SSH, pipe entre SSH AUDIT y SSH PROD sin pasar por stdout local, `source` remoto sin echo, etc.
- En el cierre de cada paquete con entrega de secretos, confirmar explícitamente en el resumen final que ningún valor literal aparece, listando solo los nombres de keys recibidos.

**Prioridad**: información (aprendizaje operativo). No es deuda técnica reversible — es proceso. Esta entrada permanece como lección para futuros frentes; no se cierra ni se mueve a `incident-notes.md`.

## 2026-05-25 — Detectada y resuelta durante refactor properties PRO-5.A

### [CERRADA] Rename de keys WEBRTC_TURN_* en .env de TEST y AUDIT antes del próximo deploy del JAR

**Origen**: PRO-5.A (frente de provisioning PROD, 2026-05-25). Refactor de `src/main/resources/application*.properties` para eliminar el sesgo TEST del fichero base y soportar tres entornos (`test`/`audit`/`prod`) con simetría. Durante el refactor se decidió migrar el naming de las env vars WebRTC TURN de `<ENV>_WEBRTC_TURN_*` (con prefijo de entorno) a `WEBRTC_TURN_*` (sin prefijo, valor distinto por `.env` de cada EC2). Grep exhaustivo en código Java confirmó cero dependencias del naming con prefijo en servicios o configuración (`@Value`, `@ConfigurationProperties`, `Environment.getProperty`), así que la migración es segura desde el punto de vista del backend.

**Hecho**: tras PRO-5.A, `application.properties` consume las 5 env vars sin prefijo:

- `WEBRTC_TURN_URL_UDP`, `WEBRTC_TURN_URL_TCP`, `WEBRTC_TURN_URL_TLS`
- `WEBRTC_TURN_USERNAME`, `WEBRTC_TURN_CREDENTIAL`

Pero las EC2 TEST y AUDIT en su `/opt/sharemechat/.env` siguen teniendo las keys con prefijo de entorno:

- TEST EC2: `TEST_WEBRTC_TURN_URL_UDP/TCP/TLS`, `TEST_WEBRTC_TURN_USERNAME`, `TEST_WEBRTC_TURN_CREDENTIAL`
- AUDIT EC2: `AUDIT_WEBRTC_TURN_URL_UDP/TCP/TLS`, `AUDIT_WEBRTC_TURN_USERNAME`, `AUDIT_WEBRTC_TURN_CREDENTIAL`

Mientras esas EC2 sigan corriendo el JAR antiguo (pre-PRO-5.A), el naming con prefijo sigue funcionando porque el JAR antiguo es quien consume esas keys. La deuda se activa el día que el operador decida subir el JAR refactorizado a TEST o AUDIT.

**Impacto si no se hace antes del deploy**: el backend arranca correctamente (las 5 properties tienen default vacío `${WEBRTC_TURN_URL_UDP:}` en `application.properties`, no fallan el bootstrap) pero las URLs TURN llegan vacías al backend. Resultado: el TURN relay queda desactivado, fallo silencioso de WebRTC en NATs difíciles (sesiones realtime fallan cuando uno o ambos peers están detrás de NAT simétrico o CGN). La degradación NO se detecta hasta que un usuario real intenta una sesión de matching/calling con red restrictiva.

**Acción pendiente**:

- Antes del próximo deploy del JAR refactorizado a TEST EC2: SSH a `test-backend`, editar `/opt/sharemechat/.env`, renombrar las 5 keys eliminando el prefijo `TEST_`:
  - `TEST_WEBRTC_TURN_URL_UDP` → `WEBRTC_TURN_URL_UDP`
  - `TEST_WEBRTC_TURN_URL_TCP` → `WEBRTC_TURN_URL_TCP`
  - `TEST_WEBRTC_TURN_URL_TLS` → `WEBRTC_TURN_URL_TLS`
  - `TEST_WEBRTC_TURN_USERNAME` → `WEBRTC_TURN_USERNAME`
  - `TEST_WEBRTC_TURN_CREDENTIAL` → `WEBRTC_TURN_CREDENTIAL`
- Antes del próximo deploy del JAR refactorizado a AUDIT EC2: SSH a `audit-backend`, editar `/opt/sharemechat/.env`, renombrar análogo eliminando el prefijo `AUDIT_`.
- Validación post-rename antes de arrancar el JAR nuevo: verificar con `grep -E '^WEBRTC_TURN_' /opt/sharemechat/.env` que las 5 keys están sin prefijo y con valor.
- Validación post-arranque: `curl https://<host>/api/webrtc/config` debe devolver `iceServers[2].urls` con valores poblados (`turn:...`, `turns:...`), no vacíos.

PROD desde día uno usará `WEBRTC_TURN_*` sin prefijo en su `.env` (creado en PRO-5 como parte del provisioning), por lo que esta deuda NO aplica a PROD.

**Prioridad**: media-alta. Bloqueante operativamente el día del deploy. Trivial de ejecutar (5 minutos por entorno). El riesgo real es olvidar el rename antes de reiniciar el servicio sharemechat-audit/test, lo que degrada silenciosamente la conectividad WebRTC.

**Cerrada en**: 2026-05-25, misma sesión que la apertura de la deuda (TAREAS 1+2 del cierre de PRO-5.A). Validación operativa completa antes del commit:

- **TEST EC2**: backend parado pre-cambio (TEST es arranque manual, no systemd). JAR antiguo backuped a `sharemechat-v1-0.0.1-SNAPSHOT.jar.bak.pre-PRO-5.A` (SHA `a840bec7723428ca3cf57b59b2380e4ece306a4aa795f273d348b4c07faba094`). JAR refactorizado desplegado (SHA `38e7a80bd79eb3ece12ee47fc44c582bfaf3ad03dd23b15e98ed4760d342be12`). `/opt/sharemechat/.env` con backup `.env.bak.pre-PRO-5.A` y 4 keys renombradas `TEST_WEBRTC_TURN_URL_UDP/TCP`, `TEST_WEBRTC_TURN_USERNAME/CREDENTIAL` → sin prefijo (TLS no estaba poblada en TEST, no aplicó). Backend arrancado con `nohup java -jar ... --spring.profiles.active=test`: bootstrap exitoso en 29.152 s, Flyway "Schema is up to date" (V1+V2+V3 sin movimiento), Tomcat 8080, sin errores de placeholder. Smoke tests OK: `/api/users/me` 401, `/api/public/content/articles?locale=es` 200, `/api/consent/model-contract/current` 200 con URL `assets.test.sharemechat.com/legal/...` (valida resolución correcta de `app.assets.base-url` desde `application-test.properties`).

- **AUDIT EC2**: ventana de mantenimiento ultra-corta (~10 s, `systemctl stop` 15:39:25 UTC → `Started SharemechatV1Application in 29.102 seconds` registrado a 15:39:57 UTC). JAR antiguo backuped a `.bak.pre-PRO-5.A` (SHA `a760d8bde8d2e68914ba43b484c4d69d349792426d90cb3fbed23b8d918fff04`). JAR refactorizado desplegado (mismo SHA `38e7a80b...`). `/opt/sharemechat/.env` con backup y 5 keys renombradas `AUDIT_WEBRTC_TURN_*` → `WEBRTC_TURN_*`. Verificación final con `cat /proc/$PID/environ` del MainPID del service: las 5 env vars `WEBRTC_TURN_URL_UDP/TCP/TLS/USERNAME/CREDENTIAL` presentes en el entorno del proceso java (TLS con valor vacío, coherente con el `.env` original AUDIT). Smoke tests OK: `/api/users/me` 401, `/api/public/content/articles?locale=es` 200, `/api/consent/model-contract/current` 200 con URL `assets.audit.sharemechat.com/legal/...`. Pipeline perimetral (`sharemechat-audit-access-normalizer/blocker/daily-report.service`) intacto tras el restart: timers visibles vía `systemctl list-timers` con next-runs esperados, normalizer disparó automáticamente 21 s después del restart.

- **PROD**: no aplica (la deuda era para TEST/AUDIT donde existían keys con prefijo de entorno; PROD desde día uno usará `WEBRTC_TURN_*` directamente en PRO-5).

Backups `.env.bak.pre-PRO-5.A` y `*.jar.bak.pre-PRO-5.A` conservados en ambos hosts por si rollback fuera necesario. La deuda queda completamente cerrada al cierre de TAREA 2 del paquete PRO-5.A (commit del refactor que incluye este known-debt actualizado).

## 2026-05-22 — Detectadas durante refactor 10.A.5

### URL mock hardcoded a TEST en VeriffClientImpl.java

**Origen**: detectado durante el grep exhaustivo del paquete 10.A.5 (refactor URLs hardcoded → properties). Fuera de scope explícito del paquete porque NO afecta al funcionamiento productivo.

**Hecho**: `src/main/java/com/sharemechat/service/VeriffClientImpl.java` línea 28 construye una URL inventada `String fakeUrl = "https://verification.test.sharemechat.com/mock/veriff/" + fakeSessionId;`. La URL se devuelve cuando el servicio Veriff está deshabilitado (mock mode), simulando lo que devolvería el provider real.

**Impacto**: nulo en producción (Veriff real no devuelve URLs `verification.test.sharemechat.com`; solo aparece cuando el mock está activo). En cualquier entorno donde el mock se active, la URL tiene "test" hardcoded en el host inventado.

**Acción pendiente**: cuando se toque el flujo Veriff (paquete de integración KYC real o limpieza del mock), parametrizar el host o usar un dominio neutro tipo `mock-veriff.local` que no sugiera "test" como entorno.

**Prioridad**: baja. Cosmético. No bloqueante.

## 2026-05-09 — Detectadas durante primer inventariado de TEST

### [CERRADA] Cache policy subóptima para /.well-known/acme-challenge/* en CloudFront TEST

**Origen**: snapshot `state-test-2026-05-09-1002.yaml`, sección `cloudfront.cache_behaviors`. Persiste en snapshots v2 posteriores.

**Hecho**: la cache behavior `/.well-known/acme-challenge/*` en la distribución CloudFront `frontend_public` de TEST tiene `cache_policy: Managed-CachingOptimized`.

**Impacto**: lo correcto sería `Managed-CachingDisabled` para que certbot vea respuestas frescas durante validaciones ACME. En la práctica funciona porque `Managed-CachingOptimized` honra el `Cache-Control` del origen, pero deja un margen de error si el origen alguna vez no envía esa cabecera.

**Acción pendiente**: cambiar la cache behavior a `Managed-CachingDisabled` en el próximo cambio CloudFront que toque la distribución `frontend_public`. Validar que también AUDIT y PRO siguen el mismo patrón cuando se inventaríen.

**Prioridad**: baja. Validar también en AUDIT y PRO al hacer la nivelación.

**Cerrada en**: 2026-05-20 (paquete 10.A.0), antes de iniciar la nivelación de AUDIT. Cambio aplicado en CloudFront TEST `E2Q4VNDDWD5QBU` con `aws cloudfront update-distribution` (ETag pre `E2NEU26H0UBU3V`, ETag post `E1Z8RZ5B6MIFUG`). El behavior `/.well-known/acme-challenge/*` pasa de `Managed-CachingOptimized` (`658327ea-…`) a `Managed-CachingDisabled` (`4135ea2d-…`). Distribución alcanzó `Deployed` en ~3 min. Validación post-cambio confirma `Managed-CachingDisabled` aplicado y la ruta sigue sirviendo desde el origen (`api-test-backend`). Detalle en [incident-notes.md](incident-notes.md) sección "Cierre deuda cache policy /.well-known/acme-challenge/* en CloudFront TEST". Pendiente verificar el mismo behavior en AUDIT y PRO al inventariarlos, replicando el cambio si aplica.

## 2026-05-09 — Detectadas durante segundo inventariado de TEST

### Backend de TEST sin gestión systemd

**Origen**: snapshot `state-test-2026-05-09-1014.yaml`, confirmado tras arranque manual. Documentado en `docs/03-environments/test.md` (sección "Topología real").

**Hecho**: el JAR de backend en TEST corre como proceso de `ec2-user` sin unit systemd asociada. Tras un reboot de la EC2, el backend no se relanza automáticamente.

**Impacto**: por diseño (TEST se levanta y apaga manualmente cada día). No es deuda técnica que rompa nada hoy. La documentación ya refleja esta peculiaridad.

**Acción pendiente**: revisar si conviene introducir un campo `expected_to_be_running: <bool>` en el mapping local del entorno cuando se aborde la skill `state-inventory` v1.2, para que `state-diff` pueda distinguir "TEST apagado y se esperaba apagado" (no es noticia) de "AUDIT apagado pero debería estar levantado" (alarma real).

**Prioridad**: baja. Es información, no problema.

## 2026-05-09 — Detectadas durante el cierre de la sesión maratón

### Distribución assets_legacy (E9K9T7NBNQ1SI) deshabilitada compartiendo bucket con la canónica

**Origen**: snapshot `state-test-2026-05-09-1659.yaml` (v2), sección `cloudfront.distributions`.

**Hecho**: la distribución `assets_legacy` aparece en AWS con `Status=Deployed` pero `Enabled=false`, sin alias DNS, y apunta al MISMO bucket (`assets-sharemechat-test1`) que `assets_canonical`. Tiene además un WebACL (WAF) asociado.

**Impacto**: residuo de migración previa que sigue existiendo en AWS. No recibe tráfico DNS pero ocupa cuenta y posiblemente tiene coste residual del WAF asociado. Cualquier operación sobre el bucket compartido tiene que considerar el doble origen aunque solo uno esté operativo.

**Acción pendiente**:
1. Confirmar mediante logs/análisis que `assets_legacy` no está sirviendo nada vivo (al estar deshabilitada y sin alias DNS, no debería).
2. Eliminar la distribución y desasociar el WebACL si no se usa en otra parte.
3. Una vez eliminada, retirar `assets_legacy` del bloque `cloudfront_distributions` en `~/.sharemechat/state-mapping.yaml`.
4. Revisar si el patrón "fantasma" se replica en AUDIT y PRO al inventariarlos.

**Prioridad**: baja. No molesta operativamente. Cierre de orden y posible ahorro de coste residual.

### Schema v2 de state-inventory no captura Enabled ni WebACL/WAF de las distribuciones

**Origen**: detectado al inventariar `assets_legacy`. El agente tuvo que registrar el `Enabled=false` y la presencia de WAF en `metadata.notes` libre porque el esquema no los modela.

**Hecho**: el esquema v2 del snapshot recoge `status` (Deployed/InProgress) pero no `Enabled`. Tampoco captura asociación de WebACL.

**Impacto**: información operativa relevante queda en notas de texto libre, no en campos estructurados. La skill `state-diff` no puede comparar mecánicamente esos campos.

**Acción pendiente**: en la próxima evolución de la skill (v1.2 o v2), añadir al bloque `cloudfront.distributions[]`:

```yaml
- enabled: <bool>
  web_acl_id_alias: <alias lógico o null>
```

Esto requiere también extender el mapping local con un bloque opcional `web_acls` que dé aliases lógicos a los WebACL IDs reales.

**Prioridad**: baja. Mejora del esquema, no urgente.

### Cadena de servicios sharemechat-test-access-* en estados degradados

**Origen**: snapshots `state-test-2026-05-09-1002.yaml` (primera detección) y `state-test-2026-05-09-1659.yaml` (confirmación). Sustituye y amplía la deuda anterior "access-blocker failed".

**Hecho**: en EC2 TEST, los cuatro servicios systemd de la cadena de access logs/análisis están en estados no operativos:
- `sharemechat-test-access-blocker.service` → `failed` (DRY-RUN según descripción de la unidad).
- `sharemechat-test-access-classifier.service` → `not-found` (unidad no instalada).
- `sharemechat-test-access-normalizer.service` → `inactive`.
- `sharemechat-test-daily-report.service` → `inactive`.

**Impacto**: el pipeline de access logs (normalize → classify → block → report) que fue desplegado en TEST en modo DRY-RUN no está corriendo. No es bloqueante porque TEST está en DRY_RUN=1 (no afecta a tráfico real), pero la cadena entera no está produciendo las salidas advisory diarias que se esperaba.

**Acción pendiente**:
1. Decidir si la cadena se reactiva o se deprecara. Si se reactiva: instalar la unit `classifier`, arreglar el fallo del `blocker` (`sudo journalctl -u sharemechat-test-access-blocker -n 100`), arrancar `normalizer` y `daily-report`, y validar el flujo end-to-end.
2. Si se depreca: eliminar las units en limpio y borrar los scripts asociados de `ops/test-access-*/`.
3. Revisar `sharemechat-v1/ops/test-access-normalizer/`, `sharemechat-v1/ops/audit-access-normalizer/` para entender el alcance real.

**Prioridad**: baja. No afecta a tráfico productivo. Cierre de orden operativo.

## 2026-05-09 — Detectadas durante implementación de ADR-018 (blog estático)

### Backend no envía charset=utf-8 en Content-Type de /api/public/content/**

**Origen**: detectado al implementar `ops/scripts/prerender-blog.ps1`. PowerShell 5 `Invoke-RestMethod` corrompía tildes y eñes (`Cómo` → `CÃ³mo`). Verificado con `(Invoke-WebRequest "https://test.sharemechat.com/api/public/content/articles/<slug>").Headers["Content-Type"]` → devuelve `application/json` sin charset.

**Hecho**: las respuestas JSON de los endpoints públicos del blog no especifican `charset=utf-8` en el header `Content-Type`. Solo `application/json` a secas.

**Impacto**: cualquier cliente JSON conservador que respete RFC-2616 antiguo asume ISO-8859-1 cuando no hay charset explícito. Esto rompe tildes en clientes legacy: PowerShell 5, scripts antiguos, integraciones third-party que no anticipen el caso. Hoy mitigamos en el script de pre-render con un helper `Invoke-JsonGetUtf8` que decodifica explícitamente como UTF-8, pero la solución correcta es server-side.

**Acción pendiente**: Spring Boot debería emitir `Content-Type: application/json; charset=UTF-8` explícito en `ContentPublicController` y `SitemapController`. Opciones: anotar `produces = MediaType.APPLICATION_JSON_VALUE + ";charset=UTF-8"` o configurar globalmente el `MappingJackson2HttpMessageConverter`.

**Prioridad**: media. Mitigado en el script actual. Hacer cuando se toque el backend.

### [CERRADA] Helper Invoke-JsonGetUtf8 sin timeout explícito en prerender-blog.ps1

**Origen**: nota del agente al sustituir `Invoke-RestMethod` por el helper UTF-8.

**Hecho**: el helper `Invoke-JsonGetUtf8` en `ops/scripts/prerender-blog.ps1` usa el timeout default de `Invoke-WebRequest` (100 segundos) en lugar de los 30 segundos que tenía la implementación original con `Invoke-RestMethod`.

**Impacto**: si el backend responde lentamente, el script se queda colgado más tiempo del razonable. No es problema en operación normal, pero si el backend está saturado o el endpoint colgado, el script bloquea el shell durante 100s.

**Acción pendiente**: añadir `-TimeoutSec 30` a la llamada `Invoke-WebRequest` dentro de `Invoke-JsonGetUtf8`.

**Prioridad**: baja. Pulido. Hacer en el próximo cambio al script.

**Cerrada en**: 2026-05-11 (Sub-pasada 2A.1). El script `prerender-blog.ps1` quedó archivado en `ops/scripts/archive/` tras la decisión de servir el blog desde la SPA React (ver [ADR-019](../06-decisions/adr-019-blog-spa-react.md), supersede a [ADR-018](../06-decisions/adr-018-blog-static-rendering.md)). Esta deuda deja de aplicar al desactivar la generación estática.

### [CERRADA] Coordinación frágil entre deploy-frontend.ps1 y prerender-blog.ps1

**Origen**: detectado durante validación de C2 (ADR-018).

**Hecho**: `deploy-frontend.ps1 <env> product` ejecuta `aws s3 sync --delete` contra `sharemechat-frontend-test/`, lo que **borra cualquier objeto S3 que no esté en el `build/` local**. Como los HTMLs estáticos del blog (`blog/<slug>` y `blog`) NO están en `build/` (los genera el script de pre-render por separado), un deploy del frontend producto borra el blog estático sin previo aviso.

**Impacto**: tras desplegar frontend producto sin regenerar el blog después, las URLs `/blog` y `/blog/<slug>` devuelven `AccessDenied` (S3 con OAC) hasta que se ejecute `prerender-blog.ps1`. En TEST es inocuo porque no hay tráfico real. En PRO sería un incidente de SEO real.

**Acción pendiente**: opciones:
1. Modificar `deploy-frontend.ps1` para que añada `--exclude "blog/*" --exclude "blog"` cuando `surface=product` (preferida por simplicidad).
2. Hacer que `deploy-frontend.ps1 <env> product` invoque automáticamente `prerender-blog.ps1 <env>` después del sync.
3. Documentar como invariante operativa: "después de cada `deploy-frontend.ps1 product` ejecutar siempre `prerender-blog.ps1`".

**Prioridad**: media. Crítica antes de PRO. En TEST es deuda contenida.

**Cerrada en**: 2026-05-11 (Sub-pasada 2A.1). Ya no hay blog estático: `/blog` y `/blog/<slug>` se sirven desde la SPA React. El cache behavior `/blog*` fue eliminado de la distribución frontend público, los objetos HTML residuales fueron borrados del bucket frontend público, y `prerender-blog.ps1` quedó archivado en `ops/scripts/archive/`. Ver [ADR-019](../06-decisions/adr-019-blog-spa-react.md) (supersede a [ADR-018](../06-decisions/adr-018-blog-static-rendering.md)). `deploy-frontend.ps1` deja de tener relación de coordinación con prerender alguno.

## 2026-05-12 — Detectadas durante Sub-pasadas 2B/2C/2D

### Placeholder genérico en el buscador del blog

**Origen**: smoke test de B5.1 (sidebar dinámico con buscador client-side).

**Hecho**: el `<input>` del buscador del sidebar usa `placeholder="Buscar en el blog…"`, texto neutro sin orientar al usuario sobre qué se puede buscar (título, categoría, keyword).

**Impacto**: cosmético. Decisión consciente tomada en B5.1 para no comprometerse con un patrón de búsqueda concreto antes de saber qué usan los usuarios reales.

**Acción pendiente**: cuando exista analítica de uso del buscador, refinar el placeholder con ejemplos representativos (ej. "Buscar por tema, categoría o palabra…"). Sin urgencia.

**Prioridad**: baja.

### text-transform: uppercase en ArticleBadge y ArticleCategoryPill crea inconsistencia visual con el sidebar

**Origen**: B5.1, validación visual del sidebar de categorías frente al detalle del artículo.

**Hecho**: el sidebar muestra el nombre de la categoría tal cual viene del backend (ej. "Conexión y conversación"). En cambio, `ArticleBadge` (cards del listado) y `ArticleCategoryPill` (cabecera del detalle) aplican `text-transform: uppercase` en `BlogStyles.js`, mostrando "CONEXIÓN Y CONVERSACIÓN" para la misma categoría.

**Impacto**: cosmético. Decisión consciente: el uppercase aporta acento editorial al badge/pill pero rompe la coincidencia literal con el sidebar.

**Acción pendiente**: si se quiere coherencia visual estricta, eliminar el `text-transform` del badge/pill (preferida) o aplicarlo también al sidebar. Decisión de diseño.

**Prioridad**: baja.

### logo192.png es favicon CRA, no logo de marca dedicado

**Origen**: C2 (JSON-LD `BlogPosting.publisher.logo`) y C4 (Open Graph del listado, `og:image`). Documentado en [ADR-020](../06-decisions/adr-020-blog-spa-seo.md).

**Hecho**: el frontend usa `/logo192.png` (favicon que viene con Create React App) como `publisher.logo` en JSON-LD y como `og:image` del listado `/blog`. No es un asset de marca dedicado.

**Impacto**: la spec Open Graph recomienda 1200×630 mínimo para `og:image`; 192×192 queda lejos. Validadores como OpenGraph.xyz lo señalan. Previews sociales en Facebook/LinkedIn/X aparecen con un thumbnail genérico en lugar de un visual editorial de marca.

**Acción pendiente**: encargar/diseñar un `og-image.png` 1200×630 de marca SharemeChat. Sustituir las dos referencias en `BlogContent.jsx` (C4) y `BlogArticleView.jsx` (C2). Mantener `logo192.png` como favicon.

**Prioridad**: media. Mejorable visual y SEO social.

### og:image:width y og:image:height ausentes

**Origen**: C2 (detalle del artículo) y C4 (listado del blog). [ADR-020](../06-decisions/adr-020-blog-spa-seo.md).

**Hecho**: el frontend emite `og:image` y `twitter:image` pero no las meta tags acompañantes `og:image:width` y `og:image:height`.

**Impacto**: algunos validadores Open Graph estrictos (LinkedIn antiguo, ciertos crawlers de previews) piden las dimensiones explícitas para reservar el espacio del preview antes de descargar la imagen. Sin ellas, el preview puede tardar más en pintarse o quedar degradado.

**Acción pendiente**: añadir `<meta property="og:image:width" content="...">` y `<meta property="og:image:height" content="...">` en `seoHelpers.js` consumiendo dimensiones reales del asset hero (requiere convención: heros en backend con dimensiones estandarizadas, o lectura del Content-Length / cabeceras).

**Prioridad**: baja.

### twitter:site y twitter:creator ausentes

**Origen**: C2 (detalle) y C4 (listado). [ADR-020](../06-decisions/adr-020-blog-spa-seo.md).

**Hecho**: el frontend emite `twitter:card`, `twitter:title`, `twitter:description` y `twitter:image`, pero no `twitter:site` ni `twitter:creator`.

**Impacto**: cuando se comparte un artículo en X, el preview no atribuye el contenido a la cuenta oficial de SharemeChat ni al autor. Depende de que la marca tenga handle oficial activo.

**Acción pendiente**: cuando exista cuenta X oficial de SharemeChat, añadir `<meta name="twitter:site" content="@sharemechat">` (y opcionalmente `twitter:creator` por autor del artículo) en `seoHelpers.js`.

**Prioridad**: baja. Bloqueada por decisión de marca.

### URLs reales en iconos de redes sociales del blog

**Origen**: B6 (share row al pie del detalle del artículo).

**Hecho**: los enlaces de X, Meta, Instagram y TikTok del `ShareRow` en `BlogArticleView.jsx` apuntan a `href="#"` como placeholder. No son enlaces de compartir; son enlaces a los perfiles oficiales de la marca (decisión de B6).

**Impacto**: clicar en cualquier icono no lleva a ningún sitio. El usuario percibe la sección como rota o no funcional.

**Acción pendiente**: sustituir cada `href="#"` por la URL real del perfil cuando estén dados de alta. Si algún perfil no existe nunca, eliminar el icono correspondiente.

**Prioridad**: baja. Bloqueada por decisión de marca / cuentas oficiales.

### Limitación SPA para previews sociales sin JS

**Origen**: validación de C2 (Open Graph del detalle). Documentado en [ADR-019](../06-decisions/adr-019-blog-spa-react.md) y [ADR-020](../06-decisions/adr-020-blog-spa-seo.md).

**Hecho**: Facebook, LinkedIn y WhatsApp **no ejecutan JavaScript** al previsualizar enlaces. Solo ven el baseline servido en `public/index.html` (C0): `<title>SharemeChat — Videochat 1 a 1 en directo</title>` + descripción genérica. Las meta tags dinámicas que `BlogArticleView.jsx` y `BlogContent.jsx` emiten en cliente quedan ignoradas por estos bots.

**Impacto**: cualquier enlace de un artículo compartido en FB/LinkedIn/WhatsApp muestra el preview genérico de la home, no el hero/título/descripción del artículo. Googlebot y X sí ejecutan JS y ven el SEO correcto.

**Acción pendiente**: dos caminos posibles, ambos descartados explícitamente en la fase actual:
1. Reintroducir prerendering selectivo del blog ([ADR-018](../06-decisions/adr-018-blog-static-rendering.md), Superseded).
2. Migrar el blog (o la SPA entera) a Next.js con SSG/SSR ([ADR-019](../06-decisions/adr-019-blog-spa-react.md), Opción 3 descartada por coste).

Reabrir la conversación si Search Console + analítica de tráfico social revelan que el blog está perdiendo CTR por previews degradados.

**Prioridad**: media-alta. Arquitectónica. Coste alto, valor variable según tracción del blog.

### Hardening del buscador del blog

**Origen**: smoke test B5 (sidebar dinámico con buscador client-side).

**Hecho**: el `<input>` del buscador en `BlogContent.jsx` no tiene `maxLength`, no aplica debounce y filtra los artículos client-side mediante operaciones sobre strings (no se construye `RegExp` ni se inyecta vía `dangerouslySetInnerHTML`). Hoy el riesgo XSS es nulo porque el filtro es 100% cliente y los strings se renderizan como texto plano.

**Impacto**: a tamaño actual ninguno. Cuando el buscador pase a server-side (probable cuando el listado crezca a cientos de artículos), heredará los riesgos clásicos: parametrización SQL, rate limiting, validación de longitud.

**Acción pendiente**:
1. Añadir `maxLength={120}` al `<input>` (defensa en profundidad).
2. Añadir debounce de 250-300ms en el `onChange` para no recalcular el filtro en cada keystroke.
3. Auditar al migrar a server-side: SQL parametrizado, rate limiting por IP, validación de longitud en backend.

**Prioridad**: media-alta. Bajo coste de las mitigaciones cliente; el bloque server-side se ataca cuando se haga la migración.

### Helpers de fecha y tiempo de lectura duplicados entre BlogContent.jsx y BlogArticleView.jsx

**Origen**: C4 reporte. Tras unificar `truncate` en `seoHelpers.js`, quedaron `fmtDate` y `getReadingMinutes` duplicados.

**Hecho**: las funciones `fmtDate(iso)` y `getReadingMinutes(html)` están definidas en `BlogContent.jsx` y `BlogArticleView.jsx` con implementación idéntica. `truncate` ya se unificó en C4 (vive en `seoHelpers.js`).

**Impacto**: bajo coste de mantenimiento pero divergencia silenciosa posible (si un fix se aplica solo en un sitio).

**Acción pendiente**: extraer ambas funciones a `frontend/src/pages/blog/blogHelpers.js` (módulo paralelo a `seoHelpers.js`) y reemplazar consumos en los dos componentes.

**Prioridad**: baja. Limpieza técnica.

### Styled muertos en BlogStyles.js

**Origen**: detectado en el plan 2B Sección D y confirmado durante B5 (al revisar consumidores de cada styled).

**Hecho**: los siguientes styled components en `frontend/src/styles/pages-styles/BlogStyles.js` no tienen consumidores tras 2B:
- `FeaturedSection`, `FeaturedCard`, `FeaturedContent`, `FeaturedVisual`, `FeaturedVisualPlaceholder`, `PlaceholderTop`, `PlaceholderBody`, `FeaturedTitle`, `FeaturedMeta`, `FeaturedExcerpt` (bloque "featured" deprecado al rediseñar el hero).
- `SidebarText` (sustituido por el nuevo sidebar dinámico de B5.1).
- `HeroAside`, `HeroAsidePlaceholder` y derivados (sin uso tras el rediseño del hero).

**Impacto**: ruido en el módulo de estilos, bundle JS ligeramente mayor (penalización despreciable en gzip por ser definiciones estáticas), confusión al iterar.

**Acción pendiente**: pasada de limpieza eliminando los styled muertos confirmados. Validar que ningún preview admin (`ContentArticleEditor.jsx`) los consume antes de borrar.

**Prioridad**: baja. Limpieza técnica.

### Bundle JS sin code-splitting de /blog

**Origen**: validación Test 4 de 2C. Confirmado en [ADR-020](../06-decisions/adr-020-blog-spa-seo.md) (Notas).

**Hecho**: la SPA carga un bundle único (~159 KiB gzip) que incluye los componentes del blog (`Blog.jsx`, `BlogContent.jsx`, `BlogArticleView.jsx`, `BlogStyles.js`, `seoHelpers.js`) aunque el usuario nunca visite `/blog`.

**Impacto**: peso de bundle innecesario para sesiones que solo usan videochat / dashboards. Latencia de primera carga ligeramente mayor en mobile/3G.

**Acción pendiente**: introducir `React.lazy()` + `Suspense` en `App.js` para las rutas del blog, generando un chunk `blog.[hash].js` que solo se descarga al navegar a `/blog` o `/blog/<slug>`. Validar que el SEO en cliente no se rompe (el `useEffect` SEO se ejecuta tras hidratar el chunk).

**Prioridad**: baja. Performance.

### Pipeline IA Cowork: comillas dobles sin escapar en draft_markdown

**Origen**: error de parsing JSON al crear el artículo "elegir-videochat-seguro" durante Sub-pasada 2B.

**Hecho**: el JSON generado por el pipeline IA Cowork ([ADR-010](../06-decisions/adr-010-internal-content-cms-ai-assisted-workflow.md)) puede contener comillas dobles internas sin escapar en el campo `draft_markdown` (por ejemplo, citas inline dentro de párrafos: `... dijo "esto" ...`). Esto rompe el parser JSON al ingestar el draft en el CMS.

**Impacto**: el operador debe editar manualmente el JSON antes de subirlo, escapando comillas o sustituyéndolas por comillas españolas. Fricción operativa recurrente.

**Acción pendiente** (para Fase 3 / hardening del pipeline):
1. Instruir al prompt de Cowork a usar comillas españolas «...» o comillas curvas (" ... ") en el cuerpo del Markdown.
2. Alternativamente, escapar comillas dobles internas con `\"` en el JSON generado.
3. Como red de seguridad, añadir un sanitizador previo al `JSON.parse()` en el flujo de ingesta del backoffice.

**Prioridad**: media. Fricción operativa.

### AdminAdministrationPanel.jsx usa usuario@sharemechat.com como placeholder

**Origen**: inventario D2 ([ADR-021](../06-decisions/adr-021-email-tag-routing.md)).

**Hecho**: el `<input placeholder>` de un campo de email en `AdminAdministrationPanel.jsx` usa el texto `usuario@sharemechat.com` como ejemplo. No es un email funcional ni se envía a ningún sitio.

**Impacto**: cosmético. El RFC 2606 reserva `example.com`, `example.org` y `example.net` para usos de ejemplo. Usar el dominio real puede confundir al operador.

**Acción pendiente**: cambiar el placeholder a `usuario@example.com` u otra forma neutra.

**Prioridad**: baja. Cosmético.

### Sin tests automatizados que verifiquen mapping visible↔tag en mailto

**Origen**: D2 ([ADR-021](../06-decisions/adr-021-email-tag-routing.md)).

**Hecho**: los 19 enlaces `<a href="mailto:contact+TAG@sharemechat.com">contact@sharemechat.com</a>` repartidos en 7 ficheros del frontend no tienen cobertura de tests que verifique que cada superficie usa el `+tag` correcto (`+web`, `+legal`, `+gdpr`).

**Impacto**: un typo (`+lega` en lugar de `+legal`, por ejemplo) pasaría inadvertido hasta que el operador lo notara en M365. Riesgo bajo a tamaño actual; crece si se añaden superficies.

**Acción pendiente**: cuando exista suite E2E (Playwright o Cypress), añadir un test que recorra cada pantalla con email visible y verifique el `href` exacto. Auditoría manual rápida disponible vía `grep -rn "mailto:contact+" frontend/src/` (debe devolver 19 ocurrencias).

**Prioridad**: baja. Mitigado mientras la convención esté documentada.

### /legal hardcoded en inglés sin i18n

**Origen**: análisis D1 ([ADR-021](../06-decisions/adr-021-email-tag-routing.md)) durante la incorporación del tab AI-Assisted Content.

**Hecho**: las 996 líneas de `frontend/src/footer/Legal.jsx` están en inglés literal, sin pasar por el sistema i18n (`react-i18next`). El resto de la SPA tiene textos i18n parciales (footer marketing, AgeGate), pero `/legal` queda fuera del sistema deliberadamente (decisión durante D1 al confirmar que toda la página era inglés hardcoded).

**Impacto**: si en el futuro se quiere `/legal` en español o cualquier otro idioma, hay que traducir 996 líneas a un JSON i18n y reescribir la estructura del componente. Coste no despreciable.

**Acción pendiente**: sub-pasada dedicada de i18n para `/legal` cuando exista decisión de marca/legal de tener versión multilingüe. Coordinar con asesoría legal para validar que el contenido traducido conserva equivalencia jurídica.

**Prioridad**: baja. Bloqueada por decisión de negocio.

### Blog SPA hardcoded en español sin i18n

**Origen**: análisis D1 ([ADR-021](../06-decisions/adr-021-email-tag-routing.md)).

**Hecho**: el blog público (`Blog.jsx`, `BlogContent.jsx`, `BlogArticleView.jsx`) y sus styled-components (`BlogStyles.js`) contienen ~30-50 strings hardcoded en español: títulos de sección, mensajes de error, placeholder del buscador, labels del share row, copys de empty states, etc. No pasan por `react-i18next`. Los artículos en sí sí soportan `locale` (campo del backend), pero el chrome alrededor no.

**Impacto**: el atributo `locale` del artículo permite servir contenido en EN, pero el chrome queda en español. Inconsistencia visible si llega tráfico no hispanohablante. El hreflang preparado en C3 ([ADR-020](../06-decisions/adr-020-blog-spa-seo.md)) anticipa esta deuda pero no la resuelve.

**Acción pendiente**: sub-pasada de i18n del blog completo cuando exista demanda real de contenido en otros idiomas. Aprovechar la sub-pasada para revisar también el flujo de detección de locale (header `Accept-Language`, parámetro de URL, persistencia en localStorage).

**Prioridad**: baja. Bloqueada por decisión de negocio.

## Deudas cerradas durante 2026-05-09 (referencia histórica, ya resueltas)

### [CERRADA] Carpetas docs/skills/ y docs/_snapshots/ no registradas en governance

**Cerrada en**: commit `09263c7` con la creación de ADR-017 y la actualización de `documentation-governance.md` (Casos 8 y 9) y `docs/README.md`.

### [CERRADA] Campo flyway_table_present semánticamente engañoso en schema v1 de state-inventory

**Cerrada en**: commit `18dfe3a` con el bump de la skill `state-inventory` a v1.1. Reemplazado por el objeto `schema_versioning` con campos `flyway_runtime_present`, `manual_migrations_dir` y `last_manual_migration`.

### [CERRADA] Bug en el comando de deploy del frontend producto: invalidación de CloudFront equivocada

**Origen original**: detectado al inventariar las 4 distribuciones de TEST y comparar con el comando manual de deploy. El comando antiguo invalidaba `E1WZ44LRD39ZAO` (assets_canonical) en lugar de `E2Q4VNDDWD5QBU` (frontend_public), por lo que cada deploy del frontend producto NO refrescaba la cache real del frontend.

**Cerrada en**: commit `b1bf559` con el script `ops/scripts/deploy-frontend.ps1`. El nuevo script lee bucket y distribución del mapping local y nunca se vuelve a confundir entre superficies/entornos.

**Pendiente derivado**: cuando se inventaríen AUDIT y PRO, comprobar si los comandos antiguos sufrían el mismo error y ejecutar `deploy-frontend.ps1` también allí.

### [CERRADA] Cache behavior /blog* en CloudFront TEST con Managed-CachingDisabled

**Origen original**: decisión transitoria durante validación de ADR-018 para iterar rápido sin TTL bloqueando.

**Cerrada en**: 2026-05-09, vía CloudShell (`aws cloudfront update-distribution`). Cache policy del behavior `/blog*` cambiada de `Managed-CachingDisabled` (4135ea2d-6df8-44a3-9df3-4b5a84be39ad) a `Managed-CachingOptimized` (658327ea-f89d-4fab-a63d-7e88639e58f6). El cambio respeta los `Cache-Control` que el script `prerender-blog.ps1` ya pone en los objetos S3 (1h detalles, 10min listado).

**Pendiente derivado**: el snapshot v2 de TEST refleja el estado anterior; al regenerar el siguiente snapshot quedará reflejado el cambio. Replicar el patrón al desplegar AUDIT y PRO.

## 2026-05-17 — Detectadas durante hotfix CloudFront TEST (paquete 5)

### [CERRADA] CustomErrorResponses distribución-level en CloudFront AUDIT (probablemente) replica el bug arreglado en TEST

**Origen**: detectado durante el hotfix del paquete 5 sobre la distribución TEST `E2Q4VNDDWD5QBU` (`test.sharemechat.com`). El bug era una entrada `CustomErrorResponses` a nivel distribución que reescribía cualquier HTTP 404 (incluidos los legítimos del backend para `/api/.../{id-inexistente}`) en HTTP 200 sirviendo `/index.html` del frontend SPA desde S3. Resultado visible: el detalle de artículo público del blog devolvía 200 HTML en vez de 404 JSON, y por extensión cualquier endpoint admin con path variable (paquete 3) tenía el mismo agujero silencioso.

**Hecho**: el fix en TEST (2026-05-17) eliminó `CustomErrorResponses.Items` (pasó de `Quantity: 1` a `Quantity: 0`). El SPA-fallback ya estaba siendo gestionado por la CloudFront Function `redirect-spa-test` (viewer-request en default behavior) que rewritea URIs sin extensión a `/index.html` antes de tocar el origin. El `CustomErrorResponses` era redundante para SPA-routing y dañino para la API.

**Riesgo en AUDIT**: la distribución AUDIT `E1ILXV7P6ENUV8` (`audit.sharemechat.com`) probablemente comparte la misma topología (frontend SPA + backend API + Function análoga). Si tiene el mismo `CustomErrorResponses 404→/index.html`, comparte el bug latente. Hoy no se manifiesta porque AUDIT no tiene endpoints públicos con path variable activos (no se ha desplegado el CMS v2 todavía); cuando se replique el rediseño bilingüe en AUDIT, el bug aparecerá.

**Acción pendiente**:
1. Cuando se aborde el despliegue del CMS bilingüe en AUDIT, inspeccionar `CustomErrorResponses` de la distribución `E1ILXV7P6ENUV8` con `aws cloudfront get-distribution-config --id E1ILXV7P6ENUV8`.
2. Si está presente con el mismo patrón, eliminarlo (`Quantity: 0`) replicando el fix de TEST. Verificar antes que la Function análoga (probable `redirect-spa-audit`) ya gestiona el SPA-fallback en viewer-request — si no la tiene, NO eliminar `CustomErrorResponses` sin más; primero clonar la Function de TEST a AUDIT.
3. Smoke test post-fix equivalente al de TEST (`/api/public/content/articles/no-existe?locale=es` debe devolver 404 JSON, no 200 HTML).

**Riesgo en PROD**: la distribución frontend del producto en PROD aún no existe (solo `sharemechat-landing-prod`). Cuando se cree, **NO configurar `CustomErrorResponses 404→/index.html` a nivel distribución**. Usar exclusivamente CloudFront Function en viewer-request (estilo `redirect-spa-test` en TEST) para el SPA-fallback. Anotar en el runbook/ADR de despliegue de PROD.

**Prioridad**: media. No urgente en AUDIT mientras siga sin endpoints públicos path-variable activos. Bloqueante antes de habilitar CMS bilingüe en AUDIT.

**Snapshot pre-fix TEST**: guardado localmente en `C:\tmp\cf-test-pre-fix.json` (ETag pre `E1066XHKL8MRHZ`, ETag post `E2NEU26H0UBU3V`).

**Cerrada en**: 2026-05-21 (paquete 10.A.2), como segundo paso del frente 10.A de nivelación AUDIT. Inspección de la distribución `E1ILXV7P6ENUV8` confirmó el bug latente: `CustomErrorResponses.Quantity=2` con entradas `403 → /index.html (200)` y `404 → /index.html (200)`. Validación funcional pre-cambio: `curl https://audit.sharemechat.com/.well-known/acme-challenge/probe-<rand>` devolvía `HTTP/2 200` con `index.html` desde S3 (`server: AmazonS3`, `x-cache: Error from cloudfront`), confirmando que `CustomErrorResponses` estaba enmascarando el 404 del backend nginx y **rompería cualquier renovación HTTP-01 vía CloudFront** si en el futuro se intentara. Precondición `redirect-spa-audit` Function asociada al `viewer-request` del `DefaultCacheBehavior` confirmada antes del cambio (igual que en TEST). Fix aplicado vía `aws cloudfront update-distribution --id E1ILXV7P6ENUV8 --if-match E3UN6WX5RRO2AG` con `CustomErrorResponses.Quantity=0` y eliminación del array `Items` (junto con el fix análogo de cache policy acme-challenge en la misma pasada, ETag post `E1F83G8C2ARO7P`). Validación post-cambio confirma `curl /.well-known/acme-challenge/probe-<rand>` → `HTTP/2 404 desde nginx limpio`, `curl /ruta-inexistente-sin-extension` → `HTTP/2 200 + index.html via redirect-spa-audit Function` (SPA-fallback intacto). Detalle operativo en [incident-notes.md](incident-notes.md) sección "Fix CloudFront AUDIT 2026-05-21 (paquete 10.A.2)". El riesgo en PROD sigue vigente como nota documental: cuando se cree la distribución frontend del producto PROD, NO configurar `CustomErrorResponses 404 → /index.html` a nivel distribución; usar exclusivamente CloudFront Function en viewer-request.

### Assets `/logo192.png` y `/manifest.json` faltan en bucket S3 de TEST (devuelven 403 AccessDenied)

**Origen**: detectado durante smoke tests post-hotfix CloudFront TEST. Smoke test #12 (`/logo192.png`) y smoke test #18 (`/manifest.json`) devolvieron HTTP 403 AccessDenied de S3 (`<Error><Code>AccessDenied</Code>...`), no HTTP 200 con el asset.

**Hecho**: el bucket S3 frontend de TEST (`sharemechat-frontend-test`) está configurado con OAC (Origin Access Control). Con OAC, cuando un objeto no existe S3 devuelve 403 en vez de 404 (el bucket policy concede `GetObject` pero no `ListBucket`). Por tanto el 403 implica "el objeto no está en el bucket".

**Impacto**: ambos son assets que CRA genera por defecto en el build (`logo192.png` para PWA icon, `manifest.json` para PWA metadata). Su ausencia degrada la experiencia PWA (ícono de instalación, splash screen) pero no rompe la app. El usuario en navegador normal no nota nada; un usuario instalando como PWA puede ver iconos rotos.

**Confirmación de que NO es regresión del hotfix CloudFront**: el `CustomErrorResponses` eliminado solo gestionaba HTTP 404; los 403 no estaban siendo reescritos antes ni después. El comportamiento es idéntico pre/post fix.

**Acción pendiente**:
1. Verificar en el build del frontend (`frontend/build/` tras `npm run build`) si los archivos se generan localmente.
2. Si se generan localmente, revisar el script de deploy (`ops/scripts/deploy-frontend.ps1`) para confirmar que sube esos paths al bucket. Posible patrón de exclusión erróneo.
3. Si no se generan, revisar `public/manifest.json` y `public/logo192.png` en el repo del frontend.
4. Tras corregir, smoke test: `curl -i https://test.sharemechat.com/logo192.png` debe devolver 200 image/png.

**Prioridad**: baja. PWA install no es flujo crítico hoy. Cierre estético + cierre de iconos PWA cuando se decida priorizar.

## 2026-05-20 — Detectadas durante el cierre del paquete 8 (rediseño CMS bilingüe)

### Lista obsoleta de fases del pipeline editorial en `test.md`

**Origen**: `docs/03-environments/test.md` línea 205 aprox. Deuda preexistente: ADR-023 introdujo la fase 4.5 (`cms-translate-en`) sin actualizar esta enumeración, y [ADR-026](../06-decisions/adr-026-cms-builder-validator-split.md) introduce ahora la 5.5 (`cms-json-validator`) sin tocarla tampoco para no expandir scope.

**Hecho**: la línea describe los runs IA tipo `FULL_ARTICLE_ORCHESTRATED` y enumera las fases como `cms-research-seo → cms-draft-writer → cms-editorial-polish → cms-brand-legal-review → cms-json-builder`. Faltan 4.5 (`cms-translate-en`, obligatoria desde ADR-023) y 5.5 (`cms-json-validator`, obligatoria desde ADR-026). El pipeline real son 7 fases, no 5.

**Impacto**: documental. No bloquea operación porque el orquestador en Cowork (`cms-orchestrator.md`) sí refleja las 7 fases. Pero un agente o lector nuevo que se apoye en `test.md` para entender el pipeline tendrá una visión incompleta y desactualizada.

**Acción pendiente**: en un paquete documental de mantenimiento del entorno TEST, actualizar esa línea con las 7 fases reales del pipeline bilingüe. Aprovechar para verificar si hay otras referencias colaterales obsoletas en `docs/03-environments/` u otros documentos descriptivos.

**Prioridad**: baja. Mejora de coherencia documental, no urgente.

### Posible tabla `skills_pipeline` desactualizada en `ContentPromptBuilder.java`

**Origen**: detectado durante el paquete 8.C (integración de fase 5.5 en orquestador). NO verificado en código (fuera del alcance del paquete 8, que era exclusivamente skills + documentación). Anotación heredada del cierre del paquete 8.C.

**Hecho**: el backend genera el prompt orquestador del CMS desde `src/main/java/com/sharemechat/content/service/ContentPromptBuilder.java`, método `appendFullArticleOrchestratedPipeline` (o equivalente). Si ese método contiene un bloque interno que lista explícitamente las fases del pipeline (típicamente una tabla XML-semántica `<skills_pipeline>` con filas tipo `Fase N - skill - output`), probablemente menciona las fases 1-5 (o 1-4.5 + 5 tras la actualización del ADR-023) sin la nueva 5.5.

**Impacto**: el prompt que el backend genera para Cowork puede no anunciar la fase 5.5 explícitamente. El orquestador en Cowork ya conoce la 5.5 por su MD actualizado y la ejecuta igual, pero la traza de auditoría queda menos limpia: lo que el backend dice que debería pasar y lo que Cowork ejecuta divergen en una fila.

**Acción pendiente**: paquete de backend posterior. Verificar primero si `ContentPromptBuilder.java` lista las fases explícitamente; si lo hace, añadir la 5.5 de forma aditiva (igual que [ADR-023](../06-decisions/adr-023-bilingual-editorial-pipeline-es-en.md) añadió la 4.5 en su día) sin reorganizar la lógica del método. Si no las lista (caso de que el bloque sea genérico y delegue todo el detalle a la skill orquestadora), no hay nada que tocar.

**Prioridad**: baja. No bloquea operación; solo coherencia entre backend y skills.