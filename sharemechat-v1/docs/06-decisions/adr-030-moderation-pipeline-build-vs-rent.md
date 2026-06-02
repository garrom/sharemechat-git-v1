# ADR-030 - Pipeline de moderación: construir control plane, alquilar clasificadores de IA

## Estado

Aceptado el principio direccional "build vs rent". Los vendors concretos de clasificación visual y de detección de CSAM son **candidatos en evaluación**, no seleccionados. Para edad e identidad sí queda elegido Veriff (ver ADR-029).

## Contexto

La clasificación como adult/streaming (ADR-028) y los requisitos del PSP adult-specialist obligan a sostener moderación de contenido robusta en tiempo real sobre streaming en vivo y a registrar trazabilidad de presencia y actuación.

Hay dos familias de capacidades en el pipeline de moderación: (a) **clasificadores** que reciben frames o señales y devuelven etiquetas de violación (nudity, violencia, menores, etc.); (b) **control plane** que orquesta el muestreo, la cola de revisión humana, los hooks de auto-corte/baneo, el attendance log de la modelo, el workflow de quejas y el reporting de transparencia.

La pregunta no es "construir todo" o "alquilar todo", sino dónde corre la línea: qué tiene sentido construir como activo propio del producto y qué tiene sentido alquilar a especialistas del sector.

## Opciones consideradas

### Opción 1 — Construir clasificadores propios

Entrenar modelos de visión propios para nudity/violencia/CSAM/edad. Mantenerlos en infraestructura propia.

Pros:
- Control total sobre el dato.
- Sin coste por inferencia (más allá de cómputo propio).

Contras:
- Coste de construcción y mantenimiento desproporcionado para un equipo pequeño.
- CSAM en particular **no se puede construir como modelo propio** sin licencia y acceso a las bases hash de referencia (NCMEC, IWF). Construir capacidad propia de detección de CSAM es operativamente inviable y abre exposición legal mayor que la que cubre.
- Capacidad inferior a la de vendors especializados con años de iteración en producción.

### Opción 2 — Alquilar todo, sin pipeline propio

Externalizar también la coordinación: cola, decisiones, attendance, dashboard. Cada vendor expone su propio panel.

Pros:
- Cero código de moderación en la plataforma.

Contras:
- El control de la operación queda en manos de los vendors.
- La cola admin, las decisiones, el audit log de actuaciones y el reporting al PSP se fragmentan entre proveedores.
- Cambiar de vendor implica rehacer el procedimiento operativo del equipo.
- Operar con varios paneles externos en lugar de uno propio reduce la calidad de la respuesta humana.

### Opción 3 — Construir el control plane, alquilar los clasificadores

Construir como activo propio del producto:

- el muestreo de frames del stream,
- la cola de revisión humana,
- los hooks de auto-corte y baneo,
- el dashboard de moderación,
- el attendance log de la modelo,
- la integración de moderación de chat,
- el workflow de quejas,
- el reporting de transparencia al PSP.

Alquilar como servicio externo:

- los clasificadores visuales (nudity, violencia y similares),
- la detección de CSAM (vía hashes y modelos especializados),
- la verificación de edad e identidad (Veriff, ya decidido en ADR-029).

Pros:
- El control plane y la cola humana son el activo operativo del equipo: quedan dentro y son sustituibles internamente.
- La capacidad técnica difícil (visión + CSAM) la aportan especialistas con catálogo de licencias y certificaciones que el equipo no podría obtener.
- Cambiar de vendor de clasificación es factible (el contrato API entre vendors es razonablemente estandarizable) sin rehacer la operativa interna.
- Permite multi-vendor en el futuro si se quiere redundancia (mismo principio que ADR-029 reconoce como abierto).

Contras:
- Más superficie técnica que construir que la opción 2.
- Dependencia de vendors externos para la capa más sensible (CSAM, age verification).

## Decisión

Se adopta la **Opción 3**: construir el control plane y la cola humana como activo propio del producto, alquilar los clasificadores de IA y la verificación de edad/identidad.

### Reparto build vs rent

**Se construye (control plane y operativa)**:

- Muestreo de frames del stream en intervalos definidos.
- Cola de revisión humana con priorización por severidad y por tipo de violación.
- Hooks de auto-corte de sesión y de baneo de modelo/cliente.
- Dashboard de moderación con histórico de decisiones.
- Attendance log de presencia de la modelo en cámara durante stream (defensa ante chargebacks y trazabilidad operativa).
- Integración de moderación de chat (clasificación de texto + acción).
- Workflow de quejas (`/api/reports` ya existente más superficie admin).
- Reporting de transparencia al PSP (mensual + nil report).

**Se alquila (capacidad técnica especializada)**:

- Clasificación visual en tiempo real: **candidatos en evaluación** — Sightengine, Hive. No seleccionado.
- Detección de CSAM: **candidatos en evaluación** — Hive, Thorn Safer, PhotoDNA. No seleccionado. **Nunca construir CSAM propio**.
- Verificación de edad e identidad: Veriff, ya seleccionado en ADR-029.

### Estado de implementación

Hecho:

- Corte de sesión en cualquier momento (capacidad técnica disponible en el backend de streaming).
- Registro de sesiones: tabla de stream records con quién con quién, sesiones activas, eventos de cierre. Trazabilidad de quién ha estado en stream con quién y durante cuánto.
- Moderación de assets estáticos del perfil de modelo (fotos y vídeos del catálogo) con cola admin completa: aprobación, rechazo con motivo, rechazo retroactivo, email al modelo, audit log. Esta línea ya está cerrada para el catálogo de perfil; no se confunde con la moderación de contenido en streaming en vivo, que es la que aún no tiene capa de IA.

Planificado:

- Análisis visual del vídeo en tiempo real durante stream.
- Detección de CSAM.
- Panel de revisión humana con cola de prioridades.
- Attendance log de presencia de la modelo en cámara durante stream.
- Workflow de quejas extendido (`/api/reports` ya existe, falta superficie admin y trazabilidad a PSP).
- Reporting de transparencia al PSP (mensual + nil report).

## Justificación

Construir el control plane mantiene el activo operativo del equipo dentro del producto: la cola humana es la que aporta valor diferencial frente a una plataforma que solo automatiza. Construirla genera además una herramienta interna reutilizable para cualquier vendor que se elija (el contrato entre control plane y vendor es razonablemente estandarizable).

Alquilar los clasificadores tiene sentido por tres razones distintas: (a) la capacidad técnica de visión en producción es desproporcionada para un equipo pequeño; (b) la detección de CSAM requiere acceso a bases hash de referencia que solo se obtienen vía vendor especializado (Hive, Thorn Safer, PhotoDNA); (c) la verificación de edad e identidad ya está resuelta con Veriff en ADR-029, así que el patrón "rent" para esta capa ya está validado.

Vetar explícitamente la construcción de CSAM propio no es una preferencia, es la única decisión defendible. La detección de CSAM se hace con vendors que tienen autorización y acceso a hashes oficiales; cualquier intento de construir esa capacidad en propia exposición legal innecesaria.

"Monitorizar en todo momento" tiene además una dimensión **humana/operativa** que no se resuelve con tecnología: a medida que el volumen crezca, será necesario staff o vendor de trust & safety gestionado. Esta capa no se construye ni se alquila como software; se acomoda en el plan operativo cuando el volumen lo justifique.

## Impacto

### Arquitectura

- Se introduce un nuevo dominio funcional "moderation pipeline" que hoy no existe en código (más allá de la moderación de assets estáticos). Requerirá entities, services y controllers nuevos cuando arranque la implementación.
- El contrato entre el control plane interno y los vendors externos debe definirse con suficiente generalidad para permitir sustitución de vendor sin cambiar la lógica interna (patrón análogo al `KycProviderConfigService` actual).
- El attendance log es una pieza específica del producto adult/streaming: requiere muestreo periódico durante stream y persistencia.

### Operaciones

- Cuando arranque la implementación de la capa IA, hay que producir la documentación de arquitectura asociada (probable `docs/02-architecture/moderation-pipeline.md`) y los runbooks de operación.
- Selección de vendors: hay que hacer evaluación técnica + comercial + due diligence regulatoria de cada candidato antes de seleccionar.
- Equipo humano de moderación: pendiente de plan operativo según volumen real (no es decisión de este ADR).

### Riesgos

- Vendors de moderación visual y de CSAM aún no seleccionados: bloquea la implementación del pipeline.
- El reporting al PSP depende de que el pipeline esté operativo: hasta entonces el reporting es manual.
- Workflow de quejas existe parcialmente (`/api/reports/abuse`) pero sin superficie admin completa ni trazabilidad a PSP — gap operativo hasta cierre.

## Consecuencias

Positivas:

- Control plane reutilizable independientemente del vendor de clasificación.
- CSAM cubierto por vendor especializado (decisión legalmente defendible).
- Coherencia con la decisión Veriff (ADR-029): mismo patrón de "rent" para capacidad técnica externa, "build" para operativa interna.

Negativas:

- Trabajo de construcción significativo del control plane antes del go-live.
- Dependencia de varios vendors externos en la capa más sensible.
- Coste por inferencia para cada frame muestreado y cada documento verificado.

Trade-off asumido:

- Más superficie a construir y a operar (control plane) a cambio de soberanía sobre la operativa interna y de sustituibilidad de vendor.

## Notas

Los vendors candidatos para clasificación visual (Sightengine, Hive) y para CSAM (Hive, Thorn Safer, PhotoDNA) están en evaluación. Su selección es decisión posterior a este ADR y posiblemente abrirá ADRs menores específicos (selección y configuración de cada vendor) cuando se cierren contratos.

La arquitectura concreta del pipeline (formato de frames, cadencia de muestreo, esquema de la cola, integración con `BackofficeAuditLogService`) se diseñará cuando arranque la implementación. No se documenta ahora como arquitectura objetivo en `docs/02-architecture/` por respeto a la regla de evidencia: no documentamos como arquitectura algo aún no construido. Se referencia desde `docs/02-architecture/integrations-overview.md` como integraciones planificadas con candidatos en evaluación.
