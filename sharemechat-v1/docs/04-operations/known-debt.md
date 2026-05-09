# Deudas técnicas conocidas

Registro de deudas detectadas durante operación o auditoría que no son incidencias urgentes pero conviene no perder. Cuando una deuda se cierre, mover su sección a `incident-notes.md` con marca de resolución y eliminar de aquí.

## 2026-05-09 — Detectadas durante primer inventariado de TEST con skill state-inventory

### sharemechat-test-access-blocker.service en estado failed

**Origen**: snapshot `state-test-2026-05-09-1002.yaml`. La skill filtra solo `--state=active,inactive`, así que el `failed` no entró al snapshot, pero el agente lo detectó en una verificación lateral.

**Hecho**: la unit `sharemechat-test-access-blocker.service` en EC2 TEST está en estado `failed`. Se desconoce desde cuándo y por qué.

**Impacto**: el blocker DRY-RUN de TEST documentado en `incident-notes.md` ("Despliegue del blocker en TEST (modo DRY-RUN)") no está corriendo como debería. No es bloqueante porque TEST está en DRY_RUN=1 (no afecta a tráfico real), pero indica que las salidas advisory diarias dejaron de generarse en algún momento.

**Acción pendiente**: revisar `sudo journalctl -u sharemechat-test-access-blocker -n 100` en EC2 TEST para entender la causa del fallo. Decidir si reactivar (corregir lo que falle y `systemctl restart`) o si la unit puede deprecarse.

**Prioridad**: baja. No afecta a tráfico productivo ni a operación normal.

### Cache policy subóptima para /.well-known/acme-challenge/* en CloudFront TEST

**Origen**: snapshot `state-test-2026-05-09-1002.yaml`, sección `cloudfront.cache_behaviors`.

**Hecho**: la cache behavior `/.well-known/acme-challenge/*` en la distribución CloudFront TEST tiene `cache_policy: Managed-CachingOptimized`.

**Impacto**: lo correcto sería `Managed-CachingDisabled` para que certbot vea respuestas frescas durante validaciones ACME. En la práctica funciona porque `Managed-CachingOptimized` honra el `Cache-Control` del origen, pero deja un margen de error si el origen alguna vez no envía esa cabecera.

**Acción pendiente**: cambiar la cache behavior a `Managed-CachingDisabled` en el próximo cambio CloudFront que toque la distribución TEST. Validar que también AUDIT y PRO siguen el mismo patrón cuando se inventaríen.

**Prioridad**: baja. Validar también en AUDIT y PRO al hacer la nivelación.

### Campo flyway_table_present semánticamente engañoso en schema v1 de state-inventory

**Origen**: snapshot `state-test-2026-05-09-1002.yaml`, decisión documentada por el agente.

**Hecho**: el schema v1 de la skill `state-inventory` incluye el campo `rds_database.flyway_table_present: <bool>`. Para SharemeChat ese campo es siempre `false` porque las migraciones se aplican a mano desde `src/main/resources/db/manual/`. El campo registra correctamente que NO hay Flyway runtime, pero no captura que sí hay versionado SQL manual.

**Impacto**: cualquiera que lea un snapshot sin contexto puede interpretar `flyway_table_present: false` como "no hay versionado de schema", cuando en realidad sí lo hay (manual).

**Acción pendiente**: en la versión 1.1 del schema de la skill, sustituir `flyway_table_present` por algo más expresivo, por ejemplo:

```yaml
schema_versioning:
  flyway_runtime_present: <bool>      # ¿hay tabla flyway_schema_history?
  manual_migrations_dir: <ruta>       # carpeta donde se versiona el SQL manual
  last_manual_migration: <filename>   # último fichero aplicado según convención
```

Coordinar el cambio con un bump de `metadata.schema_version: 2`.

**Prioridad**: media. Hacer al introducir cualquier otra mejora de la skill (por ejemplo, `expected_to_be_running` o validación de TZ explícita).

## 2026-05-09 — Detectadas durante segundo inventariado de TEST

### Backend de TEST sin gestión systemd

**Origen**: snapshot `state-test-2026-05-09-1014.yaml`, confirmado tras arranque manual.

**Hecho**: el JAR de backend en TEST corre como proceso de `ec2-user` sin unit systemd asociada. Tras un reboot de la EC2, el backend no se relanza automáticamente.

**Impacto**: por diseño (TEST se levanta y apaga manualmente cada día). No es deuda técnica que rompa nada hoy. Documentar como dato operativo sirve para que cualquier nueva persona que mire la EC2 entienda por qué los snapshots pueden capturar al backend "apagado" sin que sea un incidente.

**Acción pendiente**: documentar explícitamente en `docs/03-environments/test.md` que el backend en TEST se gestiona manualmente, no con systemd, a diferencia de AUDIT y PRO. Revisar también si conviene meter `expected_to_be_running: false` en el mapping de TEST cuando se aborde el schema v2 de la skill.

**Prioridad**: baja. Es información, no problema.

### Carpetas docs/skills/ y docs/_snapshots/ no registradas en governance

**Origen**: trabajo de skill state-inventory de 2026-05-09.

**Hecho**: se han introducido dos carpetas nuevas en el repo:
- `docs/skills/`: aloja skills operativas (no editoriales) ejecutables por agentes.
- `docs/_snapshots/`: aloja snapshots estructurados de estado generados por state-inventory.

Ninguna está registrada en `documentation-governance.md` ni en el README raíz de docs.

**Impacto**: replicaríamos el problema detectado con `docs/_audit/` (carpeta huérfana sin governance) si no se cierra.

**Acción pendiente**:
1. Actualizar `documentation-governance.md` añadiendo dos casos nuevos:
    - "Caso 8 — Skill operativa nueva → docs/skills/<nombre>.md"
    - "Caso 9 — Snapshot de estado del sistema → docs/_snapshots/state-<env>-<timestamp>.yaml"
2. Actualizar README raíz incluyendo ambas carpetas en la sección "Cómo navegar".

**Prioridad**: media. Hacer antes de generar más snapshots o crear más skills, para mantener el corpus coherente.

