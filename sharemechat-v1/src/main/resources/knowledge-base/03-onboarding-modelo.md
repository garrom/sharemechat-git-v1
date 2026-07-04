# onboarding-modelo

## Ámbito

Se activa cuando la modelo pregunta sobre registro, aceptación del Model Contract, KYC modelo, aprobación admin, subida de fotos/videos al perfil, o suspensión/baneo de su cuenta.

## Rol

El usuario es MODEL. La información es del onboarding y ciclo de vida de la cuenta modelo. La operativa económica (tarifas, gifts, payout) vive en el caso payout-y-tiers.

## Hechos operativos

- Registro desde la landing con el rol "Regístrate como Modelo".
- Datos requeridos: nickname (apodo público), email, password (mínimo 8 caracteres), fecha de nacimiento (dd/mm/aaaa), checkbox "declaro ser mayor de edad", checkbox aceptación Terms + Privacy.
- La modelo SÍ da fecha de nacimiento en el formulario (a diferencia del cliente).
- No se pide país. El sistema detecta la ubicación y aplica restricciones geográficas.
- Tras enviar el formulario, la modelo recibe email con link de activación. Sin activar, no puede login.
- Al activar y entrar por primera vez, ve el onboarding con dos pasos obligatorios en orden.
- Paso 1: aceptación del Model Contract. Botón "Ver contrato (PDF)" descarga el documento, checkbox "He leído y acepto el contrato de modelo", botón final "ACEPTO EL CONTRATO". Sin este paso, el KYC queda inaccesible.
- Paso 2: KYC vía Didit. Flujo completo de identidad: documento oficial + selfie + análisis de liveness + face match. Más exigente que el KYC del cliente.
- Tras completar Didit, el estado pasa a PENDING y espera aprobación admin.
- Paso 3 (admin): revisión manual. Si aprobada, email confirmando activa. Si rechazada, email indicando resultado; puede reintentar corrigiendo lo necesario.
- Sin aprobación admin, la modelo no puede activar la cámara para sesiones ni subir contenido al perfil.
- Contenido del perfil (tras aprobación): hasta 5 fotos y hasta 2 videos. Cada asset pasa por revisión admin antes de publicarse.
- Sin guía visible al usuario sobre formatos aceptados o tamaño máximo de assets. Formatos estándar aceptados típicamente: JPG, PNG, MP4.
- Suspensión y baneo: el equipo de moderación puede aplicar WARNING, SUSPENDED o BANNED por violación de políticas (contenido prohibido, comportamiento hacia clientes, fraude). La modelo recibe email con motivo. Apelación disponible via soporte.

## Qué debes hacer

- "¿Cómo me registro como modelo?" → landing con rol "Regístrate como Modelo", formulario con fecha de nacimiento, email de activación con link.
- "¿Por qué no puedo activar la cámara?" → onboarding secuencial pendiente: aceptar Model Contract, completar KYC Didit, esperar aprobación admin.
- "¿Cuánto tarda la aprobación?" → sin plazo comprometido. Llega email cuando el estado cambia. Si supera 48h, escalar.
- "¿Qué formato pueden tener mis fotos y videos?" → formatos estándar como JPG, PNG o MP4. Sugerir subir la primera para ver si aparece error concreto.
- "¿Cuántos assets puedo subir?" → hasta 5 fotos y hasta 2 videos. Cada uno pasa revisión.
- "Me han suspendido, ¿qué hago?" → confirmar que existe proceso de apelación vía soporte; el equipo revisa con criterio distinto al que aplicó la sanción.

## Qué NO debes hacer

- No menciones tiers, tarifas por minuto, umbral €100, Wise, "retirar", primer minuto vs resto, gifts 90/10. Si preguntan por cobro o tarifas, indica que eso vive en el caso económico y pasa al ángulo pertinente.
- No menciones 1 EUR/min, packs, saldo, "Comprar", "recargar" (léxico cliente).
- No prometas plazo de aprobación del KYC.
- No especifiques tamaño máximo o formato exacto de assets como si estuviera documentado (no lo está).
- No prometas resultado favorable de apelación de suspensión.
- No especules sobre motivos concretos del rechazo de KYC de una modelo específica.

## Cuándo escalar

- KYC rechazado tras dos o más intentos con documentación correcta.
- Cuenta en estado PENDING más de 48 horas.
- Cuenta suspendida o baneada y la modelo quiere apelar.
- Assets rechazados de forma reiterada sin motivo claro.
- Modelo reporta un fallo específico en el flujo Didit con mensaje de error.
- Modelo reporta discrepancia entre la fecha de nacimiento del registro y la validada por Didit.
