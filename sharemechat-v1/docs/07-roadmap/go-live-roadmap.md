# Roadmap a GO LIVE

Este documento es el **roadmap principal de negocio** de SharemeChat hacia GO LIVE.
Se organiza por fases de negocio, no por frentes técnicos sueltos.

## Gobierno documental

- **Roadmap principal de negocio**: este documento (`go-live-roadmap.md`).
- **Backlog técnico**: [pending-hardening.md](pending-hardening.md). No es roadmap ejecutivo; se referencia desde aquí cuando una fase consume backlog técnico.
- **Planes operativos por entorno**: [test-levelling-plan.md](test-levelling-plan.md) y [audit-environment-plan.md](audit-environment-plan.md). Sirven como input técnico de fases concretas, no sustituyen el roadmap.
- **Estado y prioridades vivas**: [current-phase.md](current-phase.md), que apunta siempre a la fase actual de este roadmap.

## Lectura ejecutiva

- El sistema está en MVP industrial medio-alto (ver diagnóstico técnico global).
- El riesgo dominante actual ya no es técnico puro: es **ordenar el camino hacia GO LIVE, captación inicial y monetización real** sin abrir frentes innecesarios.
- PRO no se abre como producto completo. La apertura es progresiva, controlada y revisable en cada fase.
- Fecha objetivo de lanzamiento documentada: **1 de julio de 2026**. Las fases siguientes deben caber dentro de ese horizonte; cualquier desvío revisa el calendario, no el orden de fases.

---

## Fase 0 — Cierre de riesgos pre-PRO

Estado: EN CURSO

Objetivo: dejar el sistema en condiciones de poder abrir cualquier superficie pública sin asumir riesgos estructurales conocidos.

Alcance:

- eliminar o acotar acoplamientos del frontend a dominios y configuración de TEST.
- revisar preparación real de `properties` y variables de entorno para PRO (paridad con AUDIT, secretos, dominios, CORS, cookie domain, namespace Redis).
- mantener validada la facturacion de streams basada en doble ACK media y `billable_start` como inicio facturable.
- cerrar o proteger los endpoints de simulación económica antes de cualquier circulación de dinero real.
- definir e implantar **Product Operational Mode** como capa server-side única de gating por entorno (modos `OPEN/PRELAUNCH/MAINTENANCE/CLOSED`, flags independientes de registro y flag de simulación económica directa). Decisión registrada en [ADR-009](../06-decisions/adr-009-product-operational-mode.md). Esta capa desbloquea: cierre de registro público en TEST/AUDIT, cierre de endpoints directos de simulación donde no proceda, modo PRELAUNCH en PRO para habilitar Fase 1, y modo MAINTENANCE para operación posterior a GO LIVE.
- aplicar blacklist por países antes de abrir PRO, con criterio homogéneo entre REST y WebSocket.

Input técnico: `pending-hardening.md` y `test-levelling-plan.md`.

Esta fase debe cerrarse antes de habilitar Fase 1. Específicamente, Product Operational Mode debe estar implementado y validado antes de Fase 1, ya que es lo que permite tener registro abierto y producto cerrado simultáneamente en PRO.

### Estado detallado

- acoplamientos a TEST → PARCIAL
- properties/env de PRO → NO VALIDADO
- cierre economico stream (`start_time` vs `billable_start`) → IMPLEMENTADO Y VALIDADO EN TEST
- endpoints de simulación económica directa → GOBERNADOS POR FLAG E IMPLEMENTADOS; validación en TEST completada; AUDIT/PRO deben quedar `false` por defecto antes de dinero real
- Product Operational Mode → IMPLEMENTACIÓN PARCIAL: cierre de registro validado en TEST/AUDIT; simulación económica directa validada en TEST; modos restrictivos (`PRELAUNCH/MAINTENANCE/CLOSED`) en código pero pendientes de validación. Frontend pendiente. (ADR-009)
- packs 10/20/40 (Fase 3A) → IMPLEMENTADO Y VALIDADO EN TEST. Backend `CcbillService` acepta `P10/P20/P40` y rechaza el catálogo legacy. Frontend alineado. `minutesGranted == priceEur` en esta fase; BFPM pendiente. (ADR-011)
- BFPM Fase 4A (bonus EUR financiado por plataforma con `BONUS_GRANT`/`BONUS_FUNDING`) → IMPLEMENTADO Y VALIDADO EN TEST. Catálogo vigente: P10 sin bonus, P20 con +2 EUR, P40 con +4 EUR. Invariante `Σ BONUS_GRANT + Σ BONUS_FUNDING = 0` confirmada. (ADR-012)
- BFPM Fase 4B-a (auditoría interna contable BFPM) → IMPLEMENTADO Y VALIDADO EN TEST. Cuatro checks (`BFPM_INVARIANT_BREACH`, `BFPM_BONUS_GRANT_WITHOUT_FUNDING`, `BFPM_BONUS_FUNDING_WITHOUT_GRANT`, `BFPM_TOTAL_PAGOS_MISMATCH`) en `ACCOUNTING_AUDIT` scope `DEFAULT`. Run de validación `audit_run_id=113`: `SUCCESS`, `checks_executed=7`, `anomalies_found=0`. (ADR-012)
- BFPM Fase 4B-b (reporting backoffice + política de refund con bonus) → SIGUIENTE, prerrequisito previo a la integración PSP real.
- PSP CCBill real y firma webhook → BLOQUEADO hasta recibir manual oficial; sin inferencia.
- blacklist por países → PENDIENTE

---

## Fase 1 — Prelaunch público controlado

Estado: NO INICIADA

Objetivo: abrir presencia pública sin abrir todavía la plataforma, captando interés real y onboarding inicial sin exponer flujo completo de uso.

Alcance:

- registro de clientes y modelos activo en superficie pública.
- login y acceso al producto **bloqueados** intencionadamente.
- comunicación clara en superficie pública: "Coming Soon" / plataforma aún no disponible.
- captación inicial dirigida.
- bonus promocional prometido **solo si queda modelado correctamente** (catálogo de transacciones, gating, condiciones, expiración) antes de comunicarlo externamente.

---

## Fase 2 — Captación inicial de modelos

Estado: NO INICIADA

Objetivo: construir un inventario inicial de modelos verificadas suficiente para que la apertura posterior tenga oferta real.

Alcance:

- prioridad de captación: **Latinoamérica**.
- segunda ola: **África, Europa del Este y Asia**.
- validar onboarding externo real (KYC end-to-end, no simulado).
- contrato, tiers de earnings y mecánica de payouts claros y documentados de cara a la modelo.
- soporte privado mínimo para modelos durante onboarding (canal acotado, no soporte 24/7).

Dependencias: KYC operativo end-to-end y gating de país coherente (Fase 0).

---

## Fase 3 — PSP CCBill y monetización real

Estado: NO INICIADA

Objetivo: cerrar el circuito económico real, con PSP en producción, sin reabrir alternativas en este horizonte.

Alcance:

- **CCBill como PSP prioritario** en esta fase. No se evalúa otro PSP en paralelo.
- **wallet prepago como único modelo inicial** de monetización (no suscripción, no postpago).
- webhooks de PSP seguros: verificación de firma, validación de origen/contrato PSP y protección anti-replay.
- idempotencia de notificaciones y de acreditación de saldo.
- mantener cerrados en PRO los endpoints directos de simulación mediante `PRODUCT_SIMULATION_TRANSACTIONS_DIRECT_ENABLED=false`.
- mantener `PRODUCT_SIMULATION_TRANSACTIONS_DIRECT_ENABLED=false` en AUDIT/PRO salvo decisión operativa explícita previa al dinero real.
- auditar y endurecer las superficies económicas no directas antes de operación real: `ccbill/notify`, refund admin, review admin de payouts, kill admin de streams, gifts por WebSocket, settlement de streams por WebSocket, trials y unsubscribe/forfeit.
- pruebas extremo a extremo en AUDIT y, cuando aplique, en PRO en modo controlado, antes de apertura comercial real.

Nota: PSP figura como integración no cerrada en `integrations-overview.md` y en `known-risks.md`.

---

## Fase 4 — PRO privado funcional

Estado: NO INICIADA

Objetivo: ejercitar PRO con tráfico real pero acotado, antes de abrir al público.

Alcance:

- login permitido **solo a cuentas controladas** (equipo interno, modelos invitadas, clientes invitados).
- pruebas con usuarios y modelos internos o invitados sobre flujos completos: random, calling, gifts, wallet, payout.
- soporte activo para esos usuarios durante la fase.
- validación limitada con dinero real si procede, dentro del marco PSP definido en Fase 3.

---

## Fase 5 — PRO público limitado

Estado: NO INICIADA

Objetivo: abrir al público de forma progresiva, manteniendo capacidad de cierre rápido si aparecen señales adversas.

Alcance:

- apertura progresiva (no apertura total).
- trial de **3 minutos por día solo en RANDOM**, como mecanismo de descubrimiento controlado.
- wallet real activa para conversión.
- soporte privado mantenido.
- monitorización diaria del entorno (operación, fraude, abuso de autenticación, salud realtime).
- **no se asume escalado horizontal** del backend ni del realtime en esta fase. Operación válida sobre instancia única observada.

---

## Fase 6 — Crecimiento y hardening posterior

Estado: NO INICIADA

Objetivo: una vez existe tráfico y datos reales, ordenar las mejoras de plataforma con criterio basado en señales, no en hipótesis.

Alcance prioritario:

- **face detection / modelo visible** como prioridad post-lanzamiento (control de presencia real durante stream).
- mejoras antifraude guiadas por señales reales observadas en producción.
- i18n completo en producto y backoffice.
- contrato estable de errores funcionales entre REST, WebSocket y frontend.
- refactor progresivo de los handlers grandes (`MatchingHandlerSupport`, `MessagesWsHandlerSupport`) y servicios largos.
- soporte más industrial (24/7, escalado horizontal, replicación de estado realtime) **solo si hay volumen** que lo justifique.

Input técnico: el grueso de `pending-hardening.md` aterriza progresivamente aquí, salvo lo que se haya consumido ya en Fase 0.

Nota: posterior a GO LIVE.

---

## Relación entre roadmap y backlog técnico

- Una entrada de `pending-hardening.md` no es por sí misma una fase del roadmap.
- Cada fase de este documento puede consumir entradas del backlog, pero el orden lo dicta el negocio.
- Si una entrada del backlog deja de ser relevante por decisión de fase, se marca obsoleta en el backlog, no se borra silenciosamente.
- Cualquier nueva línea de trabajo se evalúa primero contra este roadmap; si no encaja en una fase, se discute antes de añadirla al backlog.

---

## Uso operativo del roadmap

- El roadmap se ejecuta fase a fase.
- No se avanza de fase sin cerrar los criterios mínimos de la anterior.
- El backlog técnico ([pending-hardening.md](pending-hardening.md)) **no define prioridad por sí mismo**.
- Solo se consumen tareas del backlog si desbloquean la fase activa.
- Cada cambio técnico debe justificarse contra la fase actual.
