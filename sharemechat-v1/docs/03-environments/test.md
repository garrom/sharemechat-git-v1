# Entorno TEST

## Propósito

TEST actúa como entorno principal de trabajo y validación funcional del producto.

## Lo que está claramente soportado

- frontend de producto
- frontend de backoffice
- backend Spring Boot
- MySQL
- Redis
- realtime por `/match` y `/messages`
- assets legales externos
- uploads locales servidos por backend/Nginx

## Configuración versionada relevante

El código versionado apunta de forma explícita a dominios de test para:

- cookies de autenticación
- verificación de email
- reset de password
- callback KYC
- separación entre superficie de producto y admin

## Observaciones

- TEST es la principal fuente de verdad funcional del repositorio
- varias rutas y constantes frontend siguen acopladas a este entorno
- la documentación previa indicaba que la topología edge y buckets privados de frontend ya estaban operativos, pero ese detalle se ha saneado aquí
