# Moderación y seguridad

## Verificación previa: KYC obligatorio

Antes de que cualquier interacción pueda ocurrir en la plataforma, 
ambas partes deben verificarse:

- **Modelos**: verificación completa de identidad y edad vía Didit 
  (documento oficial + selfie + liveness + face match).
- **Clientes**: verificación de edad vía Didit (age estimation facial 
  con fallback documental si es necesario).

Sin verificación completa no se puede iniciar videochat ni comprar 
saldo.

## Moderación visual en tiempo real

Durante toda sesión de videochat 1-a-1, el sistema analiza 
automáticamente el contenido en tiempo real mediante Sightengine, 
especialista en moderación de contenido visual.

El sistema tiene dos niveles de acción:

### Categorías críticas: corte automático inmediato

Si el sistema detecta contenido de tolerancia cero, la sesión se corta 
automáticamente sin previa notificación. Esto aplica a:

- Contenido que sugiera presencia de menores de edad.
- Contenido con gore, violencia extrema o autolesiones.

En estos casos, el sistema no da segunda oportunidad: es corte 
inmediato + registro para revisión inmediata del equipo de moderación.

### Categorías con revisión humana

Para el resto de categorías (nudity, contenido sensible ambiguo), el 
sistema aplica la política operativa configurada por SharemeChat. 
Contenido dentro del marco legal aplicable entre adultos verificados 
consensualmente no genera bloqueo automático.

Cuando el sistema detecta contenido ambiguo, se genera evidencia que 
el equipo de moderación revisa manualmente. Si se detecta violación, 
se aplican acciones sobre la cuenta responsable.

## Reportes entre usuarios

Cualquier usuario puede reportar a otro usuario si detecta 
comportamiento inadecuado durante una sesión o en el chat de favoritos.

Las categorías de reporte disponibles son:

- **ABUSE** (abuso)
- **HARASSMENT** (acoso)
- **FRAUD** (fraude)
- **MINOR** (menor de edad aparente)
- **OTHER** (otro)

Los reportes se envían al equipo de moderación de SharemeChat. El 
equipo revisa cada reporte y aplica las acciones que correspondan 
según las políticas del producto (advertencia, suspensión temporal, 
o baneo permanente).

Si el reporte se rechaza por falta de evidencia suficiente, SharemeChat 
comunica al reportante que no se ha encontrado evidencia y le anima a 
volver a reportar si vuelven a ocurrir situaciones similares.

## Canal público de denuncias

Adicionalmente a los reportes internos, SharemeChat mantiene un canal 
público de denuncias accesible en /complaint desde cualquier navegador, 
incluso sin cuenta.

El canal público está pensado para:

- Terceras personas que quieran denunciar contenido o comportamiento 
  visto en la plataforma.
- Situaciones graves que requieran registro formal.
- Denuncias que la persona afectada quiera reportar sin abrir sesión.

Categorías del canal público:

- CSAM (contenido de abuso sexual infantil).
- Contenido no consentido.
- Menor en riesgo.
- Símbolos de odio.
- Copyright.
- Ilegal.
- Acoso.
- Suplantación.
- Fraude.
- Otro.

**Compromiso de resolución**: 5 días hábiles desde la recepción, con 
acuse de recibo automático al denunciante si proporcionó email.

Contacto directo del equipo de Trust & Safety: safety@sharemechat.com

## Acciones sobre la cuenta

Cuando el equipo de moderación detecta violación de políticas, puede 
aplicar:

- **Advertencia** (WARNING): notificación al usuario sin restricciones 
  técnicas. Registrada para reincidencias.
- **Suspensión temporal** (SUSPENDED): la cuenta queda bloqueada 
  durante un periodo. El usuario no puede login mientras esté 
  suspendido.
- **Baneo permanente** (BANNED): la cuenta queda bloqueada de forma 
  indefinida. El usuario no puede volver a acceder ni registrarse 
  nuevamente con misma identidad.

En todos los casos el usuario recibe notificación por email cuando se 
aplica una acción sobre su cuenta, explicando el motivo.

## Apelaciones

Si el usuario considera que una acción sobre su cuenta es injusta o 
resultado de un error, puede iniciar proceso de apelación contactando 
con soporte y presentando su caso.

El equipo revisa la apelación con criterio distinto al que aplicó la 
sanción original. Si la apelación se acepta, la acción se revierte.

## Bloqueo entre usuarios

Un usuario puede bloquear a otro en cualquier momento desde la lista 
de favoritos o durante videochat.

Efectos del bloqueo:

- El usuario bloqueado no puede iniciar nueva comunicación con quien 
  le bloqueó (ni chat, ni videochat 1-a-1, ni matching random).
- Simétrico: quien bloqueó tampoco puede contactar al bloqueado.
- Persiste hasta que la parte que bloqueó decida desbloquear 
  voluntariamente.

## Seguridad de la cuenta

- **Password**: mínimo 8 caracteres al registro.
- **Recuperación**: proceso self-service disponible desde el formulario 
  de login.
- **Cambio de password**: disponible desde la sección de perfil.
- **Cambio de email**: contactar con soporte (no self-service).

## Privacidad durante sesiones

Las sesiones de videochat son privadas y ephemerales:

- No hay grabación de sesiones.
- No hay broadcast público.
- No hay terceros observando la conversación (solo cliente + modelo).

La moderación en tiempo real analiza el contenido pero no crea copia 
persistente del video de la sesión: solo captura frames muestreados 
para análisis puntual, que se almacenan como evidencia únicamente si 
disparan revisión.

---

## Notas para el Agente IA (uso interno)

- **Corte automático sin aviso previo**: si un usuario reporta que su 
  sesión se cortó sin previo aviso, primero descartar problema técnico 
  (conexión, cámara). Si el usuario insiste que fue el sistema, 
  empatizar sin acusar. Registrar el caso para que el equipo revise 
  el corte específico. NO revelar detalles técnicos de umbrales de 
  moderación.

- **Detección de menores**: si un usuario reporta que ha visto un 
  menor en la plataforma o que él/ella mismo/a es menor, ESCALAR 
  INMEDIATAMENTE al equipo. Categoría crítica.

- **Diferencia reportar (interno) vs denuncia pública**: los reportes 
  entre usuarios (categorías ABUSE/HARASSMENT/etc.) son para incidentes 
  P2P dentro del producto. Las denuncias públicas (/complaint) son 
  para casos graves o terceros externos. Guiar al usuario al canal 
  correcto según su situación. Si un usuario logueado tiene una queja 
  interna, sugerir el flujo interno. Si es CSAM o incidente grave, 
  sugerir el canal público para trazabilidad formal.

- **Apelaciones**: no prometer resultado. Solo confirmar que se puede 
  apelar y que el equipo revisa con criterio distinto. Empatizar sin 
  crear expectativa.

- **Cambio de email**: no self-service todavía. Solo por soporte. Si 
  un usuario insiste en cambiarlo, escalar a humano.

- **Recuperación password**: proceso self-service disponible. Guiar 
  al usuario al link "¿Olvidaste tu contraseña?" en el formulario de 
  login.

- **Preguntas sobre moderación en el chat 1-a-1**: si un usuario 
  pregunta si el sistema "ve" lo que hace en la sesión, ser honesto: 
  sí, hay análisis automático de contenido para detectar situaciones 
  ilegales. No hay grabación permanente. Los frames analizados no se 
  guardan salvo que disparen revisión.
