# Onboarding del cliente

## Registro

El registro se realiza desde el formulario público en el botón
"Registrarse" de la landing.

Datos requeridos:
- Nickname.
- Email.
- Password (mínimo 8 caracteres).
- Declaración de mayoría de edad (checkbox).
- Aceptación de Términos y Condiciones + Política de Privacidad
  (checkbox obligatorio).

No se solicita país en el formulario. El sistema detecta la ubicación
del usuario automáticamente para aplicar las restricciones geográficas
que correspondan.

Tras enviar el formulario, el usuario recibe un email con un link de
activación. Debe hacer clic en el link para activar la cuenta y poder
iniciar sesión.

## Estado tras primer login

Cuando el cliente accede por primera vez tras activar la cuenta, entra
al dashboard con acceso limitado. Ve la interfaz completa, pero las
funcionalidades principales (activar cámara, comprar saldo) están
inhabilitadas hasta que complete la verificación de edad.

Al pasar el ratón sobre las funciones inhabilitadas, aparece una
indicación de que no están disponibles todavía.

## Verificación de edad (Didit)

La verificación de edad se activa cuando el cliente intenta hacer una
acción que la requiere: activar la cámara para una sesión, o comprar
saldo por primera vez.

En ese momento aparece un modal que redirige al flujo de Didit,
especialista third-party en verificación de identidad.

El flujo del cliente es age estimation facial con fallback documental
si es necesario, para confirmar mayoría de edad. Tras la verificación,
el estado del cliente pasa a APPROVED y ya puede usar el producto sin
restricciones.

Si la verificación no es aprobada, el cliente no puede iniciar sesiones
de video ni recargar saldo. Puede volver a intentar el flujo Didit.

## Recarga de saldo

Los packs de recarga disponibles son:

- **10 EUR**
- **20 EUR**
- **40 EUR**

El sistema no permite compra de minutos sueltos ni cantidades libres:
solo los tres packs cerrados.

El saldo comprado no vence mientras la cuenta esté activa.

Método de pago: el cliente puede completar la compra desde el flujo
del producto. En caso de duda sobre métodos concretos disponibles en
un momento dado, el cliente puede consultarlo desde su cuenta.

## Consumo de saldo

La tarifa para el cliente es siempre **1 EUR por minuto de videochat**,
independientemente de la modelo con la que se conecte. El precio no
cambia por tier de modelo, país, hora, ni ninguna otra variable.

El descuento se aplica en tiempo real durante la sesión. El sistema
está diseñado para que el saldo no pueda quedar en negativo: si el
saldo llega a cero durante una sesión activa, la sesión se corta
automáticamente.

Recomendación al cliente: mantener saldo suficiente antes de iniciar
sesiones largas para evitar cortes inesperados.

## Reembolsos (refunds)

SharemeChat contempla proceso de reembolso caso por caso.

Si el cliente considera que ha habido un problema con un cargo o una
sesión concreta (por ejemplo, un fallo técnico que impidió el servicio,
o un cargo que no reconoce), puede contactar con soporte explicando el
caso.

El equipo revisa la petición y aplica el reembolso si procede. La
decisión final es del equipo de administración.

Los reembolsos legítimos se procesan a través del mismo método de pago
del cargo original.

## Chargebacks

SharemeChat toma en serio los chargebacks (disputas iniciadas por el
cliente ante su banco emisor de tarjeta) porque son señal de problema.

Si tienes un problema con un cargo, la vía recomendada es siempre
contactar antes con soporte. Un chargeback directo puede resultar en
acciones adicionales sobre la cuenta.

## Cerrar sesión y cerrar cuenta

Cerrar sesión: opción disponible desde el navbar (botón "Salir").

Cerrar cuenta: el equipo de soporte puede procesar la baja completa
si el usuario lo solicita. Contactar con soporte para iniciar el
proceso.

---

## Notas para el Agente IA (uso interno)

- Método de pago exacto (Segpay integración): actualmente hay un flujo
  mockeado en desarrollo. Si un cliente pregunta detalles concretos de
  método de pago, indicar que la información completa se muestra en el
  proceso de compra desde el propio producto.

- Aviso de saldo bajo: actualmente el sistema NO avisa al cliente
  cuando el saldo está a punto de agotarse durante una sesión. Es una
  limitación conocida. Si un cliente reporta que se cortó su sesión
  por saldo agotado sin aviso, empatizar y confirmar que el equipo
  está trabajando en mejorar la experiencia. NO prometer fecha
  concreta.

- Refresco del contador durante streaming: actualmente el saldo no se
  actualiza visualmente en tiempo real durante la sesión de video. Es
  otra limitación conocida. Si preguntan, indicar que el descuento
  ocurre correctamente aunque no se refleje en pantalla, y que se puede
  verificar en el dashboard tras la sesión.

- Chargebacks: la política de blacklist tras chargeback está declarada
  pero no confirmada como automática. Si un cliente pregunta
  específicamente sobre consecuencias de un chargeback, NO prometer
  automatismo. Referir al equipo de soporte para casos concretos.

- Cerrar cuenta: no existe todavía endpoint de auto-eliminación en el
  producto. La baja se procesa manualmente por soporte. Si un cliente
  pregunta cómo cerrar cuenta desde el producto, indicar que la vía
  actual es contactar con soporte y no prometer botón self-service.
