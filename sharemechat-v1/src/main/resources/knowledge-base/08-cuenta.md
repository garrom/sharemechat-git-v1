# cuenta

## Ámbito

Se activa cuando el usuario pregunta sobre login, olvidé/cambiar contraseña, cambio de email, cerrar sesión, cerrar cuenta, suspensión/baneo desde la perspectiva del acceso, KYC pendiente o rechazado, o cambio de rol.

## Rol

El usuario puede ser CLIENT o MODEL. Casi todo aplica igual a ambos. Únicos matices: el KYC del modelo es el flujo completo Didit (documento + selfie + liveness + face match), el del cliente es Age Estimation con fallback documental; el cambio de rol requiere cerrar cuenta y crear una nueva en cualquier dirección.

## Hechos operativos

- Login: email + password desde el formulario público.
- Recuperación de contraseña: link "¿Olvidaste tu contraseña?" en el formulario de login. Pide email de registro. Envía email con enlace de reset de vida limitada por seguridad.
- Cambio de contraseña estando autenticado: avatar del navbar → sección perfil → botón "Cambiar contraseña" (ruta /change-password). Requiere contraseña actual + nueva x2.
- Cambio de email: NO self-service. Se hace via soporte con verificación adicional de identidad.
- Cerrar sesión: botón "Salir" del navbar.
- Cierre de cuenta: NO self-service. Via soporte. Retenciones regulatorias pueden aplicar (KYC ≥5 años, transacciones ≥7 años). Tras el cierre no se puede acceder ni recuperar contenido.
- Suspensión temporal (SUSPENDED): cuenta bloqueada durante un periodo. Login imposible mientras dure. Se recibe email con motivo.
- Baneo permanente (BANNED): bloqueo indefinido. No se puede volver a acceder ni registrarse con la misma identidad. Email con motivo.
- Apelación: via soporte. El equipo revisa con criterio distinto al que aplicó la sanción. Si acepta, se revierte.
- KYC pendiente o rechazado: reintento posible desde el dashboard. Consejos: documento válido no expirado y legible, selfie con buena iluminación y cara clara y visible, fondo neutro, cámara estable.
- Cambio de rol (cliente ↔ modelo): no hay migración self-service. La vía recomendada es cerrar la cuenta actual y crear una nueva con el rol correcto.
- Cuenta duplicada: cada persona debe tener una única cuenta. Cuentas duplicadas pueden violar Terms.

## Qué debes hacer

- "¿Cómo cambio mi contraseña?" → avatar del navbar, perfil, botón "Cambiar contraseña". Requiere contraseña actual + nueva por duplicado.
- "Olvidé mi contraseña" → link "¿Olvidaste tu contraseña?" en el formulario de login. Self-service completo con enlace en email.
- "¿Cómo cambio mi email?" → via soporte, no self-service. Proceso con verificación adicional.
- "¿Cómo cierro mi cuenta?" → via soporte. Explicar que hay periodos de retención regulatorios que impiden borrado inmediato de ciertos datos.
- "Me han suspendido / baneado" → confirmar que existe proceso de apelación via soporte y que el equipo revisa con criterio distinto.
- "Mi KYC fue rechazado" → reintento desde el dashboard con consejos: documento válido no expirado y legible, selfie con luz y cara clara, fondo neutro, cámara estable. Escalar si persiste tras >2 intentos.
- "¿Puedo cambiar de rol de cliente a modelo?" → No hay migración automática. La vía recomendada es cerrar la cuenta actual y crear una nueva con el rol correcto.
- "No puedo acceder tras varios intentos fallidos" → esperar unos minutos y reintentar. Si persiste, escalar.

## Qué NO debes hacer

- No hagas reset de contraseña por chat ni pidas la contraseña vieja al usuario aquí.
- No inventes flujo self-service para cambiar email ni para cerrar cuenta.
- No prometas migración automática entre roles.
- No prometas plazo concreto de respuesta del equipo humano en casos vía soporte.
- No confirmes ni niegues si un email concreto ya tiene cuenta abierta (filtración de existencia de cuenta).
- No especules sobre por qué una cuenta específica fue suspendida o baneada.

## Cuándo escalar

- Cambio de email de cuenta activa.
- Cierre de cuenta.
- Apelación de cuenta suspendida o baneada.
- KYC rechazado tras >2 reintentos con documentación correcta.
- Solicitud de migración entre roles.
- Cuenta bloqueada por intentos fallidos que persiste tras unos minutos.
- Usuario admite tener otra cuenta abierta o intenta abrir una nueva similar.
- Sospecha de compromiso de cuenta (accesos no reconocidos, cambios que el usuario no hizo).
