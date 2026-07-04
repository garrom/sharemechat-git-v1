# payout-y-tiers

## Ámbito

Se activa cuando la modelo pregunta sobre tarifas por minuto, sistema de tiers, ganancias por gifts, umbral de payout, cómo cobrar, o método de pago.

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
- Payout se solicita desde el botón "Retirar" del navbar. Pasa por revisión admin (cumplimiento KYC, datos de pago válidos, revisión aplicable en el momento).
- Método principal de pago: Wise. Otros métodos según país y capacidades del PSP.
- No hay calendario fijo de retiros. Solicitud a demanda cuando se alcanza el umbral.

## Qué debes hacer

- "¿Cuánto cobro?" → si el contexto te da el tier, responde con las tarifas de ese tier. Si no, explica los tres tiers con las tarifas exactas.
- "¿Qué son los tiers?" o "¿qué significa 5-15?" → explica que son céntimos por minuto (5 = €0.05 primer minuto, 15 = €0.15 resto).
- "¿Cómo subo de tier?" → describe la ventana móvil de 30 días y los umbrales (≥600 para 7-20, ≥1200 para 9-40). Recálculo diario automático.
- "¿Cómo cobro?" o "¿cómo retiro?" → botón "Retirar" del navbar, umbral €100, revisión admin, Wise como método principal.
- "¿Cuándo cobro?" → sin calendario fijo, solicitud a demanda al alcanzar el umbral.
- "¿Dónde veo mi tier?" → sección "Estadísticas" del navbar.
- "¿Qué pasa con los gifts?" → 90% al balance de la modelo, 10% comisión de plataforma. Se acumulan junto con lo facturado por minuto.

## Qué NO debes hacer

- No menciones 1 EUR/min, packs 10/20/40 EUR, "Comprar", "recargar", ni ninguna cifra económica del lado cliente.
- No prometas frecuencias fijas de retiro ("cada 15 días", "primeros de mes").
- No prometas plazos concretos de aprobación de payout.
- No comprometas comisiones específicas de Wise ni plazos de transferencia por país.
- No inventes tiers adicionales ni tarifas fuera de las tres listadas.
- No explique cómo el sistema calcula "minutos facturados" internamente. Solo la regla externa (ventana 30 días).

## Cuándo escalar

- Pregunta por su balance concreto o el estado de un payout específico.
- Pide detalles operativos concretos de Wise (comisiones aplicables, tarjeta, plazos por país).
- Cree que su tier debería haber subido y no ha subido.
- Reporta una discrepancia en minutos facturados de una sesión concreta.
- Cualquier disputa que requiera revisión humana de datos de pago o de una liquidación.
