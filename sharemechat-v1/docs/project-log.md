# Bitácora del proyecto SharemeChat

Registro cronológico inverso (más reciente arriba) de hitos relevantes del proyecto: decisiones estructurales cerradas, cierres de fase o paquete, hipótesis archivadas, cambios de rumbo y aprendizajes operativos significativos. Cada entrada captura **qué pasó, por qué y, cuando aplica, qué se descartó y por qué**.

Este fichero **lo mantiene el agente local** (Claude Code u otro agente con acceso al repo) cada vez que materializa un cambio que cae en las categorías definidas. NUNCA se edita a mano. NO se rellena retroactivamente. NO se reescriben entradas pasadas.

La política operativa completa (categorías que disparan entrada, formato fijo, reglas de redacción y de inviolabilidad) vive en `docs/documentation-governance.md`, sección **Política operativa de la bitácora**.

---

## 2026-05-20 — Cierre documental del paquete 8: ADR-026 + deudas residuales anotadas

Tras cerrar la implementación del paquete 8 (split `cms-json-builder` / `cms-json-validator` + fase 5.5 + política de pintado del JSON, ver entrada anterior de hoy), se formaliza el cierre documental con [ADR-026](06-decisions/adr-026-cms-builder-validator-split.md), que consolida la separación builder/validator como decisión estructural del proyecto y deja consignados los precedentes (fases 3+4, fase 4.5 de ADR-023) y la inviolabilidad del contenido editorial ante fallo de validación (`final.broken.json` conserva el trabajo sin pérdida). Se anotan dos deudas residuales en `docs/04-operations/known-debt.md`: lista obsoleta de fases del pipeline en `docs/03-environments/test.md` (preexistente desde ADR-023) y posible tabla `skills_pipeline` desactualizada en `ContentPromptBuilder.java` (detectada durante 8.C, no verificada en código). El paquete 8 queda cerrado por completo.

Se evaluó arreglar las dos deudas en este mismo paquete pero se descartó por scope creep: la del `test.md` es preexistente y arrastrarla en cada ADR alejaría el alcance del paquete actual; la del `ContentPromptBuilder.java` tocaría código que estaba fuera del alcance estricto del paquete 8 (solo skills y documentación). Mejor anotarlas explícitamente en `known-debt.md` que arrastrarlas implícitamente entre sesiones.

## 2026-05-20 — Cierre del paquete 8 del rediseño bilingüe: split builder/validator y política de pintado del JSON

En un run productivo, el JSON emitido por `cms-json-builder` traía una comilla doble ASCII sin escapar dentro de `draft_markdown`; el gate cliente-side del CMS admin (paquete 6.7) lo detectó. La regla 15 del builder (self-check `JSON.parse` con hasta 3 intentos, introducida en 6.7) había sido saltada por el agente de Cowork sin que el operador pudiera detectarlo. Decisión: separar responsabilidades en dos skills (`cms-json-builder` solo construye; `cms-json-validator` valida y corrige sintaxis, fase 5.5 obligatoria del pipeline), con el orquestador encadenando ambas. Política de entrega final: el orquestador pinta el JSON validado en chat dentro de un bloque ` ```json ` en lugar de obligar al operador a abrir ficheros del sandbox; el sandbox de Cowork no escribe a `Downloads` de forma fiable y el gate cliente-side del admin ya bloquea cualquier JSON malformado al pegarlo.

Alternativas descartadas. Reforzar más la regla 15 del builder: una skill no puede auto-auditarse fiablemente porque el agente decide cuánto esfuerzo gasta en el self-check; el problema reaparecería. Validar exclusivamente en el backend sin tocar Cowork: pierde la corrección automática y deja toda la fricción del fallo en el operador, que tendría que diagnosticar y corregir el JSON a mano. Persistir `final.json` a `Downloads` como vía principal de entrega al operador: el sandbox no tiene permiso de escritura fiable a esa ruta, y mantener la regla obligatoria habría dejado deuda operativa permanente.
