# ADR-026 - Separación de responsabilidades cms-json-builder y cms-json-validator en el pipeline editorial bilingüe

## Estado

Aceptado (2026-05-20).

Aplicabilidad: skills personales del editor en Claude Cowork, orquestador del pipeline editorial, documentación del pipeline. Extiende a [ADR-014](./adr-014-full-article-orchestrated-pipeline.md) y [ADR-023](./adr-023-bilingual-editorial-pipeline-es-en.md) sin reemplazarlos. NO toca [ADR-024](./adr-024-bilingual-submit-inside-editor.md) (apply-bilingual atómico) ni [ADR-025](./adr-025-flyway-introduction-and-cms-v2-schema.md) (schema v2). Cierra el ciclo abierto por el incidente del paquete 8 (run productivo con JSON malformado pese a regla 15 reforzada en el paquete 6.7).

## Contexto

El paquete 6.7 introdujo en `cms-json-builder.md` una regla 15 reforzada con cuatro sub-pasos (15.1 a 15.4) que obligaba a la skill a construir el JSON con un serializador estándar y a hacer self-check con `JSON.parse` estricto en hasta 3 intentos antes de emitir. La intención era prevenir el caso típico de JSON malformado por comillas dobles ASCII (U+0022) sin escapar dentro de campos string del schema 2.0 (especialmente `locales.{es,en}.draft_markdown` con énfasis estilísticos).

En un run productivo posterior (artículo `elegir-videochat-seguro`, locale ES, 2026-05-20), el JSON emitido por la skill traía una comilla doble ASCII sin escapar dentro de `draft_markdown` y el gate cliente-side del CMS admin (también introducido en el paquete 6.7) lo detectó al pegar:

```
Expected ',' or '}' after property value in JSON at position 8004
(line 139 column 1208).
```

Diagnóstico tras inspección: el agente que ejecutó `cms-json-builder` en Cowork saltó el self-check del paso 15.4. La regla existía y era estricta, pero una skill no puede auto-auditarse fiablemente: el agente que la ejecuta decide cuánto esfuerzo gasta en cumplir reglas internas, y bajo presión de tokens / contexto la regla más prescriptiva puede saltarse sin que el operador lo detecte.

La pregunta de fondo: ¿cómo garantizar que el JSON emitido al CMS es siempre sintácticamente válido sin depender de la disciplina del agente que construye?

## Opciones consideradas

### Opción 1 - Reforzar aún más la regla 15 de cms-json-builder

Añadir sub-pasos más prescriptivos a la regla 15 (15.5, 15.6...), enumerar más patrones de error, exigir trazas internas explícitas del self-check.

Pros:
- Cambio mínimo: una sola skill tocada.
- No introduce piezas nuevas en el pipeline.

Contras:
- Mismo problema estructural: si el agente saltó la regla 15.4 actual, saltará igual una regla 15.5 más larga.
- Inflar la skill la hace menos legible y aumenta la probabilidad de que el agente seleccione qué partes seguir.
- No hay forma de verificar desde fuera de la skill si el self-check se ejecutó realmente o se simuló.

Descartada por no resolver la causa raíz (auto-auditoría no fiable).

### Opción 2 - Validar exclusivamente en el backend

Mover toda la responsabilidad de validación sintáctica al `ManualClipboardClaudeAdapter` del backend (paquete 2), sin tocar Cowork. La skill builder emite lo que pueda; el backend rechaza con 4xx si el JSON es inválido y el operador corrige a mano en Cowork.

Pros:
- Centraliza la validación en una sola capa controlada por código del repo.
- El backend ya tiene gate de parseo Jackson (paquete 6.7 lo enriqueció con línea/columna/contexto).

Contras:
- Pierde la capacidad de corrección automática (el backend solo detecta, no corrige).
- Deja toda la fricción del fallo en el operador: ver error 400, abrir Cowork, identificar campo problemático, re-ejecutar pipeline o corregir a mano.
- No aprovecha que en Cowork hay material editorial fresco (los `reviewed*.md`) que facilita el diagnóstico contextual.
- El gate cliente-side del paquete 6.7 ya cubre la detección sintáctica al pegar; sin corrección automática, la red de seguridad queda incompleta.

Descartada por trasladar la fricción al operador en lugar de resolverla.

### Opción 3 - Separar responsabilidades en dos skills (elegida)

Dividir el trabajo actual de `cms-json-builder` en dos piezas independientes:

- `cms-json-builder` (fase 5, simplificada) **solo construye** el JSON desde los artefactos del pipeline. Sin self-check sintáctico, sin política de intentos, sin lista de campos de riesgo. Más corta, más enfocada.
- `cms-json-validator` (fase 5.5, nueva, obligatoria sin opt-out) lee `05_final/final.json`, valida sintaxis estricta RFC 8259, identifica errores típicos (comillas dobles ASCII no escapadas, comas faltantes, llaves sin cerrar) y los corrige en lote hasta 3 intentos. Sobrescribe el fichero si éxito; lo renombra a `final.broken.json` si fallo tras los 3 intentos. Emite `validator_report.md` siempre.

El orquestador (`cms-orchestrator`) encadena ambas: tras fase 5 invoca obligatoriamente la 5.5.

Pros:
- Separación estructural: una skill no se audita a sí misma; otra skill lo hace, sin depender de la disciplina del agente que construyó.
- Patrón ya validado en el proyecto. Fase 3 (`cms-editorial-polish`, redacta) + fase 4 (`cms-brand-legal-review`, revisa) ya separan "construir" de "revisar"; [ADR-023](./adr-023-bilingual-editorial-pipeline-es-en.md) ya validó el patrón "fase decimal" introduciendo la 4.5 entre la 4 y la 5.
- Mantiene la capacidad de corrección automática (la 5.5 corrige) sin trasladar la fricción al operador.
- Cero cambios en backend ni frontend. El gate cliente-side del paquete 6.7 se mantiene como defensa en profundidad (la 5.5 es la primera línea; el gate cliente-side la segunda).
- Política de fallo segura: si los 3 intentos fallan, el contenido editorial NO se pierde (queda en `final.broken.json` para inspección manual) y el JSON canónico (`final.json`) no existe, lo que el orquestador interpreta inequívocamente como "no importar al CMS".

Contras:
- Pipeline crece de 6 a 7 fases. Más complejidad operativa para el operador.
- Doble paso en el camino feliz (sin errores sintácticos): el validator parsea el JSON, ve que está bien, lo sobrescribe igual. Sobrecoste mínimo (1 parse + 1 escritura) pero existe.
- Requiere actualizar `cms-orchestrator.md` y la tabla canónica del README de skills.

Elegida.

## Decisión

Adoptar la opción 3 con las decisiones operativas concretas listadas abajo. Implementación en 4 paquetes pequeños ya cerrados (8.A, 8.B, 8.C, 8.C-fix); este ADR cierra documentalmente el episodio.

1. **Simplificar `cms-json-builder.md`** (paquete 8.A): eliminar la regla 15 entera (incluyendo sub-pasos 15.1, 15.2, 15.3, 15.4) y los dos bullets de validación sintáctica de la sección "VALIDACIÓN ANTES DE EMITIR (self-check)". El builder mantiene su responsabilidad editorial (literalidad del draft, lista de fuentes, slugs distintos por locale, target_keywords con primary, validación de longitudes y kebab-case, etc.) pero NO valida sintaxis JSON. Añadir nota apuntando a la fase 5.5 como responsable.

2. **Crear `cms-json-validator.md`** (paquete 8.B) como nueva skill personal de Cowork (stub canónico en el repo, instancia operativa en Claude.ai). Define la fase 5.5, política de 3 intentos (intento = ciclo completo parse / detectar todos los errores / corregir en lote / re-parsear), lista canónica de campos de riesgo alto heredada del antiguo sub-paso 15.2, política de éxito (sobrescribir + emitir report), política de fallo (renombrar a `final.broken.json` sin sobrescribir el roto + emitir report con diagnóstico).

3. **Integrar fase 5.5 en `cms-orchestrator.md`** (paquete 8.C): añadir fila 5.5 en el bloque PIPELINE A EJECUTAR (de 6 a 7 fases), nueva regla 10 "convención de existencia tras la fase 5.5" (`final.json` existe → OK; solo existe `final.broken.json` → falló), reescritura del reporte estructurado de éxito para incluir auditoría sintáctica, bloque dedicado en REPORTE DE ERROR ("CASO ESPECÍFICO: FASE 5.5 ABORTÓ TRAS 3 INTENTOS") que enfatiza que el contenido editorial sigue intacto en `final.broken.json` y orienta al operador a inspeccionar `04_review/`. Añadir fila 5.5 en la tabla canónica de `docs/cms/skills/README.md`.

4. **Política de entrega del JSON al operador** (paquete 8.C-fix): el orquestador (no builder ni validator) pinta el contenido completo de `final.json` en chat dentro de un bloque ```json único, al final del reporte estructurado de éxito. Solo se pinta si la fase 5.5 pasó (existe `final.json`). Si falló (existe `final.broken.json`), NO se pinta el JSON roto; se emite el bloque de reporte de error específico. Builder y validator tienen prohibido pintar JSON en chat por su cuenta. Razón del cambio respecto a la política anterior (entrega solo por fichero descargable, paquete 8.A original): Cowork no escribe a `C:\Users\alain\Downloads\` de forma fiable y no ofrece descarga directa del artefacto del sandbox; pintar el JSON validado en chat le da al operador una vía operativa directa, y el gate cliente-side del CMS admin (paquete 6.7) bloquea cualquier JSON malformado al pegarlo, manteniendo la defensa en profundidad.

5. **Inviolabilidad del contenido editorial**: ante un fallo de validación tras 3 intentos, `final.broken.json` conserva todo el trabajo de las fases 1-5 sin tocar. El operador puede inspeccionar el JSON original, identificar el carácter problemático con la ayuda de `validator_report.md` (línea, columna, fragmento con caret), corregir el campo origen en `04_review/reviewed.md` o `reviewed_en.md`, y re-lanzar el pipeline desde la fase 5 sin perder horas de trabajo editorial.

6. **Orquestación y skill personal**: el orquestador (`cms-orchestrator.md`) sigue siendo la pieza que encadena el pipeline. La fase 5.5 NO es una sub-llamada interna de la fase 5; es un paso independiente que el orquestador invoca explícitamente. Esta arquitectura mantiene la simetría con el resto del pipeline y permite que un agente futuro auditara la traza sin tener que descender al detalle de cada skill.

## Justificación

Por qué opción 3 frente a 1 y 2:

- **Frente a opción 1**: el problema no es la calidad de la regla 15, es la imposibilidad estructural de auditar desde dentro. Reforzar más la regla no cambia ese hecho. Un agente futuro que ejecute la skill bajo presión de contexto o con un modelo menos capaz seguirá pudiendo saltársela. La separación en dos skills sí cambia la estructura: la segunda skill no construye, solo valida, y si su único trabajo es parsear y corregir tiene mucha menos margen para "tomar atajos".

- **Frente a opción 2**: el backend ya tiene su gate (paquete 6.7); duplicar esa lógica como única defensa estaría bien si lográramos un JSON limpio desde el origen, pero precisamente la opción 1 demostró que el origen no es fiable. La validación en Cowork con corrección automática es lo más cercano a la fuente del problema. El backend sigue siendo la red de seguridad final, pero sería operativamente caro tener al operador iterando entre admin del CMS y Cowork para corregir errores de comillas.

Sobre las decisiones internas de la opción 3:

- **Numerar la nueva skill como fase 5.5, no 6**: respeta el patrón inaugurado por [ADR-023](./adr-023-bilingual-editorial-pipeline-es-en.md) (fase decimal entre dos fases existentes) y deja claro semánticamente que la validación está acoplada a la construcción, no es una fase independiente con vida propia. Si en el futuro hubiera una "fase 6" (publicación automática, por ejemplo), la 5.5 seguiría siendo claramente "post-build, pre-handoff".

- **3 intentos, no más**: 3 es suficiente en la práctica para resolver los patrones típicos (comillas, comas, llaves). Más intentos no aportan: si el JSON no es corregible en 3 pasadas, suele estar tan roto que conviene parar y dejar diagnóstico al operador antes de seguir contaminando el output.

- **Intento = ciclo completo (no error individual)**: corregir error a error genera más ciclos y multiplica el riesgo de introducir errores nuevos al re-serializar parcialmente. Corregir todos los errores detectables por intento es más eficiente; suele resolver en 1 intento cuando el patrón es sistémico (todas las comillas no escapadas en el mismo campo, por ejemplo).

- **Renombrar a `final.broken.json` en lugar de sobrescribir con roto**: la convención de existencia ("si `final.json` existe → OK") es la señal más fiable y barata que el orquestador puede usar para decidir si pintar el JSON en chat o emitir el reporte de error. Sobrescribir con roto rompería esa convención.

- **El orquestador pinta el JSON, no el builder ni el validator**: separación de responsabilidades simétrica con el resto del pipeline. Una skill produce su artefacto; el orquestador consolida y presenta. Si builder o validator pintaran por su cuenta, el operador vería contenido duplicado y no sabría cuál es el canónico.

- **Pintar en chat en lugar de fichero**: pragmatismo operativo. La política inicial del paquete 8.A pedía entrega solo por fichero; la realidad operativa demostró que Cowork no ofrece esa vía de forma fiable. La inversión del paquete 8.C-fix asume que el gate cliente-side del paquete 6.7 es la red de seguridad final y que pintar en chat un JSON validado por la 5.5 da una defensa en profundidad suficiente.

## Impacto

### Arquitectura

- Pipeline editorial de Cowork pasa de 6 a 7 fases (1, 2, 3, 4, 4.5, 5, 5.5).
- Cero cambios en BD, cero migraciones, cero endpoints nuevos del CMS público ni admin.
- Cero dependencias nuevas (Maven o npm).

### Skills personales (repo + Cowork)

- **`docs/cms/skills/cms-json-builder.md`**: regla 15 eliminada (incluidos sub-pasos 15.1-15.4). Dos bullets de validación sintáctica eliminados del self-check. Nueva sección "Política de entrega al operador" aclara que el builder NO pinta JSON en chat (lo hace el orquestador).
- **`docs/cms/skills/cms-json-validator.md`**: skill nueva (creada en paquete 8.B). ~128 líneas. Estructura completa: rol, inputs, outputs, política de 3 intentos, campos de riesgo alto, política de éxito, política de fallo, política de entrega, lo que no hace, voz editorial (no aplica), cuando termines.
- **`docs/cms/skills/cms-orchestrator.md`**: fila 5.5 añadida al PIPELINE A EJECUTAR; regla 10 nueva (convención de existencia); reporte estructurado ampliado con auditoría 5.5; bloque "CASO ESPECÍFICO: FASE 5.5 ABORTÓ TRAS 3 INTENTOS" añadido al REPORTE DE ERROR; sección "POLÍTICA DE ENTREGA AL OPERADOR" nueva que define cómo se pinta el JSON en chat (8.C-fix); regla 11 anterior (persistencia obligatoria a Downloads) eliminada por no ser viable operativamente.
- **`docs/cms/skills/README.md`**: fila 5.5 añadida en la tabla canónica de skills.

### Código backend

Cero cambios en este paquete. El `ManualClipboardClaudeAdapter` (paquete 2) y el `ContentAdminController` (paquete 3) siguen tal cual. El gate de parseo Jackson del adapter sigue siendo la red de seguridad final; el frontend con `JSON.parse()` previo al POST (paquete 6.7) sigue siendo el gate cliente-side.

### Código frontend

Cero cambios. La política nueva de pintado del JSON en chat afecta a cómo el orquestador presenta el resultado, no a cómo el admin lo recibe.

### Documentación

- Nuevo `docs/project-log.md` (paquete 9.A): bitácora cronológica inversa. Recibe entrada al cierre del paquete 8 y entrada al cierre del paquete 9.B (este ADR).
- `docs/documentation-governance.md`: Caso 10 + sección "Política operativa de la bitácora" añadidos (paquete 9.A).
- `docs/04-operations/known-debt.md`: dos deudas residuales del paquete 8 anotadas (paquete 9.B).

### Operaciones

- El operador no necesita aprender nada nuevo. El pipeline en Cowork sigue siendo: pegar el prompt del CMS, esperar el reporte estructurado, copiar el JSON pintado en el bloque ```json del reporte final y pegarlo en el endpoint admin del CMS.
- Si la fase 5.5 falla, el operador ve el bloque "FASE 5.5 ABORTÓ TRAS 3 INTENTOS" con las acciones recomendadas y los ficheros disponibles en el sandbox (`final.broken.json`, `validator_report.md`).

### Riesgos asumidos

- **Riesgo 1**: el agente que ejecuta `cms-json-validator` podría saltarse igual la política de 3 intentos. Mitigación parcial: la skill es mucho más corta y su único trabajo es validar; menos margen para "tomar atajos". Riesgo real residual: el gate cliente-side del paquete 6.7 sigue siendo la red de seguridad final.
- **Riesgo 2**: el JSON pintado en chat puede truncarse si el reporte del orquestador supera el límite de respuesta de Cowork. Mitigación: el reporte está diseñado para que el bloque ```json vaya al FINAL del reporte, no en medio; si se trunca, se trunca el bloque entero y el operador lo nota. Como red de respaldo, el fichero `final.json` sigue existiendo en el sandbox de Cowork; si el operador detecta truncamiento, puede inspeccionarlo manualmente.

## Consecuencias

### Positivas

- **Auto-auditoría reemplazada por separación estructural**: el problema de fondo del paquete 6.7 queda resuelto en su origen, no parcheado.
- **Patrón reutilizable**: si en el futuro otra skill necesita verificación independiente (por ejemplo, una skill de "validar coherencia de fact_check_notes contra sources_used"), el patrón de "skill que valida lo que otra skill produjo" ya está validado y la fase decimal está acuñada como convención del proyecto.
- **Resiliencia editorial**: ante fallo del validador, el contenido editorial NO se pierde. El operador puede corregir 1 carácter en `reviewed.md` y re-lanzar solo desde la fase 5 en lugar de re-ejecutar todo el pipeline.
- **Política de entrega más operativa**: pintar el JSON en chat resuelve la fricción real que el operador estaba viviendo (no podía localizar el JSON en el sandbox de Cowork de forma fiable).

### Negativas / aceptadas

- **Pipeline más largo**: 7 fases frente a 6. Aceptado: 0.5 fases extra por seguridad sintáctica es coste razonable.
- **Doble pasada en happy path**: incluso cuando el builder emite un JSON limpio, el validator lo parsea y lo sobrescribe. Coste mínimo, aceptado.
- **Más mantenimiento documental**: ahora hay una skill más en el repo y en Cowork que mantener sincronizadas. El procedimiento de actualización ya está en el README de skills.

### Trade-offs

- Verificación robusta (opción 3) frente a simplicidad de pipeline (opciones 1 o 2). Se renuncia a "una skill menos" a cambio de "no depender de la disciplina del agente". El balance favorece la opción 3 mientras la calidad del JSON sea crítica para el flujo operativo (lo es: el operador no puede importar JSON malformado al CMS).
- Corrección automática en Cowork (opción 3) frente a rechazo en backend (opción 2). Se renuncia a centralizar todo en el backend a cambio de minimizar la fricción operativa cuando el problema es trivial (una comilla mal escapada).

## Notas

### Notas operativas

- **Activación**: tras el merge del paquete 8 y 9.A, el agente operativo en Cowork debe sincronizar la nueva skill `cms-json-validator` y las modificaciones a `cms-json-builder` y `cms-orchestrator` desde el repo. Sin esa sincronización manual, el pipeline en Cowork seguirá con la regla 15 vieja.
- **Verificación post-deploy de skill**: tras sincronizar, ejecutar un run editorial completo en Cowork y verificar que el reporte estructurado del orquestador incluye la línea de "Fase 5.5" y que el `validator_report.md` aparece en el working_dir.
- **El gate cliente-side del paquete 6.7 NO se desactiva**: sigue siendo la defensa en profundidad final. Si la fase 5.5 falla en Cowork y el operador intenta pegar el `final.broken.json` por error, el admin lo bloquea.

### Alternativas futuras consideradas

- **Validar también en una capa intermedia (proxy entre Cowork y CMS)**: rechazada por sobre-ingeniería. No hay infraestructura intermedia hoy y el gate cliente-side ya cumple el rol.
- **Compiler-style validator** que infiera errores de schema 2.0 además de sintaxis JSON (longitudes, kebab-case, etc.): rechazada en este ADR. La fase 5 (builder) ya cubre esa parte semántica con su self-check. Mezclar sintaxis y semántica en una misma skill volvería a "una skill que se audita a sí misma" en otro nivel.
- **Auto-corrección de errores semánticos** (no solo sintácticos): rechazada. Una skill que reescriba `seo_title` o `meta_description` por su cuenta entra en territorio de contenido editorial. Esa frontera es inviolable: el contenido lo deciden las skills editoriales (1-4.5), no el validator.

### Deuda registrada

- **`docs/03-environments/test.md`** (línea 205 aprox) enumera las fases del pipeline sin incluir 4.5 ni 5.5. Deuda preexistente desde ADR-023 que no se cerró entonces; este ADR la deja anotada en `docs/04-operations/known-debt.md` como parte del cierre del paquete 8 (paquete 9.B). Acción pendiente: actualizar esa línea en un paquete documental de mantenimiento.
- **`ContentPromptBuilder.java`**, método `appendFullArticleOrchestratedPipeline` (o equivalente): si el método lista explícitamente las fases del pipeline en un bloque interno (tabla `skills_pipeline` o similar), probablemente no menciona la 5.5. Detectado durante el paquete 8.C pero NO verificado en código. Anotado en `known-debt.md`. Acción pendiente: paquete de backend posterior. Verificar primero; si el método lista las fases, añadir la 5.5 de forma aditiva.

## Referencias

- [ADR-014](./adr-014-full-article-orchestrated-pipeline.md) — Pipeline editorial orquestado. Este ADR amplía la estructura de fases sin reemplazarlo.
- [ADR-023](./adr-023-bilingual-editorial-pipeline-es-en.md) — Pipeline bilingüe ES+EN, fase 4.5. Precedente directo del patrón "fase decimal".
- [ADR-024](./adr-024-bilingual-submit-inside-editor.md) — Endpoint atómico `output-bilingual` (superseded por ADR-025 en BD, pero documenta el flujo operativo Cowork → admin que este ADR consolida).
- [ADR-025](./adr-025-flyway-introduction-and-cms-v2-schema.md) — Schema bilingüe v2 en la capa de datos. Este ADR es independiente: opera en la capa Cowork, no en BD.
- `docs/cms/skills/cms-json-builder.md` — skill modificada (paquete 8.A + 8.C-fix).
- `docs/cms/skills/cms-json-validator.md` — skill nueva creada por este ADR (paquete 8.B).
- `docs/cms/skills/cms-orchestrator.md` — orquestador con fase 5.5 integrada (paquete 8.C + 8.C-fix).
- `docs/cms/skills/README.md` — tabla canónica con fila 5.5.
- `docs/project-log.md` — bitácora del proyecto: entrada del 2026-05-20 documenta el detonante del split y las alternativas descartadas (paquete 9.A).
- `docs/04-operations/known-debt.md` — deudas residuales del paquete 8 anotadas en cierre documental (paquete 9.B).
