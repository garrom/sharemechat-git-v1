# As-built — fixes de sesión de testeo (2026-08-11)

> Estado: **HECHO y desplegado en TEST**. Rama `claude/model-contract-reaccept-ux`
> (frontend product + 1 cambio backend). Integrado a `main` el 2026-08-11.
> Frente detectado probando streaming/registro en TEST; tres arreglos independientes.

## 1. UX de reaceptación de contrato de modelo (frontend)

**Problema:** una modelo con el contrato vigente sin aceptar tiene el WS bloqueado
(`ModelContractWsInterceptor`, gate de `/match` y `/messages`) → no aparece online, no
puede stream ni enviar gifts, **pero no se entera** (el aviso en perfil era pastel y pasaba
desapercibido, y el dashboard no avisaba). No es bug: el gate funciona; era UX pobre.

- `DashboardModel.jsx`: al montar consulta `/consent/model-contract/status`; si no ha
  aceptado la versión vigente, muestra un **banner ámbar llamativo** bajo el navbar, breve y
  **clickable** → lleva a `/perfil-model`. i18n `dashboardModel.contractPending.{banner,cta}`.
- `PerfilClientModelStyle.js` (`ContractNoticeCard`): la card de reaceptación pasa de crema
  pastel a **ámbar vivo** (borde 2px `#f59e0b` + fondo saturado + sombra).

## 2. Fix del cronómetro/coste del HUD al pulsar "next" (frontend)

**Problema:** tras cortarse el streaming en un momento de muchos cambios (next rápido), el
cronómetro y el coste en euros del cliente seguían corriendo sin streaming. **No era
facturación** (el backend cobra lump-sum en `endSession`, no por segundo; se verificó en BD
que los cargos eran correctos, ej. 75s → 1.25 €). Era display.

**Causa:** el `SessionHUD` se activa con `active={!!remoteStream}`. De todos los caminos de
fin, `handleNext` era el único que **no** ponía `remoteStream=null` localmente (esperaba al
backend), así que hasta el nuevo match el HUD seguía contando sobre el stream muerto.

**Fix:** teardown local inmediato en `handleNext` (`setRemoteStream(null)` + peer + mensajes),
espejo del cleanup de `onPeerDisconnected`. Aplicado en `DashboardClient` y `DashboardModel`
(mismo patrón).

## 3. Fix de matching: modelo tardía empareja con cliente en espera (backend)

**Problema (arquitectura original):** un cliente que buscaba sin modelos quedaba encolado
esperando; cuando la modelo se conectaba **después**, no casaban nunca. Crítico en fase de
poco supply (pocas modelos): habrá clientes esperando y modelos que entran después.

**Causa:** el matching es event-driven, "el que busca escanea la cola del otro". El cliente
manda `start-match` al abrir (`startMatchOnOpen=true`) → escanea modelos. Pero la modelo, al
hacer `set-role`, **solo se encolaba** (`moveToBucket("model")` + `setAvailable`) y **NO
escaneaba la cola de clientes** (su frontend no manda `start-match` al abrir). Así que al
entrar una modelo, nadie re-intentaba el match contra los clientes ya en espera. (Antes
"funcionaba" solo si el cliente daba next = re-escaneaba.)

**Fix** (`MatchingHandlerSupport`, path de modelo de `set-role`): tras encolar + `setAvailable`,
llamar a **`matchModel(session)`** → la modelo recién enrolada escanea de inmediato la cola de
clientes y empareja con cualquiera en espera. El cliente ya estaba cubierto. `matchModel`
re-gestiona el bucket (remove + re-add si no hay match). Validado en TEST: bidireccional (da
igual quién entre primero).

## 4. Diagnóstico (para futuras sesiones)

- **Presencia** = `StatusService` en Redis: `user:status:<id>=AVAILABLE` (TTL 45s) + set
  `user:available`; refrescado por heartbeat. `StatusService` **traga** `DataAccessException`
  (si Redis cae, la modelo no aparece disponible sin error visible).
- **Enrolado matching** = `set-role` (no `start-match`) pone el rol y encola. El trace WARN
  `[RANDOM_TRACE_WS_PING] role=null` salta cuando una sesión pinguea sin rol (no enrolada).
- **Cobro streaming** = `StreamService.endSession`, lump-sum por duración (`billableStart →
  endTime`), no por segundo. Cargos en `transactions` (`operation_type=STREAM_CHARGE`).

## 5. Estado

- Todo desplegado en **TEST** (frontend product `main.a5fb619c.js`; backend JAR con el fix de
  matching, `sharemechat-test.service` reiniciado). Manifest `ops/deploy-state/test.yaml`
  actualizado (backend = `6ee89d4`).
- Deuda aparte detectada: el test `MessagesControllerConsentEnforcementMockMvcTest` no
  compilaba (constructor viejo) → arreglado en rama `claude/fix-messagescontroller-test`.
- **PROD**: pendiente/congelado hasta orden explícita del operador.
