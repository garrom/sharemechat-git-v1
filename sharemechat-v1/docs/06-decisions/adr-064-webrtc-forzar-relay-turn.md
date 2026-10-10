# ADR-064 — Forzar `iceTransportPolicy='relay'` en WebRTC: toda la media del videochat va por el TURN

> Estado: Aceptada (VIGENTE)
> Fecha: 2026-10-10
> Ver también: [access-and-tooling.md](../04-operations/access-and-tooling.md), [known-risks.md](../04-operations/known-risks.md), [known-debt.md](../04-operations/known-debt.md)
> Código: `sharemechat-v1/frontend/src/realtime/webrtcConfig.js` (`normalizePeerConfig`). Commit `5b395f73`, merge `e311a8f7`, desplegado a PROD (bundle `main.ec778797.js`).

## Contexto

Primer test del videochat en una **red hostil real** (cliente en Colombia, probablemente móvil/CGNAT): la media funcionaba **~1 minuto y se quedaba en negro**, mientras el contador de cobro seguía sumando. Diagnóstico (verificado contra logs, coturn y Security Group):

- El `peerConfig` servido al navegador **no fijaba `iceTransportPolicy`** → por defecto es `'all'`: el navegador **prioriza P2P directo** (candidatos host/srflx) y deja el TURN solo como *fallback*. En redes restrictivas la ruta directa conecta y la asociación NAT se cae a los ~30-60 s, y como el par ICE elegido era el directo, **ICE no reconmuta al relay en caliente** → congelado/pantalla negra.
- **El TURN (coturn) estaba sano**: credenciales backend == coturn, Security Group con UDP 3478/5349 + rango de relay 49152-65535 abiertos, `external-ip=EIP/privada` (config correcta de AWS-tras-NAT). No era una rotura de infraestructura; era que el relay **no se forzaba**.
- El cobro va por **tiempo de sesión / WS vivo**, no por salud de la media → por eso seguía cobrando con la pantalla en negro (deuda aparte, ver Consecuencias).

## Decisión

`normalizePeerConfig` (punto único que heredan **todos** los peers: cliente trial, cliente de pago y modelo; random y llamada) devuelve ahora `{ iceServers, iceTransportPolicy: 'relay' }`. Resultado: **el 100% de la media relaya por el TURN**, se elimina el P2P directo y con él el fallo de no-failover en redes malas.

## Justificación

El producto es videochat 1-a-1 en redes de usuario final impredecibles (móvil, CGNAT, corporativas). La robustez de conexión pesa más que el ahorro de ancho de banda del P2P directo. Forzar relay es un cambio de una línea en el único punto de construcción del peerConfig, sin tocar backend, y hace la media determinista (siempre el mismo camino, a prueba de NAT).

## Consecuencias

- **Positiva (lo que arregla)**: media estable en redes restrictivas; no más congelado al minuto por no reconmutar a relay.
- **Coste económico (medido, despreciable)**: coturn ahora saca (egress) los dos streams de cada sesión. A ~1,5 Mbps/stream ≈ **3 Mbps ≈ 22 MB/min ≈ 1,35 GB/hora** de sesión. Data-transfer-OUT eu-central-1 = **100 GB/mes gratis** (≈74 h de sesión concurrente/mes), luego **~0,09 $/GB → ~0,11 €/hora de sesión ≈ 0,002 €/min**. Frente a lo que se cobra al cliente (1 €/min el primer minuto, 3-9 €/min después), el relay es **<0,2% del ingreso por minuto**. No afecta de forma perceptible al reparto modelo/plataforma.
- **El límite real es capacidad, no €**: coturn comparte el EC2 **t3.medium** (baseline de red ~0,3 Gbps, ráfaga 5 Gbps). A ~3 Mbps/sesión caben ~100 sesiones concurrentes en baseline. Para demo/pre-launch sobra; **a escala real** (cientos concurrentes sostenidas) se tensaría el baseline de red del t3 (créditos) y la CPU del relay → tocaría **sacar coturn a su propia instancia/fleet** o subir el tipo. Mitigación opcional de coste/ancho de banda: **cap de bitrate de vídeo**.
- **Mantiene vigente** el riesgo ya anotado en `known-risks.md` sobre coste no lineal de un TURN propio con volumen.

## Follow-ups abiertos (derivados de este frente)

1. **coturn ya es servicio systemd** (verificado 2026-10-10): `coturn-prod.service` está `enabled` + `Active (running)` desde 2026-09-23, con `Restart=always` y `WantedBy=multi-user.target` → arranca solo en boot y se reinicia si cae. (Durante el diagnóstico se afirmó por error que corría manual: fue por consultar `is-active coturn` en vez de `coturn-prod`.) Riesgo residual real: coturn **comparte host** con el backend (mismo EC2 t3.medium) → un fallo del host afecta a ambos, y a escala conviene separarlo a su propia instancia. Ver `known-risks.md`.
2. **Watchdog de cobro atado a salud de media** (pendiente, bloqueante blando pre-launch real): hoy el cobro corre por tiempo de WS, no por el estado del peer. Antes de abrir a usuarios reales, cortar la sesión de pago si la media del peer cae N segundos. Ver `known-debt.md`.

## Notas

- Decisión del operador (2026-10-10) tras el primer test en red hostil real.
- Artefacto de diagnóstico a recordar: **probar el relay TURN desde el propio EC2 da un falso 100%-loss por hairpin del EIP** (AWS no hace hairpin del EIP desde la misma instancia); no usarlo como señal de rotura.
