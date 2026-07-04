# Onboarding del modelo

Cómo se registra una modelo en SharemeChat y cómo llega a estar activa
para atender sesiones: registro, aceptación del contrato, verificación
KYC, aprobación admin y subida de contenido al perfil. La operativa
económica (tiers, gifts, payout) vive en la fila `payout-y-tiers`.

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

- Motivos típicos de rechazo KYC: no están documentados. Si una
  modelo pregunta por qué le rechazan, sugerir verificar que la
  documentación sea válida, no expirada, legible, y que la selfie sea
  clara con buena iluminación.
