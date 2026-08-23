# Incidencias en PROD — base de conocimiento

> Cuaderno vivo de incidencias de producción. Aquí se acumula, poco a poco,
> **conocimiento teórico** (cómo actuar), **casos reales** (qué pasó y cómo se
> resolvió) y **técnicas** (cómo investigar con lo que tenemos). No es un log
> cronológico seco (para eso está [`incident-notes.md`](../incident-notes.md));
> es el manual que consultas cuando algo se rompe y el sitio donde documentas un
> caso con suficiente detalle para no repetirlo.

## Cómo se usa este directorio

- Este `README.md` es el **manual + índice**: instrumentos disponibles, flujo de
  actuación, tipos de incidente y una plantilla.
- Cada incidente relevante se documenta en su **propio fichero**:
  `caso-AAAA-MM-DD-<slug>.md` (copiar la [plantilla](#plantilla-de-caso-real)).
- El [índice de casos](#índice-de-casos-reales) de abajo enlaza a cada caso.
- No duplicar: si algo ya vive en `known-risks.md`, `runbooks.md` o una ADR,
  enlázalo en vez de copiarlo.

---

## Instrumentos de observabilidad disponibles

Qué "sentidos" tenemos y qué mira cada uno (todos añadidos en la Fase 2 de
observabilidad salvo indicación):

| Instrumento | Qué te dice | Cómo se consulta |
|---|---|---|
| **Vigilante de salud** (`ops/health-monitor`, timer 3 min) | Backend caído/recuperado | Email automático *"[SHAREMECHAT PROD] Backend DOWN/UP"* |
| **`/api/health/version`** (público) | Vivo + commit desplegado + modo operacional | `curl https://sharemechat.com/api/health/version` |
| **`/actuator/health`** (interno, localhost) | UP/DOWN incl. chequeo de BD | En la caja: `curl localhost:8080/actuator/health` |
| **`/actuator/metrics`** (admin) | Memoria JVM, peticiones/errores HTTP, pool de BD | Autenticado como admin |
| **`requestId` en logs** | Correlacionar todas las líneas de UNA petición | `journalctl -u sharemechat-prod \| grep <requestId>` |
| **`[CLIENT-ERROR]`** en logs | Errores del navegador del usuario (mensaje, fichero:línea, URL) | `journalctl ... \| grep CLIENT-ERROR` |
| **`[AUTH-RISK]`** en logs (ADR-008) | Riesgo de login / ataques de credenciales | `journalctl ... \| grep AUTH-RISK` |
| **Pipeline seguridad `prod-access`** | Accesos sospechosos / DoS por IP + auto-bloqueo | Email diario + veredictos del classifier |
| **Auditoría contable** (cron nocturno, panel Control interno) | Descuadres de dinero, integridad de streams, estado runtime | Panel backoffice → Control interno + tabla `accounting_anomalies` |
| **GA4 / captación** | Anomalías de tráfico/conversión (firma de bot) | GA4 + panel de captación |
| **SSH a la caja** | Todo lo interno: `systemctl`, `journalctl`, BD por túnel | Alias `prod-backend` (ver `access-and-tooling.md`) |
| **Rollback** | Volver atrás | JAR `.bak` (N=1) en backend; bundle previo en S3/frontend |

---

## Flujo general de actuación

Siempre en este orden — **primero restaurar, después entender**:

1. **Detectar** — alerta (email), panel, o reporte de usuario.
2. **Triage** — severidad: **P1** caída total / dinero en riesgo · **P2** un flujo
   roto · **P3** cosmético. Decide la prisa.
3. **Investigar** — con el instrumento adecuado (tabla de arriba).
4. **Contener / mitigar** — reiniciar, revertir, bloquear o degradar. Restaurar el
   servicio aunque la causa raíz venga después.
5. **Arreglar de raíz** — fix + desplegar.
6. **Verificar** — health UP, email de recuperación, smoke del flujo afectado.
7. **Documentar** — crear el `caso-...md` aquí y, si aplica, actualizar
   `known-risks.md` / ADR.

---

## Tipos de incidente y actuaciones (referencia)

Guía teórica; cada caso real matiza. (Detalle narrado en el chat/estos ficheros.)

### Backend caído (P1)
- **Detección**: email del vigilante en ≤3 min.
- **Investigación**: `systemctl status`, `journalctl` (traza / OOM), `/actuator/health` (¿BD?).
- **Actuaciones**: reinicio (cuelgue) · reinicio + `jvm.memory` (OOM) · revisar RDS/pool
  (BD) · **rollback al JAR `.bak`** (deploy malo — no reiniciar a ciegas si es crash-loop).

### Web rota en el navegador (P2)
- **Detección**: pico de `[CLIENT-ERROR]` o "Algo ha ido mal" (ErrorBoundary).
- **Investigación**: grep `[CLIENT-ERROR]` → mensaje + fichero:línea + URL.
- **Actuaciones**: rollback del bundle (si fue un deploy) o hotfix + `deploy-frontend`.

### Ataque / abuso (P1-P2)
- **Detección**: email diario ROJO del pipeline de seguridad; `[AUTH-RISK]`.
- **Investigación**: veredictos classifier (V/A/R); firma de bot en GA4.
- **Actuaciones**: el blocker bloquea la IP (nginx deny) al día siguiente; a mano si
  urge; AuthRisk ya frena los CRITICAL de login.

### Descuadre de dinero / datos (P1)
- **Detección**: anomalía del cron de auditoría (p. ej. `BALANCE_LEDGER_MISMATCH`) en Control interno.
- **Investigación**: panel Accounting (usuario/tx/stream exactos) + SQL en la BD.
- **Actuaciones**: corregir con las herramientas de admin auditadas (refund/compensación) + arreglar el código.

### Lentitud / degradación (P2-P3)
- **Detección**: quejas de lentitud; `/actuator/metrics` (latencia, pool saturado).
- **Investigación**: métricas + `requestId` para seguir una petición lenta.
- **Actuaciones**: pool agotado → reiniciar + buscar fuga/query atascada; endpoint lento → optimizar.

### Un flujo concreto falla (registro, pago, KYC, streaming)
- **Detección**: reporte, `[CLIENT-ERROR]`, o pico de errores en un endpoint.
- **Investigación**: seguir el flujo por su `requestId`.
- **Actuaciones**: proveedor externo caído (Didit/PSP/Translate) → verificar vendor + degradar; si es nuestro → hotfix + deploy.

---

## Plantilla de caso real

Copiar a `caso-AAAA-MM-DD-<slug>.md`:

```markdown
# Caso AAAA-MM-DD — <título corto>

- **Severidad**: P1 / P2 / P3
- **Duración**: HH:MM–HH:MM (UTC) · impacto: <usuarios/flujos afectados>
- **Entorno**: PROD / AUDIT / TEST

## Síntoma
<qué se observó y cómo se detectó (alerta, panel, usuario)>

## Investigación
<qué instrumentos se usaron y qué mostraron; comandos clave>

## Causa raíz
<la causa real confirmada, no la hipótesis>

## Actuación
<qué se hizo para restaurar (contención) y qué para arreglar de raíz>

## Verificación
<cómo se confirmó que quedó sano>

## Prevención / seguimiento
<qué evita que vuelva a pasar; enlaces a fix/ADR/known-risks; deudas abiertas>
```

---

## Índice de casos reales

_(Se irá rellenando. Aún sin fichas de caso propias.)_

Casos ya documentados en otros sitios, para migrar/enlazar cuando toque:
- **2026-08-22 — PROD en crash-loop por comentario inline en `config.env`** (systemd
  `EnvironmentFile` no soporta `KEY=valor # comentario`; el `#...` quedó dentro del
  valor → booleano inválido). Detección: no arrancaba tras deploy. Aprendizaje
  durable en memoria del agente; conviene una ficha aquí.

---

## Enlaces relacionados

- [`incident-notes.md`](../incident-notes.md) — notas cronológicas de incidentes.
- [`known-risks.md`](../known-risks.md) · [`known-debt.md`](../known-debt.md) — riesgos y deuda conocidos.
- [`runbooks.md`](../runbooks.md) — procedimientos (despliegue, etc.).
- [`access-and-tooling.md`](../access-and-tooling.md) — accesos (SSH, BD, GA4).
- [`deployment-flow.md`](../deployment-flow.md) — flujo de despliegue y rollback.
