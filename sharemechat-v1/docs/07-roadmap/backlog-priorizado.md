# Backlog priorizado — SharemeChat

> **Fuente de verdad de PRIORIDADES.** Este fichero es el índice único de *qué atacar y en qué
> orden*. El detalle de cada frente vive en su ADR / `known-debt.md` / `current-phase.md`; aquí
> solo va **prioridad (1-5) + estado real reconciliado**. Si otro doc contradice el estado de aquí,
> gana este (y hay que actualizar el otro).
>
> **Última reconciliación:** 2026-08-11 (post nivelado PROD → `main fed5e01`, migraciones V47-V51).
> **Motivo de creación:** los docs de roadmap acumulaban tareas ya cerradas listadas como pendientes
> (Tickets ADR-054, anti-fraude Sightengine, Madagascar allowlist, replicación a PROD…). Este índice
> corta esa deriva.

## Escala de prioridad
| P | Significado |
|---|---|
| **P1** | Crítico e inmediato: bloquea go-live/captación, o puede estar **roto en PROD ahora**. |
| **P2** | Alto: prerrequisito de apertura pública o alto impacto; siguiente en cola. |
| **P3** | Medio: mejora importante, no bloquea. |
| **P4** | Bajo: deuda acotada, sin urgencia. |
| **P5** | Algún día / nice-to-have. |
| **BLOQ** | Bloqueado por terceros — no accionable ahora (se vigila, no se prioriza). |

Contexto: PROD en **PRELAUNCH** (producto 503). Cuello de botella estratégico = **captación de modelos**
(pivote Master/Studio + fundadoras LATAM/Madagascar).

---

## P1 — Crítico / inmediato
| Tarea | Estado | Go-live | Qué es | Ref |
|---|---|:---:|---|---|
| **Verificar gaps PROD post-nivelado** | pendiente | sí | El nivelado propagó código+migraciones, NO env vars/credenciales/assets. Verificar en PROD: `CLAUDE_API_KEY` (chat IA), `KYC_DIDIT_MASTER_CALLBACK_URL`, PDFs de contrato en S3. Pueden estar rotos AHORA. | pending-hardening §5.4 |
| **Compliance entregables** | pendiente | **sí (duro)** | Declaración 2257 en footer (dev), Records Custodian nombrado (legal), 5 políticas PSP firmadas (legal). Bloqueante duro; riesgo congelación merchant. | pending-hardening Parte 4; pre-mortem B1/B2 |
| **Bug SEO internal-linking (SPA sin `<a href>`)** | por verificar | mata orgánico | Verificar si el blog se enlaza con `<a href>` real para que Google/Bing/ChatGPT lo descubran. Bing/GEO ya habilitado por consola Google Cloud (2026-08). ~8-12h si sigue roto. | pre-mortem T2/T3 |
| **Reconciliar docs obsoletos** | en curso (este doc) | no | current-phase lista Tickets como sin-hacer y B.3→PROD como pendiente (ambos ya hechos). Refrescar current-phase + marcar cerrados. Este backlog es el primer paso. | current-phase (stale) |

## P2 — Alto
| Tarea | Estado | Go-live | Qué es | Ref |
|---|---|:---:|---|---|
| **BFPM Fase 4B-b** | siguiente paso | sí (prereq PSP) | Reporting backoffice BFPM + política refund cuando el saldo incluye bonus. Prerrequisito de integrar PSP real. | current-phase Frente 2.6 |
| **Product Operational Mode — validar** | parcial | sí | Validar PRELAUNCH/MAINTENANCE/CLOSED end-to-end + tratamiento frontend de los códigos. Habilita producto cerrado + registro abierto. | pending-hardening §1B |
| **Country-gating: blacklist + granularidad US** | pendiente | sí | Blacklist homogénea REST/WS; US requiere granularidad sub-estatal (FSC v. Paxton). | go-live-roadmap Fase 0; pre-mortem F3 |
| **KYC modelo automatizado** | pendiente | sí | Hoy manual 24-48h = cuello de botella y churn de modelos. Automatizar Didit-driven. | go-live-roadmap Fase 2 |
| **GDPR: DPO playbook #D-15 + DSR + aceptación versionada** | pendiente | sí (#D-15 duro) | #D-15 (art.15 sobre convs humanas) obligatorio pre-PROD; delete-account + DSR; `legal_acceptances` versionado. | known-debt #D-15/#12/#13/G3 |
| **Endurecer superficies económicas no-directas** | pendiente | sí | `ccbill/notify` (firma/idempotencia/replay), refund admin, payout review, gifts/settlement WS. Antes de dinero real. | pending-hardening §1C |
| **SEO US: cluster contenido US-EN** | parcial | mata orgánico | Bing ya habilitado; falta cluster US-EN + alternativeto.net + Reddit orgánico. | pending-hardening §6.2 |

## P3 — Medio
| Tarea | Estado | Go-live | Qué es | Ref |
|---|---|:---:|---|---|
| **ADR-052: purga afiliadas (V38) + reparto nuevo (V39)** | técnica pendiente | no | Rediseño estructural del reparto + retirada del programa de afiliadas. | current-phase Frente 3 |
| **#D-29: doc reparto 75% vs 50-60% real** | pendiente | no | Doc obsoleto contamina copy fundadoras y 4 docs. Corregir. | known-debt #D-29 |
| **Contrato Master v1 + Modelo v4.2 a S3 PROD + re-firma** | pendiente | no | Subir PDFs/manifest a S3 PROD/AUDIT + re-firma masiva modelos. | pending-hardening §5.4 |
| **Reactivar vendor moderación (Sightengine) con cuota** | listo, OFF | no | Ya implementado; OFF por saldo free agotado. Reactivar con plan mensual (acción operador + reemplazar credenciales antes de `enabled=true`). | known-debt #D-9/10/11 |
| **Founding Models (cohorte fundadora)** | bloqueado por dep. técnica | no | Tramo 70% en BD + badge `is_founder` + bypass PRELAUNCH allowlist. | pending-hardening §6.4 |
| **Master/Studio S5.a.8+ (ADR-056)** | **en pausa (decisión operador 2026-08-11)** | no | Tabs Historial/Payout dashboard Master → S6 payouts multi-rail. No urgente ahora. | current-phase Frente 5 |
| **GDPR #12/#13/#14/#16** | pendiente | parcial | delete-account, DSR endpoints, MFA, aviso saldo bajo en streaming. | known-debt 2026-07-02 |

## P4 — Bajo
| Tarea | Estado | Qué es | Ref |
|---|---|---|---|
| #D-24 | pendiente | Packs premium residual (cálculo dinámico min + UX picker). | known-debt |
| #D-26 | pendiente | T&C/contrato modelo v5 con política descuentos D7 (alinea con ADR-052). | known-debt |
| #D-13 / #D-14 | pendiente | Job expiración `ESCALATED>48h`; Browser Notification API agentes. | known-debt |
| #D-16 | pendiente | Ventana no-atómica `processGift`↔`sendGift` en gift WS. | known-debt |
| #D-6 / #D-1..7 | pendiente | Discrepancias doc↔código subsistema CMS (mayoría documental). | known-debt |

## P5 — Algún día
| Tarea | Ref |
|---|---|
| UX #17-21 (refresco saldo, guía assets, nombres tier, transparencia kill-switch, geografía bot). | known-debt |
| Traductor T7 (traducir mensajes propios al idioma del peer). | pending-hardening §5.3 |
| WAF rate-based CloudFront + consolidación AWS. | known-debt; pre-mortem E |
| #15 job retención chat (alta post-volumen). | known-debt |
| #D-25 recalibración xlsx modelo-financiero. | known-debt |

## BLOQ — Bloqueado por terceros
| Tarea | Bloqueo | Ref |
|---|---|---|
| **PSP tarjeta real + firma webhook** | CCBill (manual oficial), Verotel/CardBilling (sin contacto formal), Segpay descartado. NOWPayments cripto cubre puente. Sin PSP tarjeta no hay monetización real. | go-live-roadmap Fase 3; pre-mortem A1 |

---

## Cerrado recientemente (NO re-listar)
Para cortar la deriva de docs obsoletos, lo hecho que la doc vieja aún lista como pendiente:
- **PROD nivelado a main** (fed5e01, V47-V51) — 2026-08-11.
- **B6 Madagascar** en allowlist registro modelo (TEST+PROD) — verificado 2026-08-11.
- **Anti-fraude cámara (A10)** — implementado con Sightengine; OFF solo por saldo free (ver P3 reactivar).
- **Sistema Tickets ADR-054 (T1-T6 + refactor D8)** — HECHO (current-phase lo lista mal).
- **Traductor chat P2P (§5.3, V51)** — HECHO.
- **Chat Soporte LLM / panel humano (ADR-046)** — TEST/AUDIT; PROD cubierto por el nivelado (verificar credenciales en P1).
- **Google Sign-In Fase 1** — en PROD pero OFF por feature flag (desbloqueo = brand verification Google).
- **Bing/GEO para ChatGPT** — habilitado por consola Google Cloud (2026-08).

## Mantenimiento de este índice
- Al cerrar una tarea: moverla a "Cerrado recientemente" con fecha, no borrarla en silencio.
- Al detectar un doc que contradice esto: actualizar el doc, no este índice (salvo error real de estado).
- Reconciliar tras cada deploy grande.
