# Sistema económico del modelo

Cómo cobra la modelo por su actividad en SharemeChat: sistema de tiers
por facturación, tarifas por minuto, reparto de gifts, y proceso de
payout con umbral, solicitud y método de pago. El registro y KYC del
modelo viven en la fila `onboarding-modelo`.

## Cómo funciona la remuneración

### Sistema de tiers

SharemeChat tiene tres tiers de modelo. Los nombres identifican
directamente la tarifa (en euros por minuto) que la modelo cobra
mientras está en ese tier.

| Tier | Tarifa 1er minuto | Tarifa resto minutos | Requisito (minutos facturados últimos 30 días) |
|---|---|---|---|
| **5-15** | €0.05 | €0.15 | 0 (tier inicial) |
| **7-20** | €0.07 | €0.20 | ≥ 600 |
| **9-40** | €0.09 | €0.40 | ≥ 1200 |

El primer minuto de cada sesión se factura con la tarifa reducida ("1er
minuto") y el resto de la sesión con la tarifa completa ("resto
minutos").

### Cambio de tier

El tier de la modelo se recalcula automáticamente cada día basándose
en los minutos facturados en la ventana móvil de los últimos 30 días.

Si la modelo alcanza el umbral del siguiente tier, sube automáticamente.
Si su ventana de 30 días desciende por debajo del umbral, puede bajar
al tier anterior.

La modelo ve su tier actual y su progreso hacia el siguiente en la
sección "Estadísticas" del dashboard, con progreso visual.

### Gifts (regalos)

Además del pago por minuto, los clientes pueden enviar regalos (gifts)
a la modelo durante o después de una sesión. Los gifts tienen precios
variados según el catálogo del chat.

Cuando la modelo recibe un gift, el 90% del valor se acumula a su
balance. El 10% restante lo retiene la plataforma como fee de servicio.

## Payout

### Umbral mínimo

**€100 acumulados** es el umbral mínimo para solicitar un retiro. La
modelo debe alcanzar ese saldo antes de poder pedir liquidación.

### Solicitud y aprobación

Cuando la modelo alcanza el umbral, puede solicitar retiro desde el
dashboard. La solicitud pasa por revisión del equipo de administración,
que valida:

- El cumplimiento de los requisitos de verificación.
- La validez de los datos de pago proporcionados.
- Cualquier revisión aplicable en ese momento.

Si todo está en orden, el retiro se aprueba y se procesa. Si algo no
cumple, se comunica a la modelo para que corrija.

### Método de pago

El método principal de pago es Wise (transferencia internacional
optimizada). Otros métodos pueden estar disponibles según el país de
la modelo y las capacidades del PSP en cada momento.

---

## Notas para el Agente IA (uso interno)

- Nombres de tier: los nombres "5-15", "7-20", "9-40" se corresponden
  con las tarifas de primer minuto y resto (5→€0.05 y 15→€0.15
  céntimos, etc.). Si una modelo pregunta el significado de los
  nombres, explicarlo así.

- Frecuencia de retiros: no está definida en el producto como
  calendario fijo. Solicitud a demanda cuando se alcanza el umbral.
  NO prometer "cada 15 días" ni "primeros del mes" a menos que
  próximas iteraciones lo confirmen.

- Método de pago (Wise): actualmente indicado como método principal
  pero sin confirmación operativa en la UI de retirada. Si una modelo
  pregunta detalles concretos (tarjeta que usa Wise, comisiones),
  indicar que el equipo de soporte puede aclarar caso por caso en el
  proceso de retirada.
