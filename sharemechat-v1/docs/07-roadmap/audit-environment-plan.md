# Plan del entorno AUDIT

## Objetivo

Consolidar AUDIT como entorno aislado, utilizable para validación técnica, control interno y preparación de revisiones externas.

## Principios

- replicar topología lógica de TEST
- evitar datos operativos históricos
- mantener catálogos y configuración mínima necesaria
- validar frontend, backend, realtime y backoffice end-to-end

## Estado absorbido del material previo

- profile de aplicación propio
- base de datos separada y saneada
- superficie pública, admin y assets dedicados a nivel lógico

## Pendientes de alto nivel

- confirmar paridad funcional real con TEST
- revisar fallback SPA del frontend público
- revisar allowed origins y configuración realtime
- completar la integracion efectiva del TURN minimo ya desplegado en el backend AUDIT activo y su validacion WebRTC cross-network
- ejecutar validaciones funcionales completas
