# Programa de afiliados

> Estado: **RETIRADO** por [ADR-052](../06-decisions/adr-052-rediseno-reparto-precio-y-retirada-afiliadas.md) §D11 (2026-07-24).
> Contenido histórico en [_deprecated/registro.md](docs/_archive/_deprecated/registro.md).

El programa de afiliadas internas (30% revshare por cliente atribuido a la modelo referidora) queda **eliminado por completo**. Su función incentivadora la cubre el reparto escalonado a la modelo, **hoy 50-60%** del bruto (ver [sistema-tiers-modelos.md](sistema-tiers-modelos.md)), muy por encima del sector.

La afiliación externa B2B (blogs, agencias, estudios), si surge, se trata **caso por caso fuera de programa**, con acuerdo bilateral y contabilidad manual — nunca como programa de plataforma.

Retirada técnica: migración V38 (drop de tablas y columnas del programa) + purga de servicios y frontend; [ADR-049](../06-decisions/adr-049-programa-afiliadas-modelos.md) marcado SUPERSEDED. Deudas #D-18 a #D-23 canceladas por el retiro. Detalle en [ADR-052](../06-decisions/adr-052-rediseno-reparto-precio-y-retirada-afiliadas.md) §D11.
