# ADR-057 — Atribución de origen capa B: persistir la fuente first-touch por usuario

**Estado:** Aceptada (2026-08-01). Implementada en backend + frontend; pendiente de
revisión legal del texto de privacidad y de deploy backend (migración V44).

## Contexto

La **capa A** (ADR-nota en `attribution.js`, desplegada 2026-07-31) captura la
fuente first-touch (utm) en una cookie propia `smc_attribution` y emite el evento
GA4 `sign_up`. Es **anónima y agregada**: los datos viven en GA4 (Google), no son
consultables por nosotros sin GA4 Data API / export BigQuery, y no están atados al
usuario. No sirven para cruzar origen con revenue/cohortes en nuestra BD.

Necesidad: saber **de qué canal viene cada usuario registrado**, en NUESTRA base de
datos, para analizarlo (SQL / agente) sin depender de GA4.

Restricción explícita del operador: *"no tomar datos que no podamos defender"*
(plataforma adulta, UE, GDPR). Minimización y limitación de finalidad.

## Decisión

Persistir la atribución **first-touch** de cada usuario en una tabla dedicada
`user_acquisition` (1:1 con `users`), al registrarse.

**Dataset mínimo defendible** (elegido sobre alternativas más agresivas):

| Campo | Origen | Notas |
|---|---|---|
| `utm_source/medium/campaign` | cookie `smc_attribution` (first-touch) | canal de marketing |
| `referrer_host` | host del `document.referrer` en la primera visita | sin path/query |
| `landing_path` | `window.location.pathname` de la primera visita | sin query (evita PII en URL) |
| `created_at` | servidor | timestamp de registro |

**Fuera de alcance** (descartado por defensibilidad): IP cruda y user-agent en esta
tabla (la IP de registro ya vive en `users.regist_ip` y el país en
`users.country_detected`); tracking/persistencia de visitantes no registrados.

**Base legal:** interés legítimo (entender canales de adquisición). **Requiere**
declararlo en la política de privacidad antes de producción. Gated por
consentimiento: el frontend solo adjunta datos si `smc_cookie_consent === 'accepted'`.

## Diseño técnico

- **Tabla** `user_acquisition`: PK = FK `user_id` → `users(id)` `ON DELETE CASCADE`
  (el borrado/erasure del usuario arrastra su atribución — GDPR-friendly).
  Migración `V44__add_user_acquisition.sql`.
- **Entity** `UserAcquisition` con `@Id` manual (sin `@OneToOne @MapsId`, para evitar
  el `StaleObjectStateException` del frente Master).
- **Datos auto-declarados por el cliente:** los valores los envía el frontend en el
  POST de registro (`acquisition` en el body, `AcquisitionDTO`). Son spoofables;
  aceptable para marketing (no se usan para decisiones de seguridad).
- **Persistencia best-effort:** los controllers llaman a
  `UserAcquisitionService.record(userId, acq)` **tras** el alta ya committeada, en
  transacción propia (`REQUIRES_NEW`), con try/catch. Un fallo de atribución **nunca**
  rompe el registro ni la transacción del alta. No se crea fila si no hay datos.
- **Frontend:** `captureFirstTouch` extiende la cookie con `landing_path` + `referrer`
  (incluye visitas directas/orgánicas); `getAcquisitionPayload()` construye el objeto
  del POST. Los 3 modales (cliente/modelo/master) lo adjuntan.

## Relación con "quién entra / bot vs persona"

Parcialmente cubierto ya, no se duplica aquí:
- `users.regist_ip` + `users.country_detected` ya persisten IP y país de registro.
- `AuthRiskService` puntúa abuso; los pipelines `*-access-classifier` detectan
  scanners/tráfico atacante en logs.
- La discriminación bot-vs-persona en el alta (señales user-agent/headless/challenge)
  queda como frente aparte si se prioriza.

## Consecuencias

- Podemos consultar en SQL "cuántos registros por canal" y cruzarlo con revenue.
- No dependemos de GA4 para la atribución por-usuario.
- Coste: migración BD + deploy backend (nuevo JAR) + disclosure legal.

## Trabajo relacionado (aparte)

- **GA4 → BigQuery export** (decidido "planificar", 2026-08-01): hace consultable por
  API/SQL toda la analítica GA4 (incluido `sign_up`). Requiere config en consola
  Google + proyecto GCP. Documentar y ejecutar como frente propio.
