# Visión del producto

SharemeChat es una plataforma de videochat 1:1 con dos superficies principales:

- producto orientado a usuarios finales
- backoffice orientado a operación interna

El producto combina:

- registro y autenticación
- onboarding diferenciado para cliente y modelo
- matching aleatorio en tiempo real
- mensajería y llamadas directas entre usuarios relacionados
- wallet interna y gifts
- favoritos y bloqueos
- consentimiento y age gate
- onboarding documental y KYC de modelos

El backoffice comparte backend y base de datos con producto, pero opera como superficie separada con control de acceso propio.

## Alcance funcional verificado

Según el código actual del repositorio, el sistema contiene piezas activas o claramente cableadas para:

- acceso público, login, recuperación y verificación de email
- dashboards para `USER`, `CLIENT`, `MODEL` y administración interna
- realtime por WebSocket en `/match` y `/messages`
- persistencia principal en MySQL
- estado operativo efímero en Redis
- uploads locales servidos por Nginx
- trazabilidad de streams, mensajes y economía interna

## Estado funcional del producto

La base funcional es amplia y coherente, pero conviven subsistemas maduros con integraciones aún parciales. En especial, la capa de PSP y parte del proveedor KYC muestran señales de transición o cableado incompleto.
