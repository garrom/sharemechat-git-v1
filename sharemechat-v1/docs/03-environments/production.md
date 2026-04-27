# Entorno PRODUCTION

## Propósito

La información disponible sugiere que PRODUCTION se usa principalmente para:

- landing pública
- publicación de assets compartidos

## Alcance documentado

El material actual no permite afirmar con la misma solidez que exista en este repositorio una configuración completa de producto y backoffice en producción equivalente a TEST.

Por tanto, este documento se mantiene deliberadamente sobrio:

- producción pública y assets sí aparecen reflejados en documentación previa
- el backend de producción no debe darse por documentado aquí sin validación adicional

## Política

Cualquier ampliación futura de este documento debe apoyarse en evidencia versionada o en una actualización documental específica del entorno.

## Product Operational Mode previsto (pendiente de implementación)

Cuando Product Operational Mode esté implementado (ver [ADR-009](../06-decisions/adr-009-product-operational-mode.md)), la intención de configuración para PRO es:

- en **Fase 1 — Prelaunch público controlado** del roadmap, modo `PRELAUNCH` con registros de cliente y modelo abiertos. Producto bloqueado server-side y backoffice operativo.
- al alcanzar **Fase 5 — PRO público limitado**, transición a modo `OPEN` con registros abiertos.
- modo `MAINTENANCE` reservado para ventanas operativas controladas en cualquier momento posterior.

Hasta que la capa esté implementada, PRO no dispone de gating server-side por modo.
