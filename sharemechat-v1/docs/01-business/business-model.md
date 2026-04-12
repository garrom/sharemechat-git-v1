# Modelo de negocio

SharemeChat opera como una plataforma de interacción 1:1 entre clientes y modelos.

## Núcleo de monetización

El repositorio refleja un modelo económico basado en:

- wallet interna para clientes
- consumo asociado a sesiones y tiempo de interacción
- gifts con reparto entre modelo y plataforma
- retiros solicitados por modelos

La trazabilidad económica se apoya en ledger interno y snapshots de balance, lo que permite auditar movimientos de usuario y de plataforma con bastante detalle.

## Actores principales

- cliente: usuario que consume saldo y utiliza random, chat y llamadas
- modelo: usuaria aprobada para operar y generar ingresos
- plataforma: mantiene margen, control operativo y revisión administrativa

## Madurez observada

La economía interna y la trazabilidad contable parecen más maduras que la integración PSP externa. El repositorio contiene adaptación hacia CCBill, pero el material actual sugiere una integración todavía parcial.
