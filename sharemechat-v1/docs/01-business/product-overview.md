# Visión del producto

SharemeChat es una plataforma de **adult dating intimate 1-a-1** entre adultos verificados, con dos superficies principales:

- producto orientado a usuarios finales
- backoffice orientado a operación interna

El producto opera bajo régimen MCC adult/streaming ([ADR-028](../06-decisions/adr-028-business-classification-adult-streaming.md)). Dentro de ese régimen, el posicionamiento concreto es adult dating intimate 1-a-1 (no cam adult broadcast multi-cliente), alineado con Mastercard AN 5196 y con comparables del vertical (CooMeet, LuckyCrush, Chatspin). Detalle del posicionamiento en [business-model.md](business-model.md).

El producto combina:

- registro y autenticación
- onboarding diferenciado para cliente y modelo, ambos con KYC obligatorio (un solo proveedor cubre los tres flujos: identidad de modelo, edad de cliente, fallback documental)
- matching aleatorio en tiempo real, 1-a-1 privado (no broadcast, no sala multi-cliente)
- mensajería y llamadas directas entre usuarios relacionados
- wallet interna y gifts
- favoritos y bloqueos
- consentimiento y age gate (zona pública SFW: solo descripción del servicio, sin contenido adult-themed)
- moderación visual real-time obligatoria sobre sesión privada, con kill switch para CSAM/gore/no-consentido y revisión humana asíncrona para casos borderline

El backoffice comparte backend y base de datos con producto, pero opera como superficie separada con control de acceso propio.

## Alcance funcional verificado

Según el código actual del repositorio, el sistema contiene piezas activas o claramente cableadas para:

- acceso público, login, recuperación y verificación de email
- dashboards para `USER`, `CLIENT`, `MODEL` y administración interna
- realtime por WebSocket en `/match` y `/messages`
- persistencia principal en MySQL
- estado operativo efímero en Redis
- uploads privados servidos por backend y almacenados en storage configurable
- trazabilidad de streams, mensajes y economía interna

## Estado funcional del producto

La base funcional es amplia y coherente, pero conviven subsistemas maduros con integraciones aún parciales. En especial, la integración PSP y parte del proveedor KYC muestran señales de transición o cableado incompleto en código (estrategia de PSP en [psp-strategy.md](psp-strategy.md)).
