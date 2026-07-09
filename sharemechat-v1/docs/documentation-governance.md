# Gobierno documental y de decisión - SharemeChat

## Propósito

Este documento define cómo mantener la documentación del proyecto y cómo registrar cambios técnicos, operativos y de arquitectura de forma consistente.

La documentación del repositorio principal debe contener conocimiento funcional, técnico y operativo durable, pero no inventario sensible exhaustivo de infraestructura.

## Regla principal

Antes de modificar o crear documentación, identificar primero la naturaleza real del cambio o hallazgo.

## Clasificación del caso

### Caso 1. Cambio de arquitectura o diseño técnico
Ejemplos:
- cambio de flujo backend
- cambio en realtime
- cambio de estrategia de storage
- cambio en autenticación
- cambio en separación de superficies o entornos

Acción:
- actualizar el documento de arquitectura correspondiente en `docs/02-architecture/`
- si la decisión es relevante o con impacto duradero, crear o actualizar ADR en `docs/06-decisions/`

### Caso 2. Cambio de comportamiento de un entorno
Ejemplos:
- TEST y AUDIT dejan de comportarse igual
- se despliega nueva topología
- cambia el estado de AUDIT
- cambia una limitación de PRODUCTION

Acción:
- actualizar `docs/03-environments/`
- si afecta a planificación o fases, actualizar también `docs/07-roadmap/`

### Caso 3. Incidencia, anomalía o problema detectado
Ejemplos:
- deep-link falla en AUDIT
- WebSocket no está alineado con la intención de entorno
- fallback SPA es inconsistente
- error operativo repetible

Acción:
- registrar el caso en `docs/04-operations/incident-notes.md`
- si sigue existiendo riesgo o deuda, reflejarlo también en `docs/04-operations/known-risks.md`

### Caso 4. Problema resuelto
Ejemplos:
- una incidencia ya está corregida
- una divergencia de entorno ya quedó alineada
- un riesgo ya no aplica

Acción:
- actualizar el documento donde se describía el problema
- dejar constancia de resolución en `incident-notes.md`
- ajustar o retirar el punto correspondiente de `known-risks.md` si ya no aplica
- actualizar arquitectura o entorno si la solución cambia la realidad del sistema

### Caso 5. Cambio funcional o de negocio
Ejemplos:
- cambia el rol real de USER
- cambia onboarding de CLIENT o MODEL
- cambia lógica de wallet, gifts o compliance
- cambia alcance del backoffice

Acción:
- actualizar `docs/01-business/`
- actualizar `docs/05-backoffice/` si aplica
- actualizar `docs/02-architecture/` si el cambio funcional implica cambio técnico real

### Caso 6. Decisión estructural importante
Ejemplos:
- adoptar nueva estrategia de despliegue
- sustituir integración externa
- cambiar patrón de seguridad
- rehacer arquitectura realtime
- introducir un nuevo entorno

Acción:
- crear ADR nuevo en `docs/06-decisions/`
- después actualizar la documentación de estado y arquitectura afectada

### Caso 7. Estado de fase, deuda o siguiente etapa
Ejemplos:
- fase actual cambia
- se completa una etapa
- aparece una nueva prioridad
- se redefine el plan de hardening
- AUDIT entra en nueva fase

Acción:
- actualizar `docs/07-roadmap/current-phase.md`
- actualizar `docs/07-roadmap/pending-hardening.md` o `audit-environment-plan.md` si aplica

### Caso 8. Skill operativa nueva o modificada
Ejemplos:
- skill que inventaría estado de un entorno
- skill que detecta drift entre docs y realidad
- skill que despliega un componente operativo

Acción:
- ubicar en `docs/state-inventory-skills/<nombre>.md` (o `docs/cms/skills/<nombre>.md` si es skill editorial)
- documentar versión y procedimiento dentro del propio fichero de la skill
- si la skill cambia cómo se documenta o se opera el sistema, abrir ADR

### Caso 9. Snapshot de estado del sistema
Ejemplos:
- inventariado periódico de un entorno (TEST, AUDIT, PROD)
- snapshot pre/post cambio para validar diff
- snapshot tras cierre de un frente

Acción:
- ubicar en `docs/_snapshots/state-<env>-<YYYY-MM-DD-HHMM>.yaml`
- generado por skill, NO se edita a mano
- los snapshots SÍ se versionan en git (la skill aplica saneado lógico de IDs sensibles)
- la tabla de mapeo lógico↔real vive FUERA del repo (`~/.sharemechat/state-mapping.yaml`)

### Caso 10. Hito del proyecto que merece entrada en bitácora
Ejemplos:
- se cierra un ADR estructural
- se completa un paquete grande de trabajo
- se archiva una hipótesis con razón explícita
- el proyecto cambia de rumbo
- se aprende algo operativo significativo aplicable a futuro

Acción:
- añadir una entrada al inicio de `docs/project-log.md` siguiendo la **Política operativa de la bitácora** descrita más abajo
- la entrada se añade en el MISMO commit que el cambio que la motiva
- ante la duda sobre si el hito merece entrada, preguntar al operador

## Política operativa de la bitácora

La bitácora del proyecto vive en `docs/project-log.md` y es un registro cronológico inverso (más reciente arriba) de los hitos relevantes del proyecto. Su propósito es permitir que cualquier sesión LLM nueva (Claude Code, Claude.ai chat, Cowork con skills) recupere el contexto operativo del proyecto sin tener que reconstruirlo a partir de conversaciones pasadas.

### Quién la mantiene

El agente local (Claude Code u otro agente con acceso al repo) la mantiene de forma automática cuando materializa un cambio que cae en alguna de las cinco categorías de abajo. El humano NO la edita a mano: si una entrada queda incorrecta o necesita matiz, se añade una entrada nueva que la complementa, no se modifica la pasada.

### Cuándo añadir entrada (lista cerrada de 5 categorías)

1. **Decisión estructural cerrada**: se acaba de cerrar un ADR nuevo o se reabre uno existente con cambio de fondo.
2. **Definición o cierre de fase / paquete grande**: un paquete numerado del rediseño, una fase del roadmap o un frente operativo se da por cerrado.
3. **Hipótesis archivada con razón explícita**: una alternativa de diseño que se consideró seriamente queda descartada con justificación; conviene dejar constancia para que no vuelva a estudiarse desde cero.
4. **Cambio de rumbo del proyecto**: una decisión vigente se invierte (ejemplo: política operativa que se revierte) y el rumbo nuevo merece quedar registrado junto al motivo.
5. **Aprendizaje operativo significativo**: un patrón, una mala práctica detectada o una constatación operativa que será útil para futuros frentes.

### Cuándo NO añadir entrada

- cambios triviales de código (correcciones de typo, formateo, lint)
- refactors menores sin cambio de comportamiento
- updates rutinarios de dependencias sin impacto funcional
- hallazgos exploratorios sin conclusión cerrada
- ediciones cosméticas de documentación que no cambian decisiones
- commits puramente de despliegue (mismo código a otro entorno)

### Reglas operativas

- **Regla del mismo commit**: la entrada de bitácora se añade en el MISMO commit que el cambio que la motiva. No se acumulan entradas en un commit posterior; el agente que cierra el cambio cierra también la entrada.
- **Regla de inserción al inicio**: las entradas nuevas se insertan justo después del separador `---` que cierra la cabecera del fichero. El orden es cronológico inverso estricto (más reciente arriba).
- **Regla de criterio**: ante la duda sobre si un hito merece entrada, el agente pregunta al operador antes de añadirla. Mejor preguntar de más que inflar la bitácora con ruido.
- **Regla de inviolabilidad**: las entradas pasadas no se editan, no se reescriben y no se borran. Si una decisión registrada se revierte, se añade una entrada nueva que captura el cambio de rumbo y referencia (por fecha) la entrada que invierte.
- **Regla de no retroactivo**: la bitácora arranca en el momento de su creación. NO se rellenan entradas históricas para hitos previos; el contenido del repo y los ADRs anteriores ya cubren ese rango.

### Formato fijo de entrada

Cada entrada sigue la plantilla exacta:

```
## YYYY-MM-DD — Título corto del hito

Párrafo 1: qué pasó y por qué se decidió así.

Párrafo 2 (opcional): qué alternativas se descartaron y por qué.
```

- El título usa heading `##` (H2) para que las entradas sean navegables vía outline del editor.
- La fecha va en formato ISO `YYYY-MM-DD` literal.
- El guion largo `—` separa fecha y título.
- El título es una frase corta sin punto final.

### Reglas de redacción

- **Brevedad**: 1 párrafo si el hito es directo; 2 si conviene capturar las alternativas descartadas. Nunca más.
- **Capturar el porqué, no solo el qué**: el valor de la bitácora está en justificar la decisión, no en describir el cambio. Para el "qué" ya están el código y los ADRs.
- **Lenguaje neutral**: sin emojis, sin lenguaje de marketing, sin signos de exclamación.
- **Tiempo verbal**: pasado para describir lo que pasó, presente para describir el estado resultante. Sin futuro especulativo.
- **Sin enlaces**: salvo necesidad inevitable (un ADR concreto cuya referencia es esencial). La bitácora no es un índice, es un registro autosuficiente.
- **Lenguaje del proyecto**: español, coherente con el resto del corpus interno.

## Regla de no duplicidad

No duplicar la misma información en varios documentos si no aporta valor claro.
Cada dato debe tener un lugar principal.
Los demás documentos deben resumir o enlazar conceptualmente, no repetir.

## Regla de saneado

No documentar en el repo principal:
- IDs reales de CloudFront
- ARNs
- IPs públicas
- hostnames exactos de RDS
- IDs de security groups, subnets o VPC
- inventario sensible detallado de infraestructura

Sustituir por nombres lógicos:
- distribución pública TEST
- bucket privado de frontend del entorno AUDIT
- instancia RDS MySQL del entorno TEST
- security group del backend
- certificado wildcard del entorno

## Regla de evidencia

No afirmar como hecho algo que no esté razonablemente soportado por:
- código del repositorio
- configuración versionada
- documentación interna previa fiable

Si existe duda, expresarla de forma profesional dentro del documento.

## Regla de mantenimiento

Ante cualquier cambio relevante:
1. identificar el tipo de cambio
2. actualizar el documento principal correcto
3. crear ADR si la decisión es estructural
4. registrar incidencia o riesgo si procede
5. evitar duplicidad y detalle sensible

## Mapa rápido de destino

- negocio y lógica funcional -> `docs/01-business/`
- arquitectura técnica -> `docs/02-architecture/`
- entornos -> `docs/03-environments/`
- operación, incidencias y riesgos -> `docs/04-operations/`
- backoffice -> `docs/05-backoffice/`
- decisiones de arquitectura -> `docs/06-decisions/`
- fase actual y planificación -> `docs/07-roadmap/`
- skills operativas ejecutables por agentes -> `docs/state-inventory-skills/` (o `docs/cms/skills/` si son editoriales)
- snapshots estructurados de estado del sistema -> `docs/_snapshots/`
- bitácora cronológica de hitos del proyecto -> `docs/project-log.md`

## Formatos aceptados en el repo

Convención de formatos para toda la documentación versionada en `docs/` (y por extensión el resto del repo cuando aplique).

### Formato por defecto

- `.md` para toda documentación humano-legible: negocio, arquitectura, entornos, operaciones, ADRs, roadmap, runbooks, plantillas y cualquier texto discursivo del corpus.

### Excepciones justificadas

Los siguientes formatos están permitidos solo para los usos concretos indicados:

- `.yaml` / `.yml`: snapshots estructurados (`docs/_snapshots/`), configuración estructurada de skills, ficheros de estado versionados.
- `.sql`: migraciones Flyway (`src/main/resources/db/migration/`) y snippets SQL de referencia.
- `.json`: ledgers operativos (`docs/social/social-state.json`), esquemas y contratos de intercambio.
- `.ps1` / `.sh`: scripts operativos referenciados desde runbooks.

### Formatos prohibidos

- `.xlsx`, `.xls`, `.ods`: hojas de cálculo. Contenido tabular vive en tablas Markdown.
- `.docx`, `.doc`, `.odt`: documentos ofimáticos. Prosa vive en Markdown.
- `.pdf`: documentos binarios. Prosa vive en Markdown.
- `.pptx`: presentaciones. Diagramas vía Mermaid embebido en Markdown.

### PDFs de entregables legales oficiales

Los PDFs de entregables legales oficiales (registros OEPM, certificados, resoluciones, contratos firmados) **no viven en el repo**. Se conservan fuera del repo entero, en el archivo personal del operador. En el corpus se referencian por su fecha y organismo emisor, no por ruta a fichero binario.

### Imágenes

Solo si son estrictamente necesarias para transmitir información no reducible a texto (screenshots de incidentes, capturas de UI que documentan un bug concreto). Preferir Mermaid o ASCII embebido en Markdown para diagramas y arquitecturas.

## Convención de cabecera de estado

Toda documento de negocio de `docs/01-business/` y toda ADR nueva de `docs/06-decisions/` a partir de esta convención debe abrir con la siguiente cabecera de estado justo debajo del título H1:

```
> Estado: VIGENTE | TRANSITORIO | HISTÓRICO
> Fecha: YYYY-MM-DD
> Vigencia esperada: [descripción o "indefinida"]
> Reemplaza: [ruta y sección específica, o "N/A"]
> Ver también: [ADRs y ficheros relacionados]
```

Semántica de los tres valores:

- **VIGENTE**: refleja el estado actual del proyecto en el momento de la última edición y se espera que siga vigente sin fecha de caducidad prevista. Usado para decisiones estructurales y documentos de negocio estables.
- **TRANSITORIO**: refleja una fase o estrategia de duración acotada. Contiene el hito o condición esperada de cierre en el campo "Vigencia esperada". Cuando el hito se cumple, el documento se archiva en `_archive/`.
- **HISTÓRICO**: preservado por trazabilidad de decisión pero superseded por otra fuente. Contiene ruta al documento vigente en el campo "Reemplaza".

Los ADRs anteriores a esta convención mantienen su formato original (encabezado `## Estado` con `Aceptada` / `Rechazada` / `Superseded`) y no requieren adaptación retroactiva. La convención aplica solo a documentos creados o reescritos a partir de la fecha de introducción.

Las plantillas `docs/templates/template-adr.md`, `template-environment.md` y `template-runbook.md` incorporan esta cabecera y son la referencia canónica para el formato.

## Patrón de deprecados centralizados

Cuando una sección de un fichero vigente queda superseded (por un ADR nuevo, por un cambio de estrategia o por dejar de aplicar), no se elimina en silencio ni se deja en el fichero vigente contaminando la lectura. Se sigue este patrón:

1. **Mover el contenido histórico a `docs/_deprecated/registro.md`** bajo un heading nuevo con el formato `## [fichero-origen.md] §"nombre sección"` seguido del texto íntegro retirado.
2. **En el fichero vigente**, sustituir el contenido retirado por un bloque de referencia:

```
> ⚠️ SECCIÓN RETIRADA
> Contenido histórico movido a: _deprecated/registro.md §"[nombre sección]"
> Motivo: [ADR de referencia u otra razón]
> Fecha retirada: [YYYY-MM-DD]
```

3. El bloque de referencia se mantiene en el fichero vigente indefinidamente. Permite a un lector entender que ahí había contenido y saber dónde ver la versión histórica sin tener que consultar git blame.

Este patrón preserva el rastro de decisiones sin duplicar contenido activo y evita que las lecturas del corpus vigente se contaminen con paréntesis históricos sobre lo que ya no aplica.

`docs/_deprecated/registro.md` es un fichero cronológico inverso (entradas más recientes arriba) y no tiene otra política de edición: cada retirada se registra en el mismo commit que la aplica.

## Regla final

Antes de editar, decidir primero qué tipo de cambio es.
Después escribir solo en el lugar correcto.
No reorganizar toda la documentación salvo petición explícita.