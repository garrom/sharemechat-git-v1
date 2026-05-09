# ADR-017 — Coexistencia de snapshots de estado y documentación narrativa

## Estado

Propuesta (pendiente de aprobación del owner).

Si se aprueba, **complementa `documentation-governance.md`** añadiendo dos casos nuevos (skill operativa y snapshot de estado) y aclara la división de responsabilidades entre `docs/_snapshots/` y el resto de `docs/`.

## Contexto

El proyecto SharemeChat ha mantenido históricamente toda su documentación durable en `docs/` organizada por dominios narrativos (`01-business/` a `07-roadmap/`). Esa documentación mezcla dos tipos de contenido muy distintos:

1. **Hechos crudos del sistema** — listas de cache behaviors de CloudFront, lista de `location` blocks de nginx, valores actuales de `CHECK` constraints en BD, versiones de software, conteos de filas, etc.
2. **Narrativa, contexto y decisiones** — por qué se decidió cada cosa, qué deuda se tolera, qué viene después, cómo opera cada entorno, runbooks.

Esa mezcla genera dos problemas reales y observados durante 2026-04 y 2026-05:

- **Drift constante**: los hechos crudos cambian con cada deploy, cada ajuste de nginx o cada migración SQL. La prosa narrativa que los menciona se queda desactualizada y nadie se entera hasta que aparece una incidencia.
- **Auditorías post-hoc no escalan**: la solución intentada hasta ahora ha sido auditar puntualmente la documentación contra el código (`docs/_audit/doc-vs-code-gap-2026-05-07.md` y similares). Cada auditoría confirma que la documentación está desactualizada — y vuelve a estarlo en una semana.

El 2026-05-09 se introdujo un nuevo sistema de **snapshots estructurados de estado** (skill `state-inventory` en `docs/skills/state-inventory.md`, ficheros YAML en `docs/_snapshots/`). Los snapshots son fuente de verdad fáctica: lista de cache behaviors, lista de estados que admite el `CHECK`, etc. Se generan con un agente que ejecuta comandos reales contra el sistema (AWS CLI, SSH a EC2, MySQL Shell vía túnel) y producen YAML saneado de IDs sensibles.

Con la introducción de los snapshots aparece una pregunta legítima: **¿son `/docs/` y los snapshots dos formas de hacer lo mismo, o son cosas distintas?** Si son lo mismo, hay que migrar y eliminar redundancia. Si son distintas, hay que dejar claras sus responsabilidades para que la convivencia no genere más confusión que la que resuelve.

Este ADR cierra esa decisión.

## Decisión

### D1 — Snapshots y documentación narrativa coexisten con responsabilidades disjuntas

Los snapshots de estado y la documentación narrativa de `docs/` **conviven** como dos capas independientes y complementarias, con autoridad clara sobre dominios distintos:

| Capa | Pregunta que responde | Forma | Fuente de verdad sobre |
|---|---|---|---|
| **Snapshots (`docs/_snapshots/`)** | "¿qué hay AHORA en el sistema?" | YAML estructurado, generado por agente | Hechos crudos del sistema: configuraciones, valores, conteos, versiones, listas de elementos. |
| **Documentación narrativa (resto de `docs/`)** | "¿por qué está así? ¿qué deberíamos hacer? ¿cómo opera? ¿cuál es el plan?" | Prosa Markdown escrita por humano o IA | Decisiones, contexto, razones, planificación, runbooks, modelos de negocio, gobierno. |

Ninguna de las dos capas puede sustituir a la otra. Un snapshot nunca explica el porqué; un ADR nunca refleja el estado actual del sistema.

### D2 — Autoridad clara sobre datos fácticos: el snapshot manda

Cuando un dato fáctico aparece simultáneamente en un snapshot y en un fichero de `docs/` (por ejemplo, "TEST corre MySQL 8.4.7" o "el `CHECK` admite estados X, Y, Z"):

- **El snapshot tiene autoridad.** Es la captura directa del sistema real.
- La prosa narrativa puede mencionar el dato si aporta contexto, pero NO es la fuente de verdad. Es derivada.
- En caso de discrepancia, la prosa se actualiza para coincidir con el snapshot, no al revés.

Esto significa que `docs/03-environments/test.md` y similares deben **adelgazar** progresivamente: quitar listas exhaustivas de configuraciones, valores y conteos, y dejar solo la narrativa operacional ("TEST se levanta y apaga manualmente cada día", "TEST se usa para validar Frente N", etc.).

La limpieza no se hace de golpe. Se hace cuando la skill `state-diff` (futura) detecte drift y proponga ediciones concretas. Hasta entonces, `docs/` puede contener datos crudos que se sustituyen progresivamente.

### D3 — La pieza que cierra el ciclo: skill `state-diff`

Para que la convivencia funcione operativamente y no genere drift silencioso, hace falta una skill complementaria a `state-inventory` que detecte cuándo la prosa de `docs/` ha quedado desincronizada respecto a un snapshot reciente.

Esta skill, llamada **`state-diff`** (pendiente de implementación), opera de la siguiente forma:

1. Lee el snapshot más reciente del entorno objetivo.
2. Lee los ficheros de `docs/` que mencionen ese entorno (típicamente `03-environments/<env>.md`, parte de `02-architecture/`, etc.).
3. Para cada hecho fáctico citado en la prosa, comprueba si coincide con el snapshot.
4. Cuando hay drift, propone ediciones concretas a la prosa (no las aplica automáticamente).

`state-diff` es lo que evita que la documentación se pudra. Sin esa pieza, los snapshots son útiles pero pasivos: sirven para inspección manual pero no cierran el ciclo.

### D4 — Estructura nueva en `docs/`

Tras este ADR, `docs/` queda con esta estructura:

docs/
├── 00-context/           ← narrativa de alto nivel (sin cambio)
├── 01-business/          ← negocio (sin cambio)
├── 02-architecture/      ← arquitectura: prosa, sin datos crudos
├── 03-environments/      ← descripciones operativas, sin tablas de configs
├── 04-operations/        ← runbooks, incident-notes, known-debt (sin cambio)
├── 05-backoffice/        ← prosa de backoffice
├── 06-decisions/         ← ADRs (sin cambio)
├── 07-roadmap/           ← roadmap (sin cambio)
├── _audit/               ← auditorías puntuales históricas (deuda: registrar en governance o archivar)
├── _snapshots/           ← NUEVO: snapshots YAML de estado por entorno
├── skills/               ← NUEVO: skills operativas ejecutables por agentes
├── cms/skills/           ← skills editoriales del CMS (sin cambio)
└── templates/            ← plantillas 

Las dos carpetas nuevas (`_snapshots/` y `skills/`) deben quedar registradas en `documentation-governance.md` y en el README raíz de `docs/`.

### D5 — Gobierno actualizado: dos casos nuevos

`documentation-governance.md` se amplía con dos casos nuevos sobre los siete actuales:

**Caso 8 — Skill operativa nueva o modificada**
Ejemplos: skill que inventaría estado, skill que detecta drift, skill que despliega un componente.
Acción: ubicar en `docs/skills/<nombre>.md` (o `docs/cms/skills/<nombre>.md` si es skill editorial). Documentar versión y procedimiento dentro del propio fichero. Si la skill es estructural (cambia cómo se documenta o se opera el sistema), abrir ADR.

**Caso 9 — Snapshot de estado del sistema**
Ejemplos: inventariado periódico de un entorno, snapshot pre/post cambio para validar diff.
Acción: el snapshot va a `docs/_snapshots/state-<env>-<YYYY-MM-DD-HHMM>.yaml`. Es generado por skill, NO se edita a mano. Los snapshots SÍ se versionan en git (no contienen IDs sensibles porque la skill aplica saneado lógico).

### D6 — Saneado de los snapshots como invariante

Los snapshots versionados en git NO pueden contener:

- IDs reales de CloudFront, ARNs, IPs públicas.
- Hostnames RDS reales, security group IDs, account IDs.
- Cualquier identificador sensible de infraestructura.

La traducción de IDs reales a aliases lógicos se hace mediante una tabla de mapeo que vive **fuera del repo** (`~/.sharemechat/state-mapping.yaml`). Esta tabla NO se commitea bajo ningún concepto.

Esta invariante existe desde la primera versión de `state-inventory` y queda elevada a regla del gobierno en este ADR.

## Consecuencias

### Positivas

- **Drift detectable mecánicamente**: `state-diff` (cuando exista) cierra el ciclo y elimina la dependencia de auditorías humanas puntuales.
- **Responsabilidades claras**: el equipo deja de discutir si tal dato va en `test.md` o en otro sitio; la respuesta es siempre "los hechos al snapshot, las razones a la prosa".
- **Saneado garantizado por construcción**: ningún ID sensible llega al repo, sin depender de revisión manual.
- **Carpetas nuevas registradas desde el inicio**: no se repite el problema de `_audit/` huérfana sin governance.
- **Compatibilidad con cualquier entorno**: el mismo modelo aplica a TEST, AUDIT y PRO sin cambios.

### Negativas

- **Pieza pendiente**: `state-diff` no existe todavía. Mientras no exista, la convivencia funciona pero el drift se sigue detectando manualmente. Es deuda explícita.
- **Limpieza progresiva de `docs/`**: parte de la prosa actual contiene datos crudos que ahora pertenecen al snapshot. Esa migración se hace gradualmente conforme `state-diff` la sugiera, no de golpe; hasta entonces, hay redundancia tolerada.
- **Dos lugares que mirar**: para entender el estado de un entorno hay que ir al snapshot; para entender el porqué hay que ir a `docs/`. Es un coste cognitivo aceptable a cambio de la claridad de responsabilidades, pero coste al fin.

### Neutras

- **Auditorías puntuales (`docs/_audit/`)** quedan como práctica residual. Se mantiene la carpeta como histórico, pero la auditoría continua pasa a ser responsabilidad de `state-diff` cuando exista. Decidir más adelante si `_audit/` se integra al governance o se archiva.

## Plan de implementación

1. **Aprobación de este ADR** por el owner.
2. **Registro en governance**: actualizar `documentation-governance.md` con casos 8 y 9 (D5).
3. **Registro en README raíz**: añadir `_snapshots/` y `skills/` a la sección "Cómo navegar".
4. **Skill `state-diff` v1**: pendiente de redactar como pieza independiente. ADR-017 NO la diseña en detalle; solo la nombra como pieza necesaria.
5. **Limpieza progresiva de `docs/`**: comienza cuando `state-diff` esté operativa y proponga ediciones concretas. No se planifica antes.
6. **Validación**: la primera ejecución de `state-diff` sobre TEST debe producir al menos una propuesta de edición sobre `docs/03-environments/test.md`. Si no produce ninguna, es señal de que la skill no funciona o de que `test.md` ya está totalmente actualizado (poco probable).

## Decisiones explícitamente fuera de alcance

Este ADR **no decide** sobre:

- El contenido específico de la skill `state-diff` (su esquema, sus reglas de comparación, etc.). Eso será otro ADR cuando se diseñe.
- La migración masiva de prosa a YAML. No habrá migración masiva: la prosa narrativa sigue siendo prosa.
- El destino futuro de `docs/_audit/`: pendiente de revisar al construir `state-diff`.
- La automatización del túnel SSH a RDS, la persistencia de `RDS_PASSWORD`, o el flujo operativo de `state-inventory`. Eso son optimizaciones operativas, no decisiones arquitectónicas.

## Referencias

- `docs/skills/state-inventory.md` — skill v1 que produce los snapshots.
- `docs/_snapshots/state-test-2026-05-09-*.yaml` — primeros snapshots reales de TEST.
- `docs/04-operations/known-debt.md` — deudas detectadas por la primera ejecución (incluye registrar `_snapshots/` y `skills/` en governance).
- `documentation-governance.md` — gobierno documental general (a actualizar tras este ADR).
- ADR-016 — Workflow editorial simplificado (precedente del patrón "ADR cierra alcance + skills implementan").
