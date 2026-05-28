# Overview de contexto reutilizable archivado (flujo inactivo)

Este directorio agrupa el overview de contexto reutilizable del proyecto y su guía de generación, retirados del flujo documental activo el **2026-05-27**.

## Ficheros

- `shareme-context-overview.md` — narrativa de alto nivel del proyecto, pensada como contexto reutilizable y autosuficiente.
- `context-generation-guidelines.md` — guía de cómo generar y mantener el overview anterior.

## Por qué se archivaron

El caso de uso que justificaba mantener un overview de contexto reutilizable y al día ya no se da:

- arranque de chats LLM nuevos desde cero,
- pitch a inversores,
- onboarding de terceros.

Mientras esos escenarios estuvieron activos, tenía sentido mantener un documento único, condensado y autosuficiente que sirviera de punto de entrada. Hoy el contexto operativo del proyecto se recupera directamente desde la documentación viva (`docs/01-business/` a `docs/07-roadmap/`, `docs/project-log.md`, ADRs y snapshots), por lo que mantener un overview paralelo solo añadía superficie de mantenimiento y riesgo de divergencia.

No se borran porque el caso de uso podría volver. Se archivan preservando el historial git.

## ADVERTENCIA: el contenido puede estar desactualizado

El overview **no se ha mantenido al día** con los frentes recientes (frente PRO, hardening post-PRO, refactores brief-per-locale, etc.). La auditoría `docs/_audit/doc-vs-code-gap-2026-05-07.md` (hallazgo S3) ya señalaba un gap: el overview describía el cierre de registro como solo de UI, contradiciendo una capa de seguridad ya validada en backend; esa corrección nunca se aplicó.

Quien reactive este flujo **no debe tomar el overview como fuente al día**. Debe regenerarlo desde la documentación viva en `docs/` siguiendo `context-generation-guidelines.md`, tratando el contenido archivado solo como plantilla de estructura, no como datos vigentes.

## Cómo reactivar

Si vuelve la necesidad de un overview de contexto reutilizable:

1. Mover ambos ficheros de vuelta a `docs/00-context/` (`git mv` para preservar historial).
2. Restaurar la sección `## Context generation` en el `CLAUDE.md` raíz del repositorio (apuntando de nuevo a `docs/00-context/shareme-context-overview.md` y `docs/00-context/context-generation-guidelines.md`).
3. **Regenerar el overview desde cero** siguiendo `context-generation-guidelines.md` contra el estado actual de `docs/`; no confiar en el contenido archivado como vigente.

## Qué NO hacer

- No tratar el overview archivado como fuente de verdad del estado actual del proyecto.
- No editar estos ficheros aquí: si se reactivan, se regeneran; mientras estén archivados, son traza histórica inmutable.
