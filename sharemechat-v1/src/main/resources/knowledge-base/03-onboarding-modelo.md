# Onboarding del modelo

## Registro

El registro se realiza desde el formulario público con las siguientes
opciones seleccionando el rol "Regístrate como Modelo".

Datos requeridos:
- Nickname (apodo público con el que se te conocerá en la plataforma).
- Email.
- Password (mínimo 8 caracteres).
- Fecha de nacimiento (dd/mm/aaaa).
- Declaración de mayoría de edad (checkbox).
- Aceptación de Términos y Condiciones + Política de Privacidad
  (checkbox obligatorio).

No se solicita país. El sistema detecta la ubicación del usuario
automáticamente y aplica las restricciones geográficas que
correspondan.

Tras enviar el formulario, la modelo recibe un email con un link de
activación. Debe hacer clic en el link para activar la cuenta.

## Onboarding secuencial

Cuando la modelo activa la cuenta y entra por primera vez al dashboard,
ve el flujo de onboarding con dos pasos obligatorios en orden:

### Paso 1: Aceptación del Model Contract

El primer paso es leer y aceptar el Model Collaboration Agreement
(contrato legal en PDF).

Se presenta un botón "Ver contrato (PDF)" que descarga el documento,
un checkbox "He leído y acepto el contrato de modelo", y un botón
final "ACEPTO EL CONTRATO".

Sin aceptar el contrato, el paso 2 (KYC) queda inaccesible.

### Paso 2: Verificación KYC (Didit)

Tras aceptar el contrato, la modelo pasa por el flujo de Didit,
especialista third-party en verificación de identidad.

El flujo incluye documento de identidad oficial, selfie, análisis de
liveness y face match. Es el flujo completo de identidad (más
exigente que el flujo del cliente).

Tras completar Didit, el estado de verificación pasa a "PENDIENTE"
y queda a la espera de aprobación por parte del equipo de administración.

### Paso 3: Aprobación del equipo admin

El equipo revisa la verificación KYC de la modelo lo antes posible.

Si es aprobada, la modelo recibe una notificación por email confirmando
que su cuenta está activa como modelo. A partir de ese momento puede
usar la plataforma, activar la cámara para sesiones y subir contenido
al perfil.

Si es rechazada, la modelo recibe una notificación por email indicando
el resultado. Puede volver a intentar el proceso corrigiendo lo que
sea necesario.

## Contenido del perfil (assets)

Una vez aprobada, la modelo puede subir contenido al perfil:

- **Hasta 5 fotos**.
- **Hasta 2 videos**.

Cada asset subido pasa por revisión del equipo de administración antes
de ser publicado en el perfil visible.

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

## Suspensión y baneo

El equipo de moderación puede aplicar advertencia, suspensión temporal,
o baneo permanente a una cuenta modelo si detecta violación de las
políticas del producto (contenido prohibido, comportamiento hacia
clientes, fraude, etc.).

La modelo recibe notificación por email cuando se aplica una acción
sobre su cuenta.

Si la modelo considera que la acción es injusta, puede iniciar el
proceso de apelación desde el canal de soporte (véase Complaints y
Appeals Policies).

---

## Notas para el Agente IA (uso interno)

- Fecha de nacimiento: se pide en el formulario de registro modelo
  pero NO en el de cliente. Si un cliente pregunta por qué no le pide
  fecha de nacimiento, responder que la verificación de edad se hace
  automáticamente vía Didit en el momento adecuado y no requiere
  campo manual.

- Tamaño y formato de assets (fotos/videos): actualmente no hay guía
  visible al usuario sobre formatos aceptados o tamaño máximo. Si una
  modelo pregunta requisitos técnicos, indicar que la plataforma
  acepta formatos estándar (JPG, PNG, MP4) y sugerir subir la primera
  vez para ver si aparece error concreto. Confirmar que el equipo
  está trabajando en una guía clara.

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

- Motivos típicos de rechazo KYC: no están documentados. Si una
  modelo pregunta por qué le rechazan, sugerir verificar que la
  documentación sea válida, no expirada, legible, y que la selfie sea
  clara con buena iluminación.
