# ADR-059 - Estrategia de testing: acercamiento a Clean Architecture / TDD + integración + CI

> Estado: VIGENTE (fases 0-3 + Fase 4 unit/component robusta + E2E happy-paths críticos cubiertos, 2026-08-15; ver "Materialización")
> Fecha: 2026-08-12
> Vigencia esperada: indefinida (marco de calidad del proyecto)
> Reemplaza: N/A
> Ver también: `docs/07-roadmap/backlog-priorizado.md` (frente P1 "Tests + CI"), Robert C. Martin (Clean Architecture, Clean Code, TDD)

## Estado
Vigente (fases 0-3 + Fase 4 capa unit/component robusta + E2E Playwright con los happy-paths críticos cubiertos; ver "Materialización")

## Contexto

Verificación contra código (2026-08-12): el backend tiene **81 ficheros de test** pero **100% unitarios/mock o MockMvc standalone**; **cero tests de integración** (sin Testcontainers, sin `@SpringBootTest` de contexto, sin BD real), **sin CI** (no hay `.github/`), y el **frontend tiene cero tests**.

La cobertura está **sesgada a la periferia** (moderación, soporte, KYC, CMS, compliance) y deja **sin red los tres pilares de negocio en tiempo real**:
- **Dinero** — `TransactionService` (wallet, cargos, balances, payouts) sin tests; el path económico gift CLIENT→MODEL está explícitamente excluido y delegado a "smoke manual".
- **Matching** — `MatchingHandlerSupportTest` solo cubre `isApprovedClient()`; el matchmaking real (cola, pairing, `next`, ciclo WS) sin tests.
- **Streaming/facturación** — `StreamService.endSession` y el cobro por duración sin tests.

Estos tres pilares están **acoplados** a Redis, a los WebSocket handlers y a JDBC, lo que los hace difíciles de testear — y por eso no se testean. Los tres bugs corregidos en la sesión del 2026-08-11 (timer/coste del HUD, enrolado de matching, gift) caían **justo en ese hueco**; se detectaron en producción-de-pruebas a mano, no por la suite.

Restricciones: operador único, fase PRELAUNCH (ventana buena para invertir en la red antes de abrir), no se busca perfección sino un **acercamiento** pragmático a la metodología de Robert C. Martin.

## Opciones consideradas

### Opción 1 — Status quo (seguir con unit/mock en la periferia)
Pros: cero esfuerzo.
Contras: el core de dinero/tiempo-real seguirá sin red; los bugs de regresión (como los de hoy) se seguirán cazando a mano en producción.

### Opción 2 — Reescritura completa a Clean Architecture (puertos/adaptadores estrictos)
Pros: máxima testeabilidad teórica.
Contras: coste enorme, riesgo de romper lo que funciona, inviable para un operador único pre-launch. Uncle Bob mismo defiende evolución incremental, no big-bang.

### Opción 3 — Acercamiento pragmático (elegida)
Adoptar los principios de Clean Architecture / TDD de forma incremental y priorizada por riesgo, sin reescribir.

## Decisión

Adoptar un **acercamiento** a la metodología de Robert C. Martin, en cinco piezas:

1. **Inversión de dependencias / "humble object"** — extraer la lógica de negocio pura del glue de framework, de forma incremental. Ej.: sacar la **decisión de matching** de `MatchingHandlerSupport` (WS + Redis) a un servicio/policy plano testeable; aislar el **cálculo de cobro** de `StreamService` de la persistencia. No es reescribir: es adelgazar el handler y dejar la lógica en un objeto testeable sin infraestructura.
2. **Completar la pirámide** — mantener la base unitaria y **añadir la capa de integración que falta**: `@SpringBootTest` + **Testcontainers** (MySQL + Redis reales) para los flujos de dinero/matching/streaming de punta a punta dentro del backend. Unos pocos E2E (Playwright) para happy-paths críticos, más adelante.
3. **TDD hacia delante** — cada feature/bugfix nuevo entra con un test que falla primero. No se hace TDD-retrofit del código existente; se aplica a lo nuevo y al core según se endurece.
4. **FIRST** como listón de calidad de cada test (Fast, Independent, Repeatable, Self-validating, Timely).
5. **CI** — GitHub Actions que corre `mvn test` + `react-scripts test` en cada push/PR. Es la red que garantiza que la suite se ejecuta (hoy un test no compilaba sin que nadie lo detectara).

**Roll-out por fases (priorizado por riesgo):**
- **Fase 0 — CI mínimo**: Actions corriendo la suite actual; arreglar que el frontend al menos ejecute. Barato, inmediato, frena la deriva.
- **Fase 1 — Dinero**: extraer + integración `TransactionService` + gift charge CLIENT→MODEL.
- **Fase 2 — Matching + ciclo WS**: extraer la decisión de match; testear enrolado/pairing/next.
- **Fase 3 — Streaming/facturación**: `endSession`, cobro por duración.
- **Fase 4 — Primeros tests de frontend** (registro, pago, SessionHUD) + primeros E2E.

## Justificación

El coste está en el sitio equivocado: mucha red en la periferia de bajo riesgo y ninguna en el dinero y el tiempo real. La tesis de Uncle Bob aplica directa — *si el negocio es difícil de testear, la arquitectura está mal*: el remedio no es más mocks, es **desacoplar la lógica de la infraestructura** y **testear el core con dependencias reales** (Testcontainers) donde la interacción con BD/Redis es la fuente de bugs. El acercamiento incremental encaja con un operador único y no arriesga lo que ya funciona.

## Impacto

- **Arquitectura**: seams nuevos (servicios/policies puros) extraídos de handlers WS y servicios acoplados; sin reescritura.
- **Código**: dependencia de test `testcontainers` (mysql + redis) en `pom.xml`; frontend estrena Jest/RTL (infra ya presente vía CRA). Nuevos tests de integración por fase.
- **Operaciones**: `.github/workflows/ci.yml` nuevo; la suite pasa a ser bloqueante en PR.
- **Riesgos**: Testcontainers requiere Docker en el runner CI (disponible en GitHub Actions) y localmente (opcional; los unit no lo necesitan).

## Consecuencias

- **Positivas**: red bajo el dinero/matching/streaming; regresiones cazadas por CI, no en producción; arquitectura más testeable y mantenible; TDD hace de los bugs futuros tests primero.
- **Negativas / trade-offs**: los tests de integración son más lentos que los unit (se separan en CI); la extracción de seams añade indirección puntual; inversión de tiempo inicial (fases 0-1) antes de ver retorno.

## Notas

Materialización y prioridad viva en `docs/07-roadmap/backlog-priorizado.md` (frente P1). Primer paso concreto (PoC): Fase 0 (CI) + un test de integración con Testcontainers sobre el path de dinero, para validar el patrón antes de extender.

## Materialización (2026-08-12 → 08-14)

Fases 0-3 en marcha + parte de la periferia crítica. Estado a 2026-08-14:

- **Fase 0 — CI**: `.github/workflows/ci.yml` (raíz, `on: push`), jobs Backend (`./mvnw -B -ntp test`) y Frontend (`react-scripts test --passWithNoTests`), runner `ubuntu-latest` (Docker → Testcontainers corre en CI). **Verde.** Bug fundacional cazado y resuelto: `mvnw` commiteado sin bit +x (modo `100644`) daba exit 126 en el runner Linux.
- **Patrón de integración**: `@SpringBootTest(webEnvironment=NONE)` + `@ActiveProfiles("ci")` + `@Testcontainers` (MySQL 8.4). Perfil `ci` en `src/test/resources/application-ci.properties` (resuelve placeholders, vendors OFF). **GOTCHA de esquema**: el fresh-apply de las 51 migraciones es no-determinista (V42 colisiona en `uq_mpt_target_code_effective` cuando dos filas caen en el mismo segundo de `effective_from=CURRENT_TIMESTAMP`); los tests aplican un **baseline determinista** (`src/test/resources/db/migration-it/V1__it_baseline.sql`, 78 tablas) vía `spring.flyway.locations=classpath:db/migration-it`, NO las migraciones. Deuda anotada en `pending-hardening.md`.
- **Cobertura (165 tests; backend 107 + frontend 58)**. **Backend** — dinero (`TransactionService`: primer pago, packs+bonus, gift individual y bajo Master, refunds, payout×4), streaming (`StreamService.endSession`), matching (unit Mockito sobre `MatchingHandlerSupport`: pairing, ranking por idioma, `next`, trial, `matchClient` sin-oferta), trial (`UserTrialService`), tramos (`ModelTierService`: mapeo umbral→tramo, snapshot, Estatus Pro, recorte de tarifa), **Soporte** (bot IA: heurística unit + rate-limit + orquestación `SupportBotService` con `ClaudeApiClient` mockeado; y humano `SupportHumanHandlingService`), **Master completo** (splits `setInternalShare`, invitaciones `inviteModel`, payout `MasterPayoutService`, suspensión `MasterSuspensionService`), **KYC** (mapeo vendor→estado interno unit + webhooks `processVeriffWebhook`/`processDiditWebhook` integración con firma HMAC e idempotencia + age estimation), y **Auth** (`OAuthAccountController` link/unlink/initial-password + login federado `AuthGoogleController.googleAuth` slice unit, paths A/B/C). **Frontend (Fase 4, Jest/RTL)** — registros cliente/modelo/master (validación, gates 18+/términos, submit, error), `SessionHUD` (timer + cálculo local de saldo/ganancia con fake timers), checkout (`CheckoutSuccessPage` polling `getSessionStatus` / `CheckoutCancelPage`), y hooks/dominio (`useMessageTranslations`, `useConversationPolling` [polling con fake timers], `useActiveInteraction` [máquina de estados] + helpers puros `activeInteraction` [gates can-message/gift/call], `useAppModals` [modales promise-based]).
- **Verificación local**: los tests Testcontainers NO corren en local (Windows: docker-java no conecta al named pipe de Docker Desktop) → **la CI Linux es el juez**; los unit puros (matching, heurística) sí corren en local.
- **No requiere despliegue ni nivelación** de test/audit/prod: son ficheros de test + CI, cero cambios de runtime/migraciones/frontend.

Backend **cerrado** (2026-08-15): el login federado se resolvió con un unit test directo del controller (mocks + `MockHttpServletRequest/Response`, sin MockMvc/Security ni refactor de producción), y se cerraron los casos menores (matchClient sin-oferta, age estimation). Queda deuda menor: extraer clase base común de los `IntegrationTest`.

**Fase 4 (frontend) EN MARCHA** (58 tests, Jest/RTL — infra CRA+Jest+RTL ya presente). Cubierto: los 3 registros, `SessionHUD`, checkout, y hooks/dominio (traductor, polling, interacción core + helpers, modales). Se han cimentado **4 patrones de test de hooks**: harness simple, polling con fake timers (`await act(async()=>{})` + `advanceTimersByTime`, asertar nº de llamadas), captura-de-API para state machines, y modal-promise (mockear `openModal`, renderizar el `content` capturado, disparar handlers). Pendiente Fase 4 (al 08-15 ya resuelto): esos hooks/utils están cubiertos (198 tests) y los **E2E (Playwright)** de los happy-paths críticos (arranque, registro, login, registro→pago/checkout) están los 4 en verde. Extracción de seams (puertos/policies) según se endurezca el core.

### Actualización 2026-08-15 — capa unit/component robusta (198) + E2E Playwright arrancado

- **Capa unit/component cerrada (165 → 198 tests; backend 107 + frontend 91)**. Frontend +33 sobre el snapshot del 08-14: batch2 hooks (`useTranslationSettings`, `useSupportPendingCount`), batch3 utils (`attribution` [ADR-057, consent-gated], `runtimeEnv`, `normalizeNickname`, `registerErrorMessage`) y el resto de `useAppModals`/dominio. La base de pirámide (unit + component + integración backend) se considera **robusta**.
- **E2E Playwright arrancado** — **tercer job de CI** `e2e` en `.github/workflows/ci.yml` (backend + frontend + e2e). Enfoque: **backend MOCKEADO por interceptación de red** (`page.route('**/api/**')`; el backend real ya está cubierto por los 107 tests de integración). Infra: `@playwright/test` + `playwright.config.js` (Chromium sobre el frontend **product** vía `env-cmd -f .env.product react-scripts start` en :3100). Specs (4, los happy-paths críticos): `smoke` (la app carga y React monta), `registro-cliente` (age-gate saltado por localStorage → Home → género → cliente → form → modal de éxito, POST `/api/users/register/client` interceptado y payload verificado), `login` (credenciales → POST `/api/auth/login` → `refresh` GET `/api/users/me` → `resolveHomeUrl` redirige a `/client`), y `checkout-primer-pago` (cliente FORM_CLIENT recién registrado: gates KYC+email → modal de selección de pack → POST `/api/billing/nowpayments/checkout` → la app redirige a la `invoiceUrl` del PSP, con el `packId` verificado). Cubiertos los 4 happy-paths críticos (registro, login, checkout, arranque). Ampliaciones futuras según se endurezca el core.
- **Valor inmediato del E2E — bug de empaquetado cazado el primer día**: `src/polyfills.js` importaba `process` y `buffer` sin declararlos en `package.json` (`buffer` colaba como transitiva de `simple-peer`; `process` sin proveedor). En local funcionaba por caché de webpack; un `npm ci` LIMPIO (CI, o cualquier build de deploy del frontend desde cero) rompía el bundle con `Cannot find module 'process'` → React no montaba → **página en blanco**. Bomba latente en el pipeline de deploy que los tests unitarios (jsdom) no ven. Fix: declarar ambos shims explícitos en devDependencies. Justifica por sí solo la capa E2E.

### Actualización 2026-08-15 (cont.) — expansión de cobertura frontend (91 → 229 Jest)

Segunda tanda de tests frontend el mismo día, atacando el hueco de **utils puros críticos y componentes de seguridad/infra** que estaban sin cubrir. Frontend Jest **91 → 229** (32 suites verdes); total unit/component **≈336** (backend 107 + frontend 229) + 4 specs E2E. Encadenado por batches (rama → verde local → CI 3 jobs → merge verificado):

- **Utils puros de routing/acceso** — `runtimeSurface` (`resolveHomeUrl` por rol, `navigateToUrl` history-vs-`window.location`, flags product/admin), `backofficeAccess` (permisos/roles backoffice), `clientKycGate` (gate de pago + defensa open-redirect).
- **Utils de media/cámara** — `mediaState` (snapshot y observador de salud del track de video), `virtualCameraGuard` (anti-fraude Nivel 1: blacklist de virtual cameras, fallback `enumerateDevices`), más `apiErrors` y `emojiUtils`.
- **Componentes de seguridad/infra/UX** — `RequireRole` (gate operacional PRELAUNCH ADR-009 + control por rol/userType/backoffice), `MaintenanceProvider` (overlay failover por CustomEvent + auto-recuperación por poll, con fake timers), `CookieBanner` (consent GDPR + first-touch), `TrialCooldownModal` (`formatRemaining` ms→texto, 10 ramas), `LocaleSwitcher` (basename `/en` ADR-022 + alternates de blog ADR-025), `ModalProvider` (API promise-based + helpers alert/confirm/selectOptions).
- **Gotcha jsdom aprendido** — para mockear `window.location` de forma fiable a través de reads asíncronos, `Object.defineProperty(window,'location',{value})` NO engancha entre re-definiciones; el patrón que funciona es `delete window.location; window.location = mock`. También: CRA resetea las implementaciones de los mocks entre tests → re-setear en `beforeEach`.
