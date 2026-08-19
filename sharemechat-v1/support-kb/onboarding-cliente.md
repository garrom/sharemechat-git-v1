---
case_key: onboarding-cliente
role: CLIENT
active: true
description: Alta de cliente: registro, verificacion de edad, primer login
---

# onboarding-cliente

## Ámbito

Se activa cuando el cliente pregunta sobre cómo registrarse, activar su cuenta por email, verificación de edad (KYC), primer login, o cerrar su cuenta.

## Rol

El usuario es CLIENT. La información es del onboarding cliente: sin fecha de nacimiento en el formulario, KYC = Age Estimation vía Didit, dashboard con acciones bloqueadas hasta KYC aprobado.

## Hechos operativos

- Registro desde el botón "Registrarse" de la landing pública.
- Datos requeridos: nickname, email, password (mínimo 8 caracteres), checkbox "declaro ser mayor de edad", checkbox aceptación Terms + Privacy.
- No se pide fecha de nacimiento en el formulario cliente. Se detecta en el KYC facial.
- No se pide país. El sistema detecta la ubicación automáticamente y aplica restricciones geográficas.
- Tras enviar el formulario, el cliente recibe email con link de activación. Sin activar, no puede login.
- Alternativa de alta/acceso: **Iniciar o registrarse con Google** (solo cliente; las modelos y los estudios no usan Google). Sirve tanto para registro como para login. La disponibilidad puede estar limitada mientras se completa el despliegue.
- Google NO verifica la edad: aunque entres con Google, el **KYC de edad (Didit) sigue siendo obligatorio** igual que con email/contraseña.
- Un usuario que entra solo con Google no tiene contraseña; puede añadir una desde su perfil para poder entrar también con email.
- Método de pago para packs: hoy pago en criptomoneda desde el propio flujo de compra (ver el caso de pagos y saldo).
- Primer login post-activación: entra al dashboard con acciones "activar cámara" y "comprar saldo" inhabilitadas hasta completar KYC.
- Hover sobre acción inhabilitada muestra indicación de que no está disponible todavía.
- KYC cliente = Age Estimation facial vía Didit, con fallback documental si es necesario.
- KYC se dispara cuando el cliente intenta activar la cámara o comprar saldo por primera vez. Aparece modal que redirige al flujo Didit.
- Aprobado: estado APPROVED, sin restricciones.
- Rechazado: cliente no puede activar cámara ni comprar saldo. Puede reintentar el flujo Didit.
- Cierre de cuenta: no self-service. Via soporte.

## Qué debes hacer

- "¿Cómo me registro?" → botón "Registrarse" de la landing (formulario con 4 datos y 2 checkboxes + email de activación), o bien "Registrarse con Google".
- "¿Puedo entrar con Google?" → sí (cuenta cliente), para registrarte o iniciar sesión; la verificación de edad Didit sigue siendo obligatoria igual.
- "Entré con Google, ¿tengo contraseña?" → no por defecto; puedes añadir una desde tu perfil para entrar también con email.
- "No puedo activar la cámara" → verifica que hayas completado el KYC vía Didit. Aparece modal al intentar activar cámara o comprar por primera vez.
- "No puedo comprar saldo" → mismo motivo típico: KYC pendiente o rechazado.
- "¿Por qué no me piden fecha de nacimiento?" → la verificación de edad se hace automáticamente en el flujo Didit; no requiere campo manual.
- "¿Cómo cierro mi cuenta?" → contactar soporte. No hay botón self-service; retenciones regulatorias pueden aplicar sobre KYC y transacciones.

## Qué NO debes hacer

- No menciones tiers, payout, umbral €100, Wise, "retirar", primer minuto vs resto, estadísticas modelo.
- No prometas botón self-service para cerrar cuenta.
- No comprometas plazo del email de activación.
- No digas que se paga con tarjeta hoy; el pago actual es en cripto desde el propio flujo de compra (detalle en pagos y saldo).
- No ofrezcas Google a modelos ni a estudios (Google es solo para clientes).
- No digas que Google verifica la edad: no lo hace; el KYC Didit sigue siendo obligatorio.
- No especifiques consecuencias exactas de un chargeback (viven en pagos-y-saldo).
- No confirmes ni niegues si un email concreto ya tiene cuenta abierta.

## Cuándo escalar

- Email de activación no llega tras verificar spam.
- KYC rechazado tras dos o más intentos con documentación correcta.
- Cliente pide cerrar cuenta.
- Cliente reporta un cargo o compra concreta que quiere revisar.
- Cliente admite tener otra cuenta abierta con el mismo email.
- Cuenta bloqueada por intentos fallidos que persiste tras unos minutos de espera.
