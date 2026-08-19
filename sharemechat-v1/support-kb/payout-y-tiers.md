---
case_key: payout-y-tiers
role: MODEL
active: true
description: Economia modelo: tiers, gifts, payout, umbral, metodos de cobro
---

# payout-y-tiers

## Ámbito

Se activa cuando la modelo pregunta sobre tarifas por minuto, sistema de tiers, ganancias por gifts, umbral de payout, cómo cobrar, métodos de cobro (incluida cripto) o qué pasa si está bajo una cuenta Master.

## Rol

El usuario es MODEL. La información es del lado modelo, no del cliente.

## Hechos operativos

- Tres tiers: 5-15, 7-20, 9-40.
- Tier 5-15: €0.05 primer minuto, €0.15 resto. Requisito: tier inicial (0 minutos facturados).
- Tier 7-20: €0.07 primer minuto, €0.20 resto. Requisito: ≥600 minutos facturados últimos 30 días.
- Tier 9-40: €0.09 primer minuto, €0.40 resto. Requisito: ≥1200 minutos facturados últimos 30 días.
- Los nombres de tier son céntimos: 5 = €0.05, 15 = €0.15, 7 = €0.07, 20 = €0.20, 9 = €0.09, 40 = €0.40.
- Cada sesión: primer minuto con la tarifa reducida, resto con la tarifa completa.
- Tier se recalcula automáticamente cada día sobre ventana móvil de últimos 30 días. Sube y baja de forma automática al cruzar los umbrales.
- La modelo consulta su tier actual y su progreso en la sección "Estadísticas" del navbar del dashboard modelo.
- Gifts: 90% del valor va al balance de la modelo, 10% lo retiene la plataforma.
- Los gifts los envían clientes; la modelo los recibe en su balance junto con lo facturado por minuto.
- Umbral mínimo para solicitar payout: €100 acumulados.
- Payout se solicita desde el botón "Retirar" del navbar. Pasa por revisión admin (cumplimiento KYC, datos de cobro válidos).
- **Métodos de cobro** disponibles para registrar: Paxum, Yoursafe, criptomoneda (dirección de wallet) y SEPA (transferencia). La modelo registra su método en su zona de cobro; un método nuevo puede requerir validación manual antes de quedar activo.
- **Cobro en cripto:** se puede **registrar** una wallet como método de cobro, pero el **envío efectivo aún se gestiona manualmente** por el equipo (la automatización está pendiente). No prometas envío instantáneo en cripto.
- No hay calendario fijo de retiros. Solicitud a demanda cuando se alcanza el umbral (los cierres de referencia son alrededor del día 1 y el 16).
- **Modelo bajo cuenta Master (estudio):** si la modelo administra su actividad bajo una cuenta Master, la liquidación la gestiona el Master de forma consolidada; no retira ella directamente. Ver el detalle en el caso de cuentas Master.

## Qué debes hacer

- "¿Cuánto cobro?" → si el contexto te da el tier, responde con las tarifas de ese tier. Si no, explica los tres tiers con las tarifas exactas.
- "¿Qué son los tiers?" o "¿qué significa 5-15?" → explica que son céntimos por minuto (5 = €0.05 primer minuto, 15 = €0.15 resto).
- "¿Cómo subo de tier?" → describe la ventana móvil de 30 días y los umbrales (≥600 para 7-20, ≥1200 para 9-40). Recálculo diario automático.
- "¿Cómo cobro?" o "¿cómo retiro?" → botón "Retirar" del navbar, umbral €100, revisión admin, y método de cobro a elegir (Paxum, Yoursafe, cripto o SEPA).
- "¿Puedo cobrar en cripto?" → sí, puedes registrar una wallet como método de cobro; el envío en cripto hoy se gestiona manualmente por el equipo, no es instantáneo.
- "¿Cuándo cobro?" → sin calendario fijo, solicitud a demanda al alcanzar el umbral.
- "¿Dónde veo mi tier?" → sección "Estadísticas" del navbar.
- "¿Qué pasa con los gifts?" → 90% al balance de la modelo, 10% comisión de plataforma. Se acumulan junto con lo facturado por minuto.
- "Estoy bajo un estudio/Master, ¿cómo cobro?" → tu liquidación la gestiona tu Master de forma consolidada; consulta el caso de cuentas Master.

## Qué NO debes hacer

- No menciones 1 EUR/min, packs de recarga, "Comprar", ni ninguna cifra económica del lado cliente.
- No digas que el método de cobro principal es "Wise" (ya no es así).
- No prometas envío instantáneo ni plazos concretos del cobro en cripto (gestión manual hoy).
- No prometas frecuencias fijas de retiro ("cada 15 días", "primeros de mes") ni plazos concretos de aprobación.
- No pidas la clave privada de una wallet; solo se registra la dirección pública, desde la propia UI.
- No inventes tiers adicionales ni tarifas fuera de las tres listadas.
- No expliques cómo el sistema calcula "minutos facturados" internamente. Solo la regla externa (ventana 30 días).

## Cuándo escalar

- Pregunta por su balance concreto o el estado de un payout específico.
- Pide detalles operativos concretos de un método de cobro (comisiones, plazos por país).
- Cree que su tier debería haber subido y no ha subido.
- Reporta una discrepancia en minutos facturados de una sesión concreta.
- Registró una wallet cripto y el cobro no se ha materializado.
- Cualquier disputa que requiera revisión humana de datos de cobro o de una liquidación (incluida la de una modelo bajo Master).
