# Skill: state-diff

## Propósito

Detectar drift entre un snapshot de estado de un entorno y la documentación narrativa que describe ese mismo entorno, y aplicar ediciones puntuales tras aprobación del usuario.

La skill cierra el ciclo del sistema documental definido en ADR-017: los snapshots tienen autoridad sobre los hechos crudos del sistema; la prosa de `docs/` se actualiza para coincidir con los snapshots, no al revés.

## Cuándo usar esta skill

Después de generar un snapshot reciente con `state-inventory`, cuando se quiera verificar que la prosa de `docs/03-environments/<env>.md` coincide con la realidad capturada.

Habitualmente se invoca al cerrar un frente técnico o antes de nivelar un entorno.

## Cuándo NO usar esta skill

- No usar para auditar prosa narrativa subjetiva (decisiones, contexto, runbooks). Eso es responsabilidad humana, no mecánica.
- No usar para detectar drift entre entornos distintos (ej. TEST vs AUDIT). Los entornos son diferentes por diseño; comparar entre ellos genera ruido.
- No usar para escribir ADRs o nueva documentación. Esta skill solo edita prosa existente.

## Inputs requeridos

- `environment`: identificador del entorno (`test`, `audit`, `pro`).
- `snapshot_path` (opcional): ruta al snapshot YAML. Si no se pasa, la skill busca el más reciente en `docs/_snapshots/state-<env>-*.yaml`.
- `target_doc` (opcional): ruta al fichero de docs. Por defecto `docs/03-environments/<env>.md`.

## Output

La skill NO produce un fichero. Produce un flujo conversacional que termina con:

- Un resumen inicial con la lista de drifts detectados.
- Una secuencia de preguntas individuales (una por drift).
- Las ediciones aplicadas directamente sobre `target_doc` cuando el usuario aprueba.

Al finalizar, deja un resumen de qué se aplicó y qué se rechazó.

## Procedimiento

### Paso 1 — Cargar el snapshot

Localizar el snapshot del entorno:

- Si el usuario proporciona `snapshot_path`, usarlo.
- Si no, listar `docs/_snapshots/state-<environment>-*.yaml`, ordenar por fecha (parte `YYYY-MM-DD-HHMM` del nombre), y tomar el más reciente.

Validar que el campo `metadata.environment` del snapshot coincide con el entorno solicitado. Si no coincide, abortar.

Cargar el YAML en memoria. Extraer los siguientes "hechos" para uso posterior:

```
hechos = {
  "cloudfront_cache_behaviors_count": <número de behaviors>,
  "cloudfront_cache_behavior_paths": [<lista de path_patterns>],
  "cloudfront_default_function_associations": [<lista de nombres>],
  "cloudfront_custom_error_codes": [<lista de error_codes>],
  "ec2_systemd_services": [<lista de nombres>],
  "ec2_nginx_location_paths": [<lista de paths>],
  "ec2_client_max_body_size": <valor>,
  "rds_mysql_version": <versión>,
  "rds_schema_name": <nombre>,
  "rds_content_articles_states": [<lista>],
  "rds_content_articles_state_default": <valor>,
  "rds_content_articles_rows_total": <int>,
  "rds_content_articles_rows_by_state": {<state>: <int>, ...},
  "rds_event_types": [<lista>],
  "repo_branch": <string>,
  "repo_jar_version": <string>
}
```

### Paso 2 — Leer el fichero de docs

Cargar el contenido de `target_doc` línea a línea. Si no existe, abortar con mensaje claro.

Mantener el contenido como lista de líneas (con número de línea preservado) para poder reportar exactamente dónde está cada drift.

### Paso 3 — Detectar drift con los 4 patrones

Recorrer cada línea del documento aplicando los siguientes patrones. Para cada match, comparar contra los hechos del snapshot. Si hay discrepancia, registrar como drift candidato.

#### Patrón 1 — Lista literal de valores enumerables

Detección: regex que busca listas de identificadores en mayúsculas separados por comas, posiblemente entre backticks o comillas.

```
Regex (Python): r"`?\b([A-Z][A-Z_]{2,}(?:\s*,\s*`?[A-Z][A-Z_]{2,}`?){1,})\b"
```

Para cada match:
- Extraer la lista de identificadores de la línea.
- Comparar con cada lista de hechos enumerables del snapshot (estados de artículo, event_types, paths de cache behaviors si vinieran en mayúsculas, servicios systemd).
- Si la línea menciona una categoría reconocible (heurística por contexto cercano: palabras como "estados", "transiciones", "event_type", "cache behaviors"), comparar con la lista correspondiente.
- Si hay diferencia (lista de docs distinta de lista de snapshot), registrar drift.

Ejemplos:

```
Doc: "Estados modelados: IDEA, OUTLINE_READY, DRAFT_GENERATED, IN_REVIEW, APPROVED, PUBLISHED."
Snapshot: rds_content_articles_states = [DRAFT, IN_REVIEW, PUBLISHED, RETRACTED, SCHEDULED]
→ Drift detectado.
```

#### Patrón 2 — Cuentas numéricas

Detección: regex que busca números seguidos de un sustantivo conocido del esquema del snapshot.

```
Regex: r"(\d+)\s+(cache\s+behaviors|location\s+blocks|art[íi]culos|servicios\s+systemd|migraciones)"
```

Para cada match:
- Extraer el número y el sustantivo.
- Mapear el sustantivo al campo correspondiente del snapshot.
- Comparar.
- Si discrepa, registrar drift.

Ejemplos:

```
Doc: "Hay 6 cache behaviors en CloudFront TEST."
Snapshot: cloudfront_cache_behaviors_count = 8
→ Drift detectado.
```

#### Patrón 3 — Versiones de software

Detección: regex que busca menciones de versiones con formato semver.

```
Regex: r"\b(MySQL|MariaDB|Java|Spring\s+Boot|Node\.?js|nginx)\s+(\d+(?:\.\d+){0,2})"
```

Para cada match:
- Extraer producto y versión.
- Mapear a un campo del snapshot (mysql_version, jar_version, etc.).
- Comparar string a string.
- Si discrepa, registrar drift.

Ejemplos:

```
Doc: "TEST corre MySQL 8.0."
Snapshot: rds_mysql_version = "8.4.7"
→ Drift detectado (versión menor diferente).
```

#### Patrón 4 — Valores de configuración explícitos

Detección: regex que busca pares clave: valor con campos conocidos.

```
Regex: r"\b(client_max_body_size|state\s+default|jar\s+version|expected_filename)\s*[:=]\s*[`\"']?([^\"'\n,]+?)[`\"']?\s*(?:[\.\,\;]|$)"
```

Para cada match:
- Extraer clave y valor.
- Mapear la clave al campo del snapshot.
- Comparar.
- Si discrepa, registrar drift.

Ejemplos:

```
Doc: "Configuración nginx: client_max_body_size: 50M."
Snapshot: ec2_client_max_body_size = "60M"
→ Drift detectado.
```

### Paso 4 — Filtrar falsos positivos

Algunos drifts detectados pueden ser ambiguos. Antes de presentarlos al usuario, descartar:

- Listas de identificadores en mayúsculas que NO coincidan con ninguna categoría conocida del snapshot (probablemente son nombres de variables, constantes, o algo no inventariado).
- Cuentas numéricas que aparecen en bloques de código (delimitados por triple backtick), porque suelen ser ejemplos.
- Versiones que aparecen en bloques de código por la misma razón.
- Líneas dentro de tablas Markdown que comparen explícitamente "antes vs después" (heurística: si la línea contiene la palabra "antes" o "histórico" cerca, probablemente es contexto histórico legítimo, no drift).
- Cualquier match dentro de bloques de cita HTML/Markdown marcados como históricos (`<!-- historical -->`, etc.).

Si tras filtrar no queda ningún drift, terminar con mensaje "Sin drift detectado en `<target_doc>` respecto al snapshot `<snapshot_path>`."

### Paso 5 — Presentar resumen inicial al usuario

Mostrar:

```
N puntos de drift detectados entre snapshot <ruta> y <target_doc>.

Resumen:
  [1] Línea 47 — Lista de estados de artículo
  [2] Línea 52 — Cuenta de cache behaviors
  [3] Línea 89 — Versión de MySQL
  ...

Procederé a preguntar uno a uno. Para cada drift puedes responder:
  - "s" o "sí"  → aplicar la edición
  - "n" o "no"  → no aplicar, dejar la prosa como está
  - "skip"      → revisar más tarde (no aplicar pero marcar)
```

### Paso 6 — Iterar drift por drift

Para cada drift detectado, mostrar:

```
[i/N] Línea <num>:
  Actual:    <texto exacto de la línea>
  Propuesta: <línea modificada con el valor del snapshot>
  Origen:    snapshot.<ruta_del_campo>
  
  ¿Aplicar? [s/n/skip]
```

Esperar respuesta del usuario. Según la respuesta:

- `s`: aplicar la edición sobre `target_doc` modificando esa línea exacta. Marcar como APLICADO.
- `n`: no editar. Marcar como RECHAZADO.
- `skip`: no editar. Marcar como PENDIENTE_REVISION.

Pasar al siguiente drift.

### Paso 7 — Aplicar cambios y resumen final

Tras procesar todos los drifts, escribir `target_doc` modificado en disco.

Mostrar resumen final:

```
state-diff completado.

Aplicados:        X
Rechazados:       Y
Pendientes:       Z

Fichero modificado: <ruta>
Líneas modificadas: <lista de números>

Siguiente paso para el usuario:
  1. Revisar el diff con: git diff <ruta>
  2. Si convence, git add + commit.
  3. Si algo no convence, descartar con: git checkout -- <ruta>
```

NO hacer git commit. NO pushear. La revisión humana del diff es invariante.

## Errores conocidos y mitigaciones

### Snapshot no encontrado

Si no hay ningún fichero `state-<env>-*.yaml` en `docs/_snapshots/`, abortar con mensaje: "No hay snapshot para entorno <env>. Genera uno con la skill state-inventory primero."

### target_doc no existe

Si el fichero de docs no existe, abortar con: "El fichero <ruta> no existe. La skill state-diff v1 solo opera sobre ficheros existentes; no crea documentación nueva."

### Snapshot con dominios PARCIAL

Si el snapshot tiene `metadata.notes` indicando dominios parciales (ej. "RDS no inventariado: túnel SSH no disponible"), avisar al usuario al inicio:

```
Atención: el snapshot está marcado como PARCIAL en los siguientes dominios: <lista>.
Los hechos de esos dominios NO se compararán. ¿Continuar igualmente? [s/n]
```

### Línea ambigua durante aplicación

Si tras aplicar un cambio la línea resultante es sintácticamente extraña (markdown roto, bloque de código sin cerrar), revertir el cambio en esa línea concreta y registrar como APLICADO_CON_AVISO. Reportar al final.

### Conflicto entre múltiples drifts en la misma línea

Si dos drifts apuntan a la misma línea, presentarlos juntos como un único item compuesto:

```
[i/N] Línea <num> (2 cambios):
  Actual:    <texto>
  Propuesta: <texto con ambos cambios aplicados>
  ...
```

## Limitaciones conocidas (deuda explícita para v1.1+)

- No detecta drift en parafraseo libre ni hechos compuestos en prosa larga.
- No detecta drift que requiera inferencia ("el backend se gestiona manualmente").
- No detecta drift en otros ficheros que no sean `target_doc`.
- No detecta drift introducido por listas con valores hetereogéneos (mezcla mayúsculas y minúsculas, números y strings).
- No reescribe párrafos enteros, solo líneas.
- No reordena listas si el orden interno difiere pero los valores son iguales.

Estas limitaciones son aceptables para v1: la skill prioriza precisión (no aplicar cambios incorrectos) sobre cobertura (detectar todos los drifts posibles).

## Versión

Esta skill es `state-diff@v1`. Cambios significativos requieren bump y nota en este apartado.
