# Backlog priorizado — SharemeChat

> **Fuente de verdad de PRIORIDADES.** Índice único de *qué atacar y en qué orden*. Prioridad
> (1-5) + estado **verificado contra CÓDIGO FUENTE** (no docs). Si otro doc contradice esto, gana
> este y hay que actualizar el otro.
>
> **Reconciliación:** 2026-08-11, verificada contra el código por 4 pasadas (producto, economía/PSP,
> compliance/GDPR, testing/SEO). Muchos frentes que los docs listaban pendientes están **hechos**.

## Escala
| P | Significado |
|---|---|
| **P1** | Crítico/inmediato: bloquea go-live/captación, roto en PROD ahora, o fundacional de calidad. |
| **P2** | Alto: prerrequisito de apertura pública o alto impacto. |
| **P3** | Medio. **P4** Bajo. **P5** Algún día. **BLOQ** Bloqueado por terceros. |

Contexto: PROD en **PRELAUNCH**. Cuello de botella = **captación de modelos**.

---

## P1 — Crítico / fundacional
| Tarea | Estado (código) | Qué es | Evidencia |
|---|---|---|---|
| **Frente de TESTS + CI (metodología)** | 🟢 backend cerrado + Fase 4 unit/component robusta + E2E arrancado (2026-08-15) | CI (`.github/workflows/ci.yml`, `on: push`) **verde**, **3 jobs**: backend (`mvnw test`) + frontend (`react-scripts test`) + **e2e (Playwright/Chromium, backend mockeado)** en cada push. **198 tests unit/component + 4 specs E2E**: **backend 107** (blindado — dinero/payout, streaming, matching, trial, tramos+Pro+tarifa, Soporte bot+humano, Master COMPLETO, KYC mapeo+webhooks HMAC, Auth OAuth-linking **+ login federado Google**) **+ frontend 91** (Fase 4 Jest/RTL — registros cliente/modelo/master, `SessionHUD` timer/coste, checkout polling, hooks/dominio [traductor, polling, interacción, `useAppModals`, settings, pending-count] + utils [`attribution`, `runtimeEnv`, `normalizeNickname`, `registerErrorMessage`]). **E2E** (`frontend/e2e/`, backend mockeado): `smoke` + `registro-cliente` (age-gate→género→cliente→form→éxito) + `login` (credenciales→`refresh`→redirige a `/client`) + `checkout-primer-pago` (FORM_CLIENT: gates KYC+email→modal de pack→redirige a la `invoiceUrl` del PSP). Los 4 happy-paths críticos cubiertos. Capa unit/component/integración/E2E **ROBUSTA**. Deuda menor pendiente: clase base común de los `IntegrationTest`. Nota: el E2E cazó el día 1 un bug de empaquetado (`process`/`buffer` sin declarar → `npm ci` limpio rompía el bundle, página en blanco; ya corregido). | ADR-059; `src/test/java/**` + `frontend/src/**/*.test.*` + `frontend/e2e/**`; `docs/project-log.md` 2026-08-15 |
| **Cripto (NOWPayments) — mejoras UX de pago** | 🟡 pendiente (lidera operador) | Cripto ya implementado y en PROD; mejorar la **experiencia de pago del usuario**. Urgente. En el tejado del operador. | `psp/` NOWPayments |
| **Verificar gaps PROD post-nivelado** | 🟡 pendiente | El nivelado propagó código+migraciones, NO env/credenciales/assets. Verificar en PROD: `CLAUDE_API_KEY`, `KYC_DIDIT_MASTER_CALLBACK_URL`, PDFs de contrato en S3. | infra (no código) |
| **Compliance: 5 políticas PSP firmadas** | 🟡 pendiente (legal) | Las 5 políticas en estado PLANIFICADO sin firma legal. Bloqueante duro de go-live. *(2257 + Records Custodian YA existen en `footer/Legal.jsx` — no re-hacer.)* | `Legal.jsx:302,1197,1271` (2257 hecho) |
| **Reconciliar docs obsoletos** | 🟡 en curso | Refrescar `current-phase.md` (lista Tickets, KYC, Operational Mode… como pendientes cuando están hechos). Este backlog es el ancla. | current-phase (stale) |

## P2 — Alto
| Tarea | Estado (código) | Qué es | Evidencia |
|---|---|---|---|
| **BFPM Fase 4B-b** | 🟡 parcial | Motor contable bonus HECHO (partida doble). Falta **resumen admin BFPM** + **política refund con bonus** (#D-35). | `TransactionService:246`; `PspWebhookOrchestrator:231` (#D-35) |
| **GDPR: delete-account (art.17) + DSR self-service + aceptación versionada** | 🟡 parcial | Export art.15 admin-driven HECHO; **falta borrado de cuenta (art.17)** y DSR self-service. Versionado parcial (`ConsentEvent` append-only + `model_contract_acceptances`), falta catálogo por documento. #D-15 (DPO playbook) obligatorio pre-PROD. | `GdprExportService`; no hay deleteAccount; `ConsentEvent` |
| **Country-gating: WS independiente + granularidad US** | 🟡 parcial | Allowlist REST HECHA. Gaps: **el WS no se gatea por país de forma independiente** (solo transitivo vía JWT) + **sin granularidad sub-estatal US** (FSC v. Paxton). | `CountryAccessService` (solo REST, ISO-2) |
| **Endurecer superficies económicas restantes** | 🟡 parcial | Webhook NOWPayments HECHO (firma HMAC-512 + idempotencia + lock). Revisar guards de **payout review** (¿lock pesimista?) y settlement. | `PspWebhookOrchestrator`; `MasterPayoutService:95` |
| **SEO US — cluster contenido + marketing** | 🟡 parcial | Bing/GEO habilitado; blog crawleable (a href + sitemap + prerender OK). Falta **cluster US-EN + alternativeto.net + Reddit orgánico** (marketing, no código). | `BlogContent.jsx:385`; `SitemapController` |

## P3 — Medio
| Tarea | Estado | Qué es |
|---|---|---|
| **ADR-052: purga afiliadas (V38) + reparto nuevo (V39)** | 🟡 pendiente | Rediseño estructural reparto + retirada afiliadas. |
| **#D-29: doc reparto 75% vs 50-60% real** | 🟡 pendiente | Doc obsoleto contamina copy fundadoras. |
| **Contratos Master v1 + Modelo v4.2 a S3 PROD + re-firma** | 🟡 pendiente | Subir PDFs/manifest + re-firma masiva. |
| **Reactivar vendor moderación (Sightengine) con cuota** | 🟢 listo, OFF | Anti-fraude cámara implementado (face-presence + frame-diff/frozen + no-face → kill). OFF por saldo free. Acción operador: plan mensual + credenciales antes de `enabled=true`. |
| **Founding Models (cohorte fundadora)** | 🔴 pendiente | Tramo 70% BD + badge `is_founder` + bypass PRELAUNCH allowlist. |

## P4 — Bajo
#D-24 packs premium · #D-26 T&C v5 (alinea ADR-052) · #D-13/#D-14 (job ESCALATED, notif API) · #D-16 (atomicidad gift WS) · #D-6/#D-1..7 (doc↔código CMS) · #12/#14/#16 GDPR (MFA, aviso saldo bajo).

## P5 — Algún día
**Master/Studio: adapter payout real (Paxum)** — todo Master hecho salvo el rail real, hoy `NoopPayoutAdapter` manual; despriorizado por el operador · Traductor **T7** (traducir mensajes PROPIOS al idioma del peer — **no está en código**, opcional; `useMessageTranslations.js:41` salta los propios) · UX #17-21 · WAF/consolidación AWS · #15 retención chat · #D-25 xlsx.

## Gated por decisión de lanzamiento del operador
| Tarea | Nota |
|---|---|
| **PSP tarjeta real (CardBilling / grupo Verotel)** | **Proveedor ya negociado** (CardBilling, grupo Verotel) → NO está bloqueado por terceros; depende de **cuándo el operador decida lanzar**. Falta construir el **adapter** (hoy solo NOWPayments cripto en código). Registry `PaymentProvider` extensible listo. Prioridad y fecha las fija el operador. |

---

## Cerrado / verificado en código (NO re-listar — corta la deriva de docs obsoletos)
- **PROD nivelado a main** (fed5e01, V47-V51) — 2026-08-11.
- **B6 Madagascar** allowlist registro modelo (TEST+PROD) — verificado.
- **A5 Product Operational Mode** — REST (`ProductOperationalModeFilter`) + WS (`...WsInterceptor`) + frontend (`http.js`, `PreLaunchScreen`). HECHO.
- **A7 KYC modelo automatizado** — Didit webhook-driven (`KycSessionService:531`, HMAC+anti-replay), fija `verification_status` sin admin manual. HECHO. *(El "manual" es revisión de assets, otro flujo.)*
- **A9 SEO internal-linking** — FALSO positivo: `<a href>` real (`BlogContent.jsx:385`), sitemap dinámico (`SitemapController`), prerender Puppeteer. Crawleable.
- **A10 anti-fraude cámara** — Sightengine real + frame-diff/frozen/no-face → `killStreamAsAdmin`. HECHO (OFF por saldo).
- **2257 + Records Custodian** — `footer/Legal.jsx`. HECHO.
- **Gifts + efectos** (4 superficies) · **Tickets ADR-054** · **Google Sign-In** (off en PROD por flag) · **Chat Soporte LLM + panel humano ADR-046** — HECHO.
- **Master/Studio ADR-056** — registro, dashboard (tabs), split dual, invitación, suspensión HECHO (solo falta Paxum, ver P3).
- **Traductor chat P2P entrada + "ver original"** (V51) · **facturación streaming lump-sum** — HECHO.

## Mantenimiento
- Al cerrar: mover a "Cerrado/verificado" con fecha + ref de código, no borrar en silencio.
- Reconciliar contra CÓDIGO (no docs) tras cada frente grande.
