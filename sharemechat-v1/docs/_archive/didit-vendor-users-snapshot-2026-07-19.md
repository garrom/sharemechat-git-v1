# Snapshot Didit vendor users — 2026-07-19 (pre-limpieza panel)

## Contexto

Registro histórico de los 14 usuarios que existían en el panel de Didit el 2026-07-19, momento en el que el operador decidió borrarlos en bulk desde el panel del vendor. Motivo: la misma vista `Usuarios` de Didit va a ser usada a partir de aquí para verificaciones de PROD reales, y queríamos quitar de en medio el ruido de pruebas antiguas (sesiones con la cara y el DNI reales del operador subidos durante desarrollo).

Este snapshot se archiva porque:

- Es una foto puntual del vendor que **ya no existe en Didit** después de esta fecha (borrado en cascada desde el panel).
- **Nuestro backend NO se ve afectado**: `kyc_sessions` y `kyc_webhook_events` locales se conservan intactos por decisión operativa (no molestan, están separadas por entorno, tienen valor histórico para auditoría). Los `provider_session_id` locales apuntan a IDs que ya no resuelven en Didit — no importa porque el sistema es one-shot: una vez cerrada la verificación, no volvemos a consultar la sesión.
- Sirve como paper trail si hiciera falta reconstruir después: "qué había en Didit el día que se activaron los vendors reales en PROD".

Fuente: export CSV nativo del panel Didit (`/organization/users/export`), fichero descargado como `124bbadb-3683-44f2-bc41-c08eb740f164.csv`.

## Tabla de usuarios (14 filas)

Ordenada por `last_session_at` descendente. Solo columnas informativas — el CSV original tenía 41 columnas, la mayoría vacías (address, phone, email, payment_method_*, VPN/datacenter flags).

| vendor_data (nuestro `smc:userId`) | didit_internal_id (UUID vendor) | full_name (si subió DNI) | DOB | sesiones (total/OK/pending) | doc types | doc country | created_at → last_session_at |
|---|---|---|---|---|---|---|---|
| `smc:96`  | 5ba72431-badf-4bc7-9f50-b975ae5fb3a3 | — | — | 1 / 1 / 0 | — | — | 2026-07-12 19:18 |
| `smc:102` | 6140b153-f5a9-4b7c-b098-4c54412dd65b | — | — | 1 / 1 / 0 | — | — | 2026-07-12 18:14 |
| `smc:101` | 1e683f78-8fe5-4cd1-b9e8-eb9e478a03f1 | — | — | 1 / 1 / 0 | — | — | 2026-07-12 13:57 |
| `smc:30`  | cb9e370d-8772-4845-9213-1b2f0f63ae05 | — | — | 1 / 1 / 0 | — | — | 2026-07-09 22:04 |
| `smc:12`  | ae54891c-22f4-4c77-a8ee-1c29f62b9ddd | — | — | 1 / 1 / 0 | — | — | 2026-06-28 19:34 |
| `smc:27`  | 10302701-e883-4483-94bd-2aaa0978d19a | Alain Garmendia Martinez | 1977-05-05 | 3 / 2 / 1 | DL + ID | ESP | 2026-06-20 18:07 → 21:41 |
| `smc:28`  | e30a71c8-7110-416d-9f75-d15ff5cb7bbf | Alain Garmendia Martinez | 1977-05-05 | 1 / 1 / 0 | DL       | ESP | 2026-06-20 20:57 |
| `smc:22`  | 5fbe48da-b92b-4c69-a4aa-a805c3ce0506 | — | — | 1 / 1 / 0 | — | — | 2026-06-20 17:25 |
| `smc:89`  | e445922a-3969-4ada-b981-f04bf1b1f0d6 | — | — | 1 / 1 / 0 | — | — | 2026-06-20 10:13 |
| `smc:97`  | 1555d8bd-a650-4339-8343-fb47700a84a1 | Alain Garmendia Martinez | 1977-05-05 | 1 / 1 / 0 | ID       | ESP | 2026-06-19 23:00 |
| `smc:95`  | 7d14b6e8-f9c3-4e28-b0bf-29dbaff765b5 | — | — | 1 / 1 / 0 | — | — | 2026-06-14 19:59 |
| `smc:90`  | e22a7a96-3659-477b-8ec5-c14119b6704c | — | — | 2 / 2 / 0 | — | — | 2026-06-14 13:06 → 18:59 |
| `smc:88`  | 15ed5eae-a1a8-48bd-9888-7c927426e669 | — | — | 1 / 1 / 0 | — | — | 2026-06-14 12:20 |
| `smc:87`  | acedb976-4f4d-4aa0-919c-ca54d1fbb3e1 | Alain Garmendia Martinez | 1977-05-05 | 2 / 2 / 0 | ID       | ESP | 2026-06-13 23:10 → 2026-06-14 00:10 |

## Observaciones

- **Prefijo `smc:`** en `vendor_data` es lo que pasamos al vendor como identificador nuestro (nuestro `user_id` con prefijo). Ver `DiditKycAdapter` en el backend.
- **`smc:userId` NO distingue entorno**. Las cuentas 87–102 vienen de sesiones de TEST/AUDIT y PROD indistintamente. Para saber a qué entorno pertenece cada sesión hay que cruzar con `kyc_sessions.provider_session_id = didit_internal_id` en la BD del entorno correspondiente. Todas las BD locales están conservadas (política del operador 2026-07-19).
- **4 sesiones con datos personales reales** del operador (nombre + DOB + documento español). El resto son sesiones interrumpidas o de smoke test (solo se creó el `session_id` sin subir ni cara ni doc).
- **Localización uniforme**: todo desde Donostia / San Sebastián, iPhone Apple. No hay tráfico anómalo.
- **VPN / datacenter**: `has_vpn_or_tor = False` y `has_datacenter = False` en las 14 filas (esperado, son pruebas locales sin VPN).
- **Estado global**: 14/14 `ACTIVE` en Didit al momento del snapshot. El status "ACTIVE" en el panel Didit no es lo mismo que "APPROVED KYC" — indica que el usuario existe como recurso en el panel; los approved_count (mayormente 1) es lo que refleja verificaciones cerradas OK.

## Correspondencia con nuestra BD (guía para reconstrucción futura si hiciera falta)

Si algún día quisiéramos volver a mirar qué implica cada sesión Didit:

```sql
-- Reemplazar <internal_id> por el UUID de la tabla de arriba.
SELECT ks.id, ks.user_id, ks.provider_session_id, ks.provider_status,
       ks.kyc_status, ks.session_type, ks.decided_at, ks.created_at
FROM kyc_sessions ks
WHERE ks.provider = 'didit'
  AND ks.provider_session_id = '<internal_id>';
```

Y para los webhooks asociados:

```sql
SELECT id, event_type, is_processed, received_at
FROM kyc_webhook_events
WHERE provider = 'didit'
  AND provider_session_id = '<internal_id>'
ORDER BY received_at ASC;
```

Ejecutar en el entorno correcto (TEST/AUDIT/PROD según toque). El túnel RDS + credenciales están documentados en `docs/04-operations/access-and-tooling.md`.

## Política a partir de 2026-07-19

- El panel Didit queda limpio a partir de esta fecha.
- Las nuevas sesiones que aparezcan en el panel Didit **son verificaciones reales de PROD** (o pruebas legítimas de TEST/AUDIT limpiadas periódicamente).
- Si vuelve a acumularse ruido de pruebas (p.ej. testing de un nuevo flujo), se hace otro snapshot como este antes de limpiar. Nomenclatura: `didit-vendor-users-snapshot-YYYY-MM-DD.md` en esta misma carpeta.
- Las BD locales (`kyc_sessions`, `kyc_webhook_events`) NO se tocan en estas limpiezas — se conservan por entorno como paper trail interno.
