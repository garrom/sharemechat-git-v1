# Flujo de despliegue

## Flujo lógico de despliegue

El repositorio sugiere un proceso de despliegue por capas:

1. build de frontend por superficie
2. publicación del frontend estático en su superficie correspondiente
3. despliegue del backend Spring Boot
4. aplicación de configuración de entorno
5. validación de endpoints REST y WebSocket

## Dependencias operativas

- el frontend depende de la superficie seleccionada en build
- el backend depende de variables sensibles no versionadas
- el storage local requiere soporte de Nginx o capa equivalente
- MySQL y Redis forman parte del runtime efectivo

## Política documental

Este documento describe el flujo lógico de despliegue y sus dependencias, no los pasos sensibles ni el inventario exacto de infraestructura.

## Nota sobre AUDIT

El material previo mostraba una secuencia operativa detallada de construcción de AUDIT. Ese conocimiento se ha reducido aquí a hitos de proceso y se traslada el resto a documentación saneada por entorno y roadmap.
